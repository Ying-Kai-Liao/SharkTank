## Why

The bargain/negotiation phase adds interaction complexity that slows down the core loop. Right now the game doesn't have time budget for back-and-forth negotiation. Simplifying the post-panel flow — pick a deal, then see the debrief — keeps the experience tight and lets players focus on pitching.

## What Changes

- **Remove the bargain mechanic** from `PLAYER_DECISION` state — no more counter-offers or revised terms.
- **Remove `PLAYER_DECISION` and `ROUND_RESULT` as separate states** — after deals are shown on stage, the player picks one (or rejects all) and goes straight to debrief.
- **Deals shown as bubbles above judges' heads** (existing `StageScene` UI) — player hovers a judge, sees the offer, clicks Accept or Reject All.
- **Debrief pops immediately after deal selection** — whether the player accepted a deal or rejected all, the `DebriefReport` modal appears with in-character feedback, scores, and offer summaries.

## Capabilities

### New Capabilities

- `direct-deal-to-debrief`: Streamlined post-panel flow that skips bargaining — player selects a deal on stage, then immediately sees the debrief report.

### Modified Capabilities

- `demo-core-loop`: State machine transitions change — `DEALS` transitions directly to `DEBRIEF`, removing `PLAYER_DECISION` and `ROUND_RESULT` intermediate states.

## Impact

- **Game engine**: `state-machine.js` — remove bargain-related transitions, wire `ACCEPT_OFFER` / `REJECT_ALL` to transition to `DEBRIEF`.
- **Game engine**: `offers.js` — remove `clampBargainTerms()`, `createRevisedOffer()`, and bargain handling from `handleAction`.
- **Contracts**: `game.js` — remove `SUBMIT_BARGAIN` action, remove `PLAYER_DECISION` / `ROUND_RESULT` states if fully unused.
- **Web UI**: `page.jsx` — remove bargain UI, negotiation panel, and `PLAYER_DECISION`/`ROUND_RESULT` phase handling. Wire deal acceptance to trigger debrief fetch + modal.
- **Web UI**: `StageScene.jsx` — no changes needed, deal bubble UI stays as-is.
