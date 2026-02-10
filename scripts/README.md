# Data Seeding Scripts

This directory contains scripts for seeding the SkillX database with initial skill data.

## Files

- **seed-data.json**: Contains 30 curated AI agent skills across various categories
- **seed-skills.mjs**: Node.js script to POST seed data to the admin API
- **seed-skills.ts**: TypeScript version (for reference)

## Usage

### Prerequisites

1. Ensure the web app is running locally or deployed
2. Set the `ADMIN_SECRET` environment variable (must match `env.ADMIN_SECRET` in wrangler.jsonc)

### Local Development

```bash
# Start the dev server
pnpm dev

# In another terminal, run the seed script
ADMIN_SECRET=your-secret-here pnpm seed
```

### Custom API URL

```bash
API_URL=https://your-deployed-app.com ADMIN_SECRET=your-secret pnpm seed
```

## How It Works

1. **seed-skills.mjs** reads `seed-data.json`
2. POSTs JSON array to `/api/admin/seed` with `X-Admin-Secret` header
3. API endpoint (`api.admin.seed.ts`) validates secret
4. For each skill:
   - Upserts into D1 database via Drizzle ORM
   - Chunks text content into 512-token segments with 10% overlap
   - Generates embeddings using Workers AI (@cf/baai/bge-base-en-v1.5)
   - Upserts vectors to Vectorize index with metadata
5. Returns `{ skills: count, vectors: count }`

## Embedding Pipeline

Each skill goes through:

1. **Text Chunking** (`chunk-text.ts`)
   - Combines name, description, and content
   - Splits into ~512 token chunks with 10% overlap
   - Prevents context loss at chunk boundaries

2. **Embedding Generation** (`embed-text.ts`)
   - Batches text chunks to Workers AI
   - Uses BGE-base-en-v1.5 embedding model
   - Returns 768-dimensional vectors

3. **Vector Indexing** (`index-skill.ts`)
   - Creates vector IDs: `skill_{skillId}_chunk_{chunkIndex}`
   - Attaches metadata: skill_id, category, is_paid, avg_rating, chunk_index
   - Upserts to Vectorize in batches of 1000

## Metadata Schema

Each vector includes:
```json
{
  "skill_id": "uuid-v4",
  "category": "devops|implementation|testing|security|planning",
  "is_paid": 0,
  "avg_rating": 0,
  "chunk_index": 0
}
```

## Idempotency

The seed script is idempotent:
- D1 upserts on slug conflict (updates existing skills)
- Vectorize upserts replace existing vectors by ID
- Safe to run multiple times

## Adding New Skills

Edit `seed-data.json` and add entries following this schema:

```json
{
  "name": "skill-name",
  "slug": "skill-slug",
  "description": "Short description (50-200 chars)",
  "content": "Longer markdown content with features, usage, etc.",
  "author": "author-name",
  "source_url": "https://github.com/...",
  "category": "devops|implementation|testing|security|planning",
  "install_command": "npx skillx use skill-slug",
  "version": "1.0.0",
  "is_paid": false,
  "price_cents": 0
}
```

Then run `pnpm seed` to update the database.
