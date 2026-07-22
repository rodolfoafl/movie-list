# Research: Shared Movie Watchlist

**Date**: 2026-07-21 | **Feature**: [spec.md](./spec.md)

This project runs on a modified Next.js whose docs live in `node_modules/next/dist/docs/`. Several decisions below are pinned to that local copy, not to general Next.js knowledge, since this version has renamed/removed APIs relative to older training data (see `AGENTS.md`).

## 1. Framework version and its breaking changes vs "classic" Next.js

**Decision**: Target the installed Next.js 16.2.11 conventions exactly as documented locally, not the Next.js 13–15 patterns that appear in general references.

**Rationale**: `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` and `01-app/01-getting-started/16-proxy.md` confirm the following are load-bearing for this feature:
- `middleware.ts` is renamed to **`proxy.ts`**; the exported function must be named `proxy` (not `middleware`). The `edge` runtime is not supported here — proxy always runs on `nodejs`. This directly shapes how session-based route protection is implemented (see §4).
- `cookies()`, `headers()`, `params`, and `searchParams` are **fully async-only** (no synchronous fallback). Every session/cookie read and every dynamic route param must be awaited.
- Turbopack is the default bundler for `next dev`/`next build`; no config changes needed for this project.
- `next/image` defaults changed: `images.qualities` now defaults to `[75]` only, and remote sources require `images.remotePatterns` (the older `images.domains` is deprecated). TMDB poster hosts must be added there.
- ESLint uses flat config by default (already reflected in the repo's `eslint.config.mjs`).

**Alternatives considered**: Writing against generic/older Next.js docs (rejected — would produce a `middleware.ts` file that Next 16 no longer recognizes, and synchronous `cookies()`/`params` access that no longer compiles).

## 2. Postgres provider: Neon vs "Vercel Postgres"

**Decision**: **Neon** (accessed either directly or via the Vercel Marketplace Neon integration), using the `@neondatabase/serverless` HTTP driver.

**Rationale**: Vercel Postgres as a distinct product was sunset (June 2025); every existing Vercel Postgres database was migrated onto Neon, and new Vercel Postgres instances can no longer be created — Vercel's own Marketplace now lists Neon directly. Going straight to Neon gets the same underlying database, avoids depending on a discontinued product name, and is meaningfully cheaper on Neon's own free tier than routing through the old Vercel-branded wrapper. Neon's free tier (generous storage/compute for a 2-user personal app, branching, point-in-time restore) satisfies the spec's "zero monthly cost" and "data survives deploys" requirements (FR-023) without extra infrastructure.

**Alternatives considered**:
- *Vercel Postgres* — rejected, product no longer exists as a distinct offering to provision.
- *Supabase-as-DB* — viable (also Postgres, also has a free tier), but adds an auth/storage/realtime surface this project doesn't use; picked Neon for a smaller footprint.
- *PlanetScale* — MySQL, not Postgres; spec explicitly asks for Postgres.

## 3. Typed ORM: Drizzle vs Prisma

**Decision**: **Drizzle ORM** with `drizzle-kit` for migrations, paired with the Neon HTTP driver (`drizzle-orm/neon-http`).

**Rationale**: The schema is small (3 tables) and the queries are simple CRUD + a couple of uniqueness constraints — Drizzle's SQL-shaped, fully-typed query builder is a natural fit and has first-class Neon HTTP driver support, which matters for Vercel's serverless function cold-starts (no persistent connection pool needed, no binary engine to bundle). Prisma's query engine binary adds cold-start weight and historically needed Accelerate/Data Proxy to work well over HTTP-only connections in serverless; Drizzle avoids that entirely while still giving full compile-time type safety end to end (schema → query → `List`/`MovieEntry` types used in Server Actions).

**Alternatives considered**:
- *Prisma* — rejected for this scale: heavier serverless cold start, extra infra (Data Proxy/Accelerate) to get the same HTTP-driver benefit Drizzle has natively.
- *Raw `pg`/`postgres.js` with hand-written types* — rejected: loses compile-time guarantees the spec's "typed ORM" requirement calls for.

## 4. Auth: Auth.js (NextAuth) v5, credentials provider, session-based

> **Revised after version verification (2026-07-21)** — see below. The original decision (database sessions) is not achievable with the installed package and has been changed to JWT sessions. The rationale bullets below are kept but struck through where superseded; the alternatives list now reflects what's actually shipped.

**Decision**: **Auth.js v5** (`next-auth@5.0.0-beta.32` — there is no stable `5.x` on npm; `next-auth@5` resolves to nothing, `@beta` is the only installable v5 line) with the **Credentials provider only** (no OAuth providers registered), **JWT sessions** (not database sessions — see verification below), and the single `auth()` helper re-exported as the **`proxy`** function in `proxy.ts` for optimistic route protection.

**Version verification finding**: `session: { strategy: "database" }` combined with a Credentials-only provider list is not silently downgraded to JWT — it is a hard configuration error in the installed version. `node_modules/@auth/core/lib/utils/assert.js:114-118`:
```js
if (hasCredentials) {
    const dbStrategy = options.session?.strategy === "database";
    const onlyCredentials = !options.providers.some((p) => (typeof p === "function" ? p() : p).type !== "credentials");
    if (dbStrategy && onlyCredentials) {
        return new UnsupportedStrategy("Signing in with credentials only supported if JWT strategy is enabled");
    }
```
This `UnsupportedStrategy` error is not a warning — `node_modules/@auth/core/index.js:72-89` shows any non-GET/non-HTML action (i.e. exactly the `signIn('credentials', ...)` POST call our `signInAction` makes) with a config error returns an HTTP 500 (`"There was a problem with the server configuration."`) instead of authenticating. With this app's Credentials-only provider list (no OAuth, per FR-002), sign-in would fail outright at every attempt if `session.strategy` were left as `"database"`. There is no manual escape hatch inside Auth.js for this combination — the Drizzle adapter's session methods (`createSession`, `getSessionAndUser`, etc.) are simply never invoked when `hasCredentials && onlyCredentials` is true and `strategy` is forced to `"jwt"`.

**Rationale** (updated):
- Auth.js v5 unifies `getServerSession`, the old middleware helper, and provider config behind one `auth()` call usable from Server Components, Server Actions, Route Handlers, and now `proxy.ts`. The env var prefix is `AUTH_*` (not the old `NEXTAUTH_*`).
- The Credentials provider is the right fit for "exactly two pre-registered accounts, email + password, no OAuth, no self-service sign-up" (FR-002). Auth.js does not hash/verify passwords itself for this provider by design (security-sensitive, left to the app) — password verification is done in the `authorize()` callback using `bcryptjs` against a `password_hash` column seeded out-of-band.
- ~~Database sessions (rather than JWT-only) were chosen over stateless JWT sessions because: (a) this app already has Postgres for everything else, so a `sessions` table adds no new infrastructure; (b) it allows revoking a session server-side (relevant since a session-expiry edge case is explicitly in scope); (c) the spec has no requirement for edge-runtime auth checks, and `proxy.ts` in this Next.js version is Node-only anyway, so there's no JWT-for-edge-compatibility reason to prefer stateless tokens.~~ **Superseded**: database sessions are not achievable with Credentials-only auth in the installed version (see verification above). **JWT sessions** are used instead. The spec's only session-related requirement (`spec.md` line 178: "the next action redirects them to login" on mid-action expiry) is fully satisfiable by a JWT's `maxAge`/`exp` claim checked in `verifySession()` — no DB round-trip needed for that behavior. The spec has no requirement for server-side forced revocation (e.g. "log out all devices", admin-initiated invalidation), so the one capability JWT sessions give up is not something this app needs. No `sessions` table is created.
- **`@auth/drizzle-adapter` is not used at all, and has been uninstalled.** Initially installed alongside the Credentials provider on the (reasonable-looking) assumption that Auth.js needs *some* adapter to look up users even without database sessions. Traced the actual Credentials sign-in path in `node_modules/@auth/core/lib/actions/callback/index.js:227-277`: on a Credentials POST, it calls `provider.authorize(credentials, request)` directly, builds the JWT payload from `authorize()`'s return value via `callbacks.jwt(...)`, and encodes/sets the cookie — it never calls `handleLoginOrRegister` (`lib/actions/callback/handle-login.js`), which is the only place any adapter method (`getUser`, `getUserByAccount`, `createUser`, `createSession`, ...) gets invoked, and that function is only reached for `oauth`/`oidc`/`email`/`webauthn` account types (`handle-login.js:19`), never `credentials`. `assert.js:128-143` confirms an adapter is only *required* for email-provider or database-strategy setups, neither of which apply here. In this app, the `authorize()` callback queries the `users` table directly via plain Drizzle queries (`drizzle-orm`, not the adapter) to verify email/`password_hash`, so the adapter package added a dependency, an install step, and adapter-shaped tables in the mental model for zero runtime benefit. `drizzle-orm` itself is still a primary dependency — it's what `authorize()`, and every other data-layer query in this app, is built on.
- `proxy.ts` performs only the **optimistic** check (session cookie present/valid, decoded from the JWT) and redirects signed-out visitors to `/login` for every route except `/login` itself (FR-001, User Story 1 scenario 3). The **authoritative** check happens in a small Data Access Layer (`verifySession()`) called from every Server Action and Route Handler that touches data, per the local docs' recommended pattern (`node_modules/next/dist/docs/01-app/02-guides/authentication.md`, "Authorization" section) — this avoids relying on `proxy.ts` (or a layout) as the only line of defense. With JWT sessions, `verifySession()` decodes/verifies the signed JWT cookie (still server-side, still can't be forged by the client) rather than querying a `sessions` row; it checks expiry the same way either strategy would.

