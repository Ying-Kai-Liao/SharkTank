## MODIFIED Requirements

### Requirement: Local demo round flow
The system SHALL provide a local-first playable demo round that progresses from timed pitch capture to round result without requiring auth, realtime infrastructure, or a separately deployed AI service.

#### Scenario: Complete a single round locally
- **WHEN** a user starts the demo and completes a pitch round locally
- **THEN** the system progresses through an explicit pitch timer, finalized pitch transcript handling, judge interaction, and round result within the local demo flow

### Requirement: Deterministic state authority
The system SHALL treat the game engine or equivalent deterministic round logic as the authority for round states, legal transitions, pitch timing, scores, and deal outcomes.

#### Scenario: Engine applies legal transition
- **WHEN** the user submits a valid action for the current round state
- **THEN** the system advances the round according to the defined timed pitch and post-pitch flow

#### Scenario: Engine rejects invalid transition
- **WHEN** the user submits an action that is not legal for the current round state
- **THEN** the engine rejects the action and the round state remains unchanged

### Requirement: Core action validation
The system SHALL support and validate the MVP action set of `start_pitch`, `submit_pitch_transcript`, `close_pitch`, `submit_answer`, `accept_deal`, `reject_deal`, and progression to the next state when the current state is complete.

#### Scenario: Pitch start begins the round
- **WHEN** the user starts a round from the initial demo state
- **THEN** the system enters the pitch phase and accepts pitch transcript updates until the pitch is closed

#### Scenario: Deal actions require available deals
- **WHEN** the user attempts to accept or reject a deal before deals have been generated
- **THEN** the engine blocks the action as invalid
