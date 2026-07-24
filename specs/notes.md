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