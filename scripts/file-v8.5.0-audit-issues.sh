#!/usr/bin/env bash
# File the 4 deferrals from the 2026-04-28 dashboard design audit:
#   H6b RideDetail height-auto animation
#   H8  Accent contrast for ≤14px text on dark canvas
#   M2  BottomNav active state should follow scroll, not click
#   M5  UserMenu keyboard nav + focus management
# (M3 self-host fonts is already covered by issue #12 Lighthouse work — skipped.)
#
# Originally targeted v8.4.0; reslotted to v8.5.0 once v8.4.0 shipped.
#
# Idempotent: re-running won't duplicate (matches title against existing issues).
#
# Prereqs: gh authenticated (gh auth login). Milestone + labels exist
#          (./scripts/bootstrap-issues.sh).

set -euo pipefail

REPO="${REPO:-jose-reboredo/cycling-coach}"
MILESTONE="${MILESTONE:-v8.5.0}"
echo "→ Repo: $REPO"
echo "→ Milestone: $MILESTONE"

existing=$(gh api "repos/$REPO/milestones?state=all" --jq ".[] | select(.title==\"$MILESTONE\") | .number" || true)
if [[ -z "$existing" ]]; then
  echo "  + creating milestone $MILESTONE"
  gh api "repos/$REPO/milestones" -X POST -f title="$MILESTONE" -f description="Weekly release" >/dev/null
fi

ensure_issue() {
  local title="$1" labels="$2" body="$3"
  if gh issue list --repo "$REPO" --state all --limit 200 --json title --jq '.[].title' | grep -Fxq "$title"; then
    echo "  · exists: $title"
  else
    echo "  + creating: $title"
    gh issue create --repo "$REPO" \
      --title "$title" \
      --label "$labels" \
      --milestone "$MILESTONE" \
      --body "$body" >/dev/null
  fi
}

ensure_issue \
  "RideDetail expand: animate transform/opacity, not height: auto" \
  "priority:medium,area:dashboard,type:perf" \
  "## Audit deferral — H6b
