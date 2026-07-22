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
