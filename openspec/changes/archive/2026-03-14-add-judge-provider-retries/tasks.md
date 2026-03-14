## 1. Resilience Primitives

- [x] 1.1 Add AI-service configuration for retry attempts, base backoff, jitter, maximum backoff, and per-run provider concurrency
- [x] 1.2 Implement a shared provider execution helper that classifies retryable failures and applies bounded exponential backoff
- [x] 1.3 Implement a small concurrency limiter for judge draft and discussion execution paths

## 2. Orchestration Integration

- [x] 2.1 Route judge draft generation through the retry and concurrency wrapper while preserving parallel orchestration semantics
- [x] 2.2 Route discussion revision calls through the same resilience wrapper and record retry metadata in debug output
- [x] 2.3 Add bounded per-judge fallback generation and minimum viable panel threshold handling for retry exhaustion

## 3. Verification

- [x] 3.1 Add provider stub tests for transient retries, non-retryable failures, and backoff exhaustion behavior
- [x] 3.2 Add orchestration tests for bounded concurrency and degraded-but-valid structured bundle completion
- [x] 3.3 Document the new resilience configuration and live-provider debugging behavior in the AI-service README
