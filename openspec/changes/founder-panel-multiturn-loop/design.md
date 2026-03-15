## Context

The repository already separates deterministic game truth from AI-generated dialogue. The current local demo in [apps/web/app/page.jsx](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/apps/web/app/page.jsx) is still a scripted, mostly linear flow, while the game engine in [packages/game-engine/src/state-machine.js](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/packages/game-engine/src/state-machine.js) owns legal transitions, round closure, and offer acceptance. The AI service in [apps/ai-service/src/service.js](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/apps/ai-service/src/service.js) already supports isolated judge agents and bounded peer consultation, but it currently finalizes only a single post-pitch judge bundle.

This change extends the round model into a staged, multi-turn panel experience:
- a timed pitch capture window
- non-authoritative judge reactions during the pitch
- visible judge presence and panel status cues across the round
- a bounded post-pitch panel loop with independent judge intents
- a bounded founder negotiation loop

The design must keep the founder experience adaptive while preserving deterministic authority over timers, legal actions, negotiation limits, offer validity, and round-ending rules.

## Goals / Non-Goals

**Goals:**
- Introduce a round-director model that coordinates pitch capture, panel turns, founder actions, and round closure across the web app, contracts, game engine, and AI service.
- Support live judge reaction cues during the pitch without allowing those cues to alter authoritative state.
- Support visible judge status cues such as understanding, evaluating, uncertain, active offer, waiting, and dropped out so the panel feels alive even when not speaking.
- Support independent per-judge turn intents after the pitch, including asking a follow-up question, waiting, consulting peers, offering, revising an offer within allowed bounds, supporting a peer, or dropping out.
- Support founder actions beyond a single answer, including accept, bargain, refuse, and choosing not to answer a question.
- Keep the experience bounded and testable through deterministic turn budgets and stop conditions.

**Non-Goals:**
- Implementing an actually unbounded conversation loop.
- Moving scoring, valid offer terms, or round-closing authority into the AI service.
- Requiring a specific STT provider or Realtime API provider in the first implementation.
- Exposing raw internal judge reasoning traces as product-facing state.

## Decisions

### Decision: Add a deterministic round director above the existing engine transitions

The system will introduce a round-director layer that evaluates live session state, allowed actions, per-turn budgets, and stop conditions before each new panel or founder turn. The director may be implemented inside the game-engine package or as a thin deterministic orchestration wrapper around the existing engine, but it remains outside the AI layer.

Rationale:
- The desired panel behavior is variable-length and multi-turn, which exceeds the current single-answer flow.
- Budgets and stop conditions are product rules and must remain deterministic.
- This keeps AI free to influence how judges sound without deciding when the round is legally over.

Alternatives considered:
- Let the AI service decide when to continue or stop.
  - Rejected because it makes round closure difficult to test and shifts authority into the non-deterministic layer.
- Encode all panel turn logic directly in the web UI.
  - Rejected because it would make the browser a hidden source of truth and complicate service integration.

### Decision: Represent the live round as a typed event stream

The shared contracts will describe the multi-turn experience as typed events such as `pitch_started`, `pitch_partial_transcript`, `judge_reaction`, `judge_status`, `judge_question`, `judge_offer`, `judge_offer_revision`, `judge_dropout`, `founder_reply`, `founder_bargain`, and `round_closed`.

Rationale:
- The current single-speaker UI will not scale cleanly to a variable-length panel loop.
- Event types allow the frontend to animate and render the round without directly owning round logic.
- Event logs make replay, debugging, and test fixtures easier.

Alternatives considered:
- Continue with a single mutable bundle per phase.
  - Rejected because incremental reactions, questions, and negotiation changes are easier to model as events than as repeated full snapshots.

### Decision: Separate pitch capture from post-pitch panel evaluation

During the timed pitch, the system captures transcript updates and optional live reaction cues only. The authoritative pitch evaluation and initial panel planning happen after the pitch is locked.

Rationale:
- It avoids recalculating authoritative evaluation on every STT partial.
- It allows live judge reactions to remain expressive but non-authoritative.
- It creates a clean contract boundary between realtime UI updates and post-pitch deliberation.

Alternatives considered:
- Continuously run full judge deliberation during the pitch.
  - Rejected because it is expensive, noisy, and blurs transient understanding with formal judge decisions.

### Decision: Use independent per-judge turn intents rather than one global panel mode

Each judge will emit a structured turn intent after the pitch and after each founder action. Example intents include `ask_question`, `offer`, `revise_offer`, `wait`, `support_peer`, `drop_out`, and `final_no`. The round director decides which intents become visible events on that turn.

