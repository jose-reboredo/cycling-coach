# Confluence Information Architecture — Proposed

**Status:** proposal — for founder review and manual application
**Last touched:** Sprint 11 docs upgrade (2026-05-03)
**Source of truth for content:** [`src/docs.js`](../src/docs.js) — pushed via `/admin/document-release` on every prod deploy

---

## Why this document exists

The `/admin/document-release` endpoint (`src/worker.js` → `documentRelease()`) creates and updates pages **flat, as direct children of the project homepage** (`CONFLUENCE_HOMEPAGE_ID`). Confluence v2 lets us pass a `parentId` per `pages` POST, so technically the endpoint *could* nest children — but right now every spec page lives under the homepage, two levels deep at most (homepage → spec page; releases parent → release child).

For Merkle-quality readability, a curated tree is better than a flat list. This file proposes the tree the founder should apply manually in the Confluence UI (or — future work — wire into the doc-sync orchestrator).

---

## Proposed page tree

```
Cadence Club (space root, key: CC)
└── Engineering (homepage — id 262256, already wired)
    ├── 0. Sprint Roadmap — What's Next      [auto, src/docs.js]
    ├── 1. Architecture
    │   ├── 1.1 Systems & Architecture        [auto, src/docs.js — slug: systems-architecture]
    │   ├── 1.2 APIs                          [auto, src/docs.js — slug: apis]
    │   └── 1.3 User Interfaces               [auto, src/docs.js — slug: interfaces]
    ├── 2. Functional + Technical
    │   ├── 2.1 Functional Specification      [auto — slug: functional-spec]
    │   └── 2.2 Technical Specification       [auto — slug: technical-spec]
    ├── 3. Data Model                         [auto — slug: data-model]
    ├── 4. Security                           [auto — slug: security]
    ├── 5. Runbook — Deploy, Rollback, On-call [auto — slug: runbook (NEW in Sprint 11)]
    ├── 6. Decisions (ADRs)                   [manual today; one child per ADR]
    │   ├── ADR-S5.1 — Cron failure mode (log-and-skip)
    │   ├── ADR-S5.2 — Readiness-dot thresholds
    │   ├── ADR-S5.3 — AI-description prompt shape + cost ceiling
    │   ├── ADR-S5.4 — AI plan parsing contract
    │   └── …
    ├── 7. Roadmap                            [auto, regenerated from GitHub Issues]
    └── 8. Releases                           [auto, append-only parent]
        ├── Release v8.6.0
        ├── …
        ├── Release v10.11.x
        └── Release v10.12.0                  [latest]
```

### Why this shape

- **One node per concern.** Architecture cluster sits together (1.1 / 1.2 / 1.3) so an engineer onboarding can read three pages and have the full picture. Functional / Technical Specifications are bundled because they often cross-reference each other.
- **Runbook as a peer of Architecture.** The on-call runbook is a top-level concern, not buried inside Technical Spec. New in Sprint 11.
- **ADR archive distinct from sprint plans.** Sprint plans churn; ADRs are stable. The ADR section is intended to be a long-lived index, not a sprint-by-sprint commentary.
- **Releases append-only.** Already the shipped pattern. Each release child carries CHANGELOG entry + commits + verification + migration + breaking-change callouts (the latter two added in Sprint 11).

---

## Manual steps to apply (one-shot, founder action)

1. In Confluence → Engineering homepage → page tree:
   - Create three new parent pages: **1. Architecture**, **2. Functional + Technical**, **6. Decisions (ADRs)**.
   - Move existing auto-managed pages under their new parents (Confluence supports drag-and-drop in the page tree sidebar).
2. Update `src/docs.js` `SPEC_PAGES` titles **only if you want the renumbering reflected in the auto-managed names**. The current numeric prefix (`0.`, `1.`, `2.`, …) is a hint to keep alphabetical ordering stable; the proposal doesn't change that.
3. The doc-sync orchestrator looks up pages by **title** (against `homepageChildren`), so as long as titles stay stable, page moves don't break the upsert. Confirm by running a dry deploy of `/admin/document-release` after the move and verifying the response's `spec_pages[].status` is `unchanged` for all entries.

---

## Future automation (optional follow-up)

If we want the endpoint to *create* the structure programmatically:

1. Extend `SPEC_PAGES` entries with an optional `parentSlug` field.
2. In `documentRelease()` (`src/worker.js`), resolve `parentSlug` → page id (from prior pass or by lookup), then pass that id to `conf.create({ parentId, ... })` instead of always using the homepage id.
3. Two-pass semantics: first pass creates parents, second pass creates children. (Current single-pass loop is fine for flat structure.)
4. Add a tree-config check: if Confluence's actual parent for a page differs from `parentSlug`, log a warning rather than auto-move. Page-move is a destructive op; don't fold it into a deploy.

That work isn't in scope for Sprint 11 — flagged for the backlog.

---

## Cross-references

- [`src/docs.js`](../src/docs.js) — canonical content for every auto-managed spec page.
- [`src/worker.js`](../src/worker.js) → `documentRelease()` — the orchestrator that pushes the pages.
- [`/admin/document-release`](../README.md#routes) — the endpoint, gated by `Authorization: Bearer $ADMIN_SECRET`.
- [`README.md` → Deploy and on-call](../README.md#deploy-and-on-call) — the human runbook this proposal complements.
