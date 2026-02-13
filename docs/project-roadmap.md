# SkillX Project Roadmap

## Current Status

**Phase 1: Core Platform** — 100% COMPLETE ✓

MVP launched with all foundational features:
- Web marketplace UI
- Hybrid semantic + keyword search
- User authentication (GitHub OAuth)
- Ratings & reviews system
- API key management
- CLI tool (skillx)
- Deployment on Cloudflare stack

---

## Phase 2: Production Hardening & Monetization

**Status:** Next Priority
**Duration:** 4-6 weeks
**Goals:** Enable paid skills, payment processing, production deployment

### Milestones

#### 2.1 Payment Integration (Weeks 1-2)
- [ ] Stripe account setup + API keys
- [ ] Product setup in Stripe (paid skills)
- [ ] Payment UI (card entry, checkout modal)
- [ ] Webhook handlers (payment.created, payment.failed)
- [ ] Revenue tracking database (transactions table)
- [ ] Payout calculation (70% creator, 30% platform)

#### 2.2 GitHub OAuth Production Setup (Weeks 1-2)
- [ ] Create GitHub OAuth app (prod environment)
- [ ] Configure redirect URIs (skillx.sh domain)
- [ ] Set client ID/secret in production wrangler config
- [ ] Test full OAuth flow on production domain
- [ ] Disable development OAuth credentials

#### 2.3 Cloudflare Production Setup (Weeks 2-3)
- [ ] Create production Cloudflare account
- [ ] Set up custom domain (skillx.sh) + SSL
- [ ] Create production D1 database (skillx-db-prod)
- [ ] Create production KV namespace (kv-prod)
- [ ] Create production Vectorize index (skillx-skills-prod)
- [ ] Configure environment variables (.env.production)
- [ ] Enable Cloudflare Analytics + Observability

#### 2.4 Database Migration & Seeding (Weeks 3-4)
- [ ] Backup dev D1 database
- [ ] Run migrations on production D1
- [ ] Load seed data (30 initial skills)
- [ ] Verify data integrity
- [ ] Index skills in production Vectorize

#### 2.5 Testing & QA (Weeks 4-5)
- [ ] Load testing (1K concurrent users)
- [ ] Search performance testing (p95 <800ms)
- [ ] Payment flow testing (multiple payment methods)
- [ ] Auth flow testing (OAuth + API keys)
- [ ] Security audit (OWASP Top 10)
- [ ] Bug fixes & optimizations

#### 2.6 Deployment & Monitoring (Weeks 5-6)
- [ ] Deploy to production (wrangler publish)
- [ ] Monitor error rates, latency, uptime
- [ ] Set up alerts (error spikes, slow queries)
- [ ] Create runbook for common incidents
- [ ] Document rollback procedure

### Success Criteria
- [ ] Search latency p95 <800ms in production
- [ ] 99.5% uptime (first 30 days)
- [ ] Zero critical security issues
- [ ] Payment processing working for 10+ transactions
- [ ] GitHub OAuth SSO verified

---

## Phase 3: Skill Discovery & Execution

**Status:** Planned
**Duration:** 7-9 weeks
**Goals:** Leaderboard enhancements, skill references & scripts, MCP server, sandbox execution

### Milestones

> **Implementation order:** Ready-to-implement plans first (3.1, 3.2), then features with external dependencies (3.3-3.6).

#### 3.1 Leaderboard Enhancements (Weeks 1-2) — NEXT UP
**Implementation plan:** [plans/260213-1558-leaderboard-enhancements/plan.md](../plans/260213-1558-leaderboard-enhancements/plan.md)
**Status:** Plan complete (red-teamed + validated), ready to implement
**Why first:** No external dependencies, high user impact, uses migration `0007`

4 phases: DB + Vote API → Sort/Filter/Preview → Favorites/Votes UI → Scoring updates

Key decisions (validated):
- Reddit-style votes (up/down/none) coexist with 0-10 ratings
- Votes as 8th search signal (7%, RRF reduced 50%→43%)
- Votes as 7th leaderboard signal (10%, rating 35%→30%, installs 25%→20%)
- Sort tabs (5 modes) + category filter dropdown
- Author links to GitHub profile (with username validation)
- Preview modal (description, category, stats)
- Client-side overlay for per-user vote/favorite state
- DB-based rate limiting (10 votes/min per user)

- [ ] Phase 1: Database migration (`votes` table + skills columns) + Vote API
- [ ] Phase 2: Sort/filter controls + clickable author + preview modal
- [ ] Phase 3: Favorites button + vote arrows + auth overlay
- [ ] Phase 4: Scoring algorithm updates + bulk recompute

#### 3.2 Skill References & Scripts (Weeks 2-4)
**Implementation plan:** [plans/260213-1218-skill-references-scripts/plan.md](../plans/260213-1218-skill-references-scripts/plan.md)
**Status:** Plan complete (red-teamed + validated), ready to implement
**Why second:** Ready to implement, uses migration `0006` (order-independent with 3.1), depends on GitHub API

6 phases: DB migration → GitHub fetcher → Seed pipeline → API updates → UI → CLI

Key decisions (validated):
- References: full content in `skill_references` table, Vectorize titles+first-paragraph only (~200K vectors)
- Scripts: metadata JSON column on skills table, agent-mediated execution
- FTS5: separate `fts_content` computed column (content + ref titles)
- Rollout: top 50 skills first → 500 → full

