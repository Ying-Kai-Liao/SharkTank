## Context

The new judge orchestration path can already call a real model provider and execute judge work in parallel. That improves latency, but it also creates bursty provider traffic during the draft stage and again during bounded discussion turns. Real providers can respond with rate limits, transient transport failures, or malformed partial responses, and the current orchestration path has only minimal normalization around those cases.

This change adds a resilience layer around provider execution without changing the repository's core rule: AI remains non-authoritative and must continue returning only structured dialogue content. The design therefore needs to preserve deterministic engine authority, keep the structured bundle contract stable, and make degraded execution observable and testable.

## Goals / Non-Goals

**Goals:**
- Add retry and backoff behavior for transient provider failures during parallel judge execution.
- Bound concurrency so judge fan-out remains parallel but does not create uncontrolled request spikes.
- Allow the orchestration run to complete with a valid structured bundle when some judge calls exhaust retries, using bounded fallback behavior.
- Expose retry and degradation metadata for debugging and tests without leaking internal reasoning to product consumers.

**Non-Goals:**
- Guarantee provider success under all upstream outages.
- Introduce provider-specific circuit breaker infrastructure or cross-process queueing.
- Change the authoritative AI output contract consumed by the demo loop.
- Move provider resilience into `packages/game-engine` or any deterministic layer.

## Decisions

### Decision: Wrap provider calls in a shared retry policy

All draft and revision provider calls will go through a shared helper that classifies retryable failures and applies capped exponential backoff with jitter.

Rationale:
- It keeps retry rules consistent across draft and discussion stages.
- It isolates provider resilience logic from prompt-building code.
- It makes retry behavior easy to test with stub providers.

Alternatives considered:
- Ad hoc retries inside each provider method.
  - Rejected because policy drift would be likely across code paths.
- No retries, relying only on fallbacks.
  - Rejected because transient failures would degrade quality too quickly under real use.

### Decision: Keep parallelism, but add explicit concurrency limits

Judge draft and revision work will remain parallel, but execution will pass through a concurrency limiter so the system can cap in-flight provider requests per orchestration run.

Rationale:
- It preserves the latency benefit of parallel judge execution.
- It reduces the chance that a single run immediately bursts into provider rate limits.
- It gives configuration room for different provider plans or environments.

Alternatives considered:
- Fully serial execution.
  - Rejected because it gives away the main latency benefit of multi-judge orchestration.
- Unlimited parallel fan-out.
  - Rejected because it is fragile under real provider limits.

### Decision: Fallback per judge after retry exhaustion

If a judge draft or revision call still fails after retries, the orchestrator will synthesize a valid fallback draft for that judge instead of failing the entire panel outright, unless the run drops below a minimum viable response threshold.

Rationale:
- It keeps the web demo and local service path consumable during partial provider degradation.
- It respects the structured contract and non-authoritative boundary.
- It localizes one provider failure to one judge whenever possible.

Alternatives considered:
- Fail the full panel on the first unrecoverable judge error.
  - Rejected because one transient upstream fault would collapse the whole round.
- Always hide failures and never surface degradation metadata.
  - Rejected because debugging and operational visibility would be poor.

### Decision: Surface resilience metadata only in debug output

Retry counts, exhaustion reasons, and fallback usage will be available through debug metadata and tests, but not added to the normal `judgeResponses[]` contract consumed by downstream UI.

Rationale:
- It preserves the existing consumer contract.
- It makes resilience behavior observable without turning debug state into product API.
- It aligns with the existing rule against exposing orchestration internals as authoritative data.

Alternatives considered:
- Add retry metadata directly to judge responses.
  - Rejected because it pollutes the product-facing contract with operational detail.

## Risks / Trade-offs

- [Retries increase tail latency] -> Cap attempts, backoff ceilings, and total discussion turns.
- [Fallback drafts may reduce flavor quality] -> Use deterministic, judge-specific fallback text and expose degradation in debug metadata.
- [Concurrency limits may be tuned poorly] -> Make limits configurable and add fixture tests that exercise rate-limit style failures.
- [Provider error classification may miss edge cases] -> Start with a conservative transient-error classifier and expand it as concrete failures appear.

## Migration Plan

1. Add resilience configuration for max attempts, base backoff, jitter, and per-run concurrency.
2. Introduce a shared provider execution helper and route draft/revision calls through it.
3. Add fallback generation and debug metadata for retry exhaustion and degraded completion.
4. Add fixture tests for transient failures, retry exhaustion, and partial panel completion.
5. Keep heuristic provider behavior as the low-risk baseline if the live provider path regresses.

Rollback is straightforward: remove the resilience wrapper and continue using the current provider call path with heuristic fallback.

## Open Questions

- What minimum viable threshold should permit a degraded panel to finalize: all judges required, or a majority?
- Should concurrency limits be global per process later, or is per-run limiting sufficient for now?
- Which provider-specific error shapes should be treated as definitively non-retryable in the first pass?
