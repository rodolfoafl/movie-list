# Notes

## 2026-07-21 — Auth session-strategy verification (blocker before /speckit.tasks)

**What the plan assumed**: `research.md` §4 and `contracts/auth.md` specified Auth.js v5
(`next-auth@5`) with the Credentials provider **and** database sessions via the
Drizzle adapter, on the theory that this might need a manual workaround (per
historical Auth.js behavior of forcing JWT sessions when Credentials is used).

**What was actually found**:
1. `next-auth` (and `@auth/drizzle-adapter`, `drizzle-orm`, `bcryptjs`) were **not
   installed at all** — absent from `package.json`, `package-lock.json`, and
   `node_modules`. The repo was still at the fresh `create-next-app` state. Installed
   them (`npm install next-auth@beta @auth/drizzle-adapter drizzle-orm bcryptjs`) to
   get real local source to verify against, per the instruction to check local
   sources rather than trained knowledge.
2. `next-auth@5` has **no stable release on npm** — only betas exist
   (`5.0.0-beta.0` through `5.0.0-beta.32`, dist-tag `beta`). `npm install
   next-auth@5` fails with `ETARGET`. The installed version is `5.0.0-beta.32`.
3. Verified directly in `node_modules/@auth/core/lib/utils/assert.js:114-118`:
   `session.strategy: "database"` combined with a Credentials-only provider list is
   a **hard configuration error** (`UnsupportedStrategy`), not a silent fallback to
   JWT. `node_modules/@auth/core/index.js:72-89` confirms this error produces an
   HTTP 500 on the sign-in POST action itself — i.e. sign-in would fail outright
   every time with the plan's original config (Credentials-only, database
   sessions).

**Resolution**: switched to JWT sessions (no `sessions` table). Spec's only
session-related requirement — "session expires mid-action → next action redirects
to login" (`spec.md` line 178) — is fully satisfied by a JWT's `maxAge`/`exp`
claim, no DB round-trip required. The capability given up (server-side forced
revocation before natural expiry) is not required anywhere in the spec for this
2-user personal app. Considered and rejected a manual database-session workaround
(hand-rolling a second session cookie + DB row, bypassing Auth.js's own cookie/CSRF
handling) as unjustified complexity for a capability nothing in the spec asks for.

