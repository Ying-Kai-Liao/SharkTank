## ADDED Requirements

### Requirement: Judge reactions are produced by the AI service
The `/api/judge-reactions` route SHALL call `orchestrateJudgePanel()` from the AI service to generate the initial judge bundle instead of returning mock JSON.

#### Scenario: Initial judge bundle after pitch closes
- **WHEN** the pitch closes and the web app requests judge reactions with `mode: "initial"`
- **THEN** the API route calls `orchestrateJudgePanel()` with the pitch text, evaluation, and transcript
- **AND** returns a judge bundle with `leadQuestion` and `judgeResponses[]` in the shape the state machine expects

### Requirement: Panel turn questions come from the AI service replan
The `/api/judge-reactions` route SHALL call `service.replan()` when invoked with `mode: "replan"` to generate contextual judge questions for subsequent panel turns.

#### Scenario: Panel turn replan after founder answers
- **WHEN** the founder submits an answer and the panel director decides to continue
- **THEN** the web app calls the API with `mode: "replan"`, the current turn number, founder actions, and transcript
- **AND** the API returns `turnIntents` with a contextual question for the next judge

### Requirement: Heuristic provider works without configuration
The AI service SHALL use the heuristic provider by default so the judge loop functions without an OpenAI API key.

#### Scenario: No API key configured
- **WHEN** `OPENAI_API_KEY` is not set in the environment
- **THEN** the AI service uses the heuristic provider to generate judge drafts, peer consultations, and revisions

### Requirement: Feedback is synthesized from round data
The `/api/feedback` route SHALL generate a feedback paragraph based on the round's transcript, evaluation scores, and decision type instead of returning mock JSON.

#### Scenario: Feedback reflects actual round performance
- **WHEN** the round ends and the feedback page loads
- **THEN** the feedback paragraph references the founder's actual pitch content and judge interactions

### Requirement: The hardcoded judge bundle in page.jsx is removed
The web app SHALL NOT generate judge responses locally via `createJudgeBundle()`. All judge content SHALL come from the AI service via API calls.

#### Scenario: Judge bundle comes from API after pitch closes
- **WHEN** the pitch-closed phase transitions to the panel phase
- **THEN** `page.jsx` calls `/api/judge-reactions` with `mode: "initial"` and uses the returned bundle for the `ADVANCE` action payload
