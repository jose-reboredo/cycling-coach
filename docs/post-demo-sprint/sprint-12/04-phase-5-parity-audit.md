# Sprint 12 — Phase 5 Parity Audit

**Date:** 2026-05-03
**Scope:** Confirm in-app surfaces (Today / Train / Schedule / You) render unchanged against the new Sprint 12 token system, and identify any regression before cutting v11.0.0.
**Method:** Static diff analysis → CSS var-resolution scan → live dev-server walk at desktop (1280×800) and mobile (375×812).
**Outcome:** **One regression found, fixed, and locked with a regression test.** Surfaces verified. Ready for v11.0.0 cut.

---

## 1. Risk surface (from `git diff 931b9aa..HEAD`)

| File | Δ | Risk |
|---|---|---|
| `apps/web/src/design/tokens.css` | +161 / -2 | Highest — every surface consumes |
| `apps/web/src/design/tokens.ts` | +186 / -? | Source-of-truth; no runtime path on web |
| `apps/web/src/components/Button/Button.{tsx,module.css}` | +286 / -? | All surfaces use Button |
| `apps/web/src/components/Card/Card.{tsx,module.css}` | +108 / -? | Today / You / Dashboard use Card |
| `apps/web/index.html` | +6 / -2 | Source Serif Pro added to font link |
| `apps/web/public/manifest.webmanifest` | +14 / -14 | Rebrand + theme_color tweak |
| `apps/web/src/components/SessionRoutePicker/SessionRoutePicker.module.css` | +1 / -1 | Cosmetic tokenization |
| `EmptyState/Skeleton/Toast/*` | net-new | Zero in-app consumers (yet) |
| `apps/web/src/pages/Landing.{tsx,module.css}` | landing rebuild | Already approved by founder at `6a4c222` |
| `apps/web/src/routes/design-system.{tsx,module.css}` | net-new | Showcase only; not on user paths |

## 2. Token diff — additive-only verdict

`tokens.css` is **strictly additive** at the runtime layer:

- All flat tokens (`--c-canvas`, `--s-1..--s-32`, `--c-line`, `--r-md`, `--sh-md` etc.) are preserved verbatim.
- New Layer 2 / Layer 3 tokens are appended. Existing CSS modules continue to resolve via the unchanged flat tokens.
- One semantic addition with behavioral effect: `--c-border` was previously undefined (Calendar.module.css fell through to `currentColor`); now resolves to `var(--c-line)`. **This is a fix, not a regression** — the silent fall-through was a Phase 1 inventory finding (commit `5c8e1bf`).

Locked by contract test:
- `tokens.css preserves the Sprint 12 backward-compat aliases (--c-border)`

## 3. Component public-API audit

**Button** — additive only.
Old variants `'primary' | 'secondary' | 'ghost' | 'strava'` all preserved; added `'tertiary' | 'link' | 'destructive'` and props `loading | iconLeft | iconRight`. All in-app consumers use `primary` or `ghost` only — both unchanged.

**Card** — additive only.
Old props `tone | rule | pad | className | as` all preserved; added `interactive | onClick`. All in-app consumers use `tone="elev"` only — that path unchanged.
Behavioral change: `tone="accent"` now uses glow-only (no border + shadow) per DESIGN.md §4 single-depth rule. **Zero in-app consumers use `tone="accent"`** — confirmed via grep.

## 4. Regression found — `--space-5` / `--space-7` undefined

**Symptom (caught statically, before deploy):**
`Card.module.css` migrated `.pad-md { padding: var(--s-5); }` and `.pad-lg { padding: var(--s-7); }` to the new `--space-N` semantic aliases as part of the rebuild — but the alias declarations in `tokens.css` only covered `--space-1, 2, 3, 4, 6, 8, 12, 16, 24, 32`. The `5` and `7` steps were silently pruned. Result: every Card in the app with `pad="md"` (the default) or `pad="lg"` would render with `padding: 0`, collapsing every dossier card, training-profile card, AI-coach card, and goal card across `/dashboard/today`, `/dashboard/you`, and the Marketing landing.

**Fix:** Added two missing aliases in `apps/web/src/design/tokens.css`:
```css
--space-5: var(--s-5);  /* 20px */
--space-7: var(--s-7);  /* 28px */
```

**Lock (regression test):**
Two new contract tests added to `design-system-contract.test.ts`:

