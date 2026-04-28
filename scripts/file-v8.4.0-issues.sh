#!/usr/bin/env bash
# File the v8.4.0 issue batch: dashboard footer, footer cleanup, yearly goal,
# volume-chart numbers, route picker. Idempotent — re-running won't duplicate.
#
# Prereqs: ./scripts/bootstrap-issues.sh has been run (labels + milestone exist).
#          gh authenticated:  gh auth login

set -euo pipefail

REPO="${REPO:-jose-reboredo/cycling-coach}"
MILESTONE="${MILESTONE:-v8.4.0}"
echo "→ Repo: $REPO"
echo "→ Milestone: $MILESTONE"

# Ensure milestone exists (no-op if it does)
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
  "Dashboard is missing the site footer" \
  "priority:medium,area:dashboard,type:bug" \
  "## Bug
Footer renders on /, /privacy, and /whats-next but is missing on /dashboard.

## Expected
The dashboard surface should carry the same editorial footer (brand mark, blurb, navigation columns, version stamp) so users have a consistent way to reach Privacy / What's next / Powered-by links from anywhere in the app.

## Suggestion
- Extract the existing Landing footer into a shared \`<SiteFooter/>\` component (apps/web/src/components/SiteFooter/).
- Render it at the bottom of /dashboard (above BottomNav offset on mobile so it isn't covered) and on /whats-next + /privacy too.
- Drop the \"Revoke access\" link from the public list while we're at it — see separate issue."

ensure_issue \
  "Remove \"Revoke access\" from the public footer" \
  "priority:low,area:design-system,type:chore" \
  "## Cleanup
The Landing footer's \"Trust\" column currently exposes \`https://www.strava.com/settings/apps\` as \"Revoke access\". That action is only meaningful for an authenticated user — it confuses anonymous visitors and clutters the marketing surface.

## Acceptance
- Remove \"Revoke access\" from the public footer (Landing + WhatsNext).
- Keep it inside the authenticated UserMenu where it already exists (avatar pill → \"Revoke at Strava ↗\").
- Replace the slot with something useful for anon visitors: e.g. \"Status\" link to /version, or simply drop the column."

ensure_issue \
  "Yearly km goal is not editable + clarify how it's set" \
  "priority:high,area:dashboard,type:feature" \
  "## Bug + question
Yearly distance goal is currently hardcoded at 8,000 km in MOCK_GOAL. The user can't change it. We also haven't decided how the goal is defined: AI-suggested or user-set?

## Decision needed
**Recommendation: user-set, with an AI-suggested default.**
- On first visit (or if no goal is saved), the AI Coach panel can suggest a target based on (a) the rider's last 12 months of volume, (b) their declared goal event distance/elevation, (c) FTP-trend during build phase. We propose a number.
- The user can accept it, override it, or clear it. Edits inline on the goal-ring card.

## Acceptance
- New \`useYearlyGoal\` hook backed by localStorage (cc_yearlyGoal { kmTarget, set_at, source: 'ai'|'user' }).
- Goal-ring card on the dashboard gets an \"Edit\" pencil that flips the ring tile into a numeric input.
- AI Coach output extended with an optional \`suggested_goal_km\` field that pre-fills the input on first run, tagged as \"AI-suggested\" until the user touches it.
- Persists alongside other prefs; will move to D1 \`goals\` table when schema v2 is applied remotely."

ensure_issue \
  "Show distance + elevation numbers per bucket in the Volume chart" \
  "priority:medium,area:dashboard,type:feature" \
  "## Feature
The Volume chart (Distance & Elevation, weekly/monthly toggle) currently renders proportional bars with a tiny km value under each. Users want the full numeric breakdown alongside the bars: total distance per period AND total elevation per period.

## Acceptance
- Each bucket renders \`<km>\` AND \`<m>\` under the bar (mono, tabular numerals, slightly different weight to differentiate distance from elevation).
- Hover/tap on a bar surfaces a tooltip with: km, m, ride count, TSS sum.
- The header total already shows km + m for the visible window — keep that.
- Mobile: if both labels don't fit, the elevation number sits in a smaller pill under the km value (don't truncate).
- Maintain Lighthouse mobile ≥ 90 — no JS-heavy charting library, stick to inline SVG + Motion."

ensure_issue \
  "Suggested routes broken + generate routes from AI plan + use Strava surface labels" \
  "priority:high,area:routes,type:bug" \
  "## Three problems in the Routes panel

### 1. Currently broken
The Routes for today panel renders MOCK_ROUTES (Albis Loop, Üetliberg, Greifensee, etc.) — those don't reflect the user's actual saved routes and the scoring against today's plan is meaningless without real data.

### 2. AI-generated route suggestions
We need a real path from \"AI Coach said today is Sweet-spot 3×12 / 1h15\" → \"here are 3 routes that match\". Two complementary sources:
- **Strava saved routes**: hit /api/athlete/routes via the Worker proxy, score them against today's target zone + duration + elevation profile.
- **AI-generated route brief**: when no saved route fits today's plan, the Claude weekly-plan prompt should include a \"route brief\" per day (start address + target distance + target elevation + terrain hint). Render that as a card the user can paste into Komoot/Ride With GPS to plan the route.

### 3. Surface filter mismatch
Today the picker offers \"Tarmac / Gravel / Any\". Strava's actual surface options are **Any / Paved / Dirt**. Match Strava labels exactly so the filter maps 1:1 to the API.

## Acceptance
- Replace MOCK_ROUTES with /api/athlete/routes results when tokens are present (live-routes issue already filed for v8.3.0 — link).
- Surface picker copy: \`Any\`, \`Paved\`, \`Dirt\`. Map internal values: 'paved' | 'dirt' | 'any'.
- Coach output schema extended with \`route_briefs: Record<DayName, { intent, target_distance_km, target_elevation_m, surface_hint }>\`.
- When today has no matching saved route OR the user has zero saved routes, show the AI route-brief card with a \"Plan in Komoot ↗\" deeplink.
- Score: distance fit (40), zone overlap (30), surface fit (20), starred bonus (10) — same as today. Add elevation-fit (matches AI brief target ±20%) as a tie-breaker."

echo
echo "✓ Done. View: https://github.com/$REPO/issues?q=is%3Aopen+milestone%3A$MILESTONE"
