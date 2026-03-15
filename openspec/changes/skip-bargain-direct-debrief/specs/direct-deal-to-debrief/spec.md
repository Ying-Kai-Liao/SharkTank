## ADDED Requirements

### Requirement: Deal selection triggers debrief
The system SHALL transition directly from the `DEALS` state to the `DEBRIEF` state when the player accepts a deal or rejects all offers, with no intermediate states.

#### Scenario: Player accepts a deal
- **WHEN** the player accepts a judge's offer during the `DEALS` state
- **THEN** the system SHALL record the accepted deal, transition to `DEBRIEF`, and display the debrief report

#### Scenario: Player rejects all offers
- **WHEN** the player rejects all offers during the `DEALS` state
- **THEN** the system SHALL record that no deal was accepted, transition to `DEBRIEF`, and display the debrief report

### Requirement: No bargain mechanic
The system SHALL NOT support counter-offers, revised terms, or any negotiation actions during the deal selection phase. The player's only options SHALL be to accept one offer or reject all.

#### Scenario: No bargain actions available
- **WHEN** the player is in the `DEALS` state viewing offers
- **THEN** the system SHALL only present Accept and Reject All as available actions — no bargain or counter-offer controls SHALL be rendered

### Requirement: Debrief includes deal outcome
The debrief report SHALL reflect the player's deal decision — showing which deal was accepted (if any) or that no deal was made.

#### Scenario: Debrief after accepted deal
- **WHEN** the debrief displays after the player accepted a deal
- **THEN** the report SHALL include the accepted judge's offer summary alongside all judge feedback

#### Scenario: Debrief after rejection
- **WHEN** the debrief displays after the player rejected all offers
- **THEN** the report SHALL show all judge feedback with no accepted deal indicated