Updated `research.md` §4 and `contracts/auth.md` accordingly (both marked "Revised
after version verification"). `package.json`/`package-lock.json` now include the
real dependencies for the first time.

## 2026-07-21 (same day, follow-up) — dropped `@auth/drizzle-adapter`; synced remaining docs

Asked to sync the JWT decision everywhere and re-evaluate whether the Drizzle
adapter package (installed earlier the same day alongside `next-auth`) was still
needed now that sessions are JWT-based, not database-based.

Traced the actual Credentials sign-in code path in
`node_modules/@auth/core/lib/actions/callback/index.js:227-277`: a Credentials
POST calls `provider.authorize()` directly and builds the JWT from its return
value — it never reaches `handleLoginOrRegister` in `handle-login.js` (the only
place any adapter method is called), because that function only runs for
`oauth`/`oidc`/`email`/`webauthn` account types, never `credentials`
(`handle-login.js:19`). `assert.js:128-143` confirms an adapter is required only
for email-provider or database-session setups. **Verdict: the adapter was never
used, even for user lookup** — this app's `authorize()` queries the `users` table
directly via plain `drizzle-orm`, not through the adapter interface.

Ran `npm uninstall @auth/drizzle-adapter`. Updated:
- `data-model.md` — removed the `Session` entity/table and the `User → Session`
  relationship; three tables now (`users`, `lists`, `movie_entries`)
- `plan.md` Technical Context — dependency list now says `next-auth@beta`
  (matches what's actually installable, see the `ETARGET` finding above) and
  explicitly notes no `@auth/drizzle-adapter`; storage line drops the `sessions`
  table
- `research.md` §4 — replaced the now-incorrect claim that "the adapter is still
  used for user lookup" with the traced code path showing it isn't used at all

`drizzle-orm` itself stays — it's what `authorize()` and every other query in the
app run on. Only the Auth.js-specific adapter package was dead weight.

## 2026-07-22 — T011 follow-up: auth hardening beyond spec

Two fixes applied to `app/lib/auth.ts` after T011 was already spec-conformant and
reviewed: (1) timing-safe `authorize()` — unknown-email lookups now run
`bcrypt.compare()` against a precomputed `DUMMY_HASH` instead of short-circuiting
on `!user`, so unknown-email and wrong-password failures take near-identical time
(documented in `contracts/auth.md`); (2) explicit `pages: { signIn: "/login" }` in
the NextAuth config, so every internal Auth.js flow (e.g. redirects on
`UntrustedHost`/`CredentialsSignin` style errors) lands on our own login page
rather than Auth.js's built-in default.

**Lesson**: neither fix was required by the spec or contract as originally
written, and a spec-compliance review would not have flagged their absence —
reviewer passes spec-conformant code; beyond-spec hardening is human review's job.

## 2026-07-22 (retroactive) — process findings from the Phase 1 sessions

- **Feature branch never created**: Spec Kit's workflow implies a feature branch
  (plan.md header says `Branch: 001-movie-watchlist`), but no branch was ever
  created; implementation started directly on `main` and was only noticed
  mid-Phase-1. Recovered without loss (`git checkout -b` with uncommitted work).
  Lesson: current branch is part of the human's session-start checklist — don't
  assume the tooling handled it.

- **Per-task commit rule ignored**: tasks.md's own notes say "commit after each
  task or logical group", yet Phase 1 ran to completion with zero commits.
  Advisory rules in artifacts don't survive contact with implementation
  momentum; the commit discipline had to be restated explicitly in each phase's
  kickoff prompt to hold.

- **Manual .env step had no gate**: quickstart.md documents creating `.env.local`
  as a manual setup step, but nothing in the flow reminded the human before the
  first phase that depends on it (Foundational: drizzle-kit push + seed). Caught
  by conversation, not by process.

## 2026-07-23 — Phase 3 checkpoint, browser-verification tooling

- **Playwright MCP first find**: browser verification immediately caught the
  page `<title>` still reading "Create Next App" — missed by build, tsc, the
  conformance reviewer and two humans, because metadata was in no FR/contract.
  Lesson: visual verification catches a class of defect no artifact-based
  review sees.

- **Tool-artifact pollution**: Playwright MCP screenshots/logs handled via
  structural containment (`--output-dir .playwright-mcp` + gitignore) instead
  of a behavioral "clean up after yourself" rule. Lesson: prefer making
  artifacts irrelevant (config-level containment) over multi-step advisory
  rules, which degrade as context fills.

- **Unmapped destructive change (Phase 3)**: T016 required deleting the
  scaffold's `app/page.tsx` (route collision — route groups share the `/` URL
  with `app/(lists)/page.tsx`). No task mapped this; the agent resolved it
  autonomously and correctly, and the conformance reviewer did not flag the
  unmapped deletion. Lesson: the plan didn't account for interactions with
  pre-existing scaffold files, and reviewers may absorb unmapped deletions
  silently — the human diff pass is the layer that catches destructive changes
  outside task scope.

- **Unspecified addition (Phase 3)**: lists overview ordered alphabetically
  (`asc(lists.name)`) by agent choice; no FR mandates overview ordering
  (FR-022 covers movies within a list only). Flagged by the reviewer as
  informational; accepted without amending the spec — artifact amendments are
  reserved for contract-behavior changes.

## 2026-07-24 — Phase 4 checkpoint: reviewer's first real catch

- **Case-insensitive sort divergence (T028)**: the list detail page sorted
  movies with `asc(movieEntries.title)` (case-sensitive, collation-dependent)
  while `data-model.md` explicitly specifies `ORDER BY lower(title)` for
  FR-022. Invisible to the eye until data like "avatar" and "Avatar" coexist —
  the class of divergence that works until data proves otherwise. Caught by
  the spec-compliance reviewer on its fourth audit (first real finding),
  precisely because it cross-checks code against artifact text rather than
  observed behavior. Fixed and re-verified (tests 6/6, type-check, browser).
  Lesson: the artifact-diffing reviewer earns its keep on divergences that
  neither builds, tests-as-written, nor visual verification can surface.

## 2026-07-24 — Scope gap discovered mid-implementation: legacy feature parity

- **Standalone search page missed at spec time**: the original 2020 app had a
  global movie-search page (search without entering a list first); the rebuild's
  spec deliberately models search as an in-list action (FR-010, §3.2 "from
  within a list") and this parity gap only surfaced during Phase 4/5, recalled
  by the product owner from memory. Root cause is a process gap, not a memory
  one: requirements elicitation worked from conversation and feature
  description, but never audited the legacy app screen-by-screen for feature
  parity — a systematic walkthrough of the old repo's routes would have
  surfaced this before spec freeze. Decision: NOT smuggled into the current
  implementation (it would bypass FRs, tests, and the conformance reviewer);
  deferred as a proper post-MVP feature cycle (`002-global-search`, with its
  own spec — search from anywhere, per-result target-list picker, reusing the
  existing TMDB route handler). Lesson: for rebuilds, add "inventory the
  legacy system's surfaces" as an explicit elicitation step; scope changes
  discovered mid-flight enter through a new spec cycle, never through an
  implementation prompt.

## 2026-07-24 — Phase 5 checkpoint: assertion strength, recurring drift, broken chain

- **Weakened assertion caught by human review (T032)**: the FR-020 re-mark test
  originally asserted `toBeGreaterThanOrEqual` — which would PASS if a buggy
  implementation *restored* the original watched date, the exact behavior the
  rule prohibits. Passed by accident today (current schema discards the date on
  unmark, so there's nothing to restore) but would silently stop protecting
  after future refactors (e.g. a watched-history feature). Tightened to a
  strict `toBeGreaterThan` + small sleep (be2b440). Lesson: assertion strength
  is part of test review, not just coverage — a test can name the right rule
  and still be unable to fail the behavior it exists to forbid.

- **Process slip**: the assertion fix was applied BEFORE running the phase
  audit, so we lost the datum of whether the conformance reviewer would have
  caught the weak assertion on its own (its prompt's test-integrity clause
  targets exactly this). Operational rule going forward: audit first, fix
  second — corrections applied pre-audit destroy evidence about what each
  review layer catches.

- **Recurring drift class (T035)**: watched-status filter implemented in-memory
  (fetch all + `entries.filter(...)`) where data-model.md specifies a
  query-time WHERE clause — the same code-vs-artifact deviation class as the
  T028 sort one phase earlier. The reviewer not only caught it but cited
  notes.md's own T028 entry as precedent: the log has become an audit
  instrument. One occurrence is accident; two is a pattern — the agent trends
  toward solving in JS what artifacts assign to SQL. Fixed at query time.

- **Contract chain broken at the last link (T034)**: `toggleWatched` correctly
  returns the `already_removed` state built by CHK018 → contract → server
  action, but the UI wrapper discarded the return value — the concurrent-
  removal case reached the user as silent nothing. Severity-labeled NOTE by
  the reviewer, but functionally it voided the entire CHK018 chain. Fixed via
  useActionState surfacing a pt-BR message. Lesson: a requirement isn't
  delivered until the last link renders; mid-chain correctness doesn't count.

- **Ambiguous destructive-cleanup report (Phase 5 fix verification)**: the
  agent's browser verification created its own throwaway user, then reported
  cleaning up "list, entry, and seeded user" — phrasing indistinguishable from
  having deleted one of the two real pre-registered accounts. Production users
  verified intact; the issue was report ambiguity over destructive actions on
  a shared database, not the action itself. Mitigation adopted: standing
  test-data rule in all phase prompts (agent-created and prefixed data only,
  never pre-existing rows) — destructive-action reports must name exactly
  what was deleted.

## 2026-07-25 — Phase 6 audit: transaction claim vs. installed driver

- **Planned mechanism never matched the installed driver (`deleteList`)**:
  `research.md` §7 (CHK017), `data-model.md`, and `tasks.md` (T040) all specify
  that `deleteList` runs "in a transaction". The actual driver is
  `drizzle-orm/neon-http` (`app/lib/db/client.ts`) — the Neon HTTP driver, which
  issues one HTTP request per call and does not support interactive
  multi-statement transactions (`db.transaction()` is unavailable in this mode).
  Never caught at plan time. Harmless here because `deleteList` is a single
  `DELETE FROM lists WHERE id = $1`, already atomic in Postgres on its own, and
  `ON DELETE CASCADE` removes the dependent `movie_entries` rows as part of that
  same statement — no explicit transaction wrapper was ever needed. The
  implementation (`app/(lists)/actions.ts:108-116`) already reflects this via
  code comment, without the discrepancy against the artifacts ever being logged.
  A hypothetical multi-statement mutation (e.g. writing to two tables that
  aren't linked by cascade) would have hit this driver limitation for real at
  implementation time. Third instance of installed-reality diverging from a
  planned mechanism, after the Auth.js database-sessions (2026-07-21) and
  `next-auth@5` stable-release (2026-07-21) findings. Lesson: driver/library
  capability assumptions in `research.md` need the same "verify against local
  `node_modules`" treatment that was eventually applied to the auth stack.

## 2026-07-25 — Launch-blocking bug invisible to the entire process: login broken in production build

- **What happened**: T047's Lighthouse pass required `next build && next start`
  — the first time the app ever ran as a production build. Login was
  completely broken: every sign-in silently returned to /login with no
  session. Two independent, compounding causes, each sufficient to block all
  logins: (1) Auth.js rejects http://localhost:3000 as an untrusted host in
  production unless `trustHost: true` — signIn() failed internally without
  throwing CredentialsSignin, so the action fell through to redirect with no
  Set-Cookie (and our own pages.signIn hardening made the failure silent by
  landing on our login page instead of Auth.js's error page); (2) /login had
  no dynamic data, was fully static-prerendered, and POSTs to its own Server
  Action were served from the static cache instead of executing. Fixed
  together: `trustHost: true` + extracting LoginForm.tsx so page.tsx exports
  `dynamic = "force-dynamic"`.

- **Process lesson (the big one)**: every prior validation layer — Playwright
  MCP, human walkthroughs, integration tests, four compliance audits — ran
  exclusively against `npm run dev`, which applies neither behavior.
  Dev-only testing is a *class* of blindness no artifact or reviewer covered:
  the app would have shipped to Vercel with 100% login failure. Standing rule
  adopted: a production-build smoke test (`build` + `start` + manual login)
  belongs in every phase checkpoint from Foundational onward, and in any
  future project's Definition of Done.

- **Diagnosis lesson (a twist on 2026-07-24's)**: yesterday's entry warned
  that plausible-sophisticated diagnoses can mask mundane config causes. Here
  the agent's sophisticated diagnosis (static-cache swallowing the POST) and
  the mundane one (trustHost) were BOTH real and compounding — fixing either
  alone would have left login broken and the investigation looking "wrong".
  The method survives the twist: demand evidence per hypothesis and fix each
  confirmed cause separately; don't stop at the first confirmed cause when
  symptoms allow multiple.

## 2026-07-26 — Phase 7 close-out: T046/T048/T049 audit, T047 threshold waived, one destructive-action correction

- **T047 accepted without hitting the literal ≥ 90/≥ 90 gate**: two real findings were
  fixed (missing `<main>` landmark; login unusable under `next start` due to
  `trustHost` and static-prerendering of a page with a Server Action) and a
  robots.txt/sitemap exemption was added to `proxy.ts` for crawlability. The
  task's literal numeric threshold (spec Non-functional Requirements) was
  explicitly waived by the product owner rather than re-run and verified —
  recorded here so a future audit doesn't assume the number was hit and re-open
  it looking for a Lighthouse report that doesn't exist. Local numbers were
  degraded by environment interference (antivirus); definitive validation is
  deferred to a post-deploy PageSpeed Insights run against the production
  Vercel URL — if ≥ 90 there, the local-environment caveat dissolves; if not,
  it's a real signal to act on.

- **T046/T048/T049 all passed clean on first pass**: keyboard audit found every
  primary action on both pages using native `<a>`/`<button>`/`<input>` elements
  in logical tab order already (inline rename and native `confirm()` delete
  dialogs both keyboard-operable without changes needed); 360px width had no
  horizontal scroll on either page; all 10 automated tests and all four
  quickstart.md scenarios passed without code changes.

- **Destructive-action correction during T049**: the quickstart walkthrough's
  scenario 4 ("remove one movie from a list") was run against the real,
  pre-existing "Halloween marathon" list rather than session-created test data,
  removing "Matrix" (1999) from it. Caught immediately per the standing
  test-data rule (2026-07-24 entry) before it was reported as done; re-added
  the same TMDB entry to restore prior state (safe since it had never been
  marked watched in that list — no watched-date data to lose; the re-added
  entry does carry a new id/created_at, acceptable since ordering is
  alphabetical, not by date added). Lesson
  reinforced: the standing rule says "agent-created and prefixed data only" —
  quickstart's own scenario text names real-sounding list names ("Halloween
  marathon", "Date night") that overlap with actual seeded data, so future
  quickstart walkthroughs must substitute a prefixed name for every step, not
  just the ones creating new lists.

  - **T047 waiver resolved (post-deploy)**: PageSpeed Insights against the
  production Vercel URL (neutral Google infrastructure): mobile
  99/100/100/100, desktop 100/100/100/100 (Perf/A11y/BP/SEO). Spec's ≥ 90
  requirement definitively exceeded; the local-environment caveat (antivirus
  interference) is confirmed as the cause of the degraded local numbers.
  Waiver closed.