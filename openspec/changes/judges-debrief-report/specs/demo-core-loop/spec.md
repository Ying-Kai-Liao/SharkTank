## MODIFIED Requirements

### Requirement: Local demo round flow
The system SHALL provide a local-first playable demo round that progresses from pitch submission to round result through a bounded multi-turn panel flow without requiring auth, realtime infrastructure, or a separately deployed AI service. After round result, the system SHALL support an optional transition to a debrief state via a player action.

#### Scenario: Complete a single multi-turn round locally
- **WHEN** a user starts the demo and completes a pitch round locally
- **THEN** the system progresses through post-pitch panel turns, founder responses, and round result within the local demo flow

#### Scenario: Player requests debrief after round result
- **WHEN** the round reaches `ROUND_RESULT` and the player dispatches a `REQUEST_DEBRIEF` action with a debrief payload
- **THEN** the system SHALL transition to a `DEBRIEF` state containing the debrief data

#### Scenario: Player skips debrief after round result
- **WHEN** the round reaches `ROUND_RESULT` and the player does not request a debrief
- **THEN** the system SHALL allow proceeding to the next round or game end without entering the `DEBRIEF` state
