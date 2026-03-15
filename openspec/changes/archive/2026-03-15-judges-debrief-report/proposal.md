## Why

After a round ends, the player sees a terse result headline and score summary but gets no window into *why* each judge reacted the way they did. The judges accumulate rich internal state — sentiment arcs, concerns, rationale tags, peer disagreements, episodic memory — that stays hidden. Surfacing this as an immersive, in-character debrief turns every round into a learning moment, helping players understand what resonated, what fell flat, and what to try differently next time.

## What Changes

- Add a new `DEBRIEF` round state after `ROUND_RESULT`, with a `REQUEST_DEBRIEF` player action to enter it
- Introduce a debrief data contract: per-judge narrative block (in-character reflection, sentiment journey, key concerns, what convinced them) plus an overall coaching tip
- Add an AI-service endpoint that takes each judge's accumulated state (draft, concerns, rationaleTags, sentiment, episodic memory, peer consultation logs, evaluation scores) and generates an in-character debrief narrative
- Add a deterministic debrief assembler in the game engine that collects the structured data (evaluation bars, judge weights, offer rationale) without requiring AI
- Expose a `/api/judge-debrief` route that orchestrates the AI narrative generation and merges it with deterministic data
- Add a `DebriefReport` UI component that renders each judge's reflection in an immersive, narrative-first layout with subtle evaluation bars as secondary detail

## Capabilities

### New Capabilities
- `judges-debrief`: Post-round immersive report showing each judge's in-character thinking journey, sentiment arc, concerns, what convinced or worried them, peer disagreements, and a personalized coaching tip — blending AI-generated narrative with deterministic score data

### Modified Capabilities
- `demo-core-loop`: The round flow gains a new terminal state (`DEBRIEF`) after `ROUND_RESULT`, with a player action to request the debrief

## Impact

- **Contracts** (`packages/contracts`): New `DEBRIEF` round state, `REQUEST_DEBRIEF` action, debrief payload shape validators
- **Game engine** (`packages/game-engine`): State machine transition from `ROUND_RESULT` → `DEBRIEF`, deterministic debrief assembler
- **AI service** (`apps/ai-service`): New debrief narrative generation endpoint using judge accumulated state
- **Web app** (`apps/web`): New API route `/api/judge-debrief`, new `DebriefReport` component, integration into round flow UI
- **Existing specs**: `demo-core-loop` spec gains a new requirement for the debrief transition
