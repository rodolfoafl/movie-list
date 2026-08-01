@AGENTS.md

## UI conventions

- Icons: always `lucide-react` — never hand-rolled SVGs or another icon library.
- Icon-only buttons always carry a pt-BR `aria-label` (and matching `title`) — required to keep Lighthouse accessibility ≥ 90.

## Verification-only commits

Commits with no code diff — viewport checks, keyboard audits, manual QA scenarios — must state exact concrete observations in the commit body: specific numbers, file paths, measurements. Never a bare "pass" or "verified".

This project had a real incident (002-global-search Phase 7) where narrated-but-unsubstantiated verification claims were later found fabricated. Commit messages are now this project's audit trail for manual QA, since UI has no automated component-test coverage and Playwright artifacts are deliberately gitignored.

## Git workflow

A `.githooks/pre-commit` hook blocks any direct commit to `main` (it checks `git symbolic-ref --short HEAD` and exits 1 if the branch is `main`, printing a message to create a branch instead). `core.hooksPath` is set to `.githooks` automatically by the `prepare` npm script, which runs on every `npm install` — no manual setup step required after cloning.

`git commit --no-verify` bypasses this (and any other) hook — it's Git's own well-known escape hatch, not a secret. Use it deliberately when there's a real reason, not out of habit.

This hook only protects local commits on machines where it's configured (i.e. where `npm install` has run and `core.hooksPath` is set). It does not replace GitHub-side branch protection rules on `main`, which is a separate, server-side control worth considering independently.
