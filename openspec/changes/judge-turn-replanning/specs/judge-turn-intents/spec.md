## ADDED Requirements

### Requirement: Per-turn judge intents
The AI service SHALL produce a structured per-turn intent for each eligible judge during an active panel round.

#### Scenario: Judges choose different intents
- **WHEN** the service plans a panel turn after receiving updated round context
- **THEN** different judges may emit different intents such as ask, wait, offer, support a peer, or drop out

### Requirement: Visible judge statuses
The AI service SHALL produce a visible status for each judge that communicates whether the judge is evaluating, waiting, active, offering, supportive, or out.

#### Scenario: UI can show active and inactive judges
- **WHEN** a planning step completes
- **THEN** the output includes judge statuses sufficient for downstream consumers to show which judges are still engaged in the round
