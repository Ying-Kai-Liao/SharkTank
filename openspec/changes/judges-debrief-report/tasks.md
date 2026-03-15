## 1. Contracts — Debrief state and action

- [ ] 1.1 Add `DEBRIEF` to `ROUND_STATES` and `REQUEST_DEBRIEF` to `PLAYER_ACTIONS` in `packages/contracts/src/game.js`
- [ ] 1.2 Add debrief payload shape validator (`isDebriefPayloadShape`, `validateDebriefPayload`) covering per-judge deterministic data and optional narrative fields
- [ ] 1.3 Export new constants and validators from `packages/contracts/src/index.js`

## 2. Game engine — State machine and deterministic assembler

- [ ] 2.1 Add `REQUEST_DEBRIEF` case to `applyAction` in `packages/game-engine/src/state-machine.js`: assert `ROUND_RESULT` state, validate debrief payload, transition to `DEBRIEF` storing `state.debrief`
- [ ] 2.2 Update `getAllowedActions` to return `[REQUEST_DEBRIEF, ADVANCE]` for `ROUND_RESULT` state (ADVANCE for skip-debrief path)
- [ ] 2.3 Add `buildDebriefData(evaluation, judges)` function in `packages/game-engine/src/offers.js` (or new `debrief.js`) that returns per-judge deterministic data: weighted score, per-dimension scores, offer status, top dimension, and judge focus text as fallback tagline
- [ ] 2.4 Add tests for `ROUND_RESULT` → `DEBRIEF` transition, skip path, and `buildDebriefData` output matching `buildJudgeScorecard` results

## 3. AI service — Debrief narrative generation

- [ ] 3.1 Create `apps/ai-service/src/debrief.js` with `generateDebriefNarrative(judgeContext)` that takes a judge's accumulated state (persona, sentiment, concerns, rationaleTags, episodic memory, peer opinions, evaluation) and returns `{ journeyNarrative, keyMoment, improvementHint }`
- [ ] 3.2 Add structured prompt template for debrief narrative: first-person, in-character, references specific pitch signals, actionable coaching tip
- [ ] 3.3 Add `generateDebrief(request)` to `apps/ai-service/src/service.js` that runs one narrative call per judge in parallel and returns the combined result
- [ ] 3.4 Add fallback handling: if AI call fails for a judge, return null for narrative fields so deterministic layer still works

## 4. Web app — API route

- [ ] 4.1 Create `apps/web/app/api/judge-debrief/route.js` POST handler that accepts round state (evaluation, judgeResponses, transcript, roundId, sessionId, founderId) and returns merged debrief payload
- [ ] 4.2 In the route handler, call `buildDebriefData` for deterministic layer and `service.generateDebrief` for narrative layer, merging results per judge
- [ ] 4.3 Handle AI service failure gracefully: return deterministic-only debrief with fallback taglines

## 5. Web app — Debrief UI component

- [ ] 5.1 Create `DebriefReport` component that renders judge debrief cards in narrative-first layout: judge name/title, sentiment arc, journey narrative, turning point, coaching tip, then subtle evaluation bars below
- [ ] 5.2 Add evaluation dimension bar rendering (filled/unfilled segments with score label) and judge weighted score display showing the dominant weight
- [ ] 5.3 Add loading state that shows deterministic bars immediately while AI narrative loads
- [ ] 5.4 Add skip/close button to proceed without viewing full debrief

## 6. Web app — Round flow integration

- [ ] 6.1 Integrate debrief trigger into round result screen: "See what the judges were thinking" button that calls `/api/judge-debrief` and dispatches `REQUEST_DEBRIEF`
- [ ] 6.2 Pre-fetch debrief data when `ROUND_RESULT` state is reached so it's ready when the player clicks
- [ ] 6.3 Render `DebriefReport` when state is `DEBRIEF`, with a proceed button to advance to next round or game end
