## Context

The current web demo starts a short client-side countdown and then jumps straight into a pitch timer inside the page component. There is no first-class contract for transcript updates, pitch closure, or finalized pitch payloads, which makes it hard to swap between mock input and real STT later.

This change isolates the pitch phase as its own deterministic capability so later panel and negotiation work can depend on a clean, finalized pitch artifact rather than ad hoc UI state.

## Goals / Non-Goals

**Goals:**
- Introduce a real pitch phase with deterministic start, timer tracking, and close behavior.
- Define shared contracts for transcript updates and finalized pitch output.
- Support mock and live STT sources through the same interface.
- Keep pitch capture independent from live judge reactions and post-pitch panel logic.

**Non-Goals:**
- Designing judge reactions during the pitch.
- Implementing post-pitch panel turns or negotiation.
- Selecting a production STT provider in this change.

## Decisions

### Decision: Treat pitch timing as deterministic round state

The timer window and authoritative pitch-close event will be owned by deterministic round logic rather than the browser alone.

Rationale:
- The pitch duration is a product rule, not just a UI detail.
- Later phases need a reliable signal for when the pitch is final.

Alternatives considered:
- Keep timer state local to the page.
  - Rejected because later services would not have a shared notion of pitch closure.

### Decision: Separate transcript updates from finalized pitch output

The system will support incremental transcript update events during the pitch and a distinct finalized pitch artifact once the pitch closes.

Rationale:
- Downstream evaluation should consume stable finalized text, not noisy partial input.
- It allows STT correction behavior later without changing the end contract.

Alternatives considered:
- Use only one mutable pitch string.
  - Rejected because it blurs live capture with finalized round input.

### Decision: Keep the capture source behind an adapter boundary

Pitch capture will accept either mock transcript input or live STT provider output through the same internal contract.

Rationale:
- The local demo should work before provider integration exists.
- It prevents provider choice from leaking into round logic.

Alternatives considered:
- Hardcode browser input as the only capture source.
  - Rejected because it would require redesign once live STT arrives.

## Risks / Trade-offs

- [Partial transcripts may be noisy or unstable] -> Finalize a separate pitch artifact and keep downstream logic dependent on that finalized output.
- [Timer ownership may become split between UI and engine] -> Make deterministic round state the source of truth and let UI render it.
- [Provider-specific STT behaviors may differ] -> Normalize transcript updates through a common adapter contract.

## Migration Plan

1. Add pitch timer and transcript contracts.
2. Extend the demo round model with explicit pitch start and close behavior.
3. Implement a mock capture source first.
4. Layer live STT integration behind the same contracts later.

Rollback is straightforward because the current local countdown can continue serving as a fallback until the new pitch phase is wired end to end.

## Open Questions

- Should transcript updates be append-only in the first version, or support partial correction events immediately?
- Should early manual pitch close be supported from the first implementation?
