## Context

The repository currently contains architecture intent but no implementation scaffold. The full design calls for a Next.js app, an AI service, shared contracts, a deterministic game engine, and infrastructure support, but the first implementation only needs to prove the core round works and that deterministic validation owns the game truth.

The immediate audience is the project team working inside a single repository with no application code committed yet. The first usable outcome is a local demo that can be run and evaluated without requiring auth, realtime sync, or separate service deployment.

## Goals / Non-Goals

**Goals:**
- Establish the intended monorepo folder structure so future work has stable integration points.
- Build the first implementation around a single local demo round instead of the full multi-service architecture.
- Keep authoritative game state inside a deterministic engine with explicit legal transitions.
- Define a thin AI boundary that can supply structured dialogue data without deciding game outcomes.
- Make the first validation target narrow and testable: one round can complete, and invalid actions are blocked.

**Non-Goals:**
- Building realtime sync, auth, or persistent multiplayer session management.
- Requiring a separate FastAPI deployment for the first implementation.
- Implementing voice input, facial expressions, judge-to-judge debate, or long-term memory.
- Treating AI outputs as authoritative for scores, state transitions, or deal outcomes.

## Decisions

### Decision: Use a local-first demo architecture

The first implementation will run as a local demo centered on `apps/web`, with direct use of `packages/game-engine` and `packages/contracts`.

Rationale:
- It validates the main product loop without operational overhead.
- It shortens the path from empty repository to playable demo.
- It matches the practical shape of the reference `hot-seat` project: one local interface, one orchestration loop, minimal setup.

Alternatives considered:
- Build the full multi-service architecture first.
  - Rejected because it adds deployment and coordination cost before the core loop is proven.
- Build only a standalone app with no monorepo structure.
  - Rejected because it creates avoidable migration work once shared packages and services are introduced.

### Decision: Keep the final repository shape, but use placeholders for future services

The initial scaffold will create `apps/web`, `apps/ai-service`, `packages/contracts`, `packages/game-engine`, and `infra/insforge`, while only the web app, contracts, and engine need to contain working code in the first implementation.

Rationale:
- It preserves architectural intent.
- It avoids reshaping the repository later when services are introduced.
- It keeps implementation scope small by allowing `apps/ai-service` and `infra/insforge` to remain placeholders.

Alternatives considered:
- Omit future folders until they are implemented.
  - Rejected because the repository guidelines already define the target layout and shared package boundaries.

### Decision: Model the demo as a deterministic state machine

The demo will be represented as a fixed round flow with legal player actions and invalid-action rejection.

Proposed states:
- `LOBBY`
- `PITCH_SUBMITTED`
- `JUDGE_REACTIONS`
- `FOLLOW_UP`
- `DEALS`
- `PLAYER_DECISION`
- `ROUND_RESULT`

Rationale:
- A state machine makes it possible to test legal transitions directly.
- It keeps the LLM outside the authority path.
- It supports later expansion without weakening the core rule that the engine owns truth.

Alternatives considered:
- Use a loose orchestration script with implicit state.
  - Rejected because it makes invalid-action handling and deterministic validation harder to prove.

### Decision: Use structured AI outputs behind a thin adapter

The demo will consume AI or mock responses through a contract that returns structured judge content such as sentiment, short reaction, follow-up question, and rationale tags.

Rationale:
- It supports a real conversational feel without granting authority to the AI layer.
- It allows the first implementation to use a mock or in-process adapter and later replace it with a network service.
- It creates stable interfaces for `packages/contracts`.

Alternatives considered:
- Use freeform LLM output directly in the UI.
  - Rejected because it makes validation and later service extraction harder.
- Build the dedicated FastAPI service immediately.
  - Rejected because it is unnecessary for the first validation target.

## Risks / Trade-offs

- [Local demo diverges from future service architecture] -> Keep shared contracts and package boundaries in the initial scaffold so later extraction does not require domain rewrites.
- [Mocked or thin AI adapter may hide production integration issues] -> Require structured contracts now and defer network transport concerns to a later change.
- [A very narrow first loop may feel simplistic] -> Treat this change as validation of the backbone, not the final game experience.
- [Placeholder folders may be mistaken for implemented services] -> Add explicit placeholder documentation so the scaffold is honest about what exists.

## Migration Plan

1. Create the repository folders and placeholder documentation for future services.
2. Introduce shared contracts and the deterministic game engine.
3. Build the local demo loop in the web app against those packages.
4. Add validation tests for legal actions and deterministic round resolution.
5. Expand into separate AI service and infrastructure changes only after the demo loop is proven.

Rollback is low risk because this change is additive. If the demo approach proves unsuitable, the repository can retain the scaffold while replacing the local orchestration layer in a later change.

## Open Questions

- Should the first demo use fully mocked judge dialogue or a real model behind a local adapter?
- Should the first pass score pitches from user input heuristics, fixed seed data, or AI-extracted signals that the engine then clamps?
- Is one follow-up question sufficient to evaluate the loop, or should the design reserve room for a second follow-up without implementing it yet?
