#!/usr/bin/env bash
# Bootstrap GitHub Issues for the v8.x backlog.
# Idempotent: re-running won't duplicate labels/milestones; existing issues are skipped.
#
# Prereqs:
#   • gh CLI installed:        brew install gh
#   • gh authenticated:        gh auth login
#   • run from repo root:      ./scripts/bootstrap-issues.sh
set -euo pipefail

REPO="${REPO:-jose-reboredo/cycling-coach}"
echo "→ Repo: $REPO"

# ---------------------------------------------------------------------------
# Labels — colours match the PARS palette (sans the # prefix)
# ---------------------------------------------------------------------------
ensure_label() {
  local name="$1" color="$2" desc="${3:-}"
  if gh label list --repo "$REPO" --limit 200 --json name --jq '.[].name' | grep -Fxq "$name"; then
    echo "  · label exists: $name"
  else
    echo "  + label: $name"
    gh label create "$name" --color "$color" --description "$desc" --repo "$REPO"
  fi
}

echo "→ Ensuring labels…"
ensure_label "priority:high"   "B91C1C" "Blocks something or a release"
ensure_label "priority:medium" "F59E0B" "Important, scheduled"
ensure_label "priority:low"    "6B7280" "Nice to have"

ensure_label "area:dashboard"     "FF4D00" "Dashboard surface"
ensure_label "area:design-system" "C4FF3A" "Tokens, components, motion"
ensure_label "area:auth"          "3B8CE8" "OAuth, tokens, session"
ensure_label "area:db"            "4ADE80" "D1, schema, migrations"
ensure_label "area:backend"       "A855F7" "Worker logic, API proxy"
ensure_label "area:ci"            "FACC15" "Cloudflare Builds, CI/CD"
ensure_label "area:pwa"           "8B5CF6" "Service worker, manifest, offline"
ensure_label "area:perf"          "EF4444" "Lighthouse, bundle, runtime"
ensure_label "area:routes"        "FB923C" "Saved routes, picker"

ensure_label "type:feature" "C4FF3A" "New capability"
ensure_label "type:bug"     "EF4444" "Defect / regression"
ensure_label "type:chore"   "6B7280" "Maintenance / cleanup"

ensure_label "status:in-progress" "FF4D00" "Actively being worked on"

# ---------------------------------------------------------------------------
# Milestones — weekly cadence
# ---------------------------------------------------------------------------
ensure_milestone() {
  local title="$1" desc="$2"
  local existing
  existing=$(gh api "repos/$REPO/milestones?state=all" --jq ".[] | select(.title==\"$title\") | .number" || true)
  if [[ -n "$existing" ]]; then
    echo "  · milestone exists: $title (#$existing)"
  else
    echo "  + milestone: $title"
    gh api "repos/$REPO/milestones" -X POST -f title="$title" -f description="$desc" >/dev/null
  fi
}

echo "→ Ensuring milestones…"
ensure_milestone "v8.3.0" "Weekly release — backfill, live routes, CI build cmd"
ensure_milestone "v8.4.0" "Weekly release — PWA polish, offline PMC"
ensure_milestone "v8.5.0" "Weekly release — perf + Lighthouse 90"

# ---------------------------------------------------------------------------
# Issues — only created when no existing issue has the same title
# ---------------------------------------------------------------------------
ensure_issue() {
  local title="$1" labels="$2" milestone="$3" body="$4"
  if gh issue list --repo "$REPO" --state all --limit 200 --json title --jq '.[].title' | grep -Fxq "$title"; then
    echo "  · issue exists: $title"
  else
    echo "  + issue: $title"
    gh issue create --repo "$REPO" --title "$title" --label "$labels" --milestone "$milestone" --body "$body" >/dev/null
  fi
}

echo "→ Ensuring issues…"

ensure_issue \
  "Apply schema v2 migration to remote D1" \
  "priority:high,area:db,type:chore" \
  "v8.3.0" \
  "Run \`npx wrangler d1 execute cycling_coach_db --file migrations/0001_pmc_and_events.sql --remote\` so the columns from migration 0001 (users.ftp_w / weight_kg / hr_max, activities.tss / np_w / if_pct / duration_s / primary_zone, daily_load rollup, goal-event extensions) exist server-side. Verify with \`wrangler d1 execute --command \"PRAGMA table_info(activities);\"\`."

ensure_issue \
  "Retroactive TSS backfill from strava_raw_json" \
  "priority:high,area:backend,type:feature" \
  "v8.3.0" \
  "Once schema v2 is applied AND the user has set their FTP, walk every existing activities row, extract weighted_average_watts / average_watts from strava_raw_json, and compute TSS = duration_h × IF² × 100 (IF = NP / FTP). Write back to the new columns. Idempotent — re-running shouldn't double-count. Seed daily_load from the resulting rows so PMC has a real starting series. Worker endpoint: /admin/backfill-tss (auth-gated, single-user-only for now)."

ensure_issue \
  "Live Strava saved routes (replace mock)" \
  "priority:medium,area:routes,type:feature" \
  "v8.3.0" \
  "Replace MOCK_ROUTES with the live response from /api/athlete/routes. Tap a route opens https://www.strava.com/routes/<id> in a new tab. Empty state when the user has zero saved. Surface inferred from Strava's surface field on the route."

ensure_issue \
  "Update Cloudflare CI build command" \
  "priority:high,area:ci,type:chore" \
  "v8.3.0" \
  "Workers & Pages → cycling-coach → Settings → Builds → set build command to \`npm run build:web\` so push-to-main rebuilds the SPA before \`wrangler deploy\` runs. Smoke-test the next push: /, /dashboard, /privacy, /whats-next should all return 200 with the React shell after CI deploy."

ensure_issue \
  "iOS home-screen install + offline PMC tile" \
  "priority:low,area:pwa,type:feature" \
  "v8.4.0" \
  "v8.2.0 ships the PWA shell (manifest + sw.js). Validate the iOS Add-to-Home-Screen flow + render the last-cached PMC strip when offline so the dashboard isn't blank. Cache the most recent /api/athlete + /api/athlete/activities response payloads in IndexedDB and rehydrate from there when network fails."

ensure_issue \
  "Persist training prefs to D1 (Strangler-Fig)" \
  "priority:low,area:db,type:chore" \
  "v8.5.0" \
  "Today surface_pref + start_address only live in localStorage. Worker endpoint /training-prefs (POST) writes the row keyed by athlete_id. React useTrainingPrefs POSTs on update — keep writing to localStorage too until parity is confirmed. Initial load: read from D1 on auth, fall back to localStorage if D1 empty."

ensure_issue \
  "Lighthouse mobile ≥ 90" \
  "priority:medium,area:perf,type:chore" \
  "v8.5.0" \
  "Audit and fix. Bundle: split Motion if it's tipping the score (currently 18.8 KB gzipped). Fonts: preload Geist + Geist Mono first weights with display:swap on the rest. Verify ≥ 90 on /, /dashboard, /privacy, /whats-next."

ensure_issue \
  "In-app What's-new modal" \
  "priority:low,area:dashboard,type:feature" \
  "v8.5.0" \
  "Small badge in the TopBar when a new release is available (cc_lastSeenVersion < currentVersion). Click → modal renders the latest 3 entries from CHANGELOG.md, with a 'don't show again' toggle that updates cc_lastSeenVersion."

echo
echo "✓ Bootstrap complete. View: https://github.com/$REPO/issues"
