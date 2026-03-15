## Why

The judges need to feel present during the founder pitch before the full post-pitch panel logic exists. A dedicated change for live stage reactions lets the team prototype mocked or realtime judge expressions without entangling them with scoring or negotiation behavior.

## What Changes

- Add a live judge reaction capability during the active pitch window.
- Define structured presentation-safe reaction cues and visible judge presence states.
- Support both mocked reactions and provider-backed realtime reactions through the same contract.
- Update the local demo flow so pitch-time judge presence can be rendered independently from post-pitch deliberation.

## Capabilities

### New Capabilities
- `live-judge-stage-reactions`: Produces non-authoritative live judge reaction cues and presence states during the pitch.

### Modified Capabilities
- `demo-core-loop`: Allow the local demo to render pitch-time judge reactions as part of the playable round flow.

## Impact

- Affected code will likely include [apps/web](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/apps/web), [apps/ai-service](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/apps/ai-service), and [packages/contracts](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/packages/contracts).
- New contracts will be needed for live reaction events, judge presence signals, and fallback/mock reaction payloads.
