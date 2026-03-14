## Why

Parallel judge orchestration improves latency, but it also concentrates provider risk: a single burst of real model calls can hit rate limits, transient network faults, or partial failures. The AI-service needs an explicit resilience layer so live provider use remains usable without weakening the structured contract or deterministic engine authority.

## What Changes

- Add retry and exponential backoff behavior around judge draft and discussion revision provider calls.
- Define per-judge failure handling so one provider error does not automatically corrupt the entire panel response.
- Add bounded concurrency and jitter guidance for parallel judge execution against real model providers.
- Add observability fields for retry attempts, rate-limit handling, and degraded-but-valid completion paths.

## Capabilities

### New Capabilities
- `judge-provider-resilience`: Resilient provider execution for parallel judge orchestration, including retries, backoff, concurrency controls, and partial failure handling.

### Modified Capabilities

## Impact

- Affects `apps/ai-service` provider execution, graph orchestration, and debug metadata.
- May introduce small utility dependencies or shared retry helpers for provider calls.
- Adds test coverage for retry behavior, bounded concurrency, and degraded completion paths under transient provider errors.
