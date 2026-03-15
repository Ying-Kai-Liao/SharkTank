## Why

The existing AI-service orchestration is built around a one-shot post-pitch deliberation pass. To support judges who can keep following up, ask for peer views, wait, re-enter, or drop out after founder actions, judge orchestration needs to become a repeated per-turn planning capability.

## What Changes

- Extend judge orchestration so it can re-plan after each founder action during an active round.
- Add structured per-turn judge intents and visible judge statuses for panel rendering.
- Keep peer consultation brokered and bounded while allowing judges to react to evolving round context.
- Preserve the non-authoritative boundary so judge planning shapes dialogue and visible behavior but not deterministic game truth.

## Capabilities

### New Capabilities
- `judge-turn-intents`: Defines structured per-turn judge intents and visible statuses for panel-facing behavior.

### Modified Capabilities
- `judge-agent-deliberation`: Extend deliberation from a one-shot phase into repeated turn-planning across an active founder/judge round.

## Impact

- Affected code will likely include [apps/ai-service](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/apps/ai-service), [packages/contracts](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/packages/contracts), and [apps/web](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/apps/web).
- New contracts will be needed for turn intents, visible judge statuses, and repeated re-planning inputs.
