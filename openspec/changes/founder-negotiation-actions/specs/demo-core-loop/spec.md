## MODIFIED Requirements

### Requirement: Local demo round flow
The system SHALL provide a local-first playable demo round that progresses from pitch submission to round result and SHALL support founder negotiation-capable choices during the active round without requiring auth, realtime infrastructure, or a separately deployed AI service.

#### Scenario: Complete a single negotiation-aware round locally
- **WHEN** a user starts the demo and reaches an active offer or follow-up phase locally
- **THEN** the system allows founder negotiation choices before closing the round and showing the round result

### Requirement: Core action validation
The system SHALL support and validate the MVP action set of `submit_pitch`, `submit_answer`, `submit_bargain`, `accept_deal`, `reject_deal`, `decline_question`, and progression to the next state when the current state is complete.

#### Scenario: Deal actions require available deals
- **WHEN** the user attempts to accept, reject, or bargain before an active deal exists
- **THEN** the engine blocks the action as invalid

#### Scenario: Decline action is allowed only in a follow-up context
- **WHEN** the user attempts to decline a question outside a follow-up-capable state
- **THEN** the engine rejects the action as invalid

### Requirement: Structured AI boundary
The system SHALL consume judge dialogue and follow-up content through a structured contract rather than allowing freeform AI output to determine game truth.

#### Scenario: Judge content is structured
- **WHEN** the demo requests judge output
- **THEN** the returned data includes structured fields sufficient to render a reaction, follow-up question, or negotiation-facing content without directly changing score or state

#### Scenario: AI cannot decide outcome
- **WHEN** judge dialogue or negotiation language is generated
- **THEN** the final score, legal next state, and deal outcome remain derived from engine rules instead of AI output
