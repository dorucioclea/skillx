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
**Goals:** MCP server mode, skill marketplace discovery, sandbox execution, references & scripts

### Milestones

#### 3.1 MCP Server Implementation (Weeks 1-3)
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

#### 3.2 Skill Execution Sandbox (Weeks 3-5)
- [ ] Research: Deno Deploy, AWS Lambda, or Cloudflare Workers
- [ ] Design execution environment (timeouts, resource limits)
- [ ] Implement skill runner (fetch SKILL.md, parse commands)
- [ ] Output capture (stdout, stderr, exit code)
- [ ] Security: sandboxing, env var isolation

#### 3.3 Skillmark Integration (Weeks 5-6)
- [ ] Fetch radar charts from Skillmark.sh API
- [ ] Embed in skill detail page
- [ ] Cache radar charts (30 min TTL)
- [ ] Display skill verification badge

#### 3.4 Skill References & Scripts (Weeks 6-7)
- [ ] Add `references` JSON column to skills table (array of `{title, url, type}`)
- [ ] Add `scripts` JSON column to skills table (array of `{name, command, description}`)
- [ ] D1 migration (ALTER TABLE, not recreate)
- [ ] Update seed pipeline to fetch/store references & scripts from SkillsMP
- [ ] API: return references & scripts in skill detail endpoint
- [ ] API: allow creators to CRUD references & scripts on their skills
- [ ] UI: render references list on skill detail page (with icons by type: docs, repo, api, video)
- [ ] UI: render scripts section with copy-to-clipboard buttons
- [ ] CLI: `skillx info <slug>` shows references & scripts
- [ ] Search: index reference titles in FTS5 for keyword discoverability
- [ ] Validation: sanitize URLs, limit array size (max 20 refs, 10 scripts)

#### 3.5 Skill Publishing Workflow (Weeks 7-9)
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

**Last Updated:** Feb 2025
**Next Review:** Feb 20, 2025
