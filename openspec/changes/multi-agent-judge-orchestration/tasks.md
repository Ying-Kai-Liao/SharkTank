## 1. AI Service Scaffold

- [x] 1.1 Create the initial `apps/ai-service` application scaffold for a local callable judge orchestration entrypoint
- [x] 1.2 Add LangGraph and supporting runtime dependencies needed for graph execution and structured output validation
- [x] 1.3 Define configuration, environment handling, and placeholder provider wiring for the orchestration service

## 2. Contracts And Agent Definitions

- [x] 2.1 Define the AI-service input contract that accepts deterministic round context, judge profiles, and transcript data
- [x] 2.2 Define the output contract and validators for `judgeResponses[]` and `leadQuestion` compatibility with the current demo loop
- [x] 2.3 Implement judge persona definitions, judge-scoped tool registries, and memory namespace interfaces

## 3. LangGraph Orchestration

- [x] 3.1 Implement the context builder and per-judge agent nodes that consume shared round context with isolated judge state
- [x] 3.2 Implement the discussion router and bounded inter-judge discussion stage with explicit maximum turn limits
- [x] 3.3 Implement the finalizer that normalizes graph outputs into the structured judge bundle without exposing internal discussion traces
- [x] 3.4 Implement memory handling for round, episodic, and persona layers while preventing memory writes from changing deterministic engine truth

## 4. Integration And Verification

- [x] 4.1 Add an adapter path that allows the web demo to call the AI-service contract without changing game-engine authority
- [x] 4.2 Add fixture-based tests for per-judge output validity, discussion gating behavior, and non-authoritative finalization
- [x] 4.3 Add integration tests that prove the demo loop can consume either the local adapter or orchestration service with the same structured output shape
