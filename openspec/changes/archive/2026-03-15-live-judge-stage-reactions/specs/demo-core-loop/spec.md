## MODIFIED Requirements

### Requirement: Local demo round flow
The system SHALL provide a local-first playable demo round that progresses from pitch submission to round result without requiring auth, realtime infrastructure, or a separately deployed AI service, and SHALL allow judges to show live reactions during the pitch.

#### Scenario: Complete a single round locally
- **WHEN** a user starts the demo and submits a pitch
- **THEN** the system progresses through live judge reactions during the pitch, post-pitch judge interaction, deal generation, player decision, and round result within the local demo flow

### Requirement: Structured AI boundary
The system SHALL consume judge dialogue and live reaction content through structured contracts rather than allowing freeform AI output to determine game truth.

#### Scenario: Judge content is structured
- **WHEN** the demo requests judge output
- **THEN** the returned data includes structured fields sufficient to render a reaction and follow-up interaction without directly changing score or state

#### Scenario: AI cannot decide outcome
- **WHEN** judge dialogue or live reactions are generated
- **THEN** the final score, legal next state, and deal outcome remain derived from engine rules instead of AI output
