# Theme Decision: Aquamarine Palette (Tailwind v4 tokens)

**Scope**: Polish item, not a Spec Kit feature — no spec.md/plan.md/tasks.md.
This document is the single source of truth for the token mapping; the
implementation prompt references it directly.

**Source palette** (from the 2020 app, roadmap issue #3):
```
--primary-color:       #7fffd4
--primary-color-light: #a5ffe0
--primary-color-dark:  #58b294
--dark-color:          #333333
--dark-color-light:    #999999
--light-color:         #ffffff
--danger-color:        #dc3545
--success-color:       #28a745
```

**Decisions confirmed with the product owner**: dark mode gets adapted (not
left as generic grays); a warning tone is derived rather than falling back
to Tailwind's default amber; `focus-visible` styling is added now, in the
same pass.

## Contrast findings (computed, WCAG 2.1 relative-luminance formula) — these override intuition

| # | Naive choice | Ratio | Verdict | Resolution |
|---|---|---|---|---|
| 1 | `--dark-color-light` (#999) as muted **text** on white | 2.85:1 | **FAILS** AA (needs 4.5:1) | `--dark-color-light` is UI/decoration-only (borders, disabled states, placeholders) — never text. Muted text needs a separate, computed-safe tone (see below). |
| 2 | `--primary-color-dark` (#58b294) bg + white text (the instinctive "colored button, white text" pattern) | 2.56:1 | **FAILS** AA | Use `--primary-color` (bright aquamarine) as the button **fill**, `--dark-color` as the button **text** → 10.32:1. `--primary-color-dark` becomes the **hover** fill (text stays `--dark-color`, still 4.94:1 — passes). |
| 3 | `--primary-color` or `--primary-color-dark` as a `focus-visible` ring on a light background | 1.22:1 / 2.56:1 | **FAILS** the 3:1 non-text-contrast minimum | Focus ring uses `--dark-color` (light mode) / `--light-color` (dark mode) — not the brand teal. The palette cannot produce an accessible focus indicator on its own. |

**Consequence of #2**: the primary-button pattern becomes theme-invariant —
the same aquamarine fill + dark text works in both light and dark mode
(the button's own contrast is fill-to-text, independent of the page
background), which also resolves the audit's Finding #3 (two divergent
primary-button variants collapse into one).

## Light-mode token mapping

| Role | Token(s) | Value | Replaces |
|---|---|---|---|
| Page background | `--color-paper` | `--light-color` (#fff) | `bg-zinc-50` |
| Card/surface background | `--color-surface` | `--light-color` (#fff) | `bg-white` |
| Card/input border | `--color-ink-border` | `--dark-color` at 10–15% opacity | `border-black/10`, `border-black/15` |
| Primary text | `--color-ink` | `--dark-color` (#333) | `text-black` |
| Muted/secondary text | `--color-ink-muted` | **derived**, see below | `text-zinc-600`, `text-zinc-500` |
| Secondary-button text | `--color-ink-soft` | `--dark-color` at ~75% (close to current `zinc-700`) | `text-zinc-700` |
| Primary button fill | `--color-primary` | `--primary-color` (#7fffd4) | `bg-black` |
| Primary button fill (hover) | `--color-primary-hover` | `--primary-color-dark` (#58b294) | `hover:bg-[#383838]` |
| Primary button text | (uses `--color-ink`) | `--dark-color` | `text-white` |
| Focus ring | `--color-focus-ring` | `--dark-color` | *(none exists today)* |
| Danger text/border | `--color-danger` | `--danger-color` (#dc3545) | `text-red-600/700`, `border-red-300` |
| Success text | `--color-success` | `--success-color` (#28a745) | `text-emerald-600/700` |
| Warning banner | `--color-warning*` | **derived**, see below | `amber-*` (3 identical banners + 1 inline use) |

**Muted text (`--color-ink-muted`)**: `--dark-color-light` (#999) cannot be
used per Finding #1. Implementation step: compute the darkest gray ≥ 4.5:1
against `--light-color` that still reads as visually related to `#999`
(same hue family, adjusted lightness only) — the agent must compute and
state the ratio, not eyeball it.

**Warning tone**: the palette has no warm hue (red, teal, gray, white only)
— there is nothing to literally derive an amber from. Proposal: one small,
clearly-labeled addition — a curated gold/amber tone matched to the
palette's saturation level (not a Tailwind stock color), used only for the
existing warning-banner pattern (fetch-error banners × 3, the "already
removed" inline notice × 1). Implementation step: the agent proposes a
specific hex, computes text-on-background contrast for the banner pattern
(text/bg/border, mirroring the existing amber banner's structure), and
shows the ratio before it's adopted — treat as a mini-approval gate, same
as any other real design decision in this project.

## Dark-mode token mapping

The palette's only dark neutral is `--dark-color` (#333), a charcoal, not
a true black — dark mode here is intentionally a "charcoal" dark theme,
not the near-black `zinc-950`/`bg-black` currently used. This is a
deliberate consequence of respecting the given palette rather than
inventing an unrequested near-black.

| Role | Value | Note |
|---|---|---|
| Page background | `--dark-color` (#333) | Flattened vs. today's page/card elevation split — card surfaces distinguished by border/subtle overlay only, not a second dark shade |
| Card/surface background | `--dark-color`, differentiated via a subtle border/overlay (e.g. `--light-color` at ~5% over the base) | No second invented near-black |
| Primary text | `--light-color` (#fff) | Mirrors light mode's inverse |
| Muted text | `--dark-color-light` (#999) on `--dark-color` (#333) | Computed ratio ≈ 4.44:1 — **borderline**, just under the 4.5:1 normal-text threshold. Passes the 3:1 large-text/UI threshold easily. Must be verified against a real Lighthouse run, not assumed; if it fails in practice, lighten slightly. |
| Primary button | Same aquamarine fill/text as light mode (theme-invariant, see Finding #2's consequence) | No change needed between modes |
| Danger/success | Lighter tints of `--danger-color`/`--success-color` needed for legibility on a dark charcoal background — the literal hexes are tuned for text-on-white | Implementation step: agent computes and states the lightened tint + ratio, mirroring how `red-600`/`red-400` already diverge by mode today |
| Focus ring | `--light-color` (#fff) | Mirrors light mode's `--dark-color` choice |

## Component mapping (from the color-audit)

Apply the "Recurring patterns" table from the audit directly against the
tokens above — every occurrence of a pattern in that table maps to exactly
one token pair (light/dark), collapsing the two divergent primary-button
variants (audit Finding #3) and the two treatments of amber (Finding #4)
into one consistent implementation each. The two distinct reds (destructive
button vs. status/error text, audit Finding #5) both map to `--color-danger`
— same token, since the palette provides only one danger hex; any visual
distinction between "destructive action" and "error text" going forward is
via opacity/weight, not a second red.

## Non-goals

- Not touching the dead `--background`/`--foreground` `globals.css` vars —
  they're removed outright (zero consumers, confirmed by the audit) rather
  than folded into the new system.
- Not redesigning layout, spacing, or typography — colors and focus-ring
  only, per the roadmap issue's scope.