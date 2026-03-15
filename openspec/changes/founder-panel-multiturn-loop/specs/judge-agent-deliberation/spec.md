## MODIFIED Requirements

### Requirement: Native deliberation rounds
The AI service SHALL model internal deliberation as a first-class phase distinct from draft generation and SHALL support zero to three discussion rounds per orchestration run or per eligible panel re-planning turn.

#### Scenario: Deliberation is skipped when not needed
- **WHEN** the orchestration policy determines that initial judge drafts or turn intents are already sufficient
- **THEN** the system finalizes the structured panel output for that step without entering any deliberation round

#### Scenario: Deliberation stops at the configured maximum
- **WHEN** a run or re-planning turn enables internal deliberation with a maximum round limit
- **THEN** the system executes no more than the configured number of deliberation rounds and never exceeds three rounds total for that deliberation step

### Requirement: Deliberation can re-run after founder actions
The AI service SHALL support repeated judge re-planning after founder actions by accepting updated round context and producing new judge turn intents or visible panel-facing outputs.

#### Scenario: Founder action triggers a new planning step
- **WHEN** the founder answers, bargains, refuses, or declines during an active round
- **THEN** the AI service can run a new planning step for eligible judges using the updated round context

### Requirement: Deliberation remains non-authoritative
The AI service SHALL keep internal deliberation and peer-agent queries non-authoritative with respect to deterministic game truth and SHALL finalize only structured consumer outputs required by downstream systems.

#### Scenario: Internal deliberation cannot set game truth
- **WHEN** deliberation produces revised judge output after one or more peer-agent queries
- **THEN** the resulting content does not directly set scores, legal transitions, deal outcomes, or other deterministic engine state

#### Scenario: Product-facing output omits internal traces
- **WHEN** downstream consumers receive normal panel-facing output
- **THEN** they can render the round without depending on internal deliberation transcripts, peer-query payloads, or reasoning traces
