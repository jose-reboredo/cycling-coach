# Sprint 13 — CTO Review (filled at sprint close)

This document is the post-sprint retrospective. It is left as a skeleton at sprint open and filled in when the second release (v11.2.0) closes.

## What worked

(filled at sprint close — patterns to keep)

## What regressed

(filled at sprint close — what slipped, what the next sprint should fix)

## What we learned

(filled at sprint close — new memory rules to file, refinements to existing ones)

## Tech debt accrued

(filled at sprint close — backlog items for future sprints)

## Process notes

(filled at sprint close — anything to change about how we run sprints; updates to the orchestrator skill)

## Memory rules — created or validated this sprint

(filled at sprint close — table of `feedback_*.md` files created or re-validated)

## Carry-forward for Sprint 14

Carry-forward known at sprint open:
- **In-app surface migration to Layer 2 tokens** (Sprint 12 deferred). Today / Train / Schedule / Drawer rebuilds against the new design system.
- **#49 AI year-end forecast.** Replace static YTD goal bar with AI-projected forecast. Schema impact: `users.annual_goal_km` + `annual_goal_type`.
- **#56 Club Share & Invite Flow.** Engagement loop unlock. Promotion + share sheet + invite link + invitee landing.
- **`managed: 1` Pro-tier flow.** Server-side managed-key plumbing if Pro tier is greenlit (Anthropic billing relay + Stripe webhook).
- **Argon2id rotation.** When the WASM bundle cost falls or stronger primitive needed.
- **Self-hosted fonts + Phosphor migration + form fields rebuild.** Sprint 12 backlog.
