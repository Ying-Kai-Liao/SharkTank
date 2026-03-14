## Context

The repository currently proves judge dialogue through a local mock adapter in `apps/web`, while `apps/ai-service` remains a placeholder. The project already commits to a strict split: the AI layer may generate structured dialogue, but `packages/game-engine` owns deterministic state transitions, scoring, and deal outcomes.

This change introduces a richer AI orchestration pattern without changing that authority boundary. The design must support independent judge personas, judge-local memory, and optional inter-judge discussion while remaining compatible with the existing structured judge bundle consumed by the demo loop.

## Goals / Non-Goals

**Goals:**
- Introduce a multi-agent orchestration design for judge dialogue inside `apps/ai-service`.
- Give each judge agent an isolated persona, tool surface, and memory namespace.
- Allow bounded judge-to-judge discussion when the orchestration layer determines it is useful.
- Preserve compatibility with the existing structured AI contract used by the web app and game engine.
- Keep all memory and discussion outputs non-authoritative with respect to scores, legal transitions, and round outcomes.

**Non-Goals:**
- Moving deterministic scoring or offer generation into the AI layer.
- Requiring judge-to-judge discussion on every round.
- Designing persistent multiplayer session behavior or realtime transcript sync.
- Specifying a particular model provider or hosted vector database in this change.
- Exposing internal discussion transcripts as authoritative game data.

## Decisions

### Decision: Place LangGraph orchestration behind the AI-service boundary

The multi-agent graph will live in `apps/ai-service` or an equivalent local adapter that mirrors the same contract, rather than inside `packages/game-engine` or the web UI.

Rationale:
- It respects the repository rule that the AI layer decides how the game sounds, not what is true.
- It keeps orchestration concerns isolated from deterministic rules.
- It allows the current local demo to keep using the same structured response shape while future work swaps transport and hosting.

Alternatives considered:
- Embed the graph directly in `apps/web`.
  - Rejected because it couples UI concerns to orchestration internals and makes later service extraction harder.
- Let the graph call engine functions and compute outcomes directly.
  - Rejected because it violates deterministic authority and makes behavior harder to test.

### Decision: Model each judge as an independent sub-agent with isolated state

Each judge agent will receive the same round context packet plus judge-specific persona data, but will maintain separate working memory and tool access during orchestration.

Rationale:
- It maps naturally to the existing judge profile model.
- It prevents one judge's transient reasoning or memory from implicitly overwriting another's perspective.
- It makes future per-judge tuning and testing straightforward.

Alternatives considered:
- Use a single monolithic prompt that role-plays all judges.
  - Rejected because persona isolation and memory separation become informal rather than enforced.
- Share a single memory store across all judges.
  - Rejected because it weakens persona independence and increases cross-contamination risk.

### Decision: Use a bounded discussion stage gated by orchestration signals

The graph will support an optional discussion subgraph that runs only when configured heuristics indicate disagreement, ambiguity, or low confidence in initial drafts. The discussion stage will be capped to a small fixed number of turns.

Rationale:
- It preserves the user goal of allowing judges to discuss with each other when needed.
- It limits latency, token cost, and runaway conversational loops.
- It keeps the final system behavior predictable enough for product integration.

Alternatives considered:
- Always run a discussion loop.
  - Rejected because it increases cost and latency even when judges already have stable outputs.
- Never allow judges to see one another's drafts.
  - Rejected because it blocks the desired “panel discussion” behavior entirely.

### Decision: Separate memory into round, episodic, and persona layers

The orchestration design will distinguish:
- round context: pitch, deterministic evaluation, and current transcript for the active invocation
- judge episodic memory: stored observations or preferences associated with that judge and player/session
- persona state: durable configuration derived from the judge profile and system instructions

Rationale:
- It prevents implementation confusion between prompt configuration and user-derived memory.
- It allows session continuity without granting memory authority over deterministic outcomes.
- It gives the design a clean place to enforce retention and privacy rules later.

Alternatives considered:
- Store all memory as one undifferentiated blob.
  - Rejected because it obscures lifecycle and authority boundaries.
- Make the system stateless across rounds.
  - Rejected because it would not satisfy the independent memory goal behind this change.

### Decision: Finalize all judge outputs through a contract-normalizing step

The graph will terminate in a finalizer that converts drafts and discussion results into the structured `judgeResponses[]` plus `leadQuestion` bundle expected by downstream consumers. Internal discussion artifacts will not be exposed as authoritative fields.

Rationale:
- It preserves compatibility with the existing demo loop and contracts.
- It creates a single place to validate output completeness and safety.
- It ensures internal reasoning remains implementation detail instead of product API.

Alternatives considered:
- Return raw agent traces to the client and let the UI interpret them.
  - Rejected because it weakens contract stability and risks exposing brittle internal state.

## Risks / Trade-offs

- [Discussion loops increase latency and token cost] -> Gate discussion behind explicit heuristics and keep turn counts bounded.
- [Judge-local memory may bleed into gameplay authority] -> Restrict memory usage to dialogue generation and contract fields that do not affect engine truth.
- [A richer service contract may drift from the current local adapter] -> Keep the final response shape compatible with the existing structured judge bundle.
- [Independent agents create more moving parts to test] -> Add per-agent contract tests, graph-level orchestration tests, and deterministic fixture-based evaluations.
- [Memory persistence choices may become infrastructure-coupled too early] -> Define storage interfaces now and defer concrete persistence backends to implementation.

## Migration Plan

1. Define the orchestration capability and contract updates in OpenSpec.
2. Scaffold `apps/ai-service` around a graph entrypoint that accepts deterministic engine context and returns the existing structured judge bundle shape.
3. Introduce judge agent definitions, memory interfaces, and bounded discussion policies behind that entrypoint.
4. Keep the current local adapter path available until the service path produces equivalent structured outputs for the demo loop.
5. Switch the orchestration caller from the mock adapter to the service boundary only after contract validation and fixture tests pass.

Rollback remains straightforward because the local adapter can continue serving the demo loop if the multi-agent service is not ready.

## Open Questions

- Should judge episodic memory be keyed per founder, per session, or both?
- Which heuristics should trigger inter-judge discussion in the first implementation: disagreement score, low confidence, explicit ambiguity tags, or a combination?
- Should the final API expose any non-authoritative discussion summary for UI flavor, or keep discussion entirely internal?
- Does the first implementation need persistent memory storage, or is process-local memory sufficient to validate the capability?
