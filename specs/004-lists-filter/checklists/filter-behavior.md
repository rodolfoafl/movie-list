# Filter Behavior Checklist: Filter Lists by Name on the Overview Page

**Purpose**: Validate requirements quality for three risk areas raised
before planning: URL/browser-history mechanics of the live-typing filter,
literal-character escaping under FR-013, and diacritic/accent sensitivity
of the case-insensitive match — i.e. is the spec precise enough on these
points to plan and implement against, not whether the (not-yet-built)
implementation handles them.
**Created**: 2026-08-01
**Feature**: [spec.md](../spec.md)
**Depth**: Standard
**Note**: plan.md does not exist yet (checklist requested before
`/speckit.plan` completed) — items are evaluated against spec.md only.

## URL / Browser-History Mechanics (Live Typing)

- [x] CHK001 - Is the mechanism for updating the URL during live typing
  (e.g., replacing the current history entry vs. pushing a new one per
  keystroke) explicitly specified? [Gap, Spec §FR-004, FR-005]
- [x] CHK002 - Does the spec state whether each keystroke may create a
  separate browser-history entry, or whether history entries are expected
  to collapse/debounce into one per "settled" filter value? [Completeness,
  Spec §FR-004]
- [x] CHK003 - Is there an acceptance criterion for browser Back/Forward
  behavior after filtering (e.g., pressing Back once returns to the
  pre-filter view, not one keystroke at a time)? [Gap, Spec §User Story 1]
- [x] CHK004 - Do FR-004 ("update live as the user types") and FR-005 ("URL
  reflects the current filter value") reconcile precisely on *when* the URL
  updates relative to keystrokes — immediately per keystroke, or only after
  typing settles? [Consistency, Spec §FR-004, FR-005]
- [x] CHK005 - Do the User Story 1 acceptance scenarios exercise
  browser-history/navigation behavior specifically, or only the visible
  filtered result? [Coverage, Spec §User Story 1]

## Literal-Character Matching (FR-013)

- [x] CHK006 - Does FR-013 specify the expected behavior when the user's
  filter text itself contains a literal escape character (e.g. a
  backslash), in addition to the named `%`/`_` wildcard characters? [Gap,
  Spec §FR-013]
- [x] CHK007 - Is "matched literally" in FR-013 precise enough to determine
  the full set of characters requiring special handling (just `%` and `_`,
  or also whatever character an escaping mechanism would itself use)?
  [Clarity, Spec §FR-013]
- [x] CHK008 - Does the Edge Cases section's `%`/`_` example extend to (or
  explicitly exclude) other pattern-significant characters a chosen
  matching mechanism might introduce? [Completeness, Spec §Edge Cases]
- [x] CHK009 - Is there a measurable success criterion covering the
  literal-character edge case, or does Success Criteria only cover the
  case-sensitivity dimension (SC-002) and leave FR-013 untraced? [Gap,
  Traceability, Spec §Success Criteria]

## Diacritic / Accent Sensitivity (pt-BR)

- [x] CHK010 - Do FR-003 and SC-002 specify whether matching is
  accent/diacritic-sensitive or -insensitive (e.g., whether typing "sessao"
  is required, permitted, or forbidden to match a list named "Sessão")?
  [Gap, Spec §FR-003, SC-002]
- [x] CHK011 - Is "case-insensitive" in FR-003 scoped unambiguously (plain
  ASCII case-folding only, vs. locale-aware pt-BR comparison that could
  incidentally affect accented-character matching)? [Ambiguity, Spec
  §FR-003]
- [x] CHK012 - Given this is a pt-BR application where accented list names
  are plausible (e.g. "Sessão", "Romântico"), is the chosen
  accent-sensitivity behavior recorded as an explicit assumption or
  requirement, rather than left unstated? [Gap, Spec §Assumptions]

## Notes

- All three focus areas were flagged as open by the requester before
  `/speckit.plan` ran; none currently has a corresponding
  `[NEEDS CLARIFICATION]` marker in spec.md, so every item here starts
  unchecked pending a decision on each point.
- Recommended resolution path: answer CHK001-CHK012 via spec amendments (or
  an explicit Assumptions entries) before `/speckit.plan` proceeds, per this
  project's own precedent of resolving checklist findings through amendment
  before planning continues.
