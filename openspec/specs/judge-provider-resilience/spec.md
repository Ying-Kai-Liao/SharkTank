# judge-provider-resilience Specification

## Purpose
TBD - created by archiving change add-judge-provider-retries. Update Purpose after archive.
## Requirements
### Requirement: Retry transient judge provider failures
The AI service SHALL retry transient provider failures during judge draft generation, peer consultation, and discussion revision using a bounded retry policy with backoff.

#### Scenario: Draft generation retries transient failure
- **WHEN** a judge draft provider call fails with a retryable transient error
- **THEN** the AI service retries that judge call according to the configured retry policy before treating it as exhausted

#### Scenario: Peer consultation retries transient failure
- **WHEN** a peer-consultation provider call fails with a retryable transient error during deliberation
- **THEN** the AI service retries that peer-consultation call according to the configured retry policy before degrading that consultation path

#### Scenario: Discussion revision retries transient failure
- **WHEN** a judge discussion revision call fails with a retryable transient error
- **THEN** the AI service retries that judge revision according to the configured retry policy before degrading that judge response

### Requirement: Bound parallel provider concurrency
The AI service SHALL support bounded parallelism for judge provider execution so that per-run concurrency remains configurable while preserving parallel judge orchestration across draft, peer-consultation, and discussion-revision stages.

#### Scenario: Draft stage respects configured concurrency
- **WHEN** the orchestration run fans out judge draft generation
- **THEN** the number of in-flight provider calls does not exceed the configured concurrency limit

#### Scenario: Peer-consultation stage respects configured concurrency
- **WHEN** the orchestration run fans out peer-consultation execution during deliberation
- **THEN** the number of in-flight provider calls does not exceed the configured concurrency limit

#### Scenario: Discussion stage respects configured concurrency
- **WHEN** the orchestration run fans out judge discussion revisions
- **THEN** the number of in-flight provider calls does not exceed the configured concurrency limit

### Requirement: Preserve structured output under partial provider failure
The AI service SHALL preserve a valid structured judge bundle under bounded partial provider failure unless the run falls below the minimum completion threshold.

#### Scenario: Single judge falls back after retry exhaustion
- **WHEN** one judge provider call exhausts retries and the remaining judges still complete
- **THEN** the AI service finalizes a valid structured bundle with a bounded fallback response for the failed judge

#### Scenario: Peer consultation degrades without breaking the bundle
- **WHEN** a peer-consultation path exhausts retries while the run still meets the minimum completion threshold
- **THEN** the AI service degrades that consultation path and still finalizes a valid structured bundle

#### Scenario: Excessive provider failures abort finalization
- **WHEN** provider failures exceed the configured minimum completion threshold for a usable panel
- **THEN** the AI service fails the orchestration run instead of returning an incomplete or invalid structured bundle

### Requirement: Expose resilience diagnostics through debug metadata
The AI service SHALL expose retry, backoff, exhaustion, and fallback usage details through debug metadata without changing the normal consumer contract.

#### Scenario: Debug output includes retry diagnostics
- **WHEN** an orchestration run is requested with debug metadata enabled
- **THEN** the returned debug payload includes retry attempts, exhausted calls, and fallback usage for draft, peer-consultation, and discussion-revision execution

#### Scenario: Normal bundle omits resilience internals
- **WHEN** the normal judge bundle is returned to a downstream consumer
- **THEN** the product-facing response omits retry counters, backoff details, and provider failure diagnostics

