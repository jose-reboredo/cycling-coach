#!/usr/bin/env bash
# File the 7 post-demo stakeholder feedback issues from the 2026-04-30 Merkle session.
# Idempotent: skips any issue whose title already exists.
# Prereqs: gh authenticated; labels exist (bootstrap-issues.sh adds common ones).

set -euo pipefail

REPO="${REPO:-jose-reboredo/cycling-coach}"

# ── Ensure required labels exist ─────────────────────────────────────────────
ensure_label() {
  local name="$1" color="$2" desc="$3"
  if ! gh label list --repo "$REPO" --limit 200 --json name --jq '.[].name' \
      | grep -Fxq "$name"; then
    gh label create "$name" --repo "$REPO" --color "$color" --description "$desc" 2>/dev/null || true
  fi
}

ensure_label "priority:p0"    "b60205" "Blocks next demo — must ship"
ensure_label "priority:p1"    "e4e669" "Needed next round, not blocking"
ensure_label "priority:p2"    "0075ca" "Nice-to-have"
ensure_label "area:routes"    "d4edda" "Route recommendation feature"
ensure_label "area:dashboard" "d4edda" "Dashboard / home screen"
ensure_label "area:data"      "d4edda" "Data model / backend"
ensure_label "area:profile"   "d4edda" "User profile & settings"
ensure_label "area:clubs"     "d4edda" "Clubs feature area"
ensure_label "area:ux"        "d4edda" "General UX / navigation"
ensure_label "type:bug"       "ee0701" "Something isn't working"
ensure_label "type:feature"   "a2eeef" "New feature or request"
ensure_label "type:research"  "f9d0c4" "Needs investigation before implementation"

# ── Helper ────────────────────────────────────────────────────────────────────
ensure_issue() {
  local title="$1" labels="$2" body="$3"
  if gh issue list --repo "$REPO" --state all --limit 300 --json title \
      --jq '.[].title' | grep -Fxq "$title"; then
    echo "  · already exists: $title"
  else
    echo "  + creating: $title"
    number=$(gh issue create --repo "$REPO" \
      --title "$title" \
      --label "$labels" \
      --body "$body" | grep -oE '[0-9]+$')
    echo "    → #$number"
  fi
}

# ── Issues ────────────────────────────────────────────────────────────────────

ensure_issue \
  "[P0] Route recommendation broken — needs new data source and surface filter" \
  "priority:p0,area:routes,type:bug" \
  "## User story
As a **solo rider** or **club admin**, I want route suggestions that match my actual location and preferred surface type, so that I can discover real, rideable routes without manual workarounds.

