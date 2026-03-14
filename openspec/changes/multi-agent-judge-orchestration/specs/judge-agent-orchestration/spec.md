## ADDED Requirements

### Requirement: Independent judge agents
The AI service SHALL model each judge as an independent orchestration node with judge-specific persona instructions, tool access, and memory isolation.

#### Scenario: Judge agents receive shared context with isolated persona state
- **WHEN** the orchestration layer generates a judge bundle for a round
- **THEN** each judge agent receives the same round context and its own judge-specific persona configuration without sharing mutable working state with other judges

#### Scenario: Judge tools remain judge scoped
- **WHEN** a judge agent invokes tools during orchestration
- **THEN** the invocation occurs within that judge agent's configured tool surface rather than through a global shared tool context

### Requirement: Optional bounded judge discussion
The AI service SHALL support an optional judge-to-judge discussion stage that is triggered only by orchestration policy and bounded to a finite number of exchanges.

#### Scenario: Discussion is skipped when drafts are already sufficient
- **WHEN** the orchestration policy determines that initial judge drafts do not require discussion
- **THEN** the system finalizes the structured judge bundle without entering the discussion stage

#### Scenario: Discussion is bounded when triggered
- **WHEN** the orchestration policy triggers judge discussion for a round
- **THEN** the system limits the discussion to the configured maximum exchanges before finalizing outputs

### Requirement: Judge-local memory isolation
The AI service SHALL maintain memory separately for round context, judge-local episodic memory, and durable persona configuration, and SHALL prevent those memory layers from directly changing deterministic game outcomes.

#### Scenario: Judge memory stays isolated
- **WHEN** a judge agent reads or writes episodic memory
- **THEN** the memory access is constrained to that judge agent's namespace and does not overwrite another judge's episodic state

#### Scenario: Memory cannot author game truth
- **WHEN** orchestration uses memory to shape dialogue output
- **THEN** the resulting memory-influenced content does not directly set scores, legal transitions, deal outcomes, or other authoritative engine state

### Requirement: Structured finalization contract
The AI service SHALL finalize agent outputs into a structured bundle that downstream consumers can validate without depending on internal discussion traces or chain-of-thought style artifacts.

#### Scenario: Finalizer produces judge response bundle
- **WHEN** orchestration completes for a round
- **THEN** the finalizer returns structured judge responses and a lead question with all required contract fields present

#### Scenario: Internal discussion is not required for consumption
- **WHEN** the web app or orchestration caller consumes the AI result
- **THEN** it can render the round from the structured bundle without parsing internal judge discussion artifacts
