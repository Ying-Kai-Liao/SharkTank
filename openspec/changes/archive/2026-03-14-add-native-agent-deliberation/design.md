## Context

The AI service already contains a LangGraph-based orchestration path with isolated per-judge draft generation, heuristic discussion gating, and bounded revision loops. That foundation is close to the desired behavior, but the current design still treats discussion as a generic revision loop rather than a native deliberation model with explicit round accounting, a hard three-round cap, and first-class brokered peer consultation.

This change spans multiple modules. It affects orchestration flow in `apps/ai-service`, shared discussion-policy validation in `packages/contracts`, provider execution and diagnostics, and the tool surface available to judge agents. The design must preserve the existing contract boundary: AI may shape dialogue, but it cannot change deterministic scores, state transitions, deal outcomes, or other engine truth.

## Goals / Non-Goals

**Goals:**
- Model draft generation and internal deliberation as distinct orchestration phases.
- Support zero to three internal discussion rounds per run with explicit round accounting.
- Provide a native brokered peer-query tool that lets a judge request structured peer input without enabling direct recursive agent-to-agent loops.
- Keep tool usage accounting separate from the discussion-round budget.
- Preserve the current product-facing judge bundle while exposing bounded deliberation diagnostics only through debug metadata.
- Extend resilience handling so peer consultation follows the same retry, concurrency, and degradation rules as other provider-mediated stages.

**Non-Goals:**
- Exposing raw internal reasoning or chain-of-thought in the product-facing API.
- Allowing unlimited or open-ended agent chat.
- Moving deterministic scoring, offer generation, or round outcomes into the AI layer.
- Requiring live model tool-calling in the first implementation if a provider adapter can satisfy the same contract.
- Designing multiplayer transcript sync or frontend transcript rendering for internal judge discussion.

## Decisions

### Decision: Introduce a first-class deliberation policy with a hard maximum of three rounds

The orchestration input will define deliberation behavior explicitly, including a `maxRounds` field that is clamped to the range `0..3`. A run may skip deliberation entirely, but when discussion occurs the graph must never exceed three discussion rounds.

Rationale:
- It turns an implicit loop into a stable capability with predictable cost and latency.
- It matches the requested product behavior exactly.
- It gives tests and provider integrations a single source of truth for discussion budgeting.

Alternatives considered:
- Keep the current untyped discussion loop and rely on environment defaults.
  - Rejected because the semantics remain informal and easy to drift.
- Allow arbitrary discussion caps configured by environment.
  - Rejected because the request is specifically for bounded native support up to three rounds.

### Decision: Implement peer consultation as a brokered tool, not direct agent-to-agent messaging

Judge agents will access peer input through an orchestrator-managed `ask_peer_agents` tool. The tool accepts a bounded question and target judge ids, then returns normalized peer summaries derived from the latest eligible peer drafts or responses for the current run.

Rationale:
- It preserves central control over recursion, visibility, and token cost.
- It avoids emergent message loops between agents.
- It allows the service to audit peer consultation without exposing chain-of-thought.

Alternatives considered:
- Let agents send freeform messages directly to one another.
  - Rejected because it creates unbounded conversational graphs and weakens observability.
- Preload every agent with every peer draft on every turn.
  - Rejected because it removes agent choice and makes “ask other agents” not actually tool-mediated.

### Decision: Separate discussion-round accounting from tool-budget accounting

The service will treat discussion rounds and tool usage as different budgets. Tool invocations do not consume discussion rounds, but they may be subject to their own per-stage limits and diagnostics.

Rationale:
- It matches the requested rule that tool use should not count as an internal discussion round.
- It keeps round accounting simple and interpretable.
- It makes cost controls easier to tune independently.

Alternatives considered:
- Count every tool call as a discussion turn.
  - Rejected because it would make the round budget noisy and hard to reason about.
- Ignore tool accounting entirely.
  - Rejected because bounded peer consultation still needs operational guardrails.

### Decision: Keep the product-facing bundle unchanged and expose deliberation details only through debug metadata

The finalizer will continue returning the existing structured `judgeResponses[]` plus `leadQuestion` bundle. Internal discussion summaries, peer queries, and per-turn diagnostics remain implementation details unless explicitly requested through debug metadata.

Rationale:
- It avoids breaking the web app and deterministic engine integration.
- It maintains the current rule that internal deliberation is non-authoritative.
- It gives engineers observability without coupling the product UI to orchestration internals.

Alternatives considered:
- Add peer discussion transcripts to the normal bundle.
  - Rejected because it expands the consumer contract and encourages product reliance on internal orchestration details.

### Decision: Extend provider resilience semantics to peer consultation instead of creating a separate failure model

Peer consultation will use the same bounded retry/backoff, concurrency limiting, and degradation reporting model already used for draft generation and discussion revision. A peer-consultation failure may degrade the requesting judge's deliberation path, but it must not invalidate the final structured bundle unless existing minimum-panel thresholds are violated.

Rationale:
- It keeps operational behavior coherent across stages.
- It reuses existing resilience infrastructure and tests.
- It avoids a split mental model where one discussion sub-stage is governed differently from the rest.

Alternatives considered:
- Treat peer consultation failures as fatal.
  - Rejected because bounded deliberation should degrade gracefully when possible.
- Ignore retries for peer consultation because it is “internal.”
  - Rejected because it still consumes provider capacity and can fail transiently.

## Risks / Trade-offs

- [More deliberation stages increase latency and token cost] -> Enforce the three-round cap, keep peer replies structured and short, and allow zero-round runs.
- [Brokered peer queries may still over-couple judges] -> Restrict peer visibility to bounded normalized summaries instead of raw reasoning traces.
- [Provider adapters may vary in how naturally they support the tool] -> Define the tool contract at the service boundary and let adapters implement it with prompts or native tool calls.
- [Operational metrics may become harder to interpret] -> Emit per-stage debug metadata with explicit stage names and separate round/tool counters.
- [The README scope change may imply immediate product commitment] -> Keep the OpenSpec change explicit that this is an AI-service capability, not a shift in deterministic authority.

## Migration Plan

1. Extend the shared discussion-policy contract to express native deliberation rounds with a hard cap of three.
2. Add the `judge-agent-deliberation` capability and resilience deltas in OpenSpec.
3. Refactor the AI-service graph to distinguish draft, peer consultation, deliberation rounds, and finalization.
4. Introduce the brokered peer-query tool surface and provider support for using it during deliberation.
5. Expand resilience diagnostics and tests to cover peer-consultation execution and degraded deliberation paths.
6. Keep the final consumer bundle unchanged so the web app and game engine remain compatible throughout rollout.

Rollback is straightforward because the orchestration service can fall back to the existing draft-plus-revision flow while preserving the same final bundle contract.

## Open Questions

- Should the per-judge peer-query budget be one query per round, one query per target, or a global per-run limit?
- Should debug metadata retain peer-query payloads verbatim, or only summaries and counts?
- Does the first implementation need provider-native tool calling for the OpenAI path, or is adapter-mediated prompt injection sufficient?
