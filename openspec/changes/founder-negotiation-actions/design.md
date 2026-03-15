## Context

The current founder interaction model effectively allows one answer and then a final decision on offers. That is too narrow for the intended experience, where the founder may answer, bargain, refuse, or decline to respond while judges react to those choices. This change isolates negotiation behavior so founder-facing actions can be implemented and validated independently from the broader panel-director and judge-replanning work.

## Goals / Non-Goals

**Goals:**
- Define founder negotiation actions as first-class round actions.
- Broadcast founder actions back into round context for later judge planning.
- Keep active offer and offer-revision validity deterministic.
- Allow rounds to close legally even when the founder refuses or declines to answer.

**Non-Goals:**
- Implementing the full panel continuation model.
- Letting AI-generated offer text become authoritative on its own.
- Designing pitch-time capture or live reactions.

## Decisions

### Decision: Treat founder negotiation choices as distinct action types

Answer, bargain, accept, refuse, and decline-to-answer will be modeled separately rather than folded into a generic “message” action.

Rationale:
- Each action has different legality and downstream effects.
- It keeps validation explicit and testable.

Alternatives considered:
- Use one generic founder message action.
  - Rejected because legal branching and offer validation would become ambiguous.

### Decision: Keep authoritative offer state deterministic

AI may influence negotiation language or preferences, but any active offer or revision must be validated against deterministic rules before it becomes round state.

Rationale:
- Negotiation is the riskiest place for AI to become the source of truth.
- Deterministic validation keeps outcomes explainable.

Alternatives considered:
- Let judges freely invent negotiation terms.
  - Rejected because it violates the repository boundary around deterministic truth.

### Decision: Feed founder actions back into panel context

Each founder negotiation action will be appended to round context so later eligible judge planning steps can react to it.

Rationale:
- Judges need to react differently to bargaining versus refusal.
- It preserves a coherent shared round history.

Alternatives considered:
- Handle founder negotiation purely in the UI.
  - Rejected because other judges would not have a consistent view of what happened.

## Risks / Trade-offs

- [Negotiation branches may multiply quickly] -> Keep action types narrow and validate continuation deterministically.
- [Offer revisions may drift from allowed ranges] -> Clamp or reject revisions before they become active.
- [Decline-to-answer behavior may feel abrupt] -> Define clear close-the-round rules and UI messaging for that path.

## Migration Plan

1. Add founder negotiation action contracts.
2. Extend deterministic round logic to validate active offer actions and refusal/decline flows.
3. Feed founder actions back into panel context for later judge planning.
4. Update the demo UI to expose negotiation choices only when they are legal.

Rollback is low risk because the demo can keep its current accept/reject flow until richer negotiation is implemented.

## Open Questions

- Should bargain actions reference a specific offer id only, or allow a founder to negotiate across multiple active offers?
- Should refusal of one offer automatically leave other active offers open in the first version?
