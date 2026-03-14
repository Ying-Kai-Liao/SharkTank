# AI Service

This workspace now contains a local callable judge orchestration service that mirrors the contract a future hosted service will expose.

## Current Scope

- accepts deterministic round context, judge profiles, and transcript history
- runs a LangGraph-based orchestration flow with isolated per-judge draft state
- gates bounded panel discussion behind explicit heuristics
- finalizes only the structured `judgeResponses[]` and `leadQuestion` bundle consumed by the demo loop

The implementation is intentionally non-authoritative: it can shape dialogue, but it cannot change scores, legal state transitions, deal outcomes, or any other deterministic engine truth.

## Environment

Use the heuristic provider by default, or enable live OpenAI calls with:

```text
JUDGE_ORCHESTRATION_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
JUDGE_PROVIDER_RETRY_ATTEMPTS=3
JUDGE_PROVIDER_RETRY_BASE_BACKOFF_MS=40
JUDGE_PROVIDER_RETRY_JITTER_MS=20
JUDGE_PROVIDER_RETRY_MAX_BACKOFF_MS=200
JUDGE_PROVIDER_MAX_CONCURRENCY=2
JUDGE_PROVIDER_MINIMUM_SUCCESS_RATIO=0.5
```

The graph still fans out judge draft generation and discussion revisions in parallel, but live provider calls now pass through a per-run concurrency limiter plus bounded retry/backoff handling. The default minimum success ratio of `0.5` means a three-judge panel can tolerate one exhausted live call and still finalize with a deterministic fallback draft.

When `includeDebug` is enabled on `service.run(...)`, the debug payload now includes a `resilience` section with:

- aggregate retry and fallback counts
- minimum successful-judge threshold details
- per-call diagnostics for draft and discussion provider executions
- exhausted-call records that show retry attempts, backoff history, and whether fallback generation was used
