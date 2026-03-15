## MODIFIED Requirements

### Requirement: Native deliberation rounds
The AI service SHALL model internal deliberation as a first-class phase distinct from draft generation and SHALL support zero to three discussion rounds per orchestration run or per eligible turn-planning step.

#### Scenario: Deliberation is skipped when not needed
- **WHEN** the orchestration policy determines that initial judge drafts or turn intents are already sufficient
- **THEN** the system finalizes the structured output for that planning step without entering any deliberation round

#### Scenario: Deliberation stops at the configured maximum
- **WHEN** a planning step enables internal deliberation with a maximum round limit
- **THEN** the system executes no more than the configured number of deliberation rounds and never exceeds three rounds total for that step

### Requirement: Brokered peer-agent queries
The AI service SHALL provide a brokered `ask_peer_agents` capability that allows a judge agent to request bounded structured input from selected peer judges during deliberation without enabling direct recursive messaging between agents.

#### Scenario: Judge requests bounded peer input
- **WHEN** a judge agent issues a peer query during a planning step
- **THEN** the service returns only the requested bounded peer summaries for the selected eligible peer judges

#### Scenario: Recursive peer loops are blocked
- **WHEN** a peer-agent query would trigger direct peer-to-peer recursion or unbounded cascading requests
- **THEN** the service denies or truncates the request according to orchestration policy while continuing the planning step within bounded limits

### Requirement: Deliberation remains non-authoritative
The AI service SHALL keep internal deliberation and peer-agent queries non-authoritative with respect to deterministic game truth and SHALL finalize only the structured consumer outputs required by downstream systems.

#### Scenario: Internal deliberation cannot set game truth
- **WHEN** deliberation produces revised judge output after one or more peer-agent queries
- **THEN** the resulting content does not directly set scores, legal transitions, deal outcomes, or other deterministic engine state

#### Scenario: Product-facing output omits internal traces
- **WHEN** downstream consumers receive normal panel-facing output
- **THEN** they can render the round without depending on internal deliberation transcripts, peer-query payloads, or reasoning traces
