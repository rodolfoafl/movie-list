# Contract: Authentication

Auth.js v5 (`5.0.0-beta.32`), Credentials provider only, **JWT sessions** (research.md §4).

> **Revised after version verification (2026-07-21)**: the original contract specified database sessions. The installed `next-auth@5.0.0-beta.32` hard-errors (HTTP 500, `UnsupportedStrategy`) if `session.strategy: "database"` is combined with a Credentials-only provider list — see `node_modules/@auth/core/lib/utils/assert.js:114-118`. There is no session row; every mention of a "session row" below has been replaced with "signed JWT session cookie."

## `app/login/actions.ts` — `signInAction(state, formData)`

- **Input**: `email`, `password` from the login form
- Calls Auth.js `signIn('credentials', { email, password, redirect: false })`
- **On success**: a signed JWT session cookie is set (`HttpOnly`, `Secure`, `SameSite=lax`); no DB row is written for the session; action redirects to the lists overview (`/`) — spec User Story 1, scenario 1
- **On failure** (`CredentialsSignin` error, i.e. wrong email/password or unknown email): returns `{ error: 'E-mail ou senha inválidos.' }`; the login page stays put and shows the inline error (User Story 1, scenario 2) — the message is intentionally identical for "wrong password" and "unknown email" to avoid leaking which accounts exist
- No sign-up path exists; the only two valid `email` values are the seeded rows (FR-002)

## `logoutAction()`

- Calls Auth.js `signOut()`, clearing the JWT session cookie, redirects to `/login`
- Note: since sessions are JWT-based, this clears the client's cookie only — it cannot invalidate the token server-side before its natural expiry (no `sessions` table to delete from). Not a requirement per spec (see research.md §4).

## `proxy.ts` — optimistic route protection

- Exported function name is `proxy` (Next.js 16 convention — see research.md §1), built from Auth.js's `auth` wrapper
- Runs on every route except static assets; reads and verifies the JWT session cookie only (no DB round-trip either way, since sessions are JWT-based — "optimistic" here just means it doesn't re-run app-level authorization, per the local authentication guide)
- Unauthenticated + non-`/login` route → redirect to `/login` (FR-001, User Story 1 scenario 3)
- Authenticated + visiting `/login` → redirect to `/` (lists overview)

## DAL — `app/lib/dal.ts` — `verifySession()`

- The **authoritative** check, called at the top of every Server Action and the TMDB Route Handler
- Verifies and decodes the JWT session (via Auth.js `auth()`); checks the token's expiry claim
- No session / expired session → redirect to `/login` (covers the "session expires mid-action" edge case: the next action a user takes redirects them, per spec Edge Cases — satisfied by the JWT's `maxAge`/`exp`, no DB lookup needed)
- Both seeded users are otherwise equivalent — `verifySession()` returns `{ userId }` only; there is no role/permission branch anywhere in the app (FR-003)
