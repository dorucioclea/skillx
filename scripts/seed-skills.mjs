#!/usr/bin/env node

/**
 * Seeds skills from seed-data.json to the SkillX API in batches.
 * RESUMABLE: Tracks seeded skill slugs so interrupted runs continue where they left off.
 *
 * Usage: ADMIN_SECRET=xxx node scripts/seed-skills.mjs
 *        ADMIN_SECRET=xxx API_URL=https://skillx.sh node scripts/seed-skills.mjs
 *        ADMIN_SECRET=xxx node scripts/seed-skills.mjs --reset  (start fresh)
 *
 * Options:
 *   --reset     Clear progress and start from scratch
 *   --batch=N   Skills per batch (default: 50)
 */

import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const API_URL = process.env.API_URL || 'http://localhost:5173';
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const SEED_FILE = join(__dirname, 'seed-data.json');
const PROGRESS_FILE = join(__dirname, '.seed-progress.json');

// Parse --batch=N flag (default 50)
const batchArg = process.argv.find(a => a.startsWith('--batch='));
const BATCH_SIZE = batchArg ? parseInt(batchArg.split('=')[1], 10) : 50;

if (!ADMIN_SECRET) {
  console.error('Error: ADMIN_SECRET environment variable is required');
  console.error('Usage: ADMIN_SECRET=your-secret-key node scripts/seed-skills.mjs');
  process.exit(1);
}

// --- Progress tracking ---

async function loadProgress() {
  try {
    return JSON.parse(await readFile(PROGRESS_FILE, 'utf-8'));
  } catch {
    return { seededSlugs: [] };
  }
}

async function saveProgress(progress) {
  await writeFile(PROGRESS_FILE, JSON.stringify(progress) + '\n');
}

// --- Batch seeding ---

async function seedBatch(batch) {
  const res = await fetch(`${API_URL}/api/admin/seed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Secret': ADMIN_SECRET,
    },
    body: JSON.stringify(batch),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

async function main() {
  // Handle --reset flag
  if (process.argv.includes('--reset')) {
    try { await writeFile(PROGRESS_FILE, ''); } catch {}
    console.log('Seed progress reset.\n');
  }

  // Load seed data and progress
  const allSkills = JSON.parse(await readFile(SEED_FILE, 'utf-8'));
  const progress = await loadProgress();
  const seededSlugs = new Set(progress.seededSlugs);

  // Filter out already-seeded skills
  const remaining = allSkills.filter(s => !seededSlugs.has(s.slug));

  if (remaining.length === 0) {
    console.log(`All ${allSkills.length} skills already seeded. Use --reset to re-seed.`);
    return;
  }

  console.log(`Seeding to ${API_URL}/api/admin/seed`);
  console.log(`Total: ${allSkills.length} | Already seeded: ${seededSlugs.size} | Remaining: ${remaining.length} | Batch size: ${BATCH_SIZE}\n`);

  let totalSeeded = 0;
  let totalVectors = 0;

  // Process in batches
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(remaining.length / BATCH_SIZE);

    try {
      const result = await seedBatch(batch);
      totalSeeded += result.skills;
      totalVectors += result.vectors;

      // Mark batch slugs as seeded
      for (const skill of batch) {
        seededSlugs.add(skill.slug);
      }
      await saveProgress({ seededSlugs: [...seededSlugs] });

      console.log(`Batch ${batchNum}/${totalBatches} — ${result.skills} skills, ${result.vectors} vectors | Total: ${seededSlugs.size}/${allSkills.length}`);
    } catch (err) {
      console.error(`\nBatch ${batchNum} failed: ${err.message}`);
      console.error(`Progress saved (${seededSlugs.size} seeded). Re-run to resume.`);
      process.exit(1);
    }
  }

  console.log(`\nSeeding complete! Skills: ${totalSeeded} | Vectors: ${totalVectors}`);

  // Clean up progress on success
  try { await writeFile(PROGRESS_FILE, ''); } catch {}
  console.log('Progress file cleaned up. Done!');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  console.error('Re-run to resume from last saved progress.');
  process.exit(1);
});
