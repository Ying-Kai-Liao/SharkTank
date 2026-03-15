## Context

After a round resolves to `ROUND_RESULT`, the player currently sees a headline, summary, and one-line explanation derived from `createRoundResult()`. Judges accumulate rich internal state during orchestration — sentiment, concerns, rationaleTags, episodic memory, peer consultation logs, and per-dimension evaluation scores — but none of this reaches the player.

The game engine owns state transitions and scoring deterministically. The AI service generates judge dialogue and reasoning. The debrief must respect this boundary: deterministic data (scores, weights, offers) comes from the engine; narrative data (in-character reflections) comes from the AI service.

## Goals / Non-Goals

**Goals:**
- Give players an immersive, in-character post-round report that reveals each judge's thinking journey
- Surface actionable feedback so players understand what to improve in future pitches
- Blend AI-generated narrative with deterministic score data in a narrative-first layout
- Keep the debrief optional — players can skip it and move on

**Non-Goals:**
- Replacing the existing `ROUND_RESULT` screen (debrief is additive, shown after)
- Exposing raw internal scores or weights as primary UI (they appear as subtle secondary detail)
- Cross-round trend analysis or historical debrief comparison (future work)
- Allowing the debrief to alter game state, scores, or offers

## Decisions

### 1. New `DEBRIEF` state after `ROUND_RESULT`

**Decision**: Add `DEBRIEF` as a terminal state reachable from `ROUND_RESULT` via a `REQUEST_DEBRIEF` action.

**Why**: The debrief is optional and happens after the outcome is finalized. Placing it after `ROUND_RESULT` keeps it separate from the deal flow. The player explicitly requests it — no forced wait on AI generation.

**Alternative considered**: Embedding debrief data directly in `ROUND_RESULT`. Rejected because it would couple the result screen to an AI call, adding latency to a currently instant transition.

### 2. Two-layer debrief: deterministic assembler + AI narrative

```
┌──────────────────────────────────────────────────────┐
│                   DEBRIEF DATA                       │
│                                                      │
│  ┌─────────────────────┐  ┌───────────────────────┐  │
│  │  DETERMINISTIC LAYER │  │   AI NARRATIVE LAYER  │  │
│  │  (game-engine)       │  │   (ai-service)        │  │
│  │                      │  │                       │  │
│  │  • evaluation bars   │  │  • in-character       │  │
│  │  • judge weights     │  │    reflection per     │  │
│  │  • offer rationale   │  │    judge              │  │
│  │  • sentiment final   │  │  • sentiment journey  │  │
│  │  • top dimension     │  │    as story           │  │
│  │  • scorecard         │  │  • "what I noticed"   │  │
│  │                      │  │  • coaching tip       │  │
│  └─────────────────────┘  └───────────────────────┘  │
│                                                      │
│            Merged by /api/judge-debrief              │
└──────────────────────────────────────────────────────┘
```

**Decision**: The game engine produces a `buildDebriefData()` function that assembles deterministic facts (scorecard, evaluation, weights, offer details). The AI service produces an in-character narrative per judge. The API route merges them.

**Why**: Keeps the AI-out-of-game-truth boundary clean. If the AI call fails, the deterministic layer still provides a useful debrief. The narrative enriches but doesn't replace.

### 3. AI narrative generation approach

**Decision**: One LLM call per judge, using a structured prompt that receives the judge's accumulated state from the round:
- Judge persona (name, title, focus, weights)
- Final sentiment, concerns, rationaleTags
- Episodic memory entries (prior concerns/questions from earlier turns)
- Peer consultation opinions received (if discussion happened)
- Evaluation scores and which dimensions moved during follow-ups
- Whether the judge made an offer and the outcome

The LLM returns a structured response:

```
{
  journeyNarrative: string,   // 2-3 sentences, in-character, first-person
  keyMoment: string,          // the turning point or most notable moment
  improvementHint: string     // one actionable coaching tip, in-character
}
```

**Why one call per judge**: Keeps prompts focused, allows parallel execution, and matches the existing orchestration pattern. Each judge's voice stays distinct.

**Alternative considered**: Single call for all judges. Rejected because it tends to homogenize voices and makes the prompt unwieldy with three personas.

### 4. Immersive narrative-first UI layout

**Decision**: Each judge's debrief card leads with their in-character narrative (journey, key moment, tip). Evaluation dimension bars appear below as a subtle "under the hood" section that the player can glance at but isn't the focus.

```
┌─────────────────────────────────────────────┐
│  Rhea Stone · Numbers Shark                 │
│  Sentiment: Skeptical → Interested          │
│                                             │
│  "When you opened, I couldn't find the      │
│   revenue model. I was ready to tune out.   │
│   Then you mentioned the $29/mo tier and    │
│   I leaned back in. But I never heard       │
│   what it costs you to serve a customer —   │
│   that's what would have sealed it."        │
│                                             │
│  Turning point: Subscription pricing reveal │
│                                             │
│  💡 "Next time, lead with your unit         │
│      economics. I need margins before       │
│      I need vision."                        │
│                                             │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│  Clarity       ████████░░  72               │
│  Confidence    ██████░░░░  58               │
│  Originality   █████████░  85               │
│  Viability     █████░░░░░  48               │
│  ─────────────────────────────              │
│  Rhea's weighted: 57  (viability×0.4)       │
└─────────────────────────────────────────────┘
```

**Why**: Players connect emotionally with character narrative first. Scores give the analytical layer for players who want to min-max. The separation respects both casual and competitive play styles.

### 5. Fallback when AI is unavailable

**Decision**: If the AI narrative call fails, render the deterministic layer only with a generic in-character tagline per judge (derived from their persona focus text). The debrief is still useful — just less immersive.

**Why**: The debrief should never block or break. Deterministic data is always available.

### 6. Debrief data passed via action payload

**Decision**: The `REQUEST_DEBRIEF` action carries the debrief payload (both deterministic and narrative data) as `action.payload.debrief`. The state machine stores it in `state.debrief` when transitioning to `DEBRIEF`.

**Why**: Consistent with how judge responses are passed via the `ADVANCE` action payload. The orchestrating layer (web app) fetches debrief data from the API, then dispatches the action with the payload.

## Risks / Trade-offs

**[Latency]** AI narrative generation adds 2-6 seconds after the player requests the debrief.
→ Mitigation: Start pre-fetching debrief narratives when `ROUND_RESULT` is reached, before the player clicks. Cache the result. If the player requests before it's ready, show a brief loading state with the deterministic layer visible immediately.

**[Voice consistency]** Judge narratives may not always match their established persona tone.
→ Mitigation: Include judge persona details and example voice in the prompt. Validate output structure. Fall back to deterministic-only if output is malformed.

**[Scope creep]** Temptation to add cross-round trends, badges, or gamified feedback.
→ Mitigation: This change is scoped to single-round debrief only. Future changes can layer on historical analysis.

**[AI-as-truth risk]** Players might take AI narrative as authoritative rather than flavor.
→ Mitigation: Evaluation bars provide the ground truth. The narrative is presented as the judge's subjective perspective, not a score explanation.
