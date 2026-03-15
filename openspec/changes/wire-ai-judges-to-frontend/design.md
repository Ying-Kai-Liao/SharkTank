## Context

The AI service has a full judge orchestration pipeline (`orchestrateJudgePanel`, `replan`, `generateDebrief`) exposed via `/api/judge-reactions` with `mode: "initial"` and `mode: "replan"`. However, `page.jsx` never calls these modes. Instead it uses:

- `createJudgeBundle()` — hardcoded reactions and a single static question for all judges
- `/api/judge-reactions` default mode — keyword heuristic that returns `"positive"` / `"negative"` for sprite animation
- `mock-offer-conversation.json` — three static lines of dialogue before offers
- `advancePanelTurn()` payload question — falls back to "Tell me more about your approach"

The debrief (`/api/judge-debrief`) is the only endpoint that's actually wired end-to-end.

## Goals / Non-Goals

**Goals:**
- Wire `/api/judge-reactions` `mode: "initial"` to replace `createJudgeBundle()` after pitch closes
- Wire `/api/judge-reactions` `mode: "replan"` to provide AI-generated questions after each founder answer
- Create a new endpoint to generate AI offer dialogue, replacing `mock-offer-conversation.json`
- Add loading states for async AI calls (the frontend currently assumes synchronous data)
- Preserve heuristic fallback so the game works without an API key

**Non-Goals:**
- Changing the AI service orchestration pipeline itself — it already works
- Adding streaming/real-time token display — batch responses are fine
- Changing the game engine state machine or contracts
- Changing the debrief flow (already wired)
- Adding new judge personas or changing scoring

## Decisions

### 1. Async AI call after pitch closes, with loading state

**Current:** `createJudgeBundle()` returns synchronous hardcoded data, immediately used in `ADVANCE` action.

**New:** After pitch closes, show a "Judges deliberating..." loading state while calling `/api/judge-reactions` with `mode: "initial"`. When the response arrives, use the AI bundle for the `ADVANCE` action payload.

**Rationale:** The AI call takes 2-5 seconds. The pitch-closed overlay already shows for 900ms — extend it to wait for AI. This feels natural (judges are "thinking").

**Fallback:** If the API call fails, fall back to the existing `createJudgeBundle()` so the game never stalls.

### 2. AI replan after each founder answer replaces heuristic reactions

**Current:** After the founder answers, `handleSendMessage` calls `/api/judge-reactions` (default mode) which returns a keyword-based `"positive"` / `"negative"` per judge. The panel turn advances with a generic question.

**New:** After the founder answers and the game engine processes `SUBMIT_ANSWER`, call `/api/judge-reactions` with `mode: "replan"` passing the current transcript, turn number, and founder actions. Use the returned `turnIntents` to:
- Update judge reaction sprites based on AI-determined sentiment
- Feed the next question text into `advancePanelTurn()` payload

**Rationale:** The replan endpoint already exists and returns structured turn intents with questions. The panel director still controls *who* asks next deterministically — the AI just provides *what* they say.

**Fallback:** If replan fails, advance the panel turn with no custom question (existing fallback: "Tell me more about your approach").

### 3. New `/api/judge-offer-dialogue` route for AI offer conversation

**Current:** `mock-offer-conversation.json` has three static lines.

**New:** Create `/api/judge-offer-dialogue` that takes the evaluation, offers, judge responses, and transcript, then generates an in-character line per judge explaining their offer (or why they passed).

**Prompt shape:**
- Judge persona + their evaluation focus
- Whether they made an offer and the terms
- Key pitch strengths/weaknesses from rationaleTags
- Returns one dialogue line per judge (2-3 sentences max)

**Rationale:** The offer moment is high-drama — judges explaining their decision in their own voice makes the game feel alive. Keep it short (one line per judge) so it doesn't slow down the flow.

**Fallback:** If the API fails, skip the offer dialogue and go straight to offer-select (deals above heads). The static mock conversation file can remain as a fallback but the default path should be AI.

### 4. Surface judge concerns and intent in StageScene

**Current:** StageScene shows the judge's name, a one-line reaction, and a mood sprite. Nothing about their reasoning.

**New:** When a judge's turn comes up in the panel, show their `shortReaction` as dialogue. Optionally surface `rationaleTags` or `concerns` as small chips/labels below the dialogue to give players a sense of what the judge cares about (e.g., "revenue proof", "market size").

**Rationale:** The AI already generates this data — surfacing it makes the conversation feel more like talking to thinking agents, not reading scripts. Keep it subtle (small labels, not walls of text).

## Risks / Trade-offs

- **[Latency]** AI calls add 2-5s per transition. → Mitigation: Loading states ("Judges deliberating..."), and heuristic fallback if API is down.
- **[API cost]** Each round now makes ~4-8 AI calls instead of 1. → Mitigation: Using `gpt-4.1-mini` keeps cost low. Can throttle replan calls if needed.
- **[Inconsistency]** AI-generated dialogue may not perfectly match deterministic offer amounts. → Mitigation: Pass offer terms into the prompt so the AI references the correct numbers.
- **[Fallback quality gap]** Heuristic fallback produces noticeably worse dialogue than AI. → Mitigation: Acceptable — the game is playable, just less immersive.