**Alternatives considered**:
- ~~*JWT-only stateless sessions* — rejected: no server-side revocation...~~ **This is now the chosen approach**; see verification above. Trade-off accepted: no server-side forced revocation before natural JWT expiry. Not required by the spec.
- *Manual database-session workaround* (keep `strategy: "jwt"` to satisfy the assertion, but hand-create a session row in the adapter during `authorize()`/a `signIn` event and have `verifySession()` query it directly instead of trusting the JWT) — considered and rejected: reimplements Auth.js's session-cookie handling by hand (issuing/rotating/clearing a second cookie, syncing its expiry with the DB row, and bypassing the library's own CSRF/cookie-flag handling for that second cookie), for a revocation capability the spec doesn't ask for. Not worth the added attack surface for a 2-user personal app.
- *Rolling a custom cookie/JWT auth layer by hand* — rejected: the local docs explicitly recommend an auth library over hand-rolled session crypto for exactly this reason; Auth.js is already the constraint given in the technical requirements.
- *Passing OAuth providers "just in case"* — explicitly out of scope per the requirement ("no OAuth"). (Also worth noting: adding even one non-Credentials provider would flip `onlyCredentials` to false and make database sessions legal again per the assert.js logic above — but that's not a real option here since OAuth is explicitly out of scope.)

## 5. TMDB integration boundary

**Decision**: One Route Handler, `app/api/tmdb/search/route.ts` (`GET`), proxies title search to TMDB. It is the only place `TMDB_API_KEY` is read. It requires an authenticated session (checked via the DAL) before calling TMDB, and it filters out any TMDB result missing a usable `id` before returning JSON to the client (closes CHK021 from the amendments).

**Rationale**: A `GET` Route Handler (rather than a Server Action) matches the interaction shape — a debounced, cancelable client-side fetch as the user types a query — and Route Handlers are explicitly documented as not cached by default unless opted in, so no stale-search-result risk. Keeping it as the sole TMDB egress point satisfies FR-014 (key never reaches the client) trivially, since only server code ever imports it.

**Alternatives considered**: A Server Action for search — rejected only because typeahead search benefits from `fetch` + `AbortController` cancellation semantics that a plain async action call doesn't give as naturally; functionally either would keep the key server-side.

## 6. Mutation boundary: Server Actions vs a REST-style API

**Decision**: All mutations (create/rename/delete list, add/remove movie, toggle watched) are **Server Actions**, colocated per feature area (e.g. `app/lists/actions.ts`), invoked from `<form action={...}>` and `useActionState` for inline validation errors (duplicate name, empty name, 60-char limit).

**Rationale**: The local authentication guide's documented pattern for this exact class of app (form → Server Action → validate → DB call → redirect/return state) matches every mutation in this spec, gives inline error messages "for free" via `useActionState`, and keeps everything server-side without hand-building JSON API contracts for purely internal form submissions. Each Server Action still calls the DAL's `verifySession()` first, per the local docs' explicit warning that Server Actions must enforce authorization themselves and not rely on UI-level checks.

**Alternatives considered**: A full REST API under `app/api/lists/...` for mutations too — rejected as unnecessary indirection; nothing outside this Next.js app needs to call these mutations, so Server Actions are simpler and the spec's "automated tests for business rules" can exercise the Server Action functions directly/via a test DB rather than over HTTP.

## 7. Concurrency & data-integrity decisions carried from spec-amendments.md

These were explicitly deferred to the plan phase by the data-integrity checklist; resolved here:

- **CHK004** (simultaneous create of the same list name): enforced by a Postgres **unique index on `lower(trim(name))`**; the Server Action catches the resulting unique-violation error and surfaces the same inline "name already exists" message used for the application-level check, so the race and the common case look identical to the user.
- **CHK016** (durability/backup guarantees): delegated to Neon's provider-level point-in-time restore on its free tier; no app-level backup logic is built.
- **CHK017** (concurrent rename+delete of the same list): both operations run in a single DB transaction; whichever commits last wins (delete-wins if delete lands after rename, renamed-list-then-gone is also acceptable) — no special-cased conflict UI, matching the spec's last-write-wins assumption.
- **CHK018** (remove/toggle race on the same movie entry): if the entry no longer exists when a toggle/remove Server Action runs, the action treats it as a no-op and returns a gentle "this item was already removed" state rather than throwing.
- **CHK021** (TMDB results without a usable id): filtered server-side in the `/api/tmdb/search` Route Handler before the response is serialized (see §5).

## 8. Testing

**Decision**: **Vitest** for automated tests of business rules, run against a real (test) Postgres database — either a Neon branch created for CI or a local Postgres via Docker — rather than mocks, exercising the Drizzle queries and Server Action functions directly.

**Rationale**: Vitest has first-class TypeScript/ESM support matching this project's tooling (already TS + ESM `next.config.ts`), fast watch mode, and no extra Babel config needed. The spec's explicit test targets — duplicate list name prevention (case/whitespace-insensitive, including the unique-index race), duplicate movie-in-list prevention, watched/unwatched date recording, and cascade delete (list delete removes only its own entries) — are all data-layer/business-logic tests, not full end-to-end browser tests, so they're written as integration tests against Drizzle queries and the Server Action functions that wrap them.

**Alternatives considered**: *Jest* — works too, but Vitest was chosen for lower config overhead in an ESM/Turbopack-first project. *Mocking the database* — rejected: the business rules under test (uniqueness races, cascade delete) are exactly the kind of thing that only a real Postgres engine enforces correctly.

## Summary of resolved unknowns

| Area | Resolved to |
|---|---|
| Language/runtime | TypeScript, Node.js 20.9+ (Next.js 16 minimum) |
| Framework | Next.js 16.2.11, App Router, Turbopack default |
| Styling | Tailwind CSS v4 (already scaffolded) |
| Database | Neon Postgres (serverless HTTP driver) |
| ORM | Drizzle ORM + drizzle-kit |
| Auth | Auth.js v5 (`5.0.0-beta.32`), Credentials provider, **JWT sessions** (revised — database sessions unsupported with Credentials-only, see §4), `proxy.ts` for optimistic checks |
| Password hashing | bcryptjs in the Credentials `authorize()` callback |
| TMDB access | Single Route Handler `app/api/tmdb/search/route.ts` |
| Mutations | Server Actions per feature area, DAL-enforced authorization |
| Testing | Vitest, integration-style against a real test Postgres |
| Hosting | Vercel (free tier) |
