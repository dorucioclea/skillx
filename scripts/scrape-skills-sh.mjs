#!/usr/bin/env node

/**
 * Scrape skills from skills.sh (via NeverSight/skills_feed) and seed into SkillX database.
 *
 * Data source: https://github.com/NeverSight/skills_feed — daily-updated index of 27K+ skills
 * with install counts and pre-extracted descriptions from SKILL.md files.
 *
 * Usage:
 *   node scripts/scrape-skills-sh.mjs                    # Full pipeline: scrape + seed (auto-resumes)
 *   node scripts/scrape-skills-sh.mjs --fresh             # Force fresh scrape (ignore existing data)
 *   node scripts/scrape-skills-sh.mjs --scrape-only       # Only scrape, write scraped-skills.json
 *   node scripts/scrape-skills-sh.mjs --seed-only         # Only seed from existing scraped-skills.json
 *   node scripts/scrape-skills-sh.mjs --batch-size 5      # Custom batch size (default: 10)
 *
 * Env vars:
 *   ADMIN_SECRET  (required for seeding)
 *   API_URL       (default: http://localhost:5173)
 *   GITHUB_TOKEN  (optional, unused — kept for backward compat)
 */

import { readFile, writeFile, access } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Config ---
const API_URL = process.env.API_URL || "http://localhost:5173";
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SCRAPED_FILE = join(__dirname, "scraped-skills.json");
const PROGRESS_FILE = join(__dirname, "scrape-progress.json");

const FEED_INDEX_URL =
  "https://raw.githubusercontent.com/NeverSight/skills_feed/main/data/skills_index.json";
const FEED_DESC_BASE =
  "https://raw.githubusercontent.com/NeverSight/skills_feed/main/";

// --- CLI Args ---
const args = process.argv.slice(2);
const scrapeOnly = args.includes("--scrape-only");
const seedOnly = args.includes("--seed-only");
const fresh = args.includes("--fresh");
const batchSizeIdx = args.indexOf("--batch-size");
const BATCH_SIZE =
  batchSizeIdx !== -1 ? parseInt(args[batchSizeIdx + 1], 10) : 10;

// ============================================================
// SCRAPING — NeverSight/skills_feed
// ============================================================

/**
 * Fetch the skills index from NeverSight/skills_feed.
 * Returns array of { id, source, skillId, title, installsAllTime, description, skillMdPath }.
 */
async function fetchSkillsIndex() {
  console.log("📡 Fetching skills index from NeverSight/skills_feed...");
  const res = await fetch(FEED_INDEX_URL);
  if (!res.ok) throw new Error(`skills_feed index returned HTTP ${res.status}`);

  const data = await res.json();
  console.log(`   Index updated: ${data.updatedAt}`);
  console.log(`   Total skills in index: ${data.count}`);
  return data.items;
}

/**
 * Fetch pre-extracted description from NeverSight/skills_feed.
 */
async function fetchDescription(descPath) {
  if (!descPath) return null;
  try {
    const res = await fetch(`${FEED_DESC_BASE}${descPath}`);
    if (res.ok) {
      const text = await res.text();
      return text.trim().slice(0, 500);
    }
  } catch {
    // Silently fail — will use fallback description
  }
  return null;
}

/**
 * Fetch cached SKILL.md content from NeverSight/skills_feed repo.
 * Falls back to null if not available.
 */
async function fetchSkillMdContent(skillMdPath) {
  if (!skillMdPath) return null;
  try {
    const res = await fetch(`${FEED_DESC_BASE}${skillMdPath}`);
    if (res.ok) return await res.text();
  } catch {
    // Silently fail
  }
  return null;
}

/**
 * Transform a feed item into SkillX schema.
 */
function transformFeedItem(item, description, content) {
  const [owner] = item.source.includes("/")
    ? item.source.split("/", 2)
    : [item.source, item.source];

  return {
    name: item.title || item.skillId,
    slug: item.skillId,
    description:
      description || `${item.title || item.skillId} — AI agent skill from ${owner}`,
    content: content || `# ${item.title || item.skillId}\n\nSkill by ${owner}.`,
    author: owner,
    source_url: `https://github.com/${item.source}`,
    category: "implementation",
    install_command: `npx skills add ${item.source} --skill ${item.skillId}`,
    version: "1.0.0",
    is_paid: false,
    price_cents: 0,
    install_count: item.installsAllTime || 0,
    avg_rating: 0,
    rating_count: 0,
  };
}

