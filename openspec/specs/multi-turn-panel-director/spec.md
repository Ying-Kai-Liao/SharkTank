# multi-turn-panel-director Specification

## Purpose
Coordinates bounded post-pitch panel turns, event emission, legal continuation, and round closure through a deterministic director layer.

## Requirements
### Requirement: Deterministic panel continuation
The system SHALL coordinate post-pitch panel continuation through deterministic round logic that decides whether another panel turn is legal, required, or disallowed.

#### Scenario: Director allows another turn
- **WHEN** the round remains within configured continuation budgets and at least one judge is still eligible to act
- **THEN** the director permits another panel turn instead of forcing immediate round closure

### Requirement: Bounded panel budgets
The system SHALL enforce configured limits on total panel turns, per-judge follow-ups, and other continuation conditions.

#### Scenario: Director closes the loop at the configured limit
- **WHEN** the panel reaches a configured continuation budget
- **THEN** the system advances toward the next legal phase instead of allowing unlimited discussion

### Requirement: Panel actions are emitted as typed events
The system SHALL expose visible panel activity through typed event entries suitable for UI rendering, replay, and test fixtures.

#### Scenario: Judge question becomes a panel event
- **WHEN** a visible judge action is selected for a panel turn
- **THEN** the system emits a typed panel event identifying the judge and the visible action
