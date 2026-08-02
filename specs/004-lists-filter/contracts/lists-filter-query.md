# Contract: `getVisibleLists` / `hasAnyLists`

**File**: `app/(lists)/queries.ts` (new) | **Kind**: Server-only query functions, called from `app/(lists)/page.tsx`

## `getVisibleLists(filterValue: string | undefined): Promise<{ id: string; name: string }[]>`

### Behavior

```
trimmed = (filterValue ?? "").trim()

if trimmed === "":
  SELECT id, name FROM lists ORDER BY name ASC
else:
  SELECT id, name FROM lists
  WHERE position(lower(trimmed) in lower(name)) > 0
  ORDER BY name ASC
```

### Guarantees

| Requirement | How this contract satisfies it |
|---|---|
| FR-003 — case-insensitive, accent-sensitive substring | `lower()` on both sides of `position()`; no `unaccent`, no other normalization ([[research]] §1) |
| FR-006 — server-side, query-time filtering | The candidate set is narrowed by the `WHERE` clause itself; the function never fetches all rows and filters in JS ([[research]] §4) |
| FR-008 — clearing restores the full list | Empty/whitespace-only input takes the no-`WHERE` branch, identical to today's unfiltered query |
| FR-011 — ordering unchanged | `ORDER BY name ASC` in both branches, unconditionally — the filter never reorders results |
| FR-013 / SC-005 — literal substring, no wildcard/escape interpretation | `position()` has no pattern-metacharacter vocabulary; every character of `trimmed`, including `%`, `_`, and `\`, participates only as a literal byte sequence to search for |
| Edge case — whitespace-only input | `.trim()` collapses it to `""`, taking the unfiltered branch — never matches a literal space inside a stored name by accident |

### Non-goals

- No pagination, no limit — the existing overview page has never paginated and this feature doesn't add scale requirements that would need it (spec.md Scale/Scope: 2-user workspace).
- No ranking/relevance ordering — matches stay in the existing alphabetical order regardless of where in the name the substring occurs (FR-011).

## `hasAnyLists(): Promise<boolean>`

### Behavior

```
row = SELECT id FROM lists LIMIT 1
return row !== undefined
```

### Guarantees

| Requirement | How this contract satisfies it |
|---|---|
| FR-007 | Called only when `getVisibleLists` returned zero rows and a filter is active; its result is what distinguishes "no lists exist at all" (unchanged existing message) from "lists exist but none match" (new message) — see [[data-model]]'s page-level state table |

### Non-goals

- Not called on every render — only on the one empty-and-filtered path ([[research]] §5). Callers must not call it unconditionally; doing so would add a query to the common case this contract is specifically designed to avoid.
