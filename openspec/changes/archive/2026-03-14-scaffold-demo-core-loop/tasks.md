## 1. Repository Scaffold

- [x] 1.1 Create the top-level folder structure for `apps/web`, `apps/ai-service`, `packages/contracts`, `packages/game-engine`, and `infra/insforge`
- [x] 1.2 Add placeholder documentation in `apps/ai-service` and `infra/insforge` explaining that those services are reserved for later implementation
- [x] 1.3 Add minimal package-level entry points or placeholder files in `apps/web`, `packages/contracts`, and `packages/game-engine` so the first implementation path is explicit

## 2. Shared Contracts

- [x] 2.1 Define shared contract types for round state, player actions, judge output, deals, and round result
- [x] 2.2 Define the structured AI response shape used by the local demo adapter
- [x] 2.3 Export the contract surface needed by both the web app and game engine

## 3. Deterministic Game Engine

- [x] 3.1 Implement the state machine for the demo round flow from pitch submission through round result
- [x] 3.2 Implement validation for legal and illegal player actions across each state
- [x] 3.3 Implement deterministic scoring dimensions and judge weighting rules
- [x] 3.4 Implement deterministic deal generation and final round resolution

## 4. Local Demo App

- [x] 4.1 Build a minimal web flow that submits a pitch, renders judge reactions, accepts one follow-up answer, and presents deals
- [x] 4.2 Integrate the web flow with the game engine so state transitions come from engine outputs rather than UI-local decisions
- [x] 4.3 Add a thin mock or local AI adapter that returns structured judge reactions and follow-up prompts through the shared contract
- [x] 4.4 Render a final round result that explains the outcome using the deterministic evaluation model

## 5. Validation

- [x] 5.1 Add tests for valid state transitions across the demo round
- [x] 5.2 Add tests that invalid actions are rejected without changing round state
- [x] 5.3 Add tests that deal actions are blocked before deals are available
- [x] 5.4 Verify that a full demo round can complete locally from pitch submission to round result
