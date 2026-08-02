# Spec Amendments — Filter Behavior Checklist Resolution

**Status:** APPLIED (2026-08-01)
**Applies to:** specs/004-lists-filter/spec.md
**Source:** checklists/filter-behavior.md review

Paste the sections below into spec.md as indicated, then mark the
corresponding CHK items using the resolution table at the end.

---

## 1. REPLACE — FR-003

Old: "The filter input MUST narrow the visible lists to only those whose
name contains the typed text as a case-insensitive substring match."

New: "**FR-003**: The filter input MUST narrow the visible lists to only
those whose name contains the typed text as a case-insensitive substring
match. Case-insensitivity applies to letter case only (e.g. "A" matches
"a") and MUST NOT incidentally fold or normalize accented characters —
"e" MUST NOT match "é" (matching is accent-sensitive; see Assumptions)."

## 2. REPLACE — FR-005

Old: "The current filter value MUST be reflected in the page's URL as a
query parameter, such that reloading the page or sharing the URL
reproduces the same filtered view."

New: "**FR-005**: The current filter value MUST be reflected in the
page's URL as a query parameter, such that reloading the page or sharing
the URL reproduces the same filtered view. This URL update MUST replace
the current browser-history entry (not push a new one) for every
keystroke-driven change — typing in the filter field MUST NOT create a
new entry in the browser's Back/Forward history; the URL simply always
reflects the current value."

## 3. REPLACE — FR-013

Old: "Substring matching MUST treat pattern-special characters in either
the filter text or list names as literal characters, not as wildcards."

New: "**FR-013**: Substring matching MUST behave as a pure
literal-substring test: every character in the filter text — including
SQL pattern-metacharacters such as `%` and `_`, and any character an
implementation's own escaping mechanism might use (e.g. a backslash) —
MUST be matched as itself, never interpreted as a wildcard, escape
marker, or other special token. This is a property the matching behavior
must satisfy, not a prescription of which mechanism achieves it."

## 4. ADD — one new Functional Requirement (continuing from FR-013)

- **FR-014**: Pressing the browser's Back button while on a filtered
  overview page MUST return to whatever page or state the user navigated
  from to reach the overview page — never step backward through
  intermediate filter values one keystroke at a time. (This follows
  directly from FR-005's replace-not-push behavior.)

## 5. ADD — new acceptance scenario under User Story 1

"5. **Given** the user arrived at the overview page from another page
(e.g. a header nav link) and then typed a filter value, **When** they
press the browser's Back button once, **Then** they return directly to
the page they came from — not to an intermediate, less-filtered state."

## 6. ADD — one new Success Criterion (continuing from SC-004)

- **SC-005**: A list whose name contains a literal `%`, `_`, or `\`
  character is matched only by filter text containing that exact literal
  sequence — never treated as a wildcard or escape token, and never
  producing a false match or false non-match because of it.

## 7. ADD — two new Assumptions

- Matching is accent/diacritic-**sensitive**: typing "sessao" does NOT
  match a list named "Sessão" — an exact substring comparison on the
  stored characters, not a normalized/accent-folded comparison. This
  avoids depending on a Postgres extension (e.g. `unaccent`) whose
  availability on this project's Neon-hosted database has not been
  verified, and keeps the matching mechanism simple. If accent-insensitive
  matching is wanted later, it is a deliberate, separate feature change —
  not an assumed default.
- The URL's replace-not-push behavior (FR-005/FR-014) applies only to the
  filter's own keystroke-driven updates; normal navigation to/from the
  overview page (e.g. via header links) still behaves as ordinary
  navigation and is unaffected by this rule.

## 8. Resolution table for checklists/filter-behavior.md

| Item | Resolution |
| --- | --- |
| CHK001 | Resolved: FR-005 explicitly specifies replace-not-push |
| CHK002 | Resolved: FR-005 — history entries are never created per keystroke, only ever replaced |
| CHK003 | Resolved: FR-014 + new acceptance scenario #5 |
| CHK004 | Resolved: FR-005's mechanism (always replace) makes "when" a non-issue — the URL always reflects the current value with no accumulating entries |
| CHK005 | Resolved: new acceptance scenario #5 exercises Back-button behavior directly |
| CHK006 | Resolved: FR-013 rewritten to cover "any character an implementation's own escaping mechanism might use" |
| CHK007 | Resolved: FR-013 reframed as an outcome property, not an enumerated character list |
| CHK008 | Resolved: FR-013's outcome-based framing extends to any pattern-significant character by construction |
| CHK009 | Resolved: new SC-005 traces FR-013 to a measurable, testable outcome |
| CHK010 | Resolved: new Assumption — accent-sensitive, explicitly decided |
| CHK011 | Resolved: FR-003 amended — case-folding scoped to letter case only, explicitly excludes accent-folding |
| CHK012 | Resolved: new Assumption entry records this as a deliberate decision, not silence |