- [ ] Phase 1: DB schema migration (`scripts`, `fts_content` columns + `skill_references` table)
- [ ] Phase 2: GitHub fetcher script (Trees API, `--top-n=50`, progressive)
- [ ] Phase 3: Seed pipeline + Vectorize integration
- [ ] Phase 4: API & search updates (detail endpoint returns refs/scripts)
- [ ] Phase 5: UI skill detail page (references + scripts sections)
- [ ] Phase 6: CLI updates (`--include-refs`, `--include-scripts` for raw mode)

#### 3.3 MCP Server Implementation (Weeks 4-6)
- [ ] Design MCP protocol for skill discovery
- [ ] Implement MCP server in CLI tool
- [ ] `skillx-mcp-server` package
- [ ] Claude integration via MCP
- [ ] Skill result formatting (JSON/markdown)

Example usage:
```bash
npx skillx-mcp-server
# Server listens on stdio
# Claude makes requests: { method: 'tools/call', name: 'search', args: { query } }
```

#### 3.4 Skillmark Integration (Weeks 6-7)
- [ ] Fetch radar charts from Skillmark.sh API
- [ ] Embed in skill detail page
- [ ] Cache radar charts (30 min TTL)
- [ ] Display skill verification badge

#### 3.5 Skill Execution Sandbox (Weeks 7-8)
- [ ] Research: Deno Deploy, AWS Lambda, or Cloudflare Workers
- [ ] Design execution environment (timeouts, resource limits)
- [ ] Implement skill runner (fetch SKILL.md, parse commands)
- [ ] Output capture (stdout, stderr, exit code)
- [ ] Security: sandboxing, env var isolation

#### 3.6 Skill Publishing Workflow (Weeks 8-9)
- [ ] Creator dashboard (publish new skill)
- [ ] SKILL.md validation
- [ ] Auto-generate skill card
- [ ] Review queue for admins
- [ ] Approval/rejection workflow

### Success Criteria
- [ ] MCP server working with Claude
- [ ] 10+ skills successfully published
- [ ] Sandbox execution <5s per skill
- [ ] Radar charts loading & caching
- [ ] References & scripts displayed on skill detail pages
- [ ] CLI `skillx info` shows references & scripts
- [ ] Leaderboard sort/filter/preview working
- [ ] Vote system functional with rate limiting
- [ ] Scoring algorithm updated with vote signal

---

## Phase 4: Advanced Features & Community

**Status:** Future
**Duration:** Q3-Q4 2025
**Goals:** Community features, advanced search, monetization

### Potential Features

#### Community
- [ ] User profiles with bio, avatar, verified badge
- [ ] Skill review comments (replies, threading)
- [ ] User reputation system (badges, achievements)
- [ ] Discussion forum per skill

#### Search & Discovery
- [ ] Trending skills (by rating, usage, recency)
- [ ] Personalized recommendations (based on favorites)
- [ ] Skill collections (curated bundles)
- [ ] Advanced filters (tags, language, performance)

#### Monetization
- [ ] Subscription tiers (free, pro, enterprise)
- [ ] Usage-based pricing (per API call)
- [ ] Team management (multi-user accounts)
- [ ] API quota system (e.g., 1K searches/month)

#### Analytics
- [ ] Skill creator dashboard (usage stats, revenue)
- [ ] User analytics (most-used skills, success rate)
- [ ] Platform analytics (total searches, revenue, growth)

---

## Metrics & Success Tracking

### Phase 1 (Complete)
| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Skills indexed | 30+ | 30 | ✓ |
| Feature completeness | 100% | 100% | ✓ |
| Code coverage | 70%+ | TBD | ? |
| Documentation coverage | 100% | 100% | ✓ |

### Phase 2 (In Progress)
| Metric | Target | Status |
|--------|--------|--------|
| Production uptime | 99.5% | In progress |
| Payment processing | 100% | Pending |
| Search latency p95 | <800ms | Pending |
| GitHub OAuth production | Working | Pending |

### Phase 3 (Planned)
| Metric | Target |
|--------|--------|
| Skills published | 100+ |
| MCP server adoption | 50+ users |
| Sandbox execution success | 95%+ |

---

## Dependencies & Blockers

### Phase 2 Dependencies
- Stripe account approval (usually <24hrs)
- Cloudflare domain setup (DNS changes)
- GitHub OAuth app creation (instant)

### Phase 3 Dependencies
- Skillmark.sh API documentation
- Deno Deploy or alternative sandbox provider
- MCP protocol finalization (Claude ecosystem)

### Known Blockers
- None currently identified

---

## Resource Allocation

| Phase | Team Size | Estimated Hours |
|-------|-----------|-----------------|
| Phase 1 (Complete) | 2 devs | 160h |
| Phase 2 | 2 devs | 180h |
| Phase 3 | 2-3 devs | 240h |
| Phase 4 | TBD | TBD |

---

## Timeline

```
Jan 2025    Feb 2025    Mar 2025    Apr 2025    May 2025
│           │           │           │           │
├─ Phase 1 ─┤
  Complete
            ├────── Phase 2 ──────┤
            Hardening & Payments
                        ├──────────── Phase 3 ─────────┤
                        MCP & Execution
                                    ├────── Phase 4 ──→
                                    Community & Advanced
```

---

## Decision Log

| Decision | Context | Date |
|----------|---------|------|
| Use Cloudflare stack | Serverless, edge compute, free tier | Jan 2025 |
| Hybrid search (vector + FTS5) | Balance semantic + keyword search | Jan 2025 |
| Better Auth + GitHub OAuth | Passwordless, minimal setup | Jan 2025 |
| Stripe for payments (Phase 2) | Market-leading, good CLI/API | TBD |
| MCP server for Claude (Phase 3) | Leverage Claude ecosystem | TBD |

---

**Last Updated:** Feb 13, 2026
**Next Review:** Feb 20, 2025
