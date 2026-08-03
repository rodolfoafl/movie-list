---
name: speckit-phase-execution
description: The standard execution ritual for running ONE phase of a /speckit.implement cycle in this repo — pre-flight checks, tests-first discipline, per-task commit/checkbox rules, Playwright verification conventions, and the mandatory stop-after-phase boundary. Use this skill whenever the user asks to run/implement a specific phase, user story, or set of tasks (e.g. "run phase 3", "implement User Story 2", "do T001-T005"), or whenever about to invoke /speckit.implement for anything less than the full remaining feature. Also consult it before writing any integration test that touches a shared database, and before writing any verification-only commit message.
---

# Spec Kit Phase Execution

This encodes the per-phase ritual this project has settled on after several
features' worth of real incidents (fabricated verification claims, orphaned
test-DB rows, dev-vs-production gaps). Applying it by default is cheaper than
re-learning any of these the hard way again. Pairs with the
`new-feature-kickoff` skill (which covers the *start* of a feature, before
implementation begins).

## 1. Pre-flight (before executing ANY phase)

```bash
git branch --show-current   # must NOT be main
git status                  # must be clean, or only contain expected in-progress work
```

Confirm which phase/tasks are actually in scope — read the phase's Goal and
task list from `tasks.md` directly rather than assuming from the phase
number alone; task ranges shift when checklists/analyze findings add tasks
mid-cycle.

## 2. Execution rules (apply to every task in the phase)

- **Tests first**: for any task with a named test, write the test before
  the implementation and confirm it actually fails first (missing
  module/function error, not a false pass) — then implement, then confirm
  it passes.
- **Commit per task**: one commit per task (or a tightly-related small
  group), referencing the task ID in the message, with that task's
  `tasks.md` checkbox checked off in the **same** commit — never as a
  separate later pass.
- **Database access**: any test or script touching a database uses
  `TEST_DATABASE_URL` — via `npm run dev:test` for manual/Playwright
  sessions, or an explicit `--database-url`/env-var flag for standalone
  scripts. Never the bare `DATABASE_URL` default, even "just to check
  something quickly."
- **Test-data isolation**: assertions in integration tests must scope to
  the specific rows/ids *this test itself created* — never assume the
  table starts empty, and never filter only by a name prefix (e.g.
  `zz-test-`) as the sole isolation mechanism, since an orphaned row from
  an earlier manual session can share that same prefix and produce a
  false pass. Filter by the actual ids returned from this test's own
  setup calls.
- **Playwright verification**: for any task with user-visible behavior,
  verify against `npm run dev:test` (never `npm run dev`). Delete any
  test data created during the session afterward and stop the dev server.
  - **Context hygiene**: MCP tool results (screenshots, accessibility
  snapshots, console logs) stay in context for the rest of the session —
  they don't get discarded automatically just because the browser closed.
  Once a task's Playwright verification is done and its concrete findings
  are captured in the commit message, `/compact` before starting the next
  task in the same phase rather than letting raw tool output accumulate
  across the whole phase.
- **Session boundary**: this skill's own rule (§4, stop after the phase)
  is already a natural `/clear` point — what needs to survive into the
  next phase lives in git (commits, `tasks.md` checkboxes, `notes.md`),
  not in the live conversation. Prefer starting the next phase's prompt in
  a fresh session over continuing the same long-running one.
- **Verification-only commits** (no code diff — viewport checks, keyboard
  audits, manual QA): the commit body must state exact concrete
  observations — specific numbers, paths, counts, URLs — never a bare
  "pass"/"verified". This project had a real incident where narrated
  verification claims were later found fabricated purely by wall-clock/
  filesystem-timestamp forensics; commit messages are the audit trail for
  manual QA now, since there's no automated UI component-test coverage.
- **Icons**: `lucide-react` only, with a pt-BR `aria-label` on any
  icon-only control.

## 3. If a compliance/phase audit will run on this phase

Do not apply fixes before the audit runs, even if you already know
something is wrong — applying a fix pre-audit destroys the evidence of
whether that review layer would have caught it independently. Let the
audit run against the as-implemented state first.

## 4. Scope boundary — the most important rule

Implement **only** the tasks explicitly specified for this phase, then
**stop** and report for human review. Do not cascade into the next phase
automatically, even if the current phase's tests all pass and the work
feels naturally continuous. Every phase boundary in this project's history
has been a deliberate human checkpoint, not a pause for its own sake.

## 5. What to report back

- Which tasks were completed, with their commit hashes.
- Test results (counts, not just "passed").
- Concrete Playwright observations for any UI-touching task.
- Anything found that wasn't anticipated by the task description (a
  design ambiguity, an existing-code assumption that didn't hold, test-DB
  hygiene issues, etc.) — flag it explicitly rather than silently working
  around it.