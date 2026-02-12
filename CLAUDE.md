# CLAUDE.md

## Project

SkillX.sh — AI agent skills marketplace. Web marketplace + CLI + hybrid search engine. "The Only Skill That Your AI Agent Needs."

## Tech Stack

- **Monorepo**: pnpm workspaces (`apps/web`, `packages/cli`)
- **Web**: React Router v7 + Vite + SSR on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite) + Drizzle ORM
- **Search**: FTS5 + Vectorize (768-dim, bge-base-en-v1.5) + RRF fusion
- **Auth**: Better Auth + GitHub OAuth (route: `api/auth/*`)
- **Cache**: Cloudflare KV (5min TTL search, 5min leaderboard)
- **Storage**: R2 (assets), Workers AI (embeddings)
- **CSS**: Tailwind v4 + `@theme` tokens (dark-only, mint accent `#00E5A0`)
- **CLI**: Commander.js + chalk + ora + conf (package name: `skillx`)

## Directory Structure

```
apps/web/app/
├── routes/              # React Router pages + API handlers
│   ├── home.tsx         # Home page + leaderboard
│   ├── skill-detail.tsx # Skill page + ratings/reviews
│   ├── profile.tsx      # User favorites
│   ├── settings.tsx     # API key management
│   ├── auth-catchall.tsx# Better Auth handler
│   ├── api.search.ts    # Hybrid search API
│   ├── api.admin.seed.ts# Demo data seeding
│   └── api.skill-*.ts   # Rate, review, favorite APIs
├── components/          # UI components
│   ├── layout/          # Navbar, footer
│   ├── search-command-palette.tsx  # Cmd+K modal
│   └── leaderboard-table.tsx      # Sortable table
├── lib/
│   ├── db/              # schema.ts (Drizzle), queries
│   ├── auth/            # auth-server.ts, session-helpers.ts, api-key-utils.ts
│   ├── search/          # hybrid-search, vector-search, fts5-search, rrf-fusion, boost-scoring
│   ├── vectorize/       # embed-text, chunk-text, index-skill
│   └── cache/           # KV caching utilities
├── root.tsx             # App shell
└── app.css              # Tailwind + theme tokens

packages/cli/src/        # `skillx` npm package
├── commands/            # search, use, report, config
├── lib/                 # api-client, config-store
└── index.ts             # Commander.js entry
```

## Commands

```bash
pnpm install              # Install all dependencies
pnpm dev                  # Start dev server (apps/web) → http://localhost:5173
pnpm build                # Build for production
pnpm typecheck            # TypeScript check
pnpm seed                 # Seed DB (requires ADMIN_SECRET env var)

# Inside apps/web:
pnpm db:generate          # Generate Drizzle migrations
pnpm db:migrate           # Apply migrations locally
pnpm db:migrate:remote    # Apply migrations to remote D1
```

## Routes (apps/web/app/routes.ts)

| Pattern | File | Auth |
|---------|------|------|
| `/` | home.tsx | None |
| `/skills/:slug` | skill-detail.tsx | None |
| `/profile` | profile.tsx | Session |
| `/settings` | settings.tsx | Session |
| `/api/auth/*` | auth-catchall.tsx | Better Auth |
| `/api/search` | api.search.ts | None |
| `/api/skills/:slug` | api.skill-detail.ts | None |
| `/api/skills/:slug/rate` | api.skill-rate.ts | Session/Key |
| `/api/skills/:slug/review` | api.skill-review.ts | Session/Key |
| `/api/skills/:slug/favorite` | api.skill-favorite.ts | Session/Key |
| `/api/report` | api.usage-report.ts | Session/Key |
| `/api/user/api-keys` | api.user-api-keys.ts | Session |
| `/api/admin/seed` | api.admin.seed.ts | Admin secret |

## Database Tables (Drizzle schema)

`skills`, `ratings`, `reviews`, `favorites`, `usageStats`, `apiKeys`
Plus Better Auth tables: `user`, `session`, `account`, `verification`

## Key Patterns

**Page routes**: Loader (server-side data) + Component (React) + Action (form handling)

**API routes**: Auth check → Validate input → DB operation → JSON response

**Auth**: `getSession(request, env)` for session, `requireAuth(request, env)` for redirect

**Search**: Query → Embed (Workers AI) → Vectorize + FTS5 parallel → RRF fusion → Boost scoring → Filter → Cache (KV)

**Styling**: Always dark theme. Use `bg-slate-900`, `text-white`, `text-mint`, `border-mint/20`. Geist Sans/Mono fonts. Lucide icons.

## Important Caveats

- **Vectorize unavailable locally** — search falls back to FTS5-only in local dev. Use `--remote` flag or deploy for vector search.
- **Auth route must be `api/auth/*`** not `auth/*` — Better Auth client SDK calls `/api/auth/` paths.
- **API keys hashed with SHA-256** — never store or log plaintext keys.
- **Env vars** in `apps/web/.dev.vars` (local) or Cloudflare Secrets (production). Never commit `.dev.vars`.
- **Max 200 LOC per file** — split into focused modules if exceeded.
- **Seed data** in `scripts/seed-data.json` (30 real skills from skills.sh). Seed via `ADMIN_SECRET=... pnpm seed`.

## Cloudflare Bindings (wrangler.jsonc)

| Binding | Service |
|---------|---------|
| `DB` | D1 Database |
| `VECTORIZE` | Vectorize Index |
| `KV` | KV Namespace |
| `R2` | R2 Bucket |
| `AI` | Workers AI |

## Documentation

All docs in `./docs/` — see design-guidelines.md for full UI/UX spec, code-standards.md for patterns, system-architecture.md for diagrams.
