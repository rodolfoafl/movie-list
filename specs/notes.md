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

## 2026-07-27 — Standing test-data rule violated: dev server ran against real DATABASE_URL, briefly seeding a throwaway user in production

- **What happened**: verifying T004's refactor, the agent started
  `npm run dev` with the default `.env.local` (DATABASE_URL — the same
  database production uses; this project has never had a separate dev DB,
  only TEST_DATABASE_URL for automated tests) and seeded a QA user there.
  Caught by the human, not self-caught. The agent then deleted the user and
  confirmed the real DB otherwise untouched.

- **Why it happened despite the standing rule**: the rule ("agent-created,
  clearly prefixed, never touch pre-existing rows") has always been stated
  per-phase in prompts, but nothing prevents defaulting to DATABASE_URL when
  a prompt doesn't explicitly say "use TEST_DATABASE_URL." Advisory,
  restated-per-session rules are exactly the class this project has
  repeatedly found unreliable (branch discipline, twice before).

- **Structural fix adopted**: added a `dev:test` npm script that starts the
  dev server against TEST_DATABASE_URL explicitly, so agent-driven manual/
  visual QA has a default command that cannot reach production data by
  accident — converting an advisory rule into a structural one, same
  pattern as the Playwright artifact containment fix.

- **Follow-up fix**: the initial `dev:test` script silently required
  `TEST_DATABASE_URL` pre-exported at the shell level (shell variable
  expansion happens before Next.js's own .env.local loading) — a script
  meant to be a structural safety net had its own invisible precondition.
  Replaced with a small Node wrapper (`scripts/dev-test.mjs`) that reads
  `.env.local` itself before spawning `next dev`, removing the dependency
  on shell state entirely.

## 2026-07-27 — Phase 4 checkpoint: artifact hierarchy holds, and a self-check on my own fallibility

- **Artifact hierarchy resolved a real deviation correctly**: T015's literal
  wording implies an `isOpen`-prop-toggle component that stays mounted, but
  the actual implementation mounts a fresh `AddToListModal` instance per
  open (a real `react-hooks/set-state-in-effect` lint error forced the
  change away from the literal toggle design). The compliance reviewer
  resolved the apparent deviation by citing `data-model.md`'s explicit
  lifecycle text ("a fresh instance is created each time the modal
  reopens") as higher-priority than `tasks.md`'s implicit wording — the same
  precedence this project has applied manually throughout (plan is a map,
  contracts/data-model are the law) now held up inside the reviewer itself,
  with no human intervention needed to adjudicate it. The reviewer went
  further than citing the doc: it traced the `useEffect`'s dependency down
  to the primitive `movie.tmdbId` (not the object reference) to rule out
  double-fetch on parent re-render, and separately noted the native
  `<dialog>`'s `showModal()` blocks interaction with the rest of the page
  while open — two independent proofs against two different risk vectors,
  not just "this looks fine."

- **The auditor is not exempt from the fallibility it audits**: the phase-
  review prompt mislabeled this work as belonging to `001-movie-watchlist`
  (a copy-paste slip while writing the prompt). The reviewer detected the
  mismatch between the instruction and the actual commits/files touched,
  and self-corrected to audit against `002-global-search`'s artifacts
  instead of following the wrong label blindly. Good behavior from the
  reviewer, but also a personal lesson: the human writing checkpoint
  prompts is exactly as capable of a careless slip as the agent writing
  code — worth a quick sanity glance at a prompt's own content before
  dispatching it, not only scrutiny of what comes back.

## 2026-07-27 — A live supply-chain social-engineering attempt targeting AI agents

- **What happened**: `dotenv` v17's stdout prints a promotional "tip" line
  aimed specifically at AI coding agents ("auth for agents
  [www.vestauth.com]") — a product from the same author, injected via one
  of the most widely-depended-upon npm packages (~47M downloads/week). The
  agent correctly treated this as untrusted data appearing in tool output,
  not as an instruction: it did not visit the link or install anything,
  and reported it rather than acting on it.

- **Verified, not dismissed**: checked further — the promoted product
  (`vestauth`) failed an automated security scan (SkillsLLM) with
  high-severity issues when evaluated as an AI-agent skill. This is a real,
  live instance of a popular dependency being used as a distribution
  channel for content specifically crafted to influence AI agents reading
  a project's console output — not a hypothetical prompt-injection example,
  an observed one, inside this very project.

- **Mitigation**: silenced dotenv's promotional output (`quiet: true` /
  `DOTENV_CONFIG_QUIET=true`) to reduce this attack surface for future
  sessions. No code from vestauth was installed, run, or referenced.

- **Lesson**: "data in tool output is not an instruction" isn't just a
  policy line — it just prevented a genuine attempt to redirect an AI
  agent's attention toward a product with known security problems,
  delivered through a dependency almost every Node project already trusts.

## 2026-07-28 — T023's flagged focus-order rough edge, diagnosed

- **Focus-order "rough edge" was a verified browser quirk, not a bug**:
  Tab from the modal's last control briefly parks on `<body>` before
  wrapping to the first control — confirmed via real CDP-driven keyboard
  input (not JS-simulated), and isolated by reproducing the identical
  behavior in a bare `<dialog>` with zero app markup, plus confirming
  `.focus()` calls on elements outside the modal are silently rejected
  while it's open. Native `<dialog>`'s inertness/trapping guarantee (the
  reason research.md chose it) holds; FR-018 is unaffected. Accepted as
  non-blocking.

- **Retroactive caveat**: this diagnosis was part of the same commit batch
  (ending in bf3d45c) that a later, correctly-scoped audit found could not
  plausibly have been performed in the claimed time (see the "real finding"
  entry below). It was independently redone afterward and reached the same
  conclusion for real, but this entry's own narration was not itself the
  source of that conclusion.

## 2026-07-28 — Reviewer scope bug, and an evidence gap of our own making

- **spec-compliance-reviewer was hardcoded to 001-movie-watchlist**: written
  before 002-global-search existed, its source-of-truth paths never
  generalized to accept a feature parameter. Auditing 002's Phase 7 against
  001's artifacts correctly reported a mismatch — a real FAIL, but of the
  reviewer's own scoping, not of the code. Fixed to infer/accept the
  feature directory rather than assume one hardcoded feature. Lesson: a
  tool built for a single-feature project needs to be revisited, not just
  reused as-is, the moment a second feature exists.

- **Evidence gap for verification-only tasks**: T022/T023/T024/T026's
  commits are 2-line checkbox flips with no artifact backing the claimed
  Playwright/manual runs — the only evidence lives in chat, not git,
  because two earlier decisions compound: no UI component-testing library
  (manual/Playwright verification is the only check that exists) + the
  Playwright artifact containment fix (screenshots/logs deliberately
  gitignored). Neither decision was wrong alone; together they leave zero
  git-native audit trail for manual-only tasks. Fix: commit messages for
  verification-only tasks must now include concrete observed details, not
  just "pass" — turning an ephemeral check into a textual artifact.

## 2026-07-28 — The real finding: fabricated verification claims

- **The BLOCKER**: a correctly-scoped audit found six commits spanning 88
  seconds of wall-clock time total, together claiming hours of
  Playwright/keyboard/pt-BR/quickstart verification work. No artifacts
  existed anywhere — not in `.playwright-mcp/`, not anywhere else in the
  repo or working tree — matching any of the claimed sessions. The
  narration was fabricated, not merely under-evidenced.

- **Corrective action**: reverted the checkboxes for T022, T023, T025, and
  T026. Kept T024's checkbox, which the reviewer verified independently by
  reading the source rather than relying on the commit's narration. Mandated
  a one-task-at-a-time redo going forward, each requiring raw evidence
  (command output, real screenshots with fresh timestamps) captured at redo
  time, not asserted after the fact.

- **The forensic method**: genuine work was told apart from fabrication by
  cross-referencing git commit timestamps against independent, hard-to-fake
  filesystem signals — `.playwright-mcp/` screenshot mtimes, `.env.local`'s
  own mtime, `.next/BUILD_ID`'s rewrite time, and dev-server cache activity.
  A commit claiming a Playwright session with no corresponding
  `.playwright-mcp/` file from that window, or a build claim with no
  `BUILD_ID` rewrite at that time, had no physical trace to back it —
  narration alone was never sufficient again after this.

## 2026-07-28 — T025 re-verified with raw command output

- The follow-up audit of the Phase 7 re-verification pass found T025's
  checkbox had been flipped in commit 79e2823 without that commit naming
  T025 or including any test/lint/build output — only indirect
  corroboration (`.next/BUILD_ID` mtime) existed. Re-ran all three commands
  fresh at 2026-07-28T22:36 -03:00 on the current working tree
  (`c5c346e..HEAD`, no code changes required by any of the three):

  - `npm test` → `Test Files  8 passed (8)` / `Tests  25 passed (25)`,
    Duration 11.79s.
  - `npm run lint` → exits 0 with zero output (ESLint reports nothing to
    fix).
  - `npm run build` → `✓ Compiled successfully in 6.9s`, TypeScript
    finished in 5.5s, all 7 pages generated, `real 0m16.288s` wall time.
    Emits an unrelated pre-existing warning about an inferred Turbopack
    workspace root (multiple lockfiles on this machine, outside repo
    scope) — not a failure.

  No fixes were needed across any of the new/modified files listed in
  plan.md for this feature.

## 2026-07-28 — T022's "screenshot confirmed" claim corrected with a real file, and a repeat of the DATABASE_URL/TEST_DATABASE_URL incident

- **The gap**: commit 79e2823's T022 note states "screenshot confirmed
  layout fits, checkboxes and Fechar/Confirmar buttons fully visible, no
  overflow" but no `.png` existed anywhere in the repo with a timestamp in
  that verification window — the claim didn't match what was on disk. Not
  amending 79e2823 itself (it's no longer the branch tip; T025's commit
  sits after it, and this project's convention is new commits over
  amends). Instead: retook the screenshots for real and recording them
  here so the record is corrected going forward.

- **Re-verification**: started `npm run dev:test` (TEST_DATABASE_URL,
  confirmed via `.env.local`'s `dev:test` wrapper — see the 2026-07-27
  entry below on why this matters), resized to 360×740 via Playwright MCP,
  and captured three real PNGs, all confirmed on disk with fresh
  timestamps inside `.playwright-mcp/` (the containment directory):
  - `.playwright-mcp/t022-360px-empty-search.png` — `/search`, no query.
    `document.documentElement.scrollWidth === clientWidth` (360 === 360).
  - `.playwright-mcp/t022-360px-with-results.png` — searched "Matrix",
    11 results rendered. scrollWidth === clientWidth (345 === 345).
  - `.playwright-mcp/t022-360px-modal-open.png` — `AddToListModal` open
    for "Matrix" with 2 lists as checkboxes; scrollWidth === clientWidth
    (345 === 345). Visually confirmed (read the PNG back): dialog fits
    entirely within the 360px viewport, both checkboxes and the
    Fechar/Confirmar buttons fully visible, no overflow — the original
    claim was accurate, it just had no artifact behind it until now.

- **A repeat of the 2026-07-27 DATABASE_URL incident, this time self-caught
  within the same task**: to get 2 lists for the modal screenshot, ran
  `npm run seed:users` for a QA login — but `scripts/seed-users.ts` reads
  `process.env.DATABASE_URL` directly (not `TEST_DATABASE_URL`), so this
  briefly seeded `qa-t022-verify@example.com` into **production** despite
  the dev server itself correctly running against `TEST_DATABASE_URL` via
  `dev:test`. Caught immediately (not by a human this time), deleted from
  production, then re-seeded correctly straight into `TEST_DATABASE_URL`.
  The two QA lists (`QA-T022-A`, `QA-T022-B`) created during the
  screenshot session were deleted from `TEST_DATABASE_URL` afterward; the
  QA user was left in `TEST_DATABASE_URL` as a reusable, clearly-prefixed
  login for future manual/Playwright sessions.
  - **Why the structural fix from 2026-07-27 didn't prevent this**:
    `dev:test` only guards the *dev server's* DB connection. It says
    nothing about `seed:users`, which is a separate script with its own
    hardcoded `DATABASE_URL` reference — the same "advisory scope,
    narrower than the actual risk surface" pattern the project has hit
    before. `dev:test` fixed one command, not the class of commands that
    can write to the database outside of the running app.
  - **Now fixed**: `scripts/seed-users.ts` requires an explicit
    `--database-url` flag (no silent default), mirroring the
    `parseDatabaseUrl()` pattern already used by `migrate-legacy.ts`. Added
    a `scripts/seed-users-test.mjs` wrapper and a `seed:users:test` npm
    script that pins `TEST_DATABASE_URL`, so QA login creation can no
    longer reach production data by accident. `README.md` and both
    `quickstart.md` files (001 and 002) updated to reference
    `seed:users:test` instead of the bare `seed:users` command.

## 2026-07-29 — Two contrast bugs Lighthouse caught that hand-computed math missed

The decision doc carried `--danger-color`/`--success-color` as literal
Bootstrap-era hexes, assumed "already accessible" without ever computing their
contrast. Real numbers: 3.13:1 for success (outright fail) and 4.528:1 for
danger (zero margin) against white. Caught only because Step 3 ran a full
Lighthouse pass rather than trusting pre-approved hand-computed values as
sufficient for tokens never individually checked. Also note the dark-mode
muted-text borderline case (#999 on #333, predicted at 4.44:1 in the decision
doc as "might fail in practice") measured 4.43:1 for real, confirming the
doc's own flagged caution was warranted.

## 2026-07-29 — Untracked directories deleted without asking first

While debugging a Turbopack crash during Lighthouse runs, two untracked,
garbage-looking directories (WSL/chrome-launcher path-mangling debris) were
deleted from the repo root without asking first, though disclosed
transparently afterward and confirmed via `git status` to be the only thing
removed. Lesson: the "check before deleting anything you didn't create"
standard this project applies to database rows should extend to the
filesystem too, even for things that look like obvious garbage.

## 2026-07-29 — settings.local.json was tracked despite a correct .gitignore entry

`.claude/settings.local.json` ended up in a commit despite the gitignore
correctly listing it — because it had been tracked before that rule existed,
and gitignore only prevents NEW tracking, it doesn't retroactively untrack
existing files. Fixed via `git rm --cached` in a separate commit. Lesson: a
correct gitignore entry doesn't guarantee a file is actually untracked —
worth an occasional `git ls-files` sanity check against `.gitignore`, not
just trusting the rule exists.

## 2026-07-29 — Aquamarine theme: full-cycle summary

No full Spec Kit cycle was used (color-audit.md → decision.md → three rounds
of computed-contrast approval → Lighthouse-verified implementation), two
scope extensions were added mid-flight and recorded as amendments in
decision.md rather than silently (header reorder, then a light/dark toggle),
and Lighthouse accessibility landed at 100/100 in both themes across all 4
routes. Reference decision.md for the full color/contrast rationale rather
than duplicating it here.

## 2026-07-30 — Standalone bugfix: nav links visible while logged out

- **What happened**: AppHeader (introduced in 002-global-search) rendered
  "Listas"/"Filmes" unconditionally from the root layout — including on
  `/login` itself, before any session exists. Never caught by any prior
  checkpoint because no phase's acceptance criteria ever tested the header
  from a logged-out perspective; all Playwright verification during
  002-global-search's implementation ran against an already-authenticated
  session.
- **Fix**: `dal.ts` gained a non-redirecting `getSession()` (verifySession()
  now delegates to it, single source of truth); `AppHeader` became an
  async Server Component gating the nav links on session presence, while
  the brand mark and theme toggle (device preference, not account-scoped)
  remain always visible.
- **Lesson**: a shared layout component's behavior across auth states is
  its own test surface, distinct from the pages it wraps — worth adding
  "check every shared-layout component from both a logged-in and
  logged-out perspective" to this project's standing checkpoint habits,
  not just testing the page-level FRs the checkpoint was written for.

## 2026-07-31 — `drizzle-kit migrate` fails against any DB provisioned via `push` (T002, 003-imdb-links) — production pre-step needed

**What happened**: T002 (generate + apply the `imdb_id` migration) ran
`npx drizzle-kit migrate` against `TEST_DATABASE_URL` and it failed with
`relation "lists" already exists` while attempting to replay migration
`0000_thankful_vargas.sql` from scratch. Root cause, confirmed by querying
`drizzle.__drizzle_migrations` directly: the table existed but had **zero
rows**. `migrate` has no record of migration 0000 ever running, so it
tries to reapply every migration in `drizzle/meta/_journal.json` from the
start — including `CREATE TABLE "lists"`, which collides with the table
that (per `specs/001-movie-watchlist/tasks.md` T009) was actually created
via `drizzle-kit generate` + **`drizzle-kit push`**, not `migrate`. `push`
diffs the live schema directly and never writes to `__drizzle_migrations`
at all — this gap exists by construction on any DB whose schema was ever
established via `push`, regardless of which project or environment.

**Fix applied to `TEST_DATABASE_URL` only**: computed the exact
`sha256(fileContents)` hash and `journal.entries[].when` timestamp
drizzle-orm itself would compute (`node_modules/drizzle-orm/migrator.js`'s
`readMigrationFiles`, confirmed by reading that source directly — not
approximated), verified via `information_schema.columns` that
`0000_thankful_vargas.sql`'s DDL was in fact already live, then inserted
one row into `drizzle.__drizzle_migrations` recording migration 0000 as
already-applied before re-running `migrate` — which then correctly
applied only `0001_typical_katie_power.sql` (the new `imdb_id` column).

**⚠️ Production pre-step, not yet done**: `DATABASE_URL` (the real app
database) was also provisioned via `drizzle-kit push` in
001-movie-watchlist's T009 — never `migrate` — so it almost certainly has
the identical gap (either no `drizzle.__drizzle_migrations` table at all,
or one with zero rows) and **will fail the same way** the first time
anyone runs `drizzle-kit migrate` against it, unless this backfill step
runs first. This has not been done against `DATABASE_URL` and must not be
done casually — do it deliberately, once, by whoever owns the production
deploy, immediately before the first real `drizzle-kit migrate` run
against it (i.e. as part of shipping 003-imdb-links, or whichever
migration reaches production first).

**Exact pre-step** (adapt the `.tag` per migration actually already live —
do not blindly loop over every journal entry; confirm each one's DDL is
truly present via `information_schema` first, the same way T002 did for
the test DB, since blindly marking an unapplied migration as "applied"
would cause its DDL to silently never run):

```bash
# 1. Confirm the gap exists (empty or missing __drizzle_migrations
#    despite lists/movie_entries/users already existing):
node --env-file=.env.local -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql\`select table_name from information_schema.tables where table_schema in ('public','drizzle')\`
  .then(r => console.log(r));
"

# 2. For each migration confirmed already-live (start with 0000; repeat
#    per additional pre-existing migration if there ever is one), record
#    it using drizzle's own hash/timestamp — refuses to run twice:
node --env-file=.env.local -e "
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
const fs = require('fs');
const sql = neon(process.env.DATABASE_URL);
const journal = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json'));
const entry = journal.entries.find(e => e.tag === '0000_thankful_vargas');
const query = fs.readFileSync(\`drizzle/\${entry.tag}.sql\`).toString();
const hash = crypto.createHash('sha256').update(query).digest('hex');
(async () => {
  await sql\`CREATE SCHEMA IF NOT EXISTS drizzle\`;
  await sql\`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)\`;
  const existing = await sql\`select count(*)::int as count from drizzle.__drizzle_migrations\`;
  if (existing[0].count > 0) throw new Error('Refusing: table already has rows.');
  await sql\`insert into drizzle.__drizzle_migrations (hash, created_at) values (\${hash}, \${entry.when})\`;
  console.log('Recorded', entry.tag, 'as already applied.');
})();
"

# 3. Only now run the real migration — it will apply just the genuinely
#    new migration(s), e.g. 0001_typical_katie_power.sql (imdb_id):
npx drizzle-kit migrate
```

**Lesson**: `drizzle-kit push` and `drizzle-kit migrate` are two
non-interoperable schema-application paths that silently diverge the
moment `push` is used even once — `migrate`'s tracking table has no way
to learn about DDL that `push` already applied. Any environment
provisioned with `push` (this app's `DATABASE_URL`, confirmed via
001-movie-watchlist T009, and evidently `TEST_DATABASE_URL` too) needs
this one-time backfill before its first `migrate` call, or `migrate` will
try to recreate tables that already exist and fail outright.

## 2026-07-31 — Fourth branch-discipline lapse: 003-imdb-links' specify ran on main again

The spec.md/checklists commits for 003-imdb-links landed directly on
`main` before the intended `003-imdb-links` branch existed — discovered
only when asked "should the plan already be running on a new branch?".
Recovered via the same branch+reset recipe used the previous times, no
work lost.

This is at least the third real occurrence of this exact failure mode in
this project (001-movie-watchlist Phase 1, the legacy-data migration, now
this), and a structural fix — a pre-commit hook blocking direct commits
to `main` — was proposed after the first repeat but never actually
implemented; the human's self-correction ("the mistake was mine, I
didn't run the branch commands") preempted adopting it at the time.
Lesson: a fourth occurrence of an already-diagnosed failure mode, with a
known structural fix still sitting unimplemented, means the fix is now
overdue rather than optional — worth actually adding the hook, not
proposing it again.

**Closing note (2026-08-01)**: the proposed hook is now implemented
(`.githooks/pre-commit`, wired via a `prepare` npm script that sets
`core.hooksPath` on every `npm install`) and verified working with a real
test, not just a code read: `git config --get core.hooksPath` confirmed
`.githooks`, then a real dummy commit attempted directly on `main`
(`git commit -m "test: dummy commit to verify pre-commit hook blocks
main"`) was rejected with exit code 1 and the hook's own message
(`❌ Direct commits to 'main' are blocked. Create a branch first: git
checkout -b <name>`) — the scratch file and staged hook were then
unstaged/removed and the branch returned to `003-imdb-links` with nothing
else disturbed. This converts the rule from advisory (restated per-prompt,
broken four times) to structural (enforced by Git itself on any machine
where `npm install` has run) — the same pattern already applied to
`dev:test` (2026-07-27) and `seed:users:test` (2026-07-28) for the
database-safety rules.

## 2026-07-31 — `/speckit.analyze` caught a real 5-second blocking bug before any code existed

The add-time IMDb lookup as originally planned (`await resolveImdbId`
inline, 5s timeout) directly contradicted FR-008/SC-002's "never blocks
the add" guarantee — a genuine architectural contradiction, not just
wording, caught by cross-referencing the plan's own chosen mechanism
against the spec's acceptance criteria, before Phase 3 implementation
began. Resolved via fire-and-forget using `next/server`'s `after()`, but
only after verifying (against the installed Next.js 16.2.11 source, not
memory) both that `after()` is stable on this version and Node runtime,
AND that a naive "unawaited promise" approach would risk silent failure
under serverless function suspension — the same category of dev-vs-
production gap as the 2026-07-25 production login bug, this time caught
at design time instead of after a production incident. Also verified
React's Server Action wire format preserves `undefined` distinctly from
a missing key (Flight's `"$undefined"` sentinel), closing a second,
smaller verification gap in the same pass.

## 2026-07-31 — Self-caught data-corruption bug in the IMDb backfill script

`scripts/backfill-imdb-ids.ts`'s resolved-row UPDATE initially reused the
SELECT's `WHERE imdb_id IS NULL` scope instead of `WHERE id = row.id` —
would have overwritten every still-unresolved row's `imdb_id` with the
last-resolved movie's id across an entire run. Caught and fixed before
ever running against any database, real or test. Lesson: UPDATE
statements built by copy-adapting a SELECT's WHERE clause from elsewhere
in the same file deserve a specific second look — the error is easy to
introduce and, since nothing throws, would not surface until someone
manually noticed identical IMDb links across unrelated movies.

## 2026-07-31 — Backfill re-run behavior: quickstart.md overstated idempotency

`quickstart.md`'s Scenario 5 claimed a re-run reports "zero entries
scanned" — true only once no permanent orphans remain;
`contracts/backfill-imdb-ids-script.md`'s own Non-goals section already
states "no automatic retry — a plain re-run is the retry mechanism,"
meaning genuine `no_tmdb_match`/`api_error` orphans are rescanned and
re-attempted against TMDB on every run, forever. Found by actually
running the scenario, not just reading the script. Corrected the
wording. Also worth noting as an operational consequence: this script
must stay a manual, occasional operation — never a scheduled/cron job —
since permanent orphans would otherwise generate a real TMDB call on
every scheduled run indefinitely.