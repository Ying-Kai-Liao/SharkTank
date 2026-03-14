## MODIFIED Requirements

### Requirement: Structured AI boundary
The system SHALL consume judge dialogue and follow-up content through a structured contract rather than allowing freeform AI output to determine game truth. Structured judge content MAY be produced by a local adapter or a dedicated orchestration service, but the final score, legal next state, and deal outcome MUST remain derived from engine rules instead of AI output, agent memory, or judge-to-judge discussion.

#### Scenario: Judge content is structured
- **WHEN** the demo requests judge output
- **THEN** the returned data includes structured fields sufficient to render a reaction and follow-up question without directly changing score or state

#### Scenario: AI cannot decide outcome
- **WHEN** judge dialogue is generated
- **THEN** the final score, legal next state, and deal outcome remain derived from engine rules instead of AI output

#### Scenario: Orchestration service remains non-authoritative
- **WHEN** the demo uses a dedicated judge orchestration service instead of the local adapter
- **THEN** the service returns only structured dialogue content and does not directly set deterministic engine state or deal results
