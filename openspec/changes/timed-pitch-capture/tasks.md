## 1. Contracts And State

- [x] 1.1 Define shared contract types for pitch start, transcript update, timer state, and finalized pitch output
- [x] 1.2 Extend deterministic round state to include an explicit pitch phase with start and close behavior
- [x] 1.3 Add validation for late transcript updates and finalized pitch payload shape

## 2. Capture Adapters

- [x] 2.1 Implement a local/mock pitch transcript source behind the shared capture interface
- [x] 2.2 Add a source adapter boundary for future live STT integration without changing downstream consumers
- [x] 2.3 Ensure finalized pitch output is produced consistently regardless of capture source

## 3. Demo Integration And Tests

- [x] 3.1 Update the web demo to render the authoritative pitch timer and pitch-close transition from structured state
- [x] 3.2 Replace the hardcoded short countdown path with the new timed pitch phase
- [x] 3.3 Add deterministic tests for timer expiration, manual pitch close, transcript finalization, and rejected post-close input
