## MODIFIED Requirements

### Requirement: Local demo round flow
The system SHALL provide a local-first playable demo round that progresses from pitch submission through a bounded multi-turn panel flow to deal selection and debrief, without requiring auth, realtime infrastructure, or a separately deployed AI service. After deals are shown, the player SHALL accept one offer or reject all, which SHALL immediately transition to the debrief state.

#### Scenario: Complete a single multi-turn round locally
- **WHEN** a user starts the demo and completes a pitch round locally
- **THEN** the system progresses through post-pitch panel turns, founder responses, deal selection, and debrief within the local demo flow

#### Scenario: Deal selection transitions to debrief
- **WHEN** the round reaches `DEALS` and the player accepts an offer or rejects all
- **THEN** the system SHALL transition directly to `DEBRIEF` with no intermediate states

### Requirement: Core action validation
The system SHALL support and validate the MVP action set of `submit_pitch`, `advance_panel_turn`, `submit_answer`, `accept_deal`, `reject_deal`, and progression to the next state when the current state is complete. The system SHALL NOT support `submit_bargain` as a valid action.

#### Scenario: Pitch submission starts the round
- **WHEN** the user submits a pitch from the initial demo state
- **THEN** the system records the pitch and advances into a director-led panel stage

#### Scenario: Deal actions require available deals
- **WHEN** the user attempts to accept or reject a deal before deals have been generated
- **THEN** the engine blocks the action as invalid

#### Scenario: Bargain action is rejected
- **WHEN** the user attempts to submit a bargain action
- **THEN** the engine rejects the action as invalid

## REMOVED Requirements

### Requirement: Player requests debrief after round result
**Reason**: `ROUND_RESULT` state is removed. Debrief is now triggered automatically after deal selection — no separate `REQUEST_DEBRIEF` action needed.
**Migration**: Deal acceptance/rejection in `DEALS` state now transitions directly to `DEBRIEF`.

### Requirement: Player skips debrief after round result
**Reason**: `ROUND_RESULT` state is removed. Debrief always shows after deal selection as the natural end of the round.
**Migration**: The debrief is no longer optional — it is the round-ending screen.
