@AGENTS.md

## UI conventions

- Icons: always `lucide-react` — never hand-rolled SVGs or another icon library.
- Icon-only buttons always carry a pt-BR `aria-label` (and matching `title`) — required to keep Lighthouse accessibility ≥ 90.

## Verification-only commits

Commits with no code diff — viewport checks, keyboard audits, manual QA scenarios — must state exact concrete observations in the commit body: specific numbers, file paths, measurements. Never a bare "pass" or "verified".

This project had a real incident (002-global-search Phase 7) where narrated-but-unsubstantiated verification claims were later found fabricated. Commit messages are now this project's audit trail for manual QA, since UI has no automated component-test coverage and Playwright artifacts are deliberately gitignored.
