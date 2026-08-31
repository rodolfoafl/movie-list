# Production smoke test (2026-08-31)

Scope: full end-to-end pass against the live deployment at `br-filmes.vercel.app`, driven through Playwright/Chromium as a real user with a real account. Ten specified steps, all functionally passing. One defect found (`F1`), two lesser items (`F2`, `F3`). Every write to production was reverted through the UI and verified against a reload.

Viewports: `1280×900` desktop, `360×780` mobile. Steps did not run in specified order — see [Method](#method).

## Summary

| | |
| --- | --- |
| Steps passed | 10 / 10 |
| Defects | 1 (`F1`) |
| Observations | 2 (`F2`, `F3`) |
| Production mutations | 4, all reverted |
| Residue left | none — `git status` clean, 22 lists, theme restored |

## 01 — Logged-out shell

- Header contains exactly **one** link, the `B&R Filmes` brand mark — `Listas` and `Filmes` absent
- Theme toggle works pre-login: dark → light, `body` background `rgb(51,51,51)` → `rgb(255,255,255)`, `aria-label` flips to `"Alternar para tema escuro"`
- `/search` while unauthenticated redirects to `/login`

## 02 — Login with a real account

- Submit → redirect to `/`, `h1` = "Minhas listas", **22 lists** rendered, `Listas`/`Filmes` restored, `Sair` present
- Session survives a fresh document load — `/search` stayed on `/search`, no bounce
- Auth cookie is **httpOnly**: `document.cookie` empty from page context
- `/login` while authenticated redirects to `/` — no stale form over a live session
- Login form: `email` + `password`, both `required`, `autocomplete="email"` / `"current-password"`, labels bound
- Rejection path (tested with a bogus address, not a wrong password on the real account, to avoid lockout risk): stays on `/login`, error in `role="alert"`, message `"E-mail ou senha inválidos."` — generic, so no user enumeration; password cleared
- Nit: email field cleared alongside the password — see `F3`

## 03 — Lists overview and filter

- Control row `mt-6 grid gap-4 sm:grid-cols-2` computes to `504px 504px` at 1280px — create-list form left, filter right. The list itself is a single 1024px-wide column, not two
- Filter `Terror` → **22 → 2** (`Filmes Terror Trash`, `Terror Aleatório`), URL synced to `?q=Terror`
- Filter `zzzqqq` → `ul` removed entirely, distinct message `"Nenhuma lista encontrada para este filtro."`
- Cleared → back to **22**, URL back to `/`

## 04 — List detail (Studio Ghibli, 26 movies)

- Whole-card link: `<a>` measures `929×120` inside a `1024×122` card — remainder is the two action buttons. `target="_blank"`, `rel="noopener"`
- Clicked *Akira* → new tab `imdb.com/title/tt0094625/`, document title `"Akira (1988) - IMDb"`, `h1` "Akira" — correct movie
- Watched toggle → card reads `"Assistido em 31/08/2026"`, `aria-label` → `"Marcar como não assistido"`. Reverted, and the revert survived a full reload — confirms server-side persistence
- Remove opens a native `<dialog>` (`:modal` true), heading "Remover filme", body `Remover "Akira" desta lista?`, initial focus on **Cancelar**
- Cancelar closed it with all **26** items intact

## 05 — In-list movie search

- Query `Totoro` → 3 results
- Dedup is correct: `Meu Amigo Totoro` renders with **no add button** — matched to the list's `My Neighbor Totoro` by TMDB id across the pt-BR/EN title difference
- **Defect:** result `龙猫&萤火虫之墓诞生物语` carries `href="https://www.imdb.com/"`. Clicked it — opens the IMDb homepage. See `F1`

## 06 — Global search and add-to-list modal

- Modal for *A Viagem de Chihiro* lists all **22 lists**; `Studio Ghibli` renders `checked: true, disabled: true` with `"(já está nesta lista)"`
- `Escape` dismisses the modal
- Add path exercised for real against a throwaway list — see step 08
- Same `F1` defect hit **2 of 7** results for query `Spirited Away` — not an edge case
- `/search` does not sync the query to the URL (stays bare `/search`) — see `F2`

## 07 — Theme persistence

- light → dark sets `localStorage.theme = "dark"`, `body` background `rgb(51,51,51)`, `aria-label` → `"Alternar para tema claro"`
- After a full page load, still dark with the same computed background — persisted
- Theme also carried intact across the login boundary rather than resetting

## 08 — Create, rename, delete a list

- Created `ZZ Teste E2E (apagar)` — **22 → 23**, id `078137d7-d32f-4a4c-80dc-3d526c992e88`, sorted to the end
- Added *Blade Runner 2049* (2017, `tt1856101`) via the global-search modal; verified present on the list page
- Rename opens an inline editor prefilled with the current name and auto-focused, with `Salvar` / `Cancelar`. Renamed to `ZZ Teste E2E RENOMEADA`, persisted across a reload
- Delete → ConfirmDialog `"Excluir a lista … Todos os filmes desta lista serão removidos."`, focus on Cancelar. Used **Confirmar** → back to exactly **22**

## 09 — 360px lists overview

- `document.documentElement.scrollWidth` `345` equals `clientWidth` `345` — no horizontal scroll
- **Zero** elements overflow the viewport, checked across every node's `getBoundingClientRect()`
- Filter input at `y=137` sits above the create input at `y=195` — filter-first stacking confirmed
- Long names (`Filmes clássicos dignos de maratona com chuva e pipoca`) wrap without overflow

## 10 — Logout

- Redirects to `/login`
- Header drops to brand mark + theme toggle; `Listas` and `Filmes` gone

## Findings

### F1 — Cards without an IMDb id link to the IMDb homepage (defect)

`app/components/MovieClickableInfo.tsx` lines 20–22:

```tsx
const href = imdbId
  ? `https://www.imdb.com/title/${imdbId}/`
  : "https://www.imdb.com/";
```

When a TMDB result has no `imdbId`, the card still renders as a full-width anchor pointing at the IMDb root. The entire card is clickable and dead-ends the user on IMDb's front page, unrelated to the title they clicked. Reproduced on **both** search surfaces (in-list and global), at **2 of 7** results on one query — frequent enough to read as a broken feature rather than an edge case.

The fallback is deliberate — the label also switches from `"Abrir página do filme no IMDb"` to `"Abrir IMDb"` — but a label change does not rescue a link that goes nowhere useful.

**Fix:** render those cards as a non-link container rather than anchoring to the IMDb root.

### F2 — Global search does not sync its query to the URL (observation)

`/search` stays bare after a query, so results cannot be reloaded, bookmarked, or shared, and a refresh discards them. The lists filter on the overview *does* sync `?q=` (verified in step 03), so the two search surfaces behave inconsistently.

### F3 — Failed login clears the email field too (nit)

On an invalid submission the password is cleared (correct), but so is the email. A user who mistypes their password must retype their address as well. Everything else about the flow — the `role="alert"`, the generic message, the authenticated redirect guard — is clean.

## Production data touched

| Mutation | Scope | Final state |
| --- | --- | --- |
| *Akira* marked watched | `Studio Ghibli` — a real list | Reverted, verified via reload |
| Test list created → renamed → deleted | Throwaway `ZZ Teste E2E` | Deleted; 22 lists restored |
| *Blade Runner 2049* added | Throwaway list only | Removed with the list |
| Theme switched to dark | Browser `localStorage` | Restored to `light` |
| Screenshot written to repo root | `lists-360.png` | Deleted; tree clean |

No real list gained, lost, or reordered an entry. The only writes that touched pre-existing data were the *Akira* watched flag and the theme, both restored.

## Method

The browser arrived with a pre-authenticated session and no credentials were available at the outset, so steps did not run in specified order. Executed order:

```
03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 01 → 02
```

Deferring the logged-out checks until after logout let step 10 close both itself and step 01 in one pass, instead of spending the session early and stranding the authenticated steps. Step 02 ran last, once credentials were supplied — which exercised the real login form end to end, better than the inherited session would have.

Credentials were used for three form submissions and were not written to any file, log, or memory. The session was left signed in, matching the state the run started from.
