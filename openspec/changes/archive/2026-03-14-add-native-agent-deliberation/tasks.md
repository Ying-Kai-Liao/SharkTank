## 1. Contracts And Policy

- [x] 1.1 Extend the shared AI-service input contract to express native deliberation settings with a hard maximum of three rounds
- [x] 1.2 Update AI-service configuration loading so environment defaults and validation align with the new deliberation policy semantics
- [x] 1.3 Add unit coverage for deliberation-policy normalization, clamping, and validation behavior

## 2. Orchestration And Tooling

- [x] 2.1 Refactor the judge orchestration graph to distinguish draft generation, deliberation rounds, peer consultation, and finalization
- [x] 2.2 Add a brokered `ask_peer_agents` tool surface that returns bounded structured peer summaries without allowing recursive peer loops
- [x] 2.3 Update heuristic and OpenAI provider paths to support brokered peer consultation during deliberation while preserving the existing final bundle contract

## 3. Resilience, Diagnostics, And Tests

- [x] 3.1 Extend retry, backoff, concurrency, and degradation handling to cover peer-consultation execution paths
- [x] 3.2 Expand debug metadata to report deliberation rounds, peer-query activity, and per-stage resilience diagnostics without exposing product-facing reasoning traces
- [x] 3.3 Add orchestration and resilience tests covering skipped deliberation, bounded three-round discussion, peer-query usage, degraded peer consultation, and unchanged consumer bundle output
