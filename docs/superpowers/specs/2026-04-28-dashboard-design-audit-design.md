# Dashboard design audit + polish — design doc

**Date:** 2026-04-28 · **Author:** Claude (per `superpowers:brainstorming`) · **Approved by:** José Reboredo

## Context

We have an established React dashboard at `/dashboard` (apps/web/src/pages/Dashboard.tsx) running the **PARS** (Performance Dark) design system, deployed at v8.3.0. A new design-intelligence skill — `ui-ux-pro-max` — was just installed at project scope (`.claude/skills/ui-ux-pro-max/`), exposing 99 UX guidelines, 96 palettes, 57 font pairings, 67 styles and 25 chart types across 13 stack adapters, organised by 8 priority categories (P1 Accessibility *CRITICAL* → P8 Charts).

The user wants a **design pass** combining:

- (C) **Audit-driven** evaluation against the skill's catalog
- (B) **Polish** — palette / type / spacing / motion refinements

…sliced as a hybrid: comprehensive audit report first, then ship section-by-section against the report (no per-section triage round-trips).

## Scope

### In scope
- All visible dashboard surfaces, both auth state (real data) and demo state (`?demo=1`)
- Two breakpoints: 375 px (mobile baseline) + 1280 px (desktop)
- All 8 priority categories from `ui-ux-pro-max`
- Quick-fix shipping (S/M effort) within this pass
- Markdown audit report committed to the repo

### Out of scope
- New features (those are GitHub issues #2, #4, #5, #6 — separate work)
- Re-architecture of components (only refactor when a finding directly demands it)
- Design-system swap (PARS stays — molten-orange accent, Geist + Geist Mono, dark canvas)
- Other surfaces (`/`, `/privacy`, `/whats-next`)
- Tablet breakpoints (414 / 768) — only audit if a 375→1280 finding implies a tablet break

## Methodology

For every dashboard surface, evaluate against each of the 8 priority categories using the corresponding CSV catalog from `.claude/skills/ui-ux-pro-max/data/`:

| Priority | Category | Catalog source |
|---|---|---|
| 1 | Accessibility *CRITICAL* | `ux-guidelines.csv` (filtered) |
| 2 | Touch & Interaction *CRITICAL* | `ux-guidelines.csv` |
| 3 | Performance *HIGH* | `react-performance.csv` |
| 4 | Layout & Responsive *HIGH* | `ux-guidelines.csv`, `stacks/react.csv` |
| 5 | Typography & Color *MEDIUM* | `typography.csv`, `colors.csv` |
| 6 | Animation *MEDIUM* | `ux-guidelines.csv` |
| 7 | Style Selection *MEDIUM* | `styles.csv` |
| 8 | Charts & Data *LOW* | `charts.csv` |

Each finding tagged with:
- **Severity**: Critical / High / Medium / Low (driven by the skill's priority + impact)
- **Effort**: S (≤ 30 min) / M (≤ 2 h) / L (> 2 h)

**Fix-vs-defer rule**:
- All **S** findings → fix this pass (atomic commits)
- **M** findings, non-architectural → fix this pass
- **M** findings, architectural OR all **L** findings → file as GitHub issue, defer

User can override the threshold during triage.

## Surfaces audited (in display order)

1. TopBar (avatar pill + UserMenu)
2. Hero fold — greeting · PMC strip · 4 quick-stat tiles · goal event card · yearly goal ring
3. Today's workout (from AI plan or sample WorkoutCard)
4. Momentum — StreakHeatmap + WinsTimeline (side-by-side desktop, stacked mobile)
5. Volume chart (distance + elevation, weekly/monthly toggle)
6. AI Coach card (3-state: BYOK setup → sessions/week + Generate → full plan render)
7. Routes picker (surface filter + start address + ranked routes)
8. Previous rides list + ride detail expand + ride feedback panel
9. Demo banner (when `?demo=1` or no tokens in dev)
10. BottomNav (mobile only)
11. *(Missing)* site footer — flagged in issue #2

## Outputs

| Artefact | Location | When |
|---|---|---|
| **Design doc** (this file) | `docs/superpowers/specs/2026-04-28-dashboard-design-audit-design.md` | Now (Phase 0) |
| **Audit report** | `docs/superpowers/specs/2026-04-28-dashboard-design-audit.md` | End of Phase 1 |
| **In-pass fix commits** | `main` (or feature branch if requested) | Phase 3 |
| **Deferred-finding GitHub issues** | `jose-reboredo/cycling-coach` issues, milestoned | Phase 3 (alongside fixes) |
| **Confluence sync** | Auto via `npm run docs:sync` | Phase 3 |

## Process

| # | Phase | Action | Gate |
|---|---|---|---|
| 0 | Design | Write + commit this design doc | User approves (this message) |
| 1 | Audit | Read SKILL.md + relevant CSVs; walk surfaces; produce report | Auto |
| 2 | Triage | Present report; user marks "fix / defer / drop" per finding | **User input required** |
| 3 | Fix | Implement approved batch; file deferred items as GitHub issues; commit + deploy + docs:sync | Auto |
| 4 | Verify | Build passes; manual probe at 375/1280; Lighthouse before/after if cheap | Auto |

## Risk + verification

| Risk | Mitigation |
|---|---|
| Scope creep — "while I'm here" refactors | S/M/L threshold; non-goals list above |
| Touch-target regressions when applying tighter spacing | Re-verify every touched component at 375 px |
| Confluence Interfaces page drift | If component inventory changes, edit `src/docs.js` § Interfaces; the hash-skip ensures only that page re-syncs |
| Audit findings I can't visually verify (because I don't render the actual browser) | Flag explicitly; user can verify visually + override |

Verification when fixes ship:
- `npm run build:web` passes
- TypeScript strict passes
- Manual probe of `/dashboard` at 375 px and 1280 px in dev
- `wrangler dev` smoke test
- Optional: Lighthouse mobile audit

## Acceptance criteria

- [ ] Design doc committed (this file)
- [ ] Audit report committed with findings ranked by severity + effort
- [ ] User triages findings → batch decided
- [ ] In-pass S/M fixes shipped as atomic commits to `main`
- [ ] Deferred L findings filed as GitHub issues, milestoned to v8.4.0 / v8.5.0
- [ ] Build green, manual smoke clean
- [ ] Confluence pages auto-synced via `npm run docs:sync`
- [ ] CHANGELOG.md updated if version bumps

## Open questions / future work

- Lighthouse mobile ≥ 90 is already filed as issue #12 — this audit may surface additional findings that flow into that work.
- Accessibility audit may surface gaps in `/`, `/privacy`, `/whats-next` too — out of scope here, but worth filing as a follow-up issue.
- The skill itself (`ui-ux-pro-max`) isn't yet visible to Claude Code's harness (needs session restart). Phase 1 will run via direct Bash queries against the CSVs; once restarted, future passes can use the formal Skill tool.