2026-04-28 dashboard audit (\`docs/superpowers/specs/2026-04-28-dashboard-design-audit.md\`).

### Problem
\`RideDetail\` expand animation uses \`initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}\`. Animating to \`height: auto\` forces Motion to measure target height each frame and triggers layout — it's the explicit anti-pattern called out in the ui-ux-pro-max react-performance.csv: 'Use transform and opacity for animations'.

\`VolumeChart\` bars were already swapped to \`scaleY\` in commit \`426f24e\`; this issue tracks the trickier RideDetail case.

### Options
- (a) Drop the height animation entirely, keep opacity-fade. Layout snap is OK for an expand panel; Strava does the same.
- (b) Use \`<details>\` element with CSS \`interpolate-size: allow-keywords\` (Chromium-only, recent — would need fallback).
- (c) Measure with \`ResizeObserver\` on first open, cache the height per-rideId, animate to a number.

Recommendation: (a) — simplest, removes the anti-pattern entirely. The opacity fade alone reads as 'expand'.

### Acceptance
- [ ] RideDetail.tsx initial/animate/exit no longer reference \`height\`
- [ ] Visual smoke test: expand a ride at 375px, confirm content reveals smoothly
- [ ] React DevTools Profiler shows no layout passes during expand"

ensure_issue \
  "Accent #ff4d00 fails AA contrast for small text on canvas — introduce --c-accent-light" \
  "priority:medium,area:design-system,type:a11y" \
  "## Audit deferral — H8
2026-04-28 dashboard audit. Touches the design system, deferred for a deliberate pass.

### Problem
Molten orange \`#ff4d00\` on canvas \`#0a0a0c\` is approximately 3.9:1 — fails WCAG AA for normal text (<24px / <19px bold), passes for large text. PARS uses the accent for some small mono labels:

- \`Pill.accent\` (10px mono uppercase)
- \`.brandBadge\` 'v8' (9px mono)
- \`.surfaceEm\` icon 12px
- \`.matchHigh\` 22px is borderline (large-text threshold 19px bold / 24px regular)
- \`.bulletGood::before\` decorative line — not text, exempt

### Proposal
Introduce a sibling token \`--c-accent-light: #ff7a3d\` (≈ 5.2:1 on canvas), specifically for ≤14px usage. Don't change \`--c-accent\` itself — the brand call-to-action color stays. Audit the call-sites and swap the accent token for accent-light only on small-text instances.

### Open question
Does the accent-light shift the brand feel? If so, alternative: brighten \`--c-accent\` itself slightly (e.g. \`#ff5e1a\`) to lift the whole system above 4.5:1. Single-source change, but every accent surface gets warmer.

### Acceptance
- [ ] Decision logged: introduce token vs. shift the existing one
- [ ] All accent-on-canvas text ≤14px audited and brought to 4.5:1
- [ ] Confluence \"User Interfaces\" page updated with the contrast rule
- [ ] No regressions in PARS \"feel\" — review with design eye after change"

ensure_issue \
  "BottomNav active tab should sync to scroll position, not last click" \
  "priority:medium,area:dashboard,type:enhancement" \
  "## Audit deferral — M2
2026-04-28 dashboard audit.

### Problem
\`BottomNav\` (mobile) tracks an \`activeId\` from \`useState\`, set on click. Once the user scrolls naturally — which is most of the time — the active orange dot stays on whichever tab they last tapped, not on the section currently in view. Skill rule: 'Navigation: Active State — Highlight active nav item with color/underline. Don't have no visual feedback on current location.'

### Approach
\`IntersectionObserver\` over the four section IDs (\`#today\`, \`#train\`, \`#stats\`, \`#you\`). Threshold ~0.5; the section with the highest intersection ratio in the viewport wins. Update \`activeId\` on changes; debounce (rAF) to avoid thrash on fast scroll.

\`#you\` doesn't exist as a section yet (it goes to UserMenu? to a settings page?) — decide as part of this work. Could leave as scrolling to the bottom of the dashboard for now.

### Acceptance
- [ ] BottomNav active state updates as the user scrolls (no click required)
- [ ] Tapping a tab still scrolls to + activates its section
- [ ] No re-render storms — observer fires reasonably (every section transition)
- [ ] '#you' has a defined target (or removed from BottomNav)
- [ ] Manual smoke at 375px"

ensure_issue \
  "UserMenu: arrow-key navigation + focus management (extract useFocusTrap)" \
  "priority:medium,area:dashboard,type:a11y" \
  "## Audit deferral — M5 (+ refactors H3 into shared util)
2026-04-28 dashboard audit. The OnboardingModal got an inline focus trap in commit \`0e168a1\`; this issue extracts it into a reusable hook and applies it to UserMenu.

### Problem (UserMenu)
The popover has \`role=\"menu\"\` + \`role=\"menuitem\"\` (good), \`aria-expanded\`, \`aria-haspopup\`, ESC + click-outside close (good). Missing per ARIA:
- ↑/↓ to move between menu items
- Focus moves into menu when opened
- Focus returns to the trigger when closed

### Approach
1. Extract \`useFocusTrap(active: boolean, opts: { restore: boolean })\` from \`OnboardingModal.tsx\` into \`apps/web/src/hooks/useFocusTrap.ts\`. Returns a ref to attach to the trapping container.
2. Add \`useArrowMenu\` companion hook for ↑/↓/Home/End within a list of refs.
3. Apply both to \`UserMenu\`. \`OnboardingModal\` re-uses the trap.

### Acceptance
- [ ] \`useFocusTrap\` hook in \`apps/web/src/hooks/\` with unit notes in JSDoc
- [ ] OnboardingModal swapped to use the hook (delete inline trap, no behavior change)
- [ ] UserMenu uses the hook + arrow nav: open menu → first item focused → ↓/↑ moves → ESC closes → trigger refocused
- [ ] Tab still works to leave the menu (closes it)
- [ ] Manual keyboard probe of both surfaces"

echo
echo "✓ Done. View: https://github.com/$REPO/issues?q=is%3Aopen+milestone%3A$MILESTONE"
