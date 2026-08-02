---
name: new-feature-kickoff
description: Standard checklist for starting ANY new feature, bugfix, or Spec Kit cycle in this repo — branch setup, environment checks, which planning cycle to use (full Spec Kit vs. lightweight decision doc), and the project's standing conventions. Use this skill proactively at the very start of any work session where the user asks to begin a new feature, fix a bug, start a roadmap item, or run /speckit.specify — even if they don't explicitly ask for a "checklist" or mention this skill by name. Also consult it before running any script that touches the database, and before writing a verification-only commit (manual QA, Playwright checks).
---

# New Feature Kickoff

This project (a Next.js movie-watchlist app) has a documented history of the
same few mistakes recurring across features — this skill exists specifically
to make them impossible to repeat. Read `specs/notes.md`'s most recent
entries too; it's the project's running lessons log and is expected to be
skimmed before starting substantial new work.

## 1. Branch setup (do this FIRST, before any planning command)

```bash
git branch --show-current   # must NOT be main
git status                  # must be clean
git checkout -b <feature-or-fix-name>
```

A pre-commit hook (`.githooks/pre-commit`) blocks direct commits to `main`
as a structural backstop — but don't rely on it catching the mistake late.
Create the branch **before** running `/speckit.specify` or writing any
code. This exact failure (specify/plan running on `main` before the branch
existed) has happened multiple times in this project's history; the hook
prevents the commit, this step prevents wasting the planning cycle at all.

Naming convention: `NNN-feature-name` (e.g. `003-imdb-links`) for
full Spec Kit cycles, matching `specs/NNN-feature-name/`. Plain descriptive
names (e.g. `fix/header-hides-nav-when-logged-out`, `aquamarine-theme`) for
standalone bugfixes or lightweight polish work that won't get a numbered
spec folder.

## 2. Environment check

- Confirm `.env.local` has `DATABASE_URL`, `TEST_DATABASE_URL`, `AUTH_SECRET`,
  `TMDB_API_KEY` — all should already exist from prior features; only
  new variables need adding.
