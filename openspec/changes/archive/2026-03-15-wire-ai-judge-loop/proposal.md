## Why

The game engine state machine, AI service orchestration, panel director, and judge providers are all built — but every integration point between them is mocked. The web app short-circuits the AI service with hardcoded judge bundles, canned JSON reactions, scripted offer dialogues, and mock feedback. The pitch capture uses a timer-fed mock transcript source instead of real speech input.

The result is a demo that looks like a game but plays identically every time. Judges never react to what the founder actually says. The core promise — an open-ended AI-driven panel conversation — is architecturally ready but never activated.

## What Changes

- Replace the mock pitch transcript source with a live Web Speech API adapter so the founder actually speaks their pitch.
- Wire the judge reaction API route to call the existing `orchestrateJudgePanel()` service instead of returning mock JSON.
- Wire panel turn advancement to call the AI service's `replan()` so each judge question is contextual to the conversation so far.
- Replace the mock feedback API route with a call that synthesizes actual round data into a personalized debrief.
- Remove the hardcoded `createJudgeBundle()` from `page.jsx` and let the AI service produce judge responses.

## Capabilities

### New Capabilities
- `live-pitch-capture`: Web Speech API adapter that feeds real-time speech transcription into the existing pitch capture pipeline.
- `ai-judge-integration`: Connects the web app's API routes to the AI service's orchestration and replan functions so judges react contextually.

### Modified Capabilities
- `demo-core-loop`: The main page replaces mock data paths with real AI service calls and live speech input.

## Impact

- `packages/game-engine/src/pitch-capture.js` — implement `createLivePitchTranscriptSource()`.
- `apps/web/app/api/judge-reactions/route.js` — rewire to call `orchestrateJudgePanel()`.
- `apps/web/app/api/feedback/route.js` — rewire to synthesize from round data.
- `apps/web/app/page.jsx` — remove `createJudgeBundle()`, call API for initial judge bundle, call replan API before each panel turn.
- No changes to `packages/contracts`, `packages/game-engine/src/state-machine.js`, or the AI service internals — those layers are already correct.
