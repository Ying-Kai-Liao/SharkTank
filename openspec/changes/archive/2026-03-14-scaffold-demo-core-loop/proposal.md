## Why

The repository currently describes a full multi-service SharkTank architecture, but there is no implementation scaffold and no validated core loop. A simpler local demo is needed first so the project can prove deterministic round flow and action validation before introducing heavier services such as realtime sync, auth, or a separate AI backend.

## What Changes

- Define a stripped-down local demo focused on a single playable SharkTank round.
- Establish the initial monorepo folder structure with placeholders for future services.
- Specify the deterministic game loop, legal player actions, and core validation requirements.
- Constrain AI usage to structured, non-authoritative outputs for the demo.

## Capabilities

### New Capabilities
- `demo-core-loop`: A local-first playable round that evaluates a pitch, produces judge reactions, handles one follow-up answer, generates deal offers, and resolves the round through deterministic rules.
- `repo-scaffold`: An initial repository structure that creates the planned monorepo folders while only requiring implementation in the web app, shared contracts, and game engine for the first demo.

### Modified Capabilities

None.

## Impact

- Adds initial OpenSpec contracts for the demo loop and repo scaffold.
- Affects future work in `apps/web`, `packages/contracts`, and `packages/game-engine`.
- Establishes placeholders for `apps/ai-service` and `infra/insforge` without requiring them to be functional in the first implementation.
- Narrows the first implementation scope to local orchestration and deterministic validation instead of full distributed architecture.
