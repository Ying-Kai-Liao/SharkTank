## Context

The AI service already supports isolated judge drafts and bounded peer consultation, but it currently finalizes one structured bundle per invocation. The desired product behavior requires judges who can reconsider after founder actions, ask more questions, wait, support peers, or drop out while keeping their personas and memory intact.

This change evolves the AI orchestration model into repeated per-turn planning without moving deterministic authority into the AI service.

## Goals / Non-Goals

**Goals:**
- Extend judge orchestration to re-plan after founder actions during an active round.
- Define structured turn intents and visible judge statuses for downstream consumers.
- Reuse bounded peer consultation in repeated planning steps.
- Preserve non-authoritative boundaries around offers, state transitions, and outcomes.

**Non-Goals:**
- Implementing deterministic turn budgets or round closure logic.
- Designing pitch-time reaction generation.
- Exposing raw internal deliberation traces to the frontend.

## Decisions

### Decision: Reuse the existing judge deliberation system as the planning core

Repeated planning will build on the current judge-agent orchestration flow rather than creating a separate AI subsystem for later turns.

Rationale:
- Persona and memory continuity are already established there.
- It avoids splitting judge behavior across multiple implementations.

Alternatives considered:
- Add a second lightweight planner just for post-answer turns.
  - Rejected because it would duplicate persona logic and create drift between initial and later turns.

### Decision: Emit compact turn intents instead of final prose only

Each eligible judge will output a structured intent such as ask, wait, offer, revise, support, or drop out, along with a visible judge status.

Rationale:
- Downstream consumers need actionable panel decisions, not only prose reactions.
- Status helps the UI show which judges are still engaged even when they are not speaking.

Alternatives considered:
- Keep returning only one text bundle and infer intent in the client.
  - Rejected because intent inference would be brittle and duplicate logic.

### Decision: Re-plan only on meaningful founder actions

The orchestration layer will accept updated round context after founder actions and re-run planning only when deterministic round logic determines another AI planning step is legal.

Rationale:
- This avoids needless model calls.
- It keeps deterministic continuation authority outside the AI service.

Alternatives considered:
- Re-run judge planning on every low-level event.
  - Rejected because it would increase cost without improving decision quality.

## Risks / Trade-offs

- [Repeated planning increases latency and cost] -> Trigger replanning only on legal founder-driven turns and keep peer consultation bounded.
- [Judge statuses may drift from visible actions] -> Produce status and intent together from the same planning step.
- [Repeated deliberation may be mistaken for authority] -> Keep final state transitions and offer validation outside the AI service.

## Migration Plan

1. Add turn intent and judge status contracts.
2. Extend the AI service entry points to accept repeated round context.
3. Reuse bounded peer consultation during eligible replanning turns.
4. Integrate with the panel director once deterministic continuation is available.

Rollback remains simple because the current one-shot post-pitch bundle path can continue operating until repeated planning is ready.

## Open Questions

- Should turn intents include a separate confidence field or only intent and status?
- Should judges be allowed to re-enter after a prior wait or tentative exit?
