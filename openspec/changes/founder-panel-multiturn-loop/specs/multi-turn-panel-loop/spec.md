## ADDED Requirements

### Requirement: Independent per-judge turn intents
After the pitch is finalized, the system SHALL evaluate each judge independently and produce a structured per-turn intent for that judge.

#### Scenario: Judges choose different actions on the same turn
- **WHEN** the panel enters a post-pitch turn
- **THEN** one judge may ask a question, another may wait, and another may signal an offer or exit without forcing the panel into a single shared action

### Requirement: Judges expose visible engagement status
The system SHALL expose a visible per-judge panel status that communicates whether a judge is evaluating, waiting, asking, offering, supporting a peer, or no longer participating.

#### Scenario: UI can show which judges are still in play
- **WHEN** the panel completes a planning step for a turn
- **THEN** the system emits or derives a per-judge status that allows the frontend to show which judges are active, undecided, or out

### Requirement: Bounded panel continuation
The system SHALL allow a variable number of post-pitch panel turns while enforcing deterministic limits on total turns, per-judge follow-ups, and round stop conditions.

#### Scenario: Director ends a long panel exchange
- **WHEN** the panel reaches the configured turn or follow-up budget
- **THEN** the round director closes the panel loop or advances to the next legal phase instead of allowing unlimited discussion

### Requirement: Brokered peer awareness in panel planning
The system SHALL allow a judge to request bounded awareness of peer positions during panel planning without enabling unrestricted recursive peer-to-peer messaging.

#### Scenario: Judge checks peer sentiment before deciding
- **WHEN** a judge requests bounded peer context during a panel turn
- **THEN** the system returns brokered peer summaries within configured limits and continues the panel loop without unbounded agent recursion

### Requirement: Panel output is event-shaped
The system SHALL expose visible panel actions as structured events suitable for UI rendering, replay, and test fixtures.

#### Scenario: Question turn produces visible event entries
- **WHEN** a judge intent is selected for display on a panel turn
- **THEN** the system emits a typed panel event that identifies the acting judge and the visible action such as a question, offer, support signal, or dropout
