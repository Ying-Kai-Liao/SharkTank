# judge-agent-deliberation Specification

## Purpose
TBD - created by archiving change add-native-agent-deliberation. Update Purpose after archive.
## Requirements
### Requirement: Native deliberation rounds
The AI service SHALL model internal deliberation as a first-class phase distinct from draft generation and SHALL support zero to three discussion rounds per orchestration run.

#### Scenario: Deliberation is skipped when not needed
- **WHEN** the orchestration policy determines that initial judge drafts are already sufficient
- **THEN** the system finalizes the structured judge bundle without entering any deliberation round

#### Scenario: Deliberation stops at the configured maximum
- **WHEN** a run enables internal deliberation with a maximum round limit
- **THEN** the system executes no more than the configured number of deliberation rounds and never exceeds three rounds total

### Requirement: Brokered peer-agent queries
The AI service SHALL provide a brokered `ask_peer_agents` capability that allows a judge agent to request bounded structured input from selected peer judges during deliberation without enabling direct recursive messaging between agents.

#### Scenario: Judge requests bounded peer input
- **WHEN** a judge agent issues a peer query during deliberation
- **THEN** the service returns only the requested bounded peer summaries for the selected eligible peer judges

#### Scenario: Recursive peer loops are blocked
- **WHEN** a peer-agent query would trigger direct peer-to-peer recursion or unbounded cascading requests
- **THEN** the service denies or truncates the request according to orchestration policy while continuing the run within bounded limits

### Requirement: Discussion rounds are counted separately from tool usage
The AI service SHALL track internal deliberation rounds separately from tool invocations so that tool usage does not consume the discussion-round budget.

#### Scenario: Tool usage does not advance the discussion counter
- **WHEN** a judge agent invokes a tool during a deliberation round
- **THEN** the service preserves the current discussion-round count unless a new deliberation round is explicitly entered

### Requirement: Deliberation remains non-authoritative
The AI service SHALL keep internal deliberation and peer-agent queries non-authoritative with respect to deterministic game truth and SHALL finalize only the structured consumer bundle required by downstream systems.

#### Scenario: Internal deliberation cannot set game truth
- **WHEN** deliberation produces revised judge output after one or more peer-agent queries
- **THEN** the resulting content does not directly set scores, legal transitions, deal outcomes, or other deterministic engine state

#### Scenario: Product-facing output omits internal traces
- **WHEN** downstream consumers receive the normal judge bundle
- **THEN** they can render the round without depending on internal deliberation transcripts, peer-query payloads, or reasoning traces

