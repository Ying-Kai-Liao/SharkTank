## Why

The current local demo round is a scripted single-pass experience, while the intended product is a live panel where judges react during the pitch, deliberate after the pitch, and continue interacting with the founder through follow-up questions and negotiation. This change defines that future behavior in specs now so the team can implement it incrementally later without blurring AI flavor with deterministic game truth.

## What Changes

- Add a timed pitch-capture capability that supports a bounded speaking window and transcript collection suitable for STT-backed input.
- Add a live stage-reaction capability so judges can show non-authoritative realtime understanding cues during the pitch.
- Add visible judge-presence and status behavior so the panel can communicate understanding, evaluation, uncertainty, active offers, and dropout states throughout the round.
- Add a multi-turn panel loop capability where each judge independently decides whether to ask, offer, wait, consult peers, or drop out after the pitch.
- Add a founder negotiation capability covering answer, accept, bargain, refuse, and judge awareness of those actions.
- Expand the judge-agent orchestration model from a one-shot post-pitch bundle into repeated per-turn planning across the round.
- Expand the demo round flow from a single follow-up answer into a director-led multi-turn round that still ends within deterministic limits.

## Capabilities

### New Capabilities
- `timed-pitch-capture`: Captures a pitch within a configured timer window and produces a finalized transcript for downstream evaluation and orchestration.
- `live-judge-stage-reactions`: Produces non-authoritative realtime judge reaction cues during the live pitch without changing deterministic round state.
- `multi-turn-panel-loop`: Runs a bounded post-pitch panel loop where each judge can independently ask, wait, consult peers, present an offer intent, or exit.
- `founder-negotiation-actions`: Supports founder actions such as answering questions, bargaining, accepting, and refusing while broadcasting those actions back to the panel.

### Modified Capabilities
- `demo-core-loop`: Replace the current single follow-up local demo flow with a bounded multi-turn director flow that coordinates pitch capture, panel turns, negotiation, and round closure.
- `judge-agent-deliberation`: Extend judge orchestration from a one-shot deliberation phase into a repeated turn-planning capability that can react to founder actions and emit visible panel-facing intents.

## Impact

- Affected code will likely include [apps/web](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/apps/web), [apps/ai-service](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/apps/ai-service), [packages/contracts](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/packages/contracts), and [packages/game-engine](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/packages/game-engine).
- New contracts will be needed for live pitch events, judge presence/status cues, per-turn panel intents, panel event streams, negotiation actions, and round-director decisions.
- The AI service will need new orchestration surfaces, but deterministic authority for timers, legal actions, offers, and round closure must remain outside the AI layer.
