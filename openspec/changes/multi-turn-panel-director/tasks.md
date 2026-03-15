## 1. Director Contracts

- [ ] 1.1 Define shared contract types for panel events, continuation budgets, and director decisions
- [ ] 1.2 Extend deterministic round state to represent bounded post-pitch panel turns and closure conditions
- [ ] 1.3 Add validation for legal continuation, exhausted budgets, and visible panel event payloads

## 2. Deterministic Director Logic

- [ ] 2.1 Implement the panel director that decides when another turn is legal and when the round must advance or close
- [ ] 2.2 Track configured limits such as total panel turns and no-progress stop conditions
- [ ] 2.3 Emit typed panel events that the frontend can replay and render

## 3. Demo Integration And Tests

- [ ] 3.1 Replace scripted judge-group progression in the demo with event-driven panel rendering
- [ ] 3.2 Integrate the director with existing scoring and offer-generation boundaries without moving authority into AI code
- [ ] 3.3 Add deterministic tests for legal continuation, exhausted budgets, and event-stream output
