## ADDED Requirements

### Requirement: Panel questions are sourced from AI replan
The frontend SHALL pass AI-generated question text into each `advancePanelTurn()` call instead of relying on hardcoded fallback questions.

#### Scenario: AI question used for panel turn
- **WHEN** the AI replan returns a turn intent with a question for the next judge
- **THEN** the frontend SHALL pass that question text as the `payload.question` to `advancePanelTurn()`

#### Scenario: Fallback question when AI unavailable
- **WHEN** the AI replan fails or returns no question for the next judge
- **THEN** the frontend SHALL pass no custom question, letting the panel director use its built-in fallback

### Requirement: Judge reactions update from AI replan
After each founder answer, the frontend SHALL update judge reaction sprites based on AI-determined sentiment from the replan response, not keyword heuristics.

#### Scenario: Judge sentiment updates from replan
- **WHEN** the AI replan returns turn intents with updated judge statuses
- **THEN** the frontend SHALL update judge reaction sprites to reflect the AI-determined sentiment (e.g., a judge moving from "skeptical" to "interested")