- **Every manual/exploratory/QA session uses `npm run dev:test`, never
  `npm run dev`.** Same for seeding: `npm run seed:users:test`, never the
  bare `seed:users` (which requires an explicit `--database-url` and will
  refuse to run without one — that's intentional).
- Any new standalone script that touches the database must require an
  explicit `--database-url` flag or dedicated env var, mirroring
  `scripts/migrate-legacy.ts`'s pattern — never default to `DATABASE_URL`.

## 3. Choose the right planning cycle

**Full Spec Kit cycle** — for anything introducing new user-facing behavior,
new data, or touching multiple files/components:

1. `/speckit.specify` — write the feature description directly in the
   command with any product decisions already resolved (ask the user
   clarifying questions on ambiguous scope/UX choices *before* running
   this, not after — see prior features' pattern of resolving multi-select
   vs. single-select, sync vs. async, etc. up front).
2. Review the generated `spec.md` + `checklists/requirements.md`.
3. Run one or more **domain-specific checklists**
   (`/speckit.checklist`) targeting the riskiest areas of the spec
   (concurrency, data integrity, volume/rate-limit bounds, timing/sequencing
   ambiguity — whatever the feature's own description flags as a risk).
4. Resolve every checklist finding via a `spec-amendments.md` (REPLACE/ADD
   FR blocks + a resolution table mapping each CHK item) — apply, commit,
   check off the boxes. Keep `spec-amendments.md` after applying (add a
   "Status: APPLIED" header) — don't delete it; it's part of the process
   record.
5. `/speckit.plan` — with explicit steering to reuse existing patterns
   (existing Server Actions, shared components, existing script shapes)
   rather than inventing new mechanisms. Any assumption about library/
   framework behavior must be verified against the installed
   `node_modules` source (cite file/line) before the plan relies on it —
   this has caught real, otherwise-invisible bugs multiple times.
6. Review `research.md`/`data-model.md`/`plan.md`/`contracts/`.
7. `/speckit.analyze` — run this even on features that feel simple; it has
   caught real architectural contradictions (not just wording gaps) before
   any code existed.
8. `/speckit.tasks`, then review against: sensible volume for the feature's
   size, correct dependency order, explicitly named test tasks (never a
   generic "write tests" task), orphan tasks present (migrations, env vars,
   script guards), nothing reintroducing a previously-removed pattern.

**Lightweight decision doc** — for pure polish/refactor work with no new
user-facing behavior (visual theming, copy changes, internal cleanup):
skip the full cycle. Write a short `specs/<name>/decision.md` (or
`docs/<name>.md`) capturing the concrete decisions and any computed
values (contrast ratios, etc.) that need approval before implementing —
see `specs/aquamarine-theme/decision.md` for the precedent.

## 4. During implementation

- Commit after each task, checking off `tasks.md`'s box in the **same**
  commit — do not batch checkbox updates into a separate pass.
- Verification-only commits (no code diff — viewport checks, keyboard
  audits, manual QA) must state exact concrete observations (numbers,
  paths, measurements) in the commit body — never a bare "pass"/"verified".
  This project had a real incident where narrated-but-unsubstantiated
  verification claims were later found fabricated; commit messages are the
  audit trail for manual QA now.
- Test data in any shared/test database must be agent-created and clearly
  prefixed (e.g. `zz-test-`) — never touch pre-existing rows, even ones
  that look like throwaway data.
- When a phase-review/audit surfaces findings: audit first, fix second.
  Applying a fix before the audit runs destroys the evidence of whether
  that review layer would have caught it on its own.
- Icons: always `lucide-react`, never hand-rolled SVGs. Icon-only buttons
  always carry a pt-BR `aria-label` (and matching `title`).

## 5. Schema migrations & production deployment

If this feature includes a new Drizzle migration (`drizzle-kit generate`),
it does **not** automatically become safe to apply the same way against
every environment. This project's databases were provisioned via
`drizzle-kit push`, not `generate`+`migrate`, from the start — meaning
`drizzle.__drizzle_migrations` has a historical tracking gap on **every**
database this project uses (confirmed on `TEST_DATABASE_URL` 2026-07-31,
and again on the real `DATABASE_URL` 2026-08-02, when this exact gap broke
list-detail pages in production after 003-imdb-links merged without the
documented pre-step ever actually being executed).

- **A migration applied to `TEST_DATABASE_URL` is not the same as it
  being applied to the real `DATABASE_URL`.** Before considering a
  feature with a schema change fully shipped, confirm — via a real
  `information_schema` query against `DATABASE_URL`, not an assumption —
  whether the new column/table actually exists there.
- **A `notes.md` entry saying "do this before the next deploy" is not a
  completed step.** Nothing in this project's process currently gates a
  merge on it. Treat any outstanding production-migration pre-step as
  merge-blocking, not a note to revisit later, until an actual automated
  gate (e.g. a CI check comparing `__drizzle_migrations` state) exists.
- **If `DATABASE_URL` has the same historical tracking gap** (no
  `drizzle` schema, or an empty/missing `__drizzle_migrations` table):
  follow the documented recipe (specs/notes.md, 2026-07-31 and 2026-08-02
  entries) exactly — recompute the migration's hash fresh from
  `drizzle/meta/_journal.json` + the file's own contents (never reuse a
  previously-computed hash from memory, even for the same file), insert
  and re-query the tracking row to confirm it *before* running the real
  migration, then run `drizzle-kit migrate` and confirm it applies only
  the expected new migration(s) — one step at a time, confirming each via
  a real query before the next, since this touches production data.
- **This project has no staging tier** — `DATABASE_URL` serves both real
  production traffic and any local production build. Any
  "verify against a real deployment" check (e.g. confirming a
  fire-and-forget background task survives serverless suspension) should
  prefer read-only verification wherever possible over pointing a live
  dev server at this database.

## 6. Closing a feature

If this feature included a schema migration, see §5 above **before**
considering it done — do not defer that check to "after merge, whenever."

- Update `specs/notes.md` with anything genuinely surprising or
  instructive from this cycle — a verified assumption that turned out
  false, a bug caught before it shipped, a process gap. Skip routine
  "everything went fine" work; this log is for the exceptions.
- PR description: what's included, how it was validated (concrete
  numbers), any notable engineering decisions, and — if applicable — an
  honest account of anything that went wrong during the cycle and how it
  was caught. Reference `Closes #N` for the tracked roadmap issue.
- If a new gap in the *original* app's parity or the *rebuild's* scope is
  discovered mid-flight, do not patch it into the current cycle — file it
  as its own roadmap issue and finish the current one first.