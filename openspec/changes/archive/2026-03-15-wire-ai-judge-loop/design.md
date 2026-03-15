## Context

The AI service (`orchestrateJudgePanel`, `replan`) and the game engine state machine are fully implemented but disconnected. The web app uses local mocks at every boundary. This change wires the real services in without modifying the deterministic engine or the AI service internals.

## Goals / Non-Goals

**Goals:**
- Founder speaks their pitch via Web Speech API and transcript flows into the existing capture pipeline.
- Judge reactions come from the AI service (heuristic provider by default, OpenAI when configured).
- Each panel turn gets a contextual question via the AI service's replan function.
- Feedback is synthesized from actual round data instead of mock JSON.
- The game engine state machine remains untouched — all changes are at the integration layer.

**Non-Goals:**
- Changing the AI service's orchestration graph, providers, or memory system.
- Modifying the state machine, contracts, or panel director logic.
- Adding new game phases or changing the round lifecycle.
- Building a production-grade speech pipeline (Web Speech API is sufficient for now).

## Decisions

### Decision: Use Web Speech API directly in the pitch capture adapter

Implement `createLivePitchTranscriptSource()` using the browser's `SpeechRecognition` API. It will emit transcript updates through the same `emitUpdate` callback the mock source uses.

Rationale:
- The adapter interface already exists and is wired into `page.jsx`.
- Web Speech API is available in Chrome and Edge, covering the primary dev/demo targets.
- No server-side speech infrastructure needed.

Alternatives considered:
- Whisper or Deepgram server-side STT — rejected as over-engineering for the current stage.
- Text input box — rejected because the user wants voice.

### Decision: Wire judge reactions through a single API route that delegates to the AI service

`/api/judge-reactions` will call `orchestrateJudgePanel()` for the initial bundle and `service.replan()` for subsequent panel turns, selected by a `mode` field in the request body.

Rationale:
- Keeps the API surface small.
- The AI service already distinguishes between initial orchestration and replan internally.
- The heuristic provider works without an API key, so the loop functions out of the box.

Alternatives considered:
- Separate routes for initial bundle vs. replan — rejected to avoid route sprawl for what is logically one service.

### Decision: Feedback route synthesizes from round transcript and evaluation

Replace the mock JSON lookup with a function that takes the round's transcript, evaluation scores, and decision type, then produces a feedback paragraph. Initially this can use the heuristic provider's deterministic logic; later it can call an LLM.

Rationale:
- The feedback page already passes score, scoreTier, and decisionType as query params.
- Adding transcript context to the request lets the feedback be specific.

### Decision: Keep the heuristic provider as the default

The heuristic provider generates contextual judge responses without requiring an OpenAI API key. The OpenAI provider activates when `OPENAI_API_KEY` is set. This means the loop works immediately for any developer.

Rationale:
- Zero-config development experience.
- The heuristic provider already produces varied, context-aware responses.

## Risks / Trade-offs

- [Web Speech API browser support is limited] -> Document that Chrome/Edge are required for voice. Fallback to mock source if `SpeechRecognition` is unavailable.
- [AI service calls add latency to panel turns] -> The heuristic provider is synchronous and fast. OpenAI latency is acceptable for a turn-based conversation.
- [Feedback without an LLM will feel generic] -> Deterministic feedback is better than mock feedback. LLM feedback is a future upgrade.

## Migration Plan

1. Implement `createLivePitchTranscriptSource()` in `pitch-capture.js`.
2. Rewire `/api/judge-reactions` to call the AI service.
3. Update `page.jsx` to remove `createJudgeBundle()` and call the API for judge bundles and replan.
4. Rewire `/api/feedback` to synthesize from round data.
5. Remove mock JSON files that are no longer referenced.

Rollback: revert the API routes to their mock implementations. The state machine is unchanged.

## Open Questions

- Should the Web Speech API adapter support `continuous` mode (keeps listening) or single-utterance mode?
- Should we pass the full transcript to the feedback route, or keep it query-param based and expand later?