1. **Spacing-alias presence test** — asserts every `--space-N` step Sprint 12 CSS references is declared.
2. **Token-resolution scan** — generic guard: every `var(--name)` (without fallback) in `Button | Card | EmptyState | Skeleton | Toast | design-system` CSS must resolve to a declaration in `tokens.css`. The scan distinguishes hard deps (`var(--x)`) from soft hooks (`var(--x, fallback)`) — the latter are Layer 3 placeholders that ship with fallbacks (e.g. `Button.--focusRing-width, 2px`) and are valid by design.

**Red-green cycle verified:**
- Reverted the tokens.css fix → both new tests fail with the exact regression message: `components/Card/Card.module.css → --space-5 / --space-7`.
- Restored the fix → 24/24 tests pass.

## 5. Visual smoke

Dev server (Vite, localhost:5173). Console: 0 errors across all routes. The single warning (`apple-mobile-web-app-capable` deprecation) is pre-existing and unrelated.

| Surface | Viewport | Outcome |
|---|---|---|
| `/dashboard/today` | 1280×800 | Goal card + dossier card both render with proper internal padding. Tab strip + footer intact. |
| `/dashboard/train` | 1280×800 | Goal-event card + AI-Coach card render with padding. GENERATE PLAN + SAVE buttons render with proper padding. |
| `/dashboard/schedule` | 1280×800 | Layout shell intact. ADD SESSION button + filter pills (Ride/Social/Race) render correctly. (Calendar grid empty due to dev-env API auth, unrelated to Sprint 12.) |
| `/dashboard/you` | 1280×800 | **All four `Card pad="md"` (Training profile, AI Coach, Strava, Ride with GPS) render with proper padding** — the highest-density risk surface, clean. |
| `/dashboard/you` | 375×812 | Mobile parity confirmed: cards stack with padding, BottomNav anchored, Buttons full-width with proper padding. |
| `/design-system` | 1280×800 | All 6 sections render (Tokens, Button, Card, Empty state, Skeleton, Toast, Mobile 375px frame). |

Screenshots archived at `apps/web/today-1280.png`, `train-1280.png`, `schedule-1280.png`, `you-1280.png`, `you-375.png`, `design-system-1280.png` (gitignored, kept locally).

## 6. Verification matrix

| Gate | Command | Result |
|---|---|---|
| Contract tests | `npx vitest run src/lib/__tests__/design-system-contract.test.ts` | **24/24 pass · 470ms** |
| Full unit suite | `npx vitest run` | **258/259 pass · 1 skipped · 0 failures** |
| Typecheck | `npx tsc --noEmit` | **exit 0** |
| Build | `npm run build` | **green · 1.35s · bundle flat** |
| Console errors (4 surfaces) | dev-server walk | **0 errors** |
| Mobile parity (375px) | `/dashboard/you` | **clean** |

Test count: pre-Sprint-12 baseline = 234 → after `19c88d6` = 256 → after Phase 5 fix = **258** (+24 design-system contract assertions, +1 spacing-alias presence, +1 token-resolution scan, no regressions).

## 7. Verdict — ready for v11.0.0 cut

**No outstanding risks** identified for in-app surfaces. The single regression (`--space-5/7`) was caught statically by the audit method, fixed, and locked with a regression test that verifies via red-green.

**Recommended release path:**
1. Commit the fix + tests on `main` (`fix(sprint-12): missing --space-5 / --space-7 aliases + resolution contract`).
2. Bump `apps/web/package.json` 10.13.0 → 11.0.0.
3. README sweep per `feedback_release-readme-sweep.md` (Routes, Components, Build sections — add `/design-system` route, the 5 rebuilt components, Source Serif Pro font, three-layer tokens).
4. Cut as `chore(release): cut v11.0.0` with founder approval per the standing rule.

## 8. Memory rules referenced

- `feedback_pre-deploy-verification.md` — *"audit legacy parity (esp. layout shells) and smoke the diff's risk surface"* — this audit's structure follows it: diff → static analysis → live walk.
- `feedback_release-ceremony.md` — *"act like a tech lead, not a process robot"* — the audit caught a real bug that visual-only smoke might have missed (the regression was on the default Card path; would have shown only on certain viewports / loaded states).
- `feedback_pattern-replacement.md` — N/A this sprint (no repeat-class regressions).
