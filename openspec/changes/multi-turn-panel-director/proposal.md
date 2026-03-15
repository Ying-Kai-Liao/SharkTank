## Why

The current round model is essentially linear: pitch, one follow-up, offers, decision. To support a believable panel that can continue for several turns without becoming unbounded, the product needs a deterministic round director that owns turn budgets, legal transitions, and stop conditions.

## What Changes

- Add a deterministic multi-turn panel director that coordinates post-pitch panel turns and round closure.
- Define typed panel event stream contracts for visible judge actions and founder responses.
- Add configurable turn budgets and stop conditions for bounded panel continuation.
- Update the local demo round flow so the browser renders structured panel state instead of scripted dialogue groups.

## Capabilities

### New Capabilities
- `multi-turn-panel-director`: Coordinates bounded post-pitch panel turns, event emission, legal continuation, and round closure.

### Modified Capabilities
- `demo-core-loop`: Replace the single follow-up demo flow with a bounded multi-turn director-led round structure.

## Impact

- Affected code will likely include [packages/game-engine](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/packages/game-engine), [packages/contracts](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/packages/contracts), and [apps/web](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/apps/web).
- New contracts will be needed for panel events, turn budgets, active judge status, and round-director decisions.