Rationale:
- This matches the desired product behavior where judges can behave independently.
- It allows one judge to keep probing while another goes silent or moves to an offer.
- It avoids forcing the entire panel into a single shared conversation state.

Alternatives considered:
- Keep a single “panel asks one question” step.
  - Rejected because it preserves the current limitation and prevents differentiated judges.
- Allow unrestricted simultaneous multi-message judge chatter.
  - Rejected because it is hard to read in the UI and hard to bound operationally.

### Decision: Evolve judge deliberation into repeated per-turn planning

The existing judge-agent orchestration capability will be extended so judges do not deliberate only once after the pitch. Instead, they will re-plan after each founder action using updated round context, while keeping internal peer consultation bounded and non-authoritative.

Rationale:
- This matches the desired experience where judges can keep following up, turn off, re-enter, or decide after hearing the founder.
- It reuses the existing AI-service investment instead of creating a parallel orchestration system.
- It gives the frontend a consistent source for judge-facing intents, statuses, and visible actions across the round.

Alternatives considered:
- Keep the current AI service as a one-shot post-pitch generator and handle later turns in the UI.
  - Rejected because it would split judge behavior across systems and weaken persona continuity.

### Decision: Keep peer awareness brokered and bounded

Judges may request bounded awareness of peer positions through the AI-service orchestration layer, but they will not directly recurse into unrestricted peer-to-peer chat. The existing brokered peer query model remains the basis for this behavior.

Rationale:
- It preserves the current deliberate safety boundary around inter-judge consultation.
- It supports “judge wants to know what the others think” without opening runaway loops.
- It aligns with the existing judge-agent-deliberation capability already present in the repo.

Alternatives considered:
- Full freeform judge-to-judge chat.
  - Rejected because cost, latency, and observability degrade quickly.

### Decision: Make negotiation actions AI-informed but engine-validated

Founder actions such as bargain, refuse, and answer-question will be broadcast back to the panel, but any resulting offer terms or legal next steps must be validated against deterministic negotiation rules. AI may propose revised language or preferences, but the engine validates or clamps any offer state that becomes authoritative.

Rationale:
- Bargaining is the highest-risk place for AI to become the source of truth.
- It keeps offer legality and scoring explainable and testable.
- It leaves room for expressive negotiation without sacrificing deterministic outcomes.

Alternatives considered:
- Let judges freely generate any amount/equity terms.
  - Rejected because it breaks the repo rule that AI cannot define game truth.

## Risks / Trade-offs

- [A richer loop could feel infinite or confusing] -> Enforce deterministic turn budgets, visible statuses, and clear stop conditions.
- [Realtime reactions may create product expectations that exceed the initial implementation] -> Treat live reactions as a separate capability that can launch with mocked heuristics before provider-backed realtime generation.
- [Visible status cues may drift from real judge intent if they are generated separately] -> Derive panel status from the same per-turn judge planning model or from clearly scoped non-authoritative reaction adapters.
- [Event-stream contracts add complexity across multiple packages] -> Keep event types small, versioned, and test them through shared contract fixtures.
- [Negotiation may tempt implementation drift toward AI-controlled offers] -> Require engine validation for every authoritative offer and revision.
- [Frontend complexity will increase when moving from a single active speaker to an event stream] -> Keep rendering keyed off structured event types and active judge ids rather than ad hoc phase booleans.

## Migration Plan

1. Define the new contracts and spec deltas for timed pitch capture, live reactions, panel turns, and negotiation actions.
2. Extend the deterministic round model to include turn budgets, allowed actions, and stop conditions for a multi-turn round.
3. Add AI-service interfaces for per-turn judge intents, visible judge statuses, and bounded peer-aware updates while keeping the current single-bundle path available.
4. Update the web app to consume the new event stream and render pitch, panel, and negotiation states from structured data rather than local mock script arrays.
5. Introduce provider-backed or mocked STT/live-reaction adapters behind the same contracts.
6. Roll out incrementally behind the local demo path, preserving fallback behavior until the multi-turn flow is stable.

Rollback remains straightforward because the current single-pass local demo and post-pitch bundle path can continue to serve as a fallback until the new director-driven loop is complete.

## Open Questions

- Should the first implementation support partial transcript correction events from STT, or only append-only transcript chunks?
- Should visible judge statuses be a first-class contract type or a derived rendering of recent reaction and intent events?
- Should bargaining operate on fully deterministic precomputed offer envelopes, or on bounded revision ranges computed from the score state?
- How many founder turns and per-judge questions should the default local demo allow before forced closure?
- Should the UI show hidden internal panel summaries such as “Rhea is reconsidering,” or only externally visible judge actions?
- Is the round director best expressed as an extension of the existing state machine, or as a higher-level deterministic coordinator that uses the current engine as a subcomponent?
