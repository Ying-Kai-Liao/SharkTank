## Why

The founder side of the round currently collapses into a single answer and a final accept/reject step. To support the product goal of bargaining, refusal, decline-to-answer, and active negotiation across judges, negotiation needs to be modeled as its own capability with deterministic validation.

## What Changes

- Add founder negotiation actions for answer, bargain, accept, refuse, and decline-to-answer.
- Define how founder actions are appended to round context and broadcast back to eligible judges.
- Add deterministic validation for active offers and allowed negotiation revisions.
- Update the local demo flow so founder choices can drive another panel turn or close the round legally.

## Capabilities

### New Capabilities
- `founder-negotiation-actions`: Supports founder actions during negotiation-capable phases and validates how those actions affect the round.

### Modified Capabilities
- `demo-core-loop`: Expand the local demo beyond one answer and a final offer decision so founder negotiation actions can occur during an active round.

## Impact

- Affected code will likely include [packages/game-engine](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/packages/game-engine), [packages/contracts](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/packages/contracts), [apps/ai-service](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/apps/ai-service), and [apps/web](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/apps/web).
- New contracts will be needed for founder negotiation actions, active offer state, and validated offer revision payloads.