## Acceptance criteria
- Entering \"Madrid\" returns routes geographically centred on Madrid (not any hardcoded city).
- Surface filter offers at least three values: **Any**, **Paved**, **Gravel**.
- Selecting \"Paved\" hides gravel/unpaved routes; selecting \"Gravel\" hides paved-only routes.
- Route data is fetched from a non-Strava provider (Komoot, OpenRouteService, RideWithGPS, or equivalent — see IR-1 in \`docs/post-demo-sprint/01-business-requirements.md\`).
- Zero hardcoded coordinate/city references remain in the route-recommendation codebase.
- Error state shown when no routes found for a region rather than silently returning wrong results.

## Details
| Field | Value |
|-------|-------|
| Priority | P0 — blocks next demo |
| Complexity | L (16–40 h) |
| Dependencies | Data-provider evaluation (IR-1) must complete before coding |

## Implicit requirement
A provider evaluation ADR is needed first (IR-1). Candidates: Komoot API, OpenRouteService, Waymarked Trails, RideWithGPS API. Evaluate on: free-tier limits, geo coverage, surface-type metadata, licensing.

## Schema impact
Potentially new \`route_preferences\` table (SC-4 in BRD).

## Verbatim stakeholder feedback
> \"Fix route recommendation, it does not work. I add Madrid and routes are in Zurich hardcoded. The whole logic behind is not working and we need to find a solution. I think the routes suggested cannot be provided by Strava. Propose another tool we can get them. Also surface filter: we need Any, Paved, Gravel — what if the persona does only road biking?\"

---
Source: post-demo stakeholder feedback, 2026-04-30 Merkle session
BRD ref: \`docs/post-demo-sprint/01-business-requirements.md\` § FB-1"

ensure_issue \
  "[P1] My Account dashboard is unclear — improve labels, empty states, and navigation" \
  "priority:p1,area:dashboard,type:feature" \
  "## User story
As a **solo rider**, I want a clear, self-explanatory account dashboard, so that I can quickly understand my data and navigate to the right section without guessing.

## Acceptance criteria
- Every section on the dashboard has a visible, descriptive heading.
- KPI cards carry a one-line label explaining what the metric means (tooltip or sub-label).
- Navigation between sections requires no more than one tap/click from the dashboard.
- A usability test with one unfamiliar user produces zero \"I don't know what this means\" observations for labelled items.
- Empty state copy present for any section with no data yet.

## Details
| Field | Value |
|-------|-------|
| Priority | P1 — needed next round |
| Complexity | M (4–16 h) |
| Dependencies | FB-5 (mobile tab restructure) — layout changes overlap |

## Verbatim stakeholder feedback
> \"The whole My Account dashboard is unclear from user perspective.\"

---
Source: post-demo stakeholder feedback, 2026-04-30 Merkle session
BRD ref: \`docs/post-demo-sprint/01-business-requirements.md\` § FB-2"

ensure_issue \
  "[P1] Replace static YTD goal bar with AI-powered year-end distance forecast" \
  "priority:p1,area:dashboard,type:feature" \
  "## User story
As a **solo rider**, I want an AI-projected year-end distance forecast based on my current pace, so that I have a motivating, realistic target rather than an arbitrary fixed goal.

## Acceptance criteria
- The static \"X of 8,000 km\" bar is replaced with a forecast card.
- Forecast reads: \"At your current pace you will ride ~Y km by 31 Dec.\"
- Y is calculated from: (YTD distance ÷ days elapsed) × 365.
- An AI model refines the linear projection using weekly-variance data when ≥ 8 weeks of history exist (falls back to linear when < 8 weeks).
- Forecast refreshes automatically each time new activities sync.
- The 8,000 km hard-coded goal is removed; a user-configurable annual goal remains optional.

## Details
| Field | Value |
|-------|-------|
| Priority | P1 — needed next round |
| Complexity | M (4–16 h) |
| Dependencies | FB-4 (goal linkage) — configurable goal field feeds forecast card |

## Architecture conflict
AC-2: If the goal is not persisted in D1, the AI forecast Worker call has nothing to read. Frontend-only state cannot drive a server-side model.

## Schema impact
SC-1: add \`annual_goal_km\`, \`annual_goal_type\` to \`users\` or new \`user_goals\` table.

## Verbatim stakeholder feedback
> \"Year-to-date '447 of 8,000 km' — is this graphic interesting for user? Why 8,000 km and not 1,000 km? Maybe it's better a forecast: today you have 447 km, at end of year you will do 2,000 km. This must be a model projected by AI.\"

---
Source: post-demo stakeholder feedback, 2026-04-30 Merkle session
BRD ref: \`docs/post-demo-sprint/01-business-requirements.md\` § FB-3"

ensure_issue \
  "[P1] Link annual goal to weekly training plan — goal drives weekly targets" \
  "priority:p1,area:dashboard,type:feature" \
  "## User story
As a **solo rider**, I want my annual goal to drive the weekly training plan, so that every planned session meaningfully contributes toward my target.

## Acceptance criteria
- Weekly plan shows a \"towards goal\" label or progress indicator on each session.
- Changing the goal immediately recalculates the weekly target (km/week or hours/week).
- If no goal is set, the weekly plan section prompts the user to set one.
- The detached \"Goal\" display card on the dashboard is removed; goal is surfaced only inside the weekly planning context.
- Plan recalculation is visible within 2 seconds of goal save.

## Details
| Field | Value |
|-------|-------|
| Priority | P1 — needed next round |
| Complexity | M (4–16 h) |
| Dependencies | FB-3 (forecast card) shares goal field — do FB-4 first |

## Schema impact
SC-1: \`annual_goal_km\` column (same as FB-3). Do once, shared.

## Verbatim stakeholder feedback
> \"We have the Goal also on top and the weekly planning — is it linked? If not, why do we have this goal? The goal will be part of the planning.\"

---
Source: post-demo stakeholder feedback, 2026-04-30 Merkle session
BRD ref: \`docs/post-demo-sprint/01-business-requirements.md\` § FB-4"

ensure_issue \
  "[P0] Add mobile bottom-tab navigation with paginated sections (Today/Train/Rides/You)" \
  "priority:p0,area:ux,type:feature" \
  "## User story
As a **casual commuter** or **solo rider** on mobile, I want a tabbed, paginated interface, so that I can navigate sections without scrolling through one long page.

## Acceptance criteria
- Four bottom tabs on mobile: **Today**, **Train**, **Rides**, **You**.
- **Today** tab: salutation, KPIs, what's planned for today, start-training CTA, year forecast.
- **Train** tab: weekly plan, goal progress.
- **Rides** tab: recent activities list with pagination (≥ 10 items/page, prev/next controls).
- **You** tab: profile info (FB-6), settings.
- Tabs not shown on desktop (≥ 1024 px); desktop retains sidebar/section layout.
- Active tab state persisted across page refresh (URL or localStorage).

## Details
| Field | Value |
|-------|-------|
| Priority | P0 — blocks next demo (mobile is currently one-page / unusable) |
| Complexity | L (16–40 h) |
| Dependencies | FB-2 (dashboard clarity) and FB-6 (profile) for tab content |

## Architecture conflict
AC-3: TanStack Router's current route tree is likely flat/desktop-centric. Mobile tabs require nested routes or a client-side tab state manager — both touch router config.

## Verbatim stakeholder feedback
> \"We need to add pagination, specially in mobile. Not one-page dashboard. In mobile we have some tabs (which are good): Today (salutation, KPIs, what's planned for today, start training, year forecast), Train, Rides, You (empty currently — for personal info)\"

---
Source: post-demo stakeholder feedback, 2026-04-30 Merkle session
BRD ref: \`docs/post-demo-sprint/01-business-requirements.md\` § FB-5"

ensure_issue \
  "[P1] Expand Edit Profile into full My Account page — personal data, Anthropic key, consent placeholder" \
  "priority:p1,area:profile,type:feature" \
  "## User story
As a **solo rider**, I want a full \"My Account\" profile page where I can manage personal data, API keys, and future consent settings, so that the app feels complete rather than a stub.

## Acceptance criteria
- Existing FTP, Weight, HR Max fields retained.
- New fields: Name, Date of birth, Gender, City/Country, Strava connection status (read-only).
- Anthropic API key field: masked input, save + test button (cheap ping call), stored encrypted at rest.
- Placeholder section \"Consent & Data\" with a \"coming soon\" notice (no functional requirement yet).
- All fields validate on save; inline error messages for invalid input.
- Profile picture upload is out of scope for this sprint.

## Details
| Field | Value |
|-------|-------|
| Priority | P1 — needed next round |
| Complexity | M (4–16 h) |
| Dependencies | FB-5 (\"You\" tab hosts this page) |

## Architecture conflict
AC-4: Storing the Anthropic API key in D1 conflicts with the principle of keeping secrets in Cloudflare Workers Secrets. A hybrid approach (key encrypted with a Workers Secret as cipher key, ciphertext in D1) needs an explicit ADR.

## Schema impact
- SC-2: add \`dob\`, \`gender\`, \`city\`, \`country\` to \`users\`
- SC-3: add \`anthropic_api_key_enc\` + \`anthropic_api_key_iv\` to \`users\`

## Verbatim stakeholder feedback
> \"Right now it's only for FTP, Weight, HR Max. Make it more like My Account with personal data. Place to add Anthropic API key. Future consent framework.\"

---
Source: post-demo stakeholder feedback, 2026-04-30 Merkle session
BRD ref: \`docs/post-demo-sprint/01-business-requirements.md\` § FB-6"

ensure_issue \
  "[P1] Clubs — expand features beyond MVP (member roster + scoped backlog)" \
  "priority:p1,area:clubs,type:feature" \
  "## User story
As a **club admin**, I want richer club management tools, so that I can effectively organise rides, communicate with members, and track collective performance beyond the MVP.

## Acceptance criteria
- Stakeholder provides a prioritised feature list before full implementation begins.
- Interim deliverable: scoped feature backlog in \`docs/post-demo-sprint/club-features-backlog.md\`, reviewed and signed off by product owner.
- Minimum for this sprint: **member roster page** (list members, show join date, role badge Admin/Member).
- Existing create/join/events/invite-link functionality is not regressed.

## Details
| Field | Value |
|-------|-------|
| Priority | P1 — needed next round |
| Complexity | XL (40 h+) for full expansion; M for roster-only slice |
| Dependencies | None (clubs MVP already live) |

## Note
\"More club features\" is intentionally vague in the feedback. A scoping session is needed before implementation. This issue exists to trigger that conversation and capture the interim roster deliverable.

## Verbatim stakeholder feedback
> \"More club features are needed for the next round.\"

---
Source: post-demo stakeholder feedback, 2026-04-30 Merkle session
BRD ref: \`docs/post-demo-sprint/01-business-requirements.md\` § FB-7"

echo
echo "✓ Done. View: https://github.com/$REPO/issues"
