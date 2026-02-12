# Code Reviewer Memory - SkillX Project

## Project Context
- SkillX.sh: AI agent skills marketplace (React Router v7 + Cloudflare Workers + D1/SQLite)
- Monorepo: `apps/web` (main app), `packages/cli`
- DB: Drizzle ORM with `mode: "timestamp_ms"` (stores integers, returns Date objects)
- Cache: KV with `getCached()` pattern (no explicit invalidation helper exists)

## Key Patterns Discovered
- **Date in raw SQL:** Drizzle `timestamp_ms` columns store integer ms. Typed queries handle conversion, but raw `sql` template literals do NOT auto-convert `Date` to ms. Always use `.getTime()` in raw SQL.
- **KV cache key collisions:** Multiple loaders can share cache key prefixes. If they select different column sets, the first writer poisons the cache for others. Always ensure same-key = same-shape.
- **Pre-existing TS errors:** ~20+ TS errors exist in search, embed, auth, and other routes. These are NOT from new changes. Don't flag them as regressions.
- **No cache invalidation utility:** `kv-cache.ts` only has `getCached()`. There's no `invalidate()` or `deleteCached()`. Cache relies purely on TTL expiry.

## Recurring Patterns to Watch
- Synchronous DB-heavy operations in request path (should use `waitUntil()` on Workers)
- Code duplication across SSR loader and API route for same data
- `getOrderColumn` switch-case duplicated between page route and API route
- Badge computation logic duplicated between API and page loaders

## Architecture Notes
- Leaderboard uses precomputed score columns updated on write events
- Search uses real-time boost scoring (different weights than leaderboard)
- Two weight systems: search boost (7 signals incl. RRF) vs leaderboard composite (6 signals)
- Scoring utils shared: `logNormalize`, `recencyScore` in `~/lib/scoring-utils.ts`
