#!/usr/bin/env node

/**
 * Scrape skills from skills.sh and seed into SkillX database.
 *
 * Usage:
 *   node scripts/scrape-skills-sh.mjs                    # Full pipeline: scrape + seed
 *   node scripts/scrape-skills-sh.mjs --resume            # Resume seeding from last checkpoint
 *   node scripts/scrape-skills-sh.mjs --scrape-only       # Only scrape, write scraped-skills.json
 *   node scripts/scrape-skills-sh.mjs --seed-only         # Only seed from existing scraped-skills.json
 *   node scripts/scrape-skills-sh.mjs --batch-size 5      # Custom batch size (default: 10)
 *
 * Env vars:
 *   ADMIN_SECRET  (required for seeding)
 *   API_URL       (default: http://localhost:5173)
 *   GITHUB_TOKEN  (optional, increases rate limit 60→5000 req/hr)
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

// --- CLI Args ---
const args = process.argv.slice(2);
const scrapeOnly = args.includes("--scrape-only");
const seedOnly = args.includes("--seed-only");
const resume = args.includes("--resume");
const batchSizeIdx = args.indexOf("--batch-size");
const BATCH_SIZE =
  batchSizeIdx !== -1 ? parseInt(args[batchSizeIdx + 1], 10) : 10;

// ============================================================
// SCRAPING
// ============================================================

/**
 * Fetch skills.sh homepage and extract skill objects from __next_f payloads.
 * Returns array of { source, skillId, name, installs }.
 */
async function scrapeLeaderboard() {
  console.log("📡 Fetching skills.sh homepage...");
  const res = await fetch("https://skills.sh/", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) SkillX-Scraper/1.0",
    },
  });

  if (!res.ok) throw new Error(`skills.sh returned HTTP ${res.status}`);
  const html = await res.text();

  // Extract skill objects from __next_f payloads
  // In HTML, quotes are backslash-escaped: \"source\":\"value\"
  // Match both escaped and unescaped variants
  const skillRegex =
    /\\?"source\\?":\\?"([^"\\]+)\\?"[,}]\\?"skillId\\?":\\?"([^"\\]+)\\?"[,}]\\?"name\\?":\\?"([^"\\]+)\\?"[,}]\\?"installs\\?":(\d+)/g;
  const skills = [];
  const seen = new Set();
  let match;

  while ((match = skillRegex.exec(html)) !== null) {
    const [, source, skillId, name, installs] = match;
    // Deduplicate by skillId
    if (!seen.has(skillId)) {
      seen.add(skillId);
      skills.push({
        source,
        skillId,
        name,
        installs: parseInt(installs, 10),
      });
    }
  }

  console.log(`   Found ${skills.length} skills on leaderboard`);
  return skills;
}

/**
 * Fetch SKILL.md from GitHub raw content for a skill.
 * Returns { description, content } or null if not found.
 */
async function fetchSkillMd(owner, repo, slug) {
  // Try multiple path patterns (skills can be at root or in skills/ dir)
  const paths = [
    `https://raw.githubusercontent.com/${owner}/${repo}/main/skills/${slug}/SKILL.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/main/${slug}/SKILL.md`,
    `https://raw.githubusercontent.com/${owner}/${repo}/main/SKILL.md`,
  ];

  const headers = {};
  if (GITHUB_TOKEN) {
    headers["Authorization"] = `token ${GITHUB_TOKEN}`;
  }

  for (const url of paths) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const text = await res.text();
        return parseSkillMd(text);
      }
    } catch {
      // Try next path
    }
  }
  return null;
}

/**
 * Parse SKILL.md — extract YAML frontmatter description + markdown body.
 */
function parseSkillMd(text) {
  let description = "";
  let content = text;

  // Parse YAML frontmatter
  const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (frontmatterMatch) {
    const yaml = frontmatterMatch[1];
    content = frontmatterMatch[2].trim();

    // Extract description from frontmatter
    const descMatch = yaml.match(/description:\s*["']?(.*?)["']?\s*$/m);
    if (descMatch) {
      description = descMatch[1].trim();
    }
  }

  // Fallback description: first paragraph after heading
  if (!description) {
    const firstParagraph = content.match(/^#[^\n]*\n+([^\n#]+)/);
    if (firstParagraph) {
      description = firstParagraph[1].trim().slice(0, 200);
    }
  }

  return { description, content };
}

/**
 * Transform a scraped skill + SKILL.md data into SkillX schema.
 */
function transformSkill(leaderboardSkill, skillMd) {
  const [owner, repo] = leaderboardSkill.source.includes("/")
    ? leaderboardSkill.source.split("/", 2)
    : [leaderboardSkill.source, leaderboardSkill.source];

  return {
    name: leaderboardSkill.name,
    slug: leaderboardSkill.skillId,
    description:
      skillMd?.description ||
      `${leaderboardSkill.name} — AI agent skill from ${owner}`,
    content:
      skillMd?.content || `# ${leaderboardSkill.name}\n\nSkill by ${owner}.`,
    author: owner,
    source_url: `https://github.com/${leaderboardSkill.source}`,
    category: "implementation",
    install_command: `npx skills add ${leaderboardSkill.source} --skill ${leaderboardSkill.skillId}`,
    version: "1.0.0",
    is_paid: false,
    price_cents: 0,
    install_count: leaderboardSkill.installs,
    avg_rating: 0,
    rating_count: 0,
  };
}

/**
 * Scrape all skills: leaderboard + SKILL.md fetch.
 * Writes scraped-skills.json.
 */
async function scrapeAll() {
  const leaderboard = await scrapeLeaderboard();

  if (leaderboard.length === 0) {
    console.error(
      "❌ No skills found on leaderboard. HTML structure may have changed."
    );
    process.exit(1);
  }

  const skills = [];
  let fetched = 0;
  let skipped = 0;

  for (const item of leaderboard) {
    const [owner, repo] = item.source.includes("/")
      ? item.source.split("/", 2)
      : [item.source, item.source];

    process.stdout.write(
      `\r   Fetching SKILL.md: ${fetched + skipped + 1}/${leaderboard.length} — ${item.skillId}`
    );

    const skillMd = await fetchSkillMd(owner, repo, item.skillId);
    if (skillMd) {
      fetched++;
    } else {
      skipped++;
    }

    skills.push(transformSkill(item, skillMd));

    // Rate limit: 1 req/sec without token, faster with token
    await sleep(GITHUB_TOKEN ? 200 : 1100);
  }

  console.log(`\n✅ Scraped ${skills.length} skills (${fetched} with SKILL.md, ${skipped} fallback)`);

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

  // List failed skills
  const failed = Object.entries(progress.skills).filter(
    ([, s]) => s.status === "failed"
  );
  if (failed.length > 0) {
    console.log("\n   Failed skills:");
    for (const [slug, info] of failed) {
      console.log(`     - ${slug}: ${info.error} (attempts: ${info.attempts})`);
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

  if (seedOnly || resume) {
    // Load from existing scraped file
    try {
      const data = await readFile(SCRAPED_FILE, "utf-8");
      skills = JSON.parse(data);
      console.log(`📂 Loaded ${skills.length} skills from ${SCRAPED_FILE}`);
    } catch {
      console.error(`❌ Cannot read ${SCRAPED_FILE}. Run without --seed-only first.`);
      process.exit(1);
    }
  } else {
    // Scrape fresh
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