/**
 * Load existing scraped skills as a Map keyed by slug for resume.
 */
async function loadExistingScraped() {
  try {
    await access(SCRAPED_FILE);
    const data = await readFile(SCRAPED_FILE, "utf-8");
    const skills = JSON.parse(data);
    const map = new Map();
    for (const s of skills) map.set(s.slug, s);
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Enrich a single feed item: fetch description + SKILL.md from NeverSight cache.
 */
async function enrichFeedItem(item) {
  const [description, content] = await Promise.all([
    fetchDescription(item.description),
    fetchSkillMdContent(item.skillMdPath),
  ]);
  return { item, description, content, enriched: !!(description || content) };
}

/**
 * Scrape all skills from NeverSight feed + fetch descriptions and SKILL.md content.
 * Uses concurrent requests (all from NeverSight cache, no GitHub rate limits).
 * Saves incrementally to scraped-skills.json so interrupted runs can resume.
 */
async function scrapeAll() {
  const feedItems = await fetchSkillsIndex();

  if (feedItems.length === 0) {
    console.error("❌ No skills found in feed. Feed structure may have changed.");
    process.exit(1);
  }

  // Load existing scraped data for resume
  const existing = fresh ? new Map() : await loadExistingScraped();
  const resuming = existing.size > 0;
  if (resuming) {
    console.log(`   Resuming — ${existing.size} skills already scraped`);
  }

  const skills = [];
  let enriched = 0;
  let fallback = 0;
  let reused = 0;
  const CONCURRENCY = 20;

  // Separate reused vs new items
  const toFetch = [];
  for (const item of feedItems) {
    if (existing.has(item.skillId)) {
      skills.push(existing.get(item.skillId));
      reused++;
    } else {
      toFetch.push(item);
    }
  }

  if (reused > 0) {
    console.log(`   Reused ${reused} existing skills, fetching ${toFetch.length} new`);
  }

  // Process new items in concurrent batches
  for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
    const batch = toFetch.slice(i, i + CONCURRENCY);
    process.stdout.write(
      `\r   Enriching: ${reused + i + batch.length}/${feedItems.length}                              `
    );

    const results = await Promise.all(batch.map(enrichFeedItem));

    for (const { item, description, content, enriched: isEnriched } of results) {
      if (isEnriched) enriched++;
      else fallback++;
      skills.push(transformFeedItem(item, description, content));
    }

    // Save incrementally every 200 skills
    if (i % 200 === 0 && i > 0) {
      await writeFile(SCRAPED_FILE, JSON.stringify(skills, null, 2));
    }

    // Brief pause between concurrent batches to avoid hammering
    await sleep(100);
  }

  console.log(
    `\n✅ Scraped ${skills.length} skills (${enriched} enriched, ${fallback} fallback${reused ? `, ${reused} reused` : ""})`
  );

  await writeFile(SCRAPED_FILE, JSON.stringify(skills, null, 2));
  console.log(`   Written to ${SCRAPED_FILE}`);

  return skills;
}

// ============================================================
// SEEDING WITH PROGRESS TRACKING
// ============================================================

/**
 * Load progress file or initialize empty state.
 */
async function loadProgress() {
  try {
    await access(PROGRESS_FILE);
    const data = await readFile(PROGRESS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {
      last_updated: new Date().toISOString(),
      total_scraped: 0,
      stats: { completed: 0, failed: 0, pending: 0 },
      skills: {},
    };
  }
}

/**
 * Save progress file.
 */
async function saveProgress(progress) {
  progress.last_updated = new Date().toISOString();
  progress.stats = {
    completed: Object.values(progress.skills).filter(
      (s) => s.status === "completed"
    ).length,
    failed: Object.values(progress.skills).filter(
      (s) => s.status === "failed"
    ).length,
    pending: Object.values(progress.skills).filter(
      (s) => s.status === "pending"
    ).length,
  };
  await writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Seed skills to the API in batches with progress tracking.
 */
async function seedBatches(skills) {
  if (!ADMIN_SECRET) {
    console.error("❌ ADMIN_SECRET env var is required for seeding");
    console.error("   Usage: ADMIN_SECRET=xxx node scripts/scrape-skills-sh.mjs");
    process.exit(1);
  }

  const progress = await loadProgress();
  progress.total_scraped = skills.length;

  // Initialize pending skills not yet tracked
  for (const skill of skills) {
    if (!progress.skills[skill.slug]) {
      progress.skills[skill.slug] = { status: "pending" };
    }
  }
  await saveProgress(progress);

  // Filter to only pending + failed (with < 3 attempts)
  const toSeed = skills.filter((s) => {
    const p = progress.skills[s.slug];
    if (!p) return true;
    if (p.status === "completed") return false;
    if (p.status === "failed" && (p.attempts || 0) >= 3) return false;
    return true;
  });

  if (toSeed.length === 0) {
    console.log("✅ All skills already seeded!");
    printSummary(progress);
    return;
  }

  console.log(
    `\n🌱 Seeding ${toSeed.length} skills in batches of ${BATCH_SIZE} to ${API_URL}/api/admin/seed...\n`
  );

  let batchNum = 0;
  for (let i = 0; i < toSeed.length; i += BATCH_SIZE) {
    batchNum++;
    const batch = toSeed.slice(i, i + BATCH_SIZE);
    const slugs = batch.map((s) => s.slug);

    process.stdout.write(
      `   Batch ${batchNum} (${i + 1}-${Math.min(i + BATCH_SIZE, toSeed.length)}/${toSeed.length}): `
    );

    try {
      const res = await fetch(`${API_URL}/api/admin/seed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Secret": ADMIN_SECRET,
        },
        body: JSON.stringify(batch),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status}: ${errText}`);
      }

      const result = await res.json();
      console.log(`✅ ${result.skills} skills, ${result.vectors} vectors`);

      // Mark batch as completed
      for (const slug of slugs) {
        progress.skills[slug] = {
          status: "completed",
          seeded_at: new Date().toISOString(),
        };
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.log(`❌ ${errMsg}`);

      // Mark batch as failed
      for (const slug of slugs) {
        const existing = progress.skills[slug] || {};
        progress.skills[slug] = {
          status: "failed",
          error: errMsg,
          attempts: (existing.attempts || 0) + 1,
        };
      }
    }

    // Save progress after each batch
    await saveProgress(progress);

    // Brief pause between batches
    if (i + BATCH_SIZE < toSeed.length) {
      await sleep(1000);
    }
  }

  printSummary(progress);
}

function printSummary(progress) {
  console.log("\n📊 Summary:");
  console.log(`   Total: ${progress.total_scraped}`);
  console.log(`   Completed: ${progress.stats.completed}`);
  console.log(`   Failed: ${progress.stats.failed}`);
  console.log(`   Pending: ${progress.stats.pending}`);

  // List failed skills (max 20)
  const failed = Object.entries(progress.skills).filter(
    ([, s]) => s.status === "failed"
  );
  if (failed.length > 0) {
    console.log(`\n   Failed skills (${failed.length}):`);
    for (const [slug, info] of failed.slice(0, 20)) {
      console.log(`     - ${slug}: ${info.error} (attempts: ${info.attempts})`);
    }
    if (failed.length > 20) {
      console.log(`     ... and ${failed.length - 20} more`);
    }
  }
}

// ============================================================
// HELPERS
// ============================================================

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("🔧 SkillX Scraper — skills.sh → SkillX DB\n");

  let skills;

  if (seedOnly) {
    // Load from existing scraped file without re-scraping
    try {
      const data = await readFile(SCRAPED_FILE, "utf-8");
      skills = JSON.parse(data);
      console.log(`📂 Loaded ${skills.length} skills from ${SCRAPED_FILE}`);
    } catch {
      console.error(`❌ Cannot read ${SCRAPED_FILE}. Run without --seed-only first.`);
      process.exit(1);
    }
  } else {
    // Scrape (auto-resumes from scraped-skills.json unless --fresh)
    skills = await scrapeAll();
  }

  if (!scrapeOnly) {
    await seedBatches(skills);
  }

  console.log("\n🏁 Done!");
}

main().catch((err) => {
  console.error("\n💥 Fatal error:", err.message || err);
  process.exit(1);
});
