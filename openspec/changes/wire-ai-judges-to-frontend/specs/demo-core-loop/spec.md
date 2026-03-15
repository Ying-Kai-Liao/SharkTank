## MODIFIED Requirements

### Requirement: Local demo round flow
The system SHALL provide a local-first playable demo round that progresses from pitch submission through AI-generated judge deliberation, a bounded multi-turn panel flow with AI-generated questions, AI-generated offer dialogue, deal selection, and debrief. The system SHALL fall back to heuristic judge bundles and skip offer dialogue if the AI service is unavailable, so the game remains playable without an API key.

#### Scenario: Complete a single round with AI judges
- **WHEN** a user starts the demo and completes a pitch round
- **THEN** the system calls the AI service for judge reactions, panel questions, and offer dialogue
- **AND** the player sees AI-generated judge dialogue throughout the round

#### Scenario: Complete a single round without AI
- **WHEN** a user starts the demo without an AI API key configured
- **THEN** the system falls back to heuristic judge bundles and default panel questions
- **AND** the round remains fully playable with deterministic fallback dialogue

### Requirement: Structured AI boundary
The system SHALL consume judge dialogue and live reaction content through structured contracts rather than allowing freeform AI output to determine game truth. AI-generated dialogue SHALL be displayed to the player but SHALL NOT influence scores, state transitions, or deal terms.

#### Scenario: Judge content is structured
- **WHEN** the demo requests judge output from the AI service
- **THEN** the returned data includes structured fields sufficient to render a reaction and follow-up interaction without directly changing score or state

#### Scenario: AI cannot decide outcome
- **WHEN** judge dialogue or live reactions are generated
- **THEN** the final score, legal next state, and deal outcome remain derived from engine rules instead of AI output
