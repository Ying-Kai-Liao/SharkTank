## ADDED Requirements

### Requirement: Post-round debrief data assembly
The system SHALL produce a structured debrief payload for each judge after a round result is finalized, containing deterministic evaluation data (per-dimension scores, judge-weighted score, offer status) and AI-generated narrative data (in-character journey reflection, turning point, coaching tip).

#### Scenario: Debrief assembled with full AI narrative
- **WHEN** the player requests a debrief after `ROUND_RESULT` and the AI service is available
- **THEN** the debrief payload SHALL include for each judge: their final sentiment, a first-person journey narrative, a key turning-point moment, an actionable improvement hint in-character, per-dimension evaluation scores, the judge's weighted score, and whether they made an offer

#### Scenario: Debrief assembled without AI narrative
- **WHEN** the player requests a debrief after `ROUND_RESULT` and the AI narrative generation fails
- **THEN** the debrief payload SHALL include the deterministic layer (evaluation scores, weighted scores, offer status, judge focus text) and substitute a generic tagline derived from the judge's persona focus in place of the narrative fields

### Requirement: In-character narrative generation
The system SHALL generate a first-person, in-character narrative for each judge that reflects their thinking journey through the round, using their accumulated state: sentiment, concerns, rationaleTags, episodic memory, peer consultation opinions, and evaluation dimension changes.

#### Scenario: Narrative reflects judge persona voice
- **WHEN** a debrief narrative is generated for a judge
- **THEN** the narrative SHALL be written in first person matching the judge's established persona (Rhea focuses on numbers/margins, Marco on moat/differentiation, Tori on conviction/execution)

#### Scenario: Narrative references concrete pitch moments
- **WHEN** a debrief narrative is generated and the judge had specific concerns or rationale tags
- **THEN** the narrative SHALL reference at least one specific concern or signal from the pitch rather than providing only generic feedback

#### Scenario: Coaching tip is actionable
- **WHEN** a debrief narrative includes an improvement hint
- **THEN** the hint SHALL describe a specific action the player can take in their next pitch (e.g., "mention unit economics earlier") rather than abstract advice (e.g., "be more clear")

### Requirement: Deterministic debrief data
The system SHALL produce deterministic debrief data from the game engine without requiring AI, including per-dimension evaluation scores, each judge's weighted score via their rubric weights, the top evaluation dimension, offer details per judge, and the round outcome.

#### Scenario: Scorecard matches engine rubric
- **WHEN** deterministic debrief data is assembled
- **THEN** each judge's weighted score SHALL equal the sum of evaluation dimensions multiplied by that judge's weights, consistent with `buildJudgeScorecard`

#### Scenario: Evaluation bars reflect final merged evaluation
- **WHEN** deterministic debrief data is assembled after follow-up answers boosted the evaluation
- **THEN** the per-dimension scores SHALL reflect the final merged evaluation, not the initial pitch-only evaluation

### Requirement: Debrief is optional and non-blocking
The system SHALL allow the player to skip the debrief entirely and proceed to the next round or game end without viewing it.

#### Scenario: Player skips debrief
- **WHEN** the round reaches `ROUND_RESULT` and the player does not request a debrief
- **THEN** the system SHALL allow the player to proceed without entering the `DEBRIEF` state

#### Scenario: Debrief does not alter game state
- **WHEN** the player views the debrief
- **THEN** no scores, offers, or round outcomes SHALL be modified by the debrief content
