## 1. Contracts And Round Model

- [ ] 1.1 Define shared contract types for pitch-capture events, live judge reaction events, judge status cues, panel turn intents, panel event stream entries, and founder negotiation actions
- [ ] 1.2 Extend the deterministic round model with pitch, panel, negotiation, and closure phases plus configurable turn budgets and stop conditions
- [ ] 1.3 Add validation rules for active offers, bargain payloads, decline-question actions, and finalized pitch transcripts

## 2. Timed Pitch Capture

- [ ] 2.1 Implement a pitch-capture flow that starts explicitly, counts down from a configured duration, and finalizes transcript input at pitch close
- [ ] 2.2 Add a provider abstraction that supports both live STT-backed transcript input and local/mock transcript generation through the same contracts
- [ ] 2.3 Add deterministic tests for pitch timer behavior, transcript finalization, and rejected late transcript updates

## 3. Live Judge Reactions

- [ ] 3.1 Add an AI-service or local adapter path that produces non-authoritative live judge reaction cues during the active pitch
- [ ] 3.2 Keep live reaction output isolated from deterministic evaluation and round transitions
- [ ] 3.3 Add fixtures and tests for mocked live reaction generation and provider-backed fallback behavior

## 4. Multi-Turn Panel Orchestration

- [ ] 4.1 Extend the AI service and judge-agent deliberation path to generate independent per-judge turn intents after pitch finalization and after each founder action
- [ ] 4.2 Reuse bounded peer-awareness logic so judges can request limited peer context during panel planning without recursive loops
- [ ] 4.3 Add deterministic round-director logic that selects visible panel events, tracks per-judge follow-up budgets, derives visible judge statuses, and stops the panel loop when configured limits are reached
- [ ] 4.4 Add orchestration tests for mixed judge intents, repeated re-planning after founder actions, bounded continuation, and event-stream output shape

## 5. Founder Negotiation Loop

- [ ] 5.1 Implement founder actions for answer, bargain, accept, refuse, and decline-question within the deterministic round director
- [ ] 5.2 Validate or clamp any AI-proposed offer revision against deterministic negotiation envelopes before it becomes active round state
- [ ] 5.3 Add tests for founder actions informing later panel turns and for deterministic closure when no legal continuation remains

## 6. Web Demo Integration

- [ ] 6.1 Replace the current scripted local page flow with a structured event-driven round session that renders pitch, panel, negotiation, and result phases
- [ ] 6.2 Update stage rendering to consume live reaction cues, judge statuses, and panel events instead of hardcoded dialogue groups and offer scripts
- [ ] 6.3 Add local demo fixtures for timed pitch capture, multi-turn panel progression, bargain/refuse flows, and graceful no-provider fallback behavior
