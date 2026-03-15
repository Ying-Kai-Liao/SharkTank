# demo-core-loop Specification

## Purpose
TBD - created by archiving change scaffold-demo-core-loop. Update Purpose after archive.
## Requirements
### Requirement: Local demo round flow
The system SHALL provide a local-first playable demo round that progresses from pitch submission to round result through a bounded multi-turn panel flow without requiring auth, realtime infrastructure, or a separately deployed AI service.

#### Scenario: Complete a single multi-turn round locally
- **WHEN** a user starts the demo and completes a pitch round locally
- **THEN** the system progresses through post-pitch panel turns, founder responses, and round result within the local demo flow

### Requirement: Deterministic state authority
The system SHALL treat the game engine or an equivalent deterministic round director as the authority for round states, legal transitions, scores, and deal outcomes.

#### Scenario: Director applies legal transition
- **WHEN** the user submits a valid action for the current round state
- **THEN** the deterministic authority advances the round according to the defined multi-turn flow

#### Scenario: Director rejects invalid transition
- **WHEN** the user submits an action that is not legal for the current round state
- **THEN** the system rejects the action and the round state remains unchanged

### Requirement: Core action validation
The system SHALL support and validate the MVP action set of `submit_pitch`, `advance_panel_turn`, `submit_answer`, `accept_deal`, `reject_deal`, and progression to the next state when the current state is complete.

#### Scenario: Pitch submission starts the round
- **WHEN** the user submits a pitch from the initial demo state
- **THEN** the system records the pitch and advances into a director-led panel stage

#### Scenario: Deal actions require available deals
- **WHEN** the user attempts to accept or reject a deal before deals have been generated
- **THEN** the engine blocks the action as invalid

### Requirement: Structured AI boundary
The system SHALL consume judge dialogue and live reaction content through structured contracts rather than allowing freeform AI output to determine game truth.

#### Scenario: Judge content is structured
- **WHEN** the demo requests judge output
- **THEN** the returned data includes structured fields sufficient to render a reaction and follow-up interaction without directly changing score or state

#### Scenario: AI cannot decide outcome
- **WHEN** judge dialogue or live reactions are generated
- **THEN** the final score, legal next state, and deal outcome remain derived from engine rules instead of AI output

### Requirement: Explainable round result
The system SHALL produce a round result that can be traced back to deterministic evaluation dimensions and judge weighting rules.

#### Scenario: Result follows rubric
- **WHEN** a round ends
- **THEN** the outcome reflects the engine rubric and judge weighting inputs used during the round

