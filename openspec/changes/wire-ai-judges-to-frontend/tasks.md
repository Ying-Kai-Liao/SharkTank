## 1. Wire AI judge bundle after pitch closes

- [x] 1.1 Replace `createJudgeBundle()` in `page.jsx` with an async call to `/api/judge-reactions` with `mode: "initial"`, passing pitch text, evaluation, and transcript
- [x] 1.2 Add a loading state ("Judges are deliberating...") in the pitch-closed overlay while waiting for the AI response
- [x] 1.3 Add fallback: if the API call fails, generate a heuristic bundle locally (move existing `createJudgeBundle()` into a fallback path)
- [x] 1.4 Use the returned AI bundle as the payload for the `ADVANCE` action to enter the panel

## 2. Wire AI replan after each founder answer

- [x] 2.1 In `handleSendMessage()`, replace the heuristic `/api/judge-reactions` call (default mode) with `mode: "replan"`, passing pitch, evaluation, transcript, turn number, and founder actions
- [x] 2.2 Parse the returned `turnIntents` to extract the next judge's question text
- [x] 2.3 Pass the AI-generated question into `advancePanelTurn(questionText)` so the panel event uses real dialogue
- [x] 2.4 Update judge reaction sprites from the replan response sentiment instead of keyword heuristics
- [x] 2.5 Add fallback: if replan fails, advance the panel turn with no custom question (existing fallback behavior)

## 3. Create AI offer dialogue endpoint and wire to frontend

- [x] 3.1 Create `/api/judge-offer-dialogue` POST route in `apps/web/app/api/judge-offer-dialogue/route.js`
- [x] 3.2 Implement prompt that takes evaluation, offers, judge responses, transcript and generates one in-character dialogue line per judge explaining their offer or pass
- [x] 3.3 Add heuristic fallback if AI generation fails
- [x] 3.4 In `page.jsx`, when panel closes and state enters DEALS, call `/api/judge-offer-dialogue` to get AI dialogue lines
- [x] 3.5 Replace the static `mock-offer-conversation.json` playback with the AI-generated dialogue lines in the `offer-dialogue` phase
- [x] 3.6 Add loading state while offer dialogue is being generated
- [x] 3.7 If AI dialogue fails, skip directly to `offer-select` phase (deals above heads)

## 4. Surface richer AI output in UI

- [x] 4.1 Display the AI-generated `shortReaction` per judge when they first react to the pitch (during panel intro)
- [x] 4.2 Show `rationaleTags` or concerns as small labels/chips below the judge's dialogue in StageScene during panel turns

## 5. Cleanup and verification

- [x] 5.1 Remove the static `createJudgeBundle()` function from page.jsx (moved to fallback)
- [x] 5.2 Verify full flow with AI: pitch → AI deliberation → panel with AI questions → AI offer dialogue → deals → debrief
- [x] 5.3 Verify fallback flow without API key: pitch → heuristic bundle → panel with fallback questions → skip offer dialogue → deals → debrief
