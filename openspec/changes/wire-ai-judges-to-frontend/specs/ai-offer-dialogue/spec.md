## ADDED Requirements

### Requirement: AI-generated offer dialogue
The system SHALL generate in-character dialogue for each judge explaining their offer decision, replacing the hardcoded mock offer conversation.

#### Scenario: Judge with an offer explains their reasoning
- **WHEN** the panel closes and offers are generated
- **THEN** each judge who made an offer SHALL have an AI-generated dialogue line explaining why they are investing and referencing specific aspects of the pitch

#### Scenario: Judge who passed explains why
- **WHEN** the panel closes and a judge did not make an offer
- **THEN** that judge SHALL have an AI-generated dialogue line explaining why they are passing, in character

#### Scenario: Offer dialogue references actual terms
- **WHEN** offer dialogue is generated for a judge who made an offer
- **THEN** the dialogue SHALL reference the correct offer amount and equity percentage from the deterministic game engine

### Requirement: Offer dialogue endpoint
The system SHALL expose a `/api/judge-offer-dialogue` POST route that accepts evaluation, offers, judge responses, and transcript, and returns one dialogue line per judge.

#### Scenario: Successful offer dialogue generation
- **WHEN** the frontend calls `/api/judge-offer-dialogue` with round data
- **THEN** the endpoint SHALL return an array of dialogue entries, each with `judgeId`, `stageId`, and `text`

#### Scenario: Offer dialogue fallback on failure
- **WHEN** the AI service fails to generate offer dialogue
- **THEN** the endpoint SHALL return a fallback response with generic dialogue, and the frontend SHALL skip to offer-select without blocking the game
