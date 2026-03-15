## ADDED Requirements

### Requirement: Founder can take multiple negotiation actions
During the negotiation-capable phase of a round, the system SHALL support founder actions including answering a judge question, bargaining on an active offer, accepting an offer, refusing an offer, and declining to answer.

#### Scenario: Founder chooses to bargain instead of accepting
- **WHEN** at least one active offer exists and the round is still open
- **THEN** the founder may submit a bargain action rather than immediately accepting or refusing

### Requirement: Founder actions are broadcast back to the panel
The system SHALL append founder negotiation actions to round context and make those actions available to active judges on subsequent turns.

#### Scenario: Refusal informs later judge behavior
- **WHEN** the founder refuses or bargains on an offer
- **THEN** later panel planning receives that action as part of the round context for all eligible judges

### Requirement: Negotiation outcomes remain engine-validated
Any authoritative offer or offer revision presented to the founder SHALL be validated against deterministic negotiation rules before it becomes active round state.

#### Scenario: Out-of-bounds revision is rejected or clamped
- **WHEN** a negotiation response proposes terms outside the allowed deterministic envelope
- **THEN** the system rejects or normalizes that proposal before exposing it as an active offer

### Requirement: Negotiation can end without a founder answer
The system SHALL support deterministic round closure when the founder declines to answer or when no active judge remains willing to continue the negotiation loop.

#### Scenario: Founder declines to answer and the panel closes
- **WHEN** the founder declines to answer a follow-up and deterministic round logic determines no further legal continuation exists
- **THEN** the system closes negotiation and advances the round toward its final result
