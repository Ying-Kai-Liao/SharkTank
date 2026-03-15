## 1. Negotiation Contracts

- [ ] 1.1 Define shared contract types for founder answer, bargain, accept, refuse, and decline-to-answer actions
- [ ] 1.2 Add validation rules for active offers, allowed bargain payloads, and decline-question legality

## 2. Deterministic Negotiation Logic

- [ ] 2.1 Extend deterministic round logic to accept founder negotiation actions only when they are legal
- [ ] 2.2 Validate or clamp any proposed offer revision before it becomes active round state
- [ ] 2.3 Append founder actions to round context so later judge planning can react to them

## 3. Demo Integration And Tests

- [ ] 3.1 Update the demo UI to expose only legal negotiation choices at each point in the round
- [ ] 3.2 Add deterministic tests for bargain, refusal, decline-to-answer, and round closure without a founder answer
- [ ] 3.3 Add fixtures covering one-offer, multi-offer, and no-continuation negotiation paths
