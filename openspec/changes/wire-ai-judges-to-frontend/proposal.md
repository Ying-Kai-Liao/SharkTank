## Why

The AI judge orchestration pipeline (drafts, peer consultation, deliberation, replan) exists in the backend but the frontend never calls it. All judge dialogue shown to the player is hardcoded — same reaction text, same question, same offer conversation every round. The only real AI output the user sees is the debrief at the very end. This change wires the existing AI service endpoints to the frontend so judges behave as live AI agents throughout the entire round.

## What Changes

- **Replace hardcoded `createJudgeBundle()`** in `page.jsx` with a call to `/api/judge-reactions` `mode: "initial"` after pitch closes. Each judge gets an AI-generated reaction, question, and sentiment based on the actual pitch.
- **Replace heuristic sprite reactions** during panel Q&A with calls to `/api/judge-reactions` `mode: "replan"` after each founder answer. The AI re-evaluates each judge's position and generates new questions/dialogue.
- **Replace `mock-offer-conversation.json`** with AI-generated offer dialogue. Each judge explains why they're offering (or passing) in character, referencing the actual pitch and evaluation. A new `/api/judge-offer-dialogue` route generates this.
- **Surface richer AI output** on the frontend — show judge concerns, intent changes, and reasoning alongside their dialogue, not just one-liner reactions.

## Capabilities

### New Capabilities

- `ai-offer-dialogue`: AI-generated in-character dialogue where each judge explains their offer decision, replacing the hardcoded mock offer conversation.

### Modified Capabilities

- `ai-judge-integration`: Frontend now calls the AI orchestration pipeline (`mode: "initial"`) after pitch closes instead of using a hardcoded judge bundle.
- `multi-turn-panel-director`: Frontend calls AI replan (`mode: "replan"`) after each founder answer to get AI-generated follow-up questions and updated judge intents.
- `demo-core-loop`: The demo flow now depends on async AI calls for judge reactions and panel questions, requiring loading states and error fallbacks.

## Impact

- **Web UI** (`apps/web/app/page.jsx`): Major changes to judging flow — async AI calls replace synchronous hardcoded data at pitch-close, after each answer, and before deals.
- **Web UI** (`apps/web/components/StageScene.jsx`): May need updates to display richer judge state (concerns, intent changes).
- **API routes**: New `/api/judge-offer-dialogue` route. Existing `/api/judge-reactions` route already supports `initial` and `replan` modes — no backend changes needed there.
- **AI service** (`apps/ai-service`): May need a new `generateOfferDialogue()` function for the offer conversation. Existing orchestration and replan pipelines are already built.
- **Game engine**: No changes — AI output feeds into existing contracts (judge bundle shape, panel events).
