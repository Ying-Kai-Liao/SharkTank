## Context

The current post-panel flow has four states: `DEALS → PLAYER_DECISION → ROUND_RESULT → DEBRIEF`. The `PLAYER_DECISION` state includes a bargain mechanic (counter-offers with clamped terms) that adds complexity without adding enough value at this stage. `ROUND_RESULT` is a separate summary screen before the debrief.

The deal-bubble UI already exists in `StageScene` — judges show offers above their heads, and the player can accept or reject. The debrief report (`DebriefReport.jsx`) already renders per-judge scores, narratives, and offer summaries.

## Goals / Non-Goals

**Goals:**
- Simplify post-panel flow to: show deals on stage → player picks (or rejects all) → debrief pops
- Remove all bargain/negotiation code paths
- Keep the existing `StageScene` deal-bubble UI unchanged
- Debrief appears regardless of whether a deal was accepted or all were rejected

**Non-Goals:**
- Changing how offers are generated (scoring, amounts, equity formulas stay the same)
- Modifying the debrief report content or layout
- Removing the `DEALS` state itself — it's still needed to show offers on stage
- Adding any new UI components

## Decisions

### 1. Remove `PLAYER_DECISION` and `ROUND_RESULT` states entirely

**Rationale:** These states only exist to support bargaining and show a summary before debrief. With bargain removed, `DEALS` can transition directly to `DEBRIEF`. The debrief report already contains all the information that `ROUND_RESULT` showed.

**Alternative considered:** Keep `ROUND_RESULT` as a brief score screen before debrief. Rejected — the debrief already shows scores and adding an extra click adds no value.

### 2. Trigger debrief fetch on deal acceptance/rejection

**Rationale:** Currently the debrief fetch happens when `ROUND_RESULT` is reached. Since we're removing that state, the fetch should fire when the player accepts a deal or rejects all. The `onAcceptOffer` and `onRejectAllOffers` handlers in `page.jsx` become the trigger points.

**Flow:**
```
Player clicks Accept/Reject All
  → dispatch ACCEPT_DEAL or REJECT_DEAL action
  → state machine transitions DEALS → DEBRIEF
  → page.jsx detects DEBRIEF state, fetches /api/judge-debrief
  → DebriefReport modal pops
```

### 3. Remove bargain code but keep offer generation intact

**Rationale:** `generateOffers()`, scoring, and the offer data model are still needed. Only bargain-specific code is removed: `clampBargainTerms()`, `createRevisedOffer()`, `SUBMIT_BARGAIN` action handling, and bargain UI elements.

## Risks / Trade-offs

- **[Lost feature]** Bargaining was a differentiating mechanic. → Mitigation: Can be re-added later as a separate change when there's time budget for it. The offer model supports it.
- **[State removal]** Removing `PLAYER_DECISION` and `ROUND_RESULT` could break code that references these states. → Mitigation: Search all files for these state names and clean up references.
- **[Debrief timing]** Debrief fetch currently happens at `ROUND_RESULT`. Moving it to `DEALS` transition means the fetch fires slightly earlier. → Mitigation: The fetch is already async; no functional difference.
