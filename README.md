# Movie List
![Movie List](docs/screenshot.png)

A private, shared movie watchlist for two people — rebuilt from a 2020 personal project as a full **Spec-Driven Development (SDD)** case study, with every phase specified, audited and documented before merge.

**Production:** deployed on Vercel · PageSpeed (mobile) **99 / 100 / 100 / 100** · desktop **100 / 100 / 100 / 100** (Performance / Accessibility / Best Practices / SEO)

> The app itself is intentionally small — two pre-registered users, no public sign-up. What this repository demonstrates is the **engineering process around it**: how a complete product goes from specification to audited production deploy using AI-assisted development with human review gates at every phase.

## Why this repository is worth your time

- **Spec-first, not vibe-first.** Every feature was specified before implementation ([`specs/001-movie-watchlist/spec.md`](specs/001-movie-watchlist/spec.md)) using EARS-style testable requirements, refined by a 24-item data-integrity checklist that caught subtle bugs (case-insensitive rename-to-self, snapshot staleness, concurrent-create races) before a line of code existed.
- **Every phase was independently audited.** A read-only [spec-compliance reviewer subagent](.claude/agents/spec-compliance-reviewer.md) diffed each phase's code against the written artifacts. It caught real divergences a human missed — e.g. a case-sensitive sort where the data model specified `lower(title)`.
- **The failures are documented, not hidden.** [`specs/notes.md`](specs/notes.md) is an engineering journal of everything the process caught and everything it didn't: a launch-blocking login bug invisible to all testing because every layer ran against the dev server; a planned auth mechanism (database sessions) that the installed library version rejects with a hard error — found by reading `node_modules` source before implementation; an ORM driver that doesn't support the transactions the plan assumed.
- **Business rules are enforced in the database, not just the UI.** Unique index on `lower(trim(name))` for list names (closes the concurrent-create race), composite unique on `(list_id, tmdb_id)`, `ON DELETE CASCADE` — each mapped from a checklist item to a constraint to an integration test against real Postgres.
- **Tests were written first and shown failing.** Integration tests run against a real Postgres instance (not mocks), asserting the exact specified rules — including assertion-strength review (a `>=` that would have passed a forbidden behavior was tightened to `>`).

## Stack

| Layer | Choice | Why (full rationale in [`research.md`](specs/001-movie-watchlist/research.md)) |
|---|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Tailwind v4) | Server Actions for mutations; decisions grounded in the installed version's local docs, not training-data conventions |
| Database | Neon Postgres + Drizzle ORM | Serverless HTTP driver (no cold-start penalty); DB-level constraint enforcement |
| Auth | Auth.js v5, Credentials + JWT sessions | Database sessions were planned — and rejected after tracing the installed source: Credentials-only + database strategy is a hard error in this version |
| External API | TMDB via a single server-side route handler | API key never reaches the client; results filtered server-side |
| Testing | Vitest against real Postgres | Uniqueness races and cascade deletes only behave correctly on a real engine |
| Tooling | Claude Code + GitHub Spec Kit + Playwright MCP | Phased implementation with human checkpoints; browser verification by the agent |

## The process, in one paragraph

Specification (`/speckit.specify`) → quality + data-integrity checklists → amendments → implementation plan with per-decision rationale (`/speckit.plan`) → cross-artifact consistency analysis (`/speckit.analyze`, 97% requirement coverage pre-code) → 50+ dependency-ordered tasks (`/speckit.tasks`) → phase-by-phase implementation with per-task commits, tests-first (red before green), browser verification via Playwright MCP, an independent compliance audit per phase, and a manual human checkpoint before each phase gate → PR self-review → merge → production deploy → post-deploy validation on neutral infrastructure.

Three moments worth reading in [`specs/notes.md`](specs/notes.md):

1. **The auth verification** (2026-07-21): the plan specified a config that would have failed every sign-in with an HTTP 500. Caught before implementation by verifying against the installed package's source (`assert.js:114-118`) instead of trusting training data.
2. **The production-build bug** (2026-07-25): login was completely broken under `next build && next start` — two independent, compounding causes (Auth.js `trustHost` + static-prerendering swallowing a Server Action POST), invisible to every prior validation layer because all of them ran against the dev server. Now a standing rule: production-build smoke tests belong in every phase gate.
3. **The reviewer citing the journal** (2026-07-24): the compliance auditor flagged an in-memory filter as the same divergence class as a previous finding — citing the journal's own entry as precedent. The log became an audit instrument.

## Running locally

```bash
cp .env.example .env.local   # DATABASE_URL (Neon), AUTH_SECRET, TMDB_API_KEY
npm install
npx drizzle-kit push
npm run seed:users -- --database-url "$DATABASE_URL" --email you@example.com --password <pw> --email partner@example.com --password <pw>
npm run dev
```

Tests (real Postgres via `TEST_DATABASE_URL` — a Neon branch or local Docker):

```bash
npm run test
```

## Roadmap

Tracked as issues: legacy data migration from the 2020 app's MongoDB (with OMDB→TMDB id re-resolution), a global search page (`002-global-search`, as a full new spec cycle), and the original aquamarine theme via Tailwind v4 `@theme` tokens.

---

*Rodolfo Leal — [rafl-portfolio.vercel.app](https://rafl-portfolio.vercel.app) · [LinkedIn](https://www.linkedin.com/in/rodolfo-leal-96041b220/)*