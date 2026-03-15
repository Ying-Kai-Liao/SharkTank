## Why

The AI service already supports bounded judge discussion, but it does not treat multi-round deliberation as a first-class orchestration capability and it does not expose a native, brokered way for one judge agent to query peer judges. Formalizing those behaviors now keeps the architecture aligned with the product direction while preserving the rule that deterministic game truth stays outside the AI layer.

## What Changes

- Introduce a native judge deliberation capability that distinguishes draft generation from internal discussion rounds and caps discussion at three rounds per orchestration run.
- Add a brokered peer-query tool surface that lets a judge request structured input from one or more peer judges without enabling direct recursive agent-to-agent loops.
- Define discussion-budget semantics so tool usage is tracked separately from discussion rounds and does not consume the round cap.
- Preserve the existing structured output bundle while allowing debug metadata to report bounded deliberation activity and peer-query usage.
- Extend provider resilience expectations so bounded retries and concurrency limits apply consistently across draft, peer-query, and discussion-revision execution paths.

## Capabilities

### New Capabilities
- `judge-agent-deliberation`: Native multi-round judge deliberation with explicit round accounting, bounded peer consultation, and non-authoritative internal discussion.

### Modified Capabilities
- `judge-provider-resilience`: Expand resilience requirements to cover peer-consultation calls that occur during bounded deliberation.

## Impact

- Affects `apps/ai-service` graph orchestration, provider execution, tool registration, and debug metadata.
- Affects `packages/contracts` discussion-policy validation and any shared types used to configure deliberation behavior.
- Preserves the product-facing judge bundle contract consumed by the web app and game engine.
- Adds a clearer spec boundary for future implementation and testing of peer-agent query behavior.
