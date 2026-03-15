## 1. Live Pitch Capture

- [ ] 1.1 Implement `createLivePitchTranscriptSource()` in `packages/game-engine/src/pitch-capture.js` using Web Speech API with continuous mode, emitting transcript updates through the existing `emitUpdate` callback
- [ ] 1.2 Add browser support detection: fall back to `createMockPitchTranscriptSource()` when `SpeechRecognition` is unavailable
- [ ] 1.3 Update `page.jsx` `handleStart()` to use the live source instead of the mock source (keep mock as fallback)

## 2. Wire Judge Reactions API to AI Service

- [ ] 2.1 Rewire `/api/judge-reactions/route.js` to accept a `mode` field (`initial` or `replan`) and call `orchestrateJudgePanel()` for initial bundles
- [ ] 2.2 Add replan support to the same route: when `mode: "replan"`, call `service.replan()` with turn number, founder actions, and transcript, returning `turnIntents`
- [ ] 2.3 Remove `createJudgeBundle()` from `page.jsx` — replace the pitch-closed-to-panel transition with an async call to `/api/judge-reactions` with `mode: "initial"`

## 3. Wire Panel Turn Loop Through AI Service

- [ ] 3.1 Update `advancePanelTurn()` in `page.jsx` to call `/api/judge-reactions` with `mode: "replan"` before advancing, using the returned question text for the next judge
- [ ] 3.2 Pass full round context (transcript, evaluation, founderActions, turnNumber) in the replan request body
- [ ] 3.3 Handle API errors gracefully: fall back to the panel director's default question if the AI service is unreachable

## 4. Wire Feedback API

- [ ] 4.1 Rewire `/api/feedback/route.js` to synthesize a feedback paragraph from score, scoreTier, decisionType, and transcript instead of returning mock JSON
- [ ] 4.2 Update `page.jsx` to pass the round transcript to the feedback page (via POST body or extended query params)

## 5. Cleanup

- [ ] 5.1 Remove `apps/web/app/data/mock-judge-reactions.json` and `mock-feedback-results.json` once no routes reference them
- [ ] 5.2 Remove `mock-offer-conversation.json` import from `page.jsx` if offer dialogue is now AI-driven (or keep if scripted offers are intentional for now)
- [ ] 5.3 Verify the heuristic provider works end-to-end without an API key by running through a full round
