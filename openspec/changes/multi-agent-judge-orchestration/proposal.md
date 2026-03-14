## Why

The current repository defines a structured AI boundary, but judge dialogue is still modeled as a single mock adapter with no explicit support for independent judge personas, judge-local memory, or controlled inter-judge discussion. A dedicated orchestration capability is needed to make the future AI service richer without weakening the rule that the game engine remains the source of truth.

## What Changes

- Introduce a LangGraph-based judge orchestration capability inside `apps/ai-service` that models each judge as an independent agent with its own persona, tools, and memory namespace.
- Define a bounded discussion flow that allows judges to exchange draft reactions when needed before producing the final structured bundle.
- Specify the orchestration contract so the AI layer returns structured judge dialogue while leaving scores, legal transitions, and outcomes to deterministic engine rules.
- Define memory boundaries so per-round context, judge-local episodic memory, and stable persona state remain isolated from one another and cannot directly change game truth.

## Capabilities

### New Capabilities
- `judge-agent-orchestration`: A multi-agent AI orchestration layer that generates structured judge reactions and follow-up questions through independent judge agents, isolated memory, and optional bounded discussion.

### Modified Capabilities
- `demo-core-loop`: Clarify that structured AI outputs may be produced by either a local adapter or a dedicated orchestration service, while preserving deterministic engine authority over scores, state transitions, and deal outcomes.

## Impact

- Affects future work in `apps/ai-service`, `packages/contracts`, and the orchestration path that connects AI output to the engine and web app.
- Introduces a LangGraph dependency and a memory persistence strategy for judge-local agent state.
- Preserves the existing deterministic authority of `packages/game-engine` and the local demo loop as the compatibility baseline.
