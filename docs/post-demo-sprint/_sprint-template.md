# Sprint N — Planning + Retro Template

Process locked 2026-05-03 (v10.13.0). Every sprint going forward follows this 4-doc shape under `docs/post-demo-sprint/sprint-N/`.

## Files

| File | Phase | Author | When written |
|---|---|---|---|
| `00-sprint-summary.md` | Both | CTO | Updated at sprint open + close |
| `01-business-requirements.md` | Plan | Strategist + BA | Sprint open |
| `02-architecture-changes.md` | Plan + Build | Architect | Open (planned) → updated (shipped) |
| `03-cto-review.md` | Retro | CTO | Sprint close |

## 00-sprint-summary.md

One page. Use this skeleton:

```markdown
# Sprint N — <theme>

**Dates:** YYYY-MM-DD → YYYY-MM-DD
**Version range:** vX.Y.Z → vA.B.C (N releases shipped)
**Persona focus:** <Persona A/B/C from the marketing-personas doc>
**Headline outcome:** <one sentence — what this sprint enabled the user to do>

## Themes
- Theme 1 (issues `#NN`, `#MM`)
- Theme 2 (issues `#XX`)

## Releases shipped
| Version | Date | Headline |
|---|---|---|
| vX.Y.Z | YYYY-MM-DD | … |

## What landed vs planned
- Planned: …
- Shipped: …
- Drift: …

## Memory rules validated this sprint
- `feedback_<rule>.md` — confirmed by …
```

## 01-business-requirements.md

What the sprint sets out to do. Persona-driven. References open issues by number.

Sections:
- **Wedge** — which persona / problem this sprint serves
- **Hypothesis** — what we're betting works
- **In scope** — issue list with effort estimates
- **Out of scope** — what we explicitly defer and why
- **Acceptance criteria** — how we know the sprint shipped

## 02-architecture-changes.md

Technical plan + actual deltas. At sprint open, the planned section. At sprint close, fill in what actually shipped.

Sections:
- **Schema** — migrations added; cumulative `schema.sql` deltas
- **Endpoints** — new `/api/*` routes; auth + ownership posture
- **Frontend** — new components/routes; package additions
- **Infra** — Worker secrets, KV, D1, third-party APIs
- **Observability** — new logs, alarms, smoke checks

## 03-cto-review.md

Sprint close retrospective. Honest. References memory rules where they were validated or invented.

Sections:
- **What worked** — patterns to keep
- **What regressed** — bugs that escaped, hotfixes that didn't stick
- **What we learned** — new memory rules to file
- **Tech debt accrued** — backlog items for future sprints
- **Process notes** — anything to change about how we run sprints

---

## Open + close checklist

Sprint open:
- [ ] Create `sprint-N/` folder
- [ ] Write `00-sprint-summary.md` (themes, persona, planned versions)
- [ ] Write `01-business-requirements.md` from current backlog + persona priorities
- [ ] Write `02-architecture-changes.md` planned section
- [ ] Update `_sprints-overview.md` index

Sprint close:
- [ ] Update `00-sprint-summary.md` with shipped versions + drift notes
- [ ] Fill in `02-architecture-changes.md` shipped section
- [ ] Write `03-cto-review.md` from real CHANGELOG content + retro session
- [ ] Save any new memory rules to `~/.claude/projects/.../memory/`
- [ ] Update `_sprints-overview.md` row for closed sprint
