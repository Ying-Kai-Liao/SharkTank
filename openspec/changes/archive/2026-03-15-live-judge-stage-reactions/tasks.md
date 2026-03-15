## 1. Reaction Contracts

- [x] 1.1 Define shared contract types for live judge reaction events, presence states, and optional animation cues
- [x] 1.2 Add validation rules that keep live reactions presentation-only and provider-agnostic

## 2. Reaction Generation

- [x] 2.1 Implement a mock live-reaction adapter that emits structured judge presence updates during the pitch
- [x] 2.2 Add a provider-backed reaction adapter boundary that can be integrated later without changing UI contracts
- [x] 2.3 Add throttling or cadence rules so reaction generation does not fire on every transcript update

## 3. Demo Integration And Tests

- [x] 3.1 Update the stage UI to render live judge presence during the pitch
- [x] 3.2 Keep live reaction rendering isolated from deterministic evaluation and round transitions
- [x] 3.3 Add tests and fixtures for mock reaction generation, no-provider fallback, and non-authoritative behavior
