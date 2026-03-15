## MODIFIED Requirements

### Requirement: The hardcoded judge bundle in page.jsx is removed
The web app SHALL NOT generate judge responses locally via `createJudgeBundle()`. All judge content SHALL come from the AI service via API calls. The frontend SHALL show a loading state while waiting for the AI response and SHALL fall back to a heuristic bundle if the API call fails.

#### Scenario: Judge bundle comes from API after pitch closes
- **WHEN** the pitch-closed phase transitions to the panel phase
- **THEN** `page.jsx` SHALL call `/api/judge-reactions` with `mode: "initial"`, the pitch text, evaluation, and transcript
- **AND** SHALL use the returned bundle for the `ADVANCE` action payload

#### Scenario: Loading state during AI judge deliberation
- **WHEN** the pitch closes and the AI call is in progress
- **THEN** the frontend SHALL display a "Judges are deliberating..." loading state instead of immediately advancing

#### Scenario: Fallback when AI call fails
- **WHEN** the `/api/judge-reactions` `mode: "initial"` call fails
- **THEN** the frontend SHALL fall back to a locally-generated heuristic bundle so the game can continue

### Requirement: Judge reactions are produced by the AI service
The `/api/judge-reactions` route SHALL call `orchestrateJudgePanel()` from the AI service to generate the initial judge bundle instead of returning mock JSON.

#### Scenario: Initial judge bundle after pitch closes
- **WHEN** the pitch closes and the web app requests judge reactions with `mode: "initial"`
- **THEN** the API route calls `orchestrateJudgePanel()` with the pitch text, evaluation, and transcript
- **AND** returns a judge bundle with `leadQuestion` and `judgeResponses[]` in the shape the state machine expects

### Requirement: Panel turn questions come from the AI service replan
The `/api/judge-reactions` route SHALL call `service.replan()` when invoked with `mode: "replan"` to generate contextual judge questions for subsequent panel turns. The frontend SHALL call this mode after each founder answer instead of using keyword heuristics.

#### Scenario: Panel turn replan after founder answers
- **WHEN** the founder submits an answer and the panel director decides to continue
- **THEN** the web app SHALL call the API with `mode: "replan"`, the current turn number, founder actions, and transcript
- **AND** the returned `turnIntents` SHALL provide the question text for the next panel turn

#### Scenario: Replan fallback on failure
- **WHEN** the `mode: "replan"` API call fails
- **THEN** the frontend SHALL advance the panel turn with the default fallback question
