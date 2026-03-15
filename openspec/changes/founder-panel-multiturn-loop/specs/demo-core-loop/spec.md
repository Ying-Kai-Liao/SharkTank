## MODIFIED Requirements

### Requirement: Local demo round flow
The system SHALL provide a local-first playable demo round that progresses through timed pitch capture, live judge reactions, bounded post-pitch panel turns, founder negotiation choices, and round result without requiring auth, realtime infrastructure, or a separately deployed AI service.

#### Scenario: Complete a single multi-turn round locally
- **WHEN** a user starts the demo and completes a pitch round locally
- **THEN** the system progresses through pitch timing, pitch transcript finalization, judge reactions, one or more bounded panel turns, founder actions, and round result within the local demo flow

### Requirement: Deterministic state authority
The system SHALL treat the game engine or an equivalent deterministic round director as the authority for round states, legal transitions, timers, turn budgets, scores, and deal outcomes.

#### Scenario: Director applies legal multi-turn transition
- **WHEN** the user submits a valid action for the current round phase
- **THEN** the deterministic authority advances the round according to the defined round model and budgets

#### Scenario: Director rejects invalid transition
- **WHEN** the user submits an action that is not legal for the current round phase or exceeds deterministic turn budgets
- **THEN** the system rejects the action and the round state remains unchanged

### Requirement: Core action validation
The system SHALL support and validate the MVP multi-turn action set of `start_pitch`, `submit_pitch_transcript`, `close_pitch`, `advance_panel_turn`, `submit_founder_answer`, `submit_bargain`, `accept_deal`, `reject_deal`, `decline_question`, and progression to the next state when the current phase is complete.

#### Scenario: Pitch submission begins the round
- **WHEN** the user starts a round from the initial demo state
- **THEN** the system enters the pitch phase and accepts pitch transcript updates until the pitch is closed

#### Scenario: Deal actions require an active offer
- **WHEN** the user attempts to accept, reject, or bargain before an active offer exists
- **THEN** the deterministic authority blocks the action as invalid

### Requirement: Structured AI boundary
The system SHALL consume judge dialogue, live reaction cues, panel intents, and negotiation-facing content through structured contracts rather than allowing freeform AI output to determine game truth.

#### Scenario: Judge and reaction content are structured
- **WHEN** the demo requests live reactions or panel output
- **THEN** the returned data includes structured fields sufficient to render stage reactions, panel events, and negotiation states without directly changing deterministic truth

#### Scenario: AI cannot decide outcome
- **WHEN** judges generate dialogue, reactions, or negotiation language
- **THEN** the final score, legal next state, offer validity, and round outcome remain derived from deterministic rules instead of AI output
