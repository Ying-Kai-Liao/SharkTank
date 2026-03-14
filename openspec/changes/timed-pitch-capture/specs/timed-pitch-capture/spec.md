## ADDED Requirements

### Requirement: Timed pitch window
The system SHALL provide a bounded pitch-capture window that starts explicitly, counts down against a configured duration, and closes authoritatively when the timer expires or the round logic ends the pitch early.

#### Scenario: Pitch timer expires
- **WHEN** a founder starts a pitch round with a configured pitch duration
- **THEN** the system starts the pitch timer, accepts pitch transcript input only during that window, and closes pitch capture when the timer reaches zero

### Requirement: Pitch transcript collection
The system SHALL collect transcript updates during the pitch window and maintain a finalized pitch transcript artifact for downstream evaluation and orchestration.

#### Scenario: Transcript is finalized at pitch close
- **WHEN** the pitch window closes after one or more transcript updates
- **THEN** the system emits a finalized pitch transcript for the round and stops treating later speech updates as part of that pitch

### Requirement: Source-agnostic pitch input
The system SHALL support pitch transcript capture through either live STT integration or a local/mock transcript source without changing downstream round contracts.

#### Scenario: Mock transcript source uses the same contract
- **WHEN** the local demo runs without a live STT provider
- **THEN** the system still produces transcript updates and a finalized pitch transcript through the same pitch-capture contract used by live providers
