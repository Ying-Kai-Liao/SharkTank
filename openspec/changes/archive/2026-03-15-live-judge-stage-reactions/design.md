## Context

The intended product experience includes judges who visibly react while the founder is pitching, but the repo currently has only local mock reactions triggered after user messages. This change isolates the pitch-time presence layer so the team can prototype expressive judge behavior without waiting for the full multi-turn panel loop.

## Goals / Non-Goals

**Goals:**
- Define structured live judge reaction cues during the pitch.
- Support visible presence states such as engagement, confusion, skepticism, or understanding.
- Allow both mocked and provider-backed realtime reaction generation.
- Keep all pitch-time reactions non-authoritative.

**Non-Goals:**
- Determining scores, offers, or round closure from reactions.
- Implementing post-pitch judge re-planning.
- Choosing a single realtime provider implementation in this change.

## Decisions

### Decision: Keep live reactions presentation-only

Pitch-time judge reactions will be treated as UI-facing signals and will not affect deterministic evaluation or round legality.

Rationale:
- Reactions are for perceived liveliness, not game truth.
- This keeps the capability safe to prototype with mocks.

Alternatives considered:
- Feed live reactions directly into scoring.
  - Rejected because transient pitch impressions should not override deterministic evaluation logic.

### Decision: Normalize reactions into a small contract

The system will normalize live reactions into structured signals such as mood, presence, confidence band, or animation cue.

Rationale:
- The UI needs a stable surface whether reactions are mocked or provider-backed.
- A narrow contract reduces provider lock-in.

Alternatives considered:
- Stream raw model text to the frontend.
  - Rejected because it is brittle and difficult to map onto animation states.

### Decision: Throttle reaction generation independently from transcript capture

Reaction generation will run on its own cadence and consume recent pitch context rather than firing on every transcript token.

Rationale:
- This keeps latency and cost bounded.
- It avoids flickery UI behavior from overly frequent updates.

Alternatives considered:
- Recompute reactions on every transcript event.
  - Rejected because it is noisy and operationally expensive.

## Risks / Trade-offs

- [Frequent reactions may look chaotic] -> Use a throttled cadence and constrained presence vocabulary.
- [Mock reactions may not match future provider behavior] -> Define a stable contract first and treat both implementations as adapters.
- [Users may assume reactions are authoritative] -> Keep them visibly cosmetic and avoid tying them to score or legality messaging.

## Migration Plan

1. Define live reaction contracts.
2. Implement a mock reaction adapter for the local demo.
3. Update stage rendering to consume reaction cues during the pitch.
4. Add provider-backed realtime generation later behind the same interface.

Rollback is low risk because the stage can fall back to neutral judge presence if no reaction adapter is available.

## Open Questions

- Should the first UI render discrete moods only, or also include intensity/confidence?
- How often should mocked or live reactions update during a 2-minute pitch?
