## Context

The current deterministic round model supports a linear flow with one follow-up answer. That structure is too rigid for a panel where judges may continue, pause, or stop across several turns, but a fully unbounded conversation would be expensive, hard to test, and difficult to present clearly.

This change introduces a deterministic panel director that gives the product an open-ended feel while preserving bounded continuation and clear authority over when the round moves forward or stops.

## Goals / Non-Goals

**Goals:**
- Add a deterministic director for bounded post-pitch panel turns.
- Define typed panel event outputs for UI rendering and replay.
- Enforce turn budgets, stop conditions, and legal continuation rules outside the AI layer.
- Keep panel continuation compatible with later negotiation and judge replanning work.

**Non-Goals:**
- Designing live pitch reactions.
- Implementing judge-agent internal planning details.
- Allowing truly unbounded round continuation.

## Decisions

### Decision: Introduce a director layer above single-step state transitions

The system will add a deterministic panel director that owns turn budgets, eligible next actions, and stop conditions rather than encoding this logic solely as UI phase booleans.

Rationale:
- Multi-turn continuation is a game rule, not a rendering detail.
- It provides a single authority for when to continue, force decision, or close the round.

Alternatives considered:
- Let the AI service decide whether another turn happens.
  - Rejected because the AI layer should not control legal transitions.

### Decision: Use event-shaped panel output

Visible judge and founder actions will be emitted as typed panel events rather than repeatedly mutating one large phase object.

Rationale:
- Events map well to a staged UI and replayable fixtures.
- They allow multiple visible panel actions over time without confusing snapshot replacement.

Alternatives considered:
- Keep a single mutable conversation bundle.
  - Rejected because it becomes brittle as turns multiply.

### Decision: Keep continuation bounded by explicit budgets

The panel director will track limits such as total panel turns, per-judge follow-ups, and no-progress stop conditions.

Rationale:
- This preserves the feel of adaptive conversation without operational or UX runaway.
- It keeps the round deterministic and testable.

Alternatives considered:
- Allow indefinite continuation until all agents stop organically.
  - Rejected because it makes pacing and legality unpredictable.

## Risks / Trade-offs

- [Too many events may complicate the UI] -> Keep event types small and map them to a limited set of stage behaviors.
- [Budgets may feel too restrictive] -> Make limits configurable and tune them with fixtures.
- [Director logic may duplicate parts of the existing state machine] -> Keep the director as the coordination layer and reuse underlying deterministic evaluation primitives.

## Migration Plan

1. Define panel event and director contracts.
2. Extend deterministic round logic with panel-turn budgets and stop conditions.
3. Replace scripted judge-group progression with event-driven panel flow in the demo.
4. Integrate judge replanning and negotiation changes on top of the director.

Rollback is manageable because the demo can fall back to the current single-follow-up flow until the director is stable.

## Open Questions

- Should the first version allow multiple visible judge actions on one panel turn, or exactly one highlighted action at a time?
- Should the director live inside the existing state machine module or as a deterministic wrapper around it?
