# Sprint 7 — CTO Review

**Reviewed:** 2026-05-01 sprint close (post-v10.5.4)
**Releases:** 10 (5 features + 5 hotfixes) — high hotfix ratio is a flag
**Reviewer:** CTO + Architect (Opus, in-session synthesis)

## What worked

1. **MAJOR version bumped at the right time.** v10.0.0 captured the Today/Train/Schedule restructure correctly per SemVer. Footer date-stamping made the rollout visible.
2. **Plan-to-execute loop closure.** v10.4.0 (route gen backend) + v10.5.0 (drawer picker) closed the loop the founder bet on at sprint start: "+ Schedule day → confirm prefill → enter address → pick route → GPX." Demo-grade delivery.
3. **Smarter duration estimation in v10.2.0.** When AI plan rows lacked explicit duration, computing from distance × zone-pace removed a friction point. Took 30 minutes; high-leverage UX win.
4. **Layout consistency across surfaces.** v10.3.0 lifted salutation + sync + streak above TopTabs to match the club view's hierarchy. Same shell across personal + club surfaces.

## What regressed

1. **CSP shipped as a two-attempt hotfix (v10.5.1 → v10.5.2).** v10.5.1 hardened the Worker dynamic-response headers but missed the static-asset `_headers` file. v10.5.2 was the actual fix. Pattern-matched as a Sprint 5 "modal → page route" arc; led to a pre-deploy verification rethink.
2. **Route generator returned 1 route instead of 3 (v10.5.3).** Regression slipped because the existing test suite had a static-endpoint check, not a behavior assertion. **Memory rule invented:** `feedback_pre-deploy-verification.md` — smoke what changed, not static endpoints.
3. **v10.5.4 bundled two route picker fixes** (explicit Strava handoff + "Show Strava routes" CTA). Founder approved bundling because both were in the same UX surface; lesson: bundling within the same UX surface is fine, bundling across personas (Sprint 6's mistake) is not.

## What we learned

- **Two surfaces need CSP coverage.** Cloudflare Workers Static Assets serves the SPA via `_headers`; the Worker handler serves dynamic responses with its own headers. Either surface alone is insufficient.
- **Test what would catch the founder-reported bug.** v10.5.3's "1 route" was caught by founder use of the picker, not by tests. The contract-test pattern from v10.11.3 onward (statically scan worker source for the regression-prone shape) traces conceptually back to this sprint's lesson.
- **Hotfix density signal.** 5 features + 5 hotfixes in one sprint is high. v10.5.x in particular felt like four interrelated patches. When that happens, ask "is the scope right?" — sometimes the answer is "the underlying area isn't ready to ship as a feature yet."

## Tech debt accrued

- `EventDetailDrawer` is now a fat dependency. Lazy-load when the calendar surface doesn't need it on first render.
- Route generator scoring has free constants. No tests pin them. **Sprint 11 bug 1 (Zurich centroid) traces back to this gap.**
- No CSP regression test. Two surfaces should be exercised.
- "Salutation styling" trip suggests the layout shell needs a shared header component.

## Process notes

- The `chore(release)` cadence is settling at: 1 main feature + ~1 polish hotfix per cut. That's healthy for v10.x feature work.
- Confluence release pages are getting noisy. v10.5.x cut 4 child pages; some are 3-line hotfixes. Consider grouping minor hotfixes into a parent's "patches" section instead of separate child pages — see Sprint 11 docs for the upgrade.

## Memory rules — created or validated this sprint

| File | Status |
|---|---|
| `feedback_pre-deploy-verification.md` | **Created** from v10.5.3 regression |
| `feedback_pattern-replacement.md` | **Re-validated** by v10.5.1 → v10.5.2 |
| `feedback_release-readme-sweep.md` | **Validated** — every chore(release) updated README's recent-releases line |

## Carry-forward for Sprint 8

- AI plan persistence: `ai_plan_sessions` table + cascade-update from auto-regen + `user_edited_at` lock.
- RWGPS OAuth + saved-routes tab.
- Goal-driven planning (target events, race priority, periodization).
- CSP regression test that hits both surfaces. **Did not happen until much later.**
