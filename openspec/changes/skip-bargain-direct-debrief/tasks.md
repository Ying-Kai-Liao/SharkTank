## 1. Game Engine — State Machine

- [x] 1.1 Remove `PLAYER_DECISION` and `ROUND_RESULT` from round states in `packages/game-engine/src/state-machine.js`
- [x] 1.2 Add transitions from `DEALS` → `DEBRIEF` on `ACCEPT_DEAL` and `REJECT_DEAL` actions
- [x] 1.3 Remove `SUBMIT_BARGAIN` action handling from the state machine
- [x] 1.4 Remove `REQUEST_DEBRIEF` transition from `ROUND_RESULT` (no longer needed)

## 2. Game Engine — Offers

- [x] 2.1 Remove `clampBargainTerms()` and `createRevisedOffer()` from `packages/game-engine/src/offers.js`
- [x] 2.2 Remove bargain-related logic from `handleAction` in offers module

## 3. Contracts

- [x] 3.1 Remove `PLAYER_DECISION` and `ROUND_RESULT` from state enum in `packages/contracts/src/game.js`
- [x] 3.2 Remove `SUBMIT_BARGAIN` from action types in contracts
- [x] 3.3 Remove `REQUEST_DEBRIEF` action if no longer used

## 4. Web UI — Page Flow

- [x] 4.1 Remove bargain UI (bargain form, negotiation panel) from `apps/web/app/page.jsx`
- [x] 4.2 Remove `PLAYER_DECISION` and `ROUND_RESULT` phase handling from page.jsx
- [x] 4.3 Wire `onAcceptOffer` to dispatch `ACCEPT_DEAL` and trigger debrief fetch
- [x] 4.4 Wire `onRejectAllOffers` to dispatch `REJECT_DEAL` and trigger debrief fetch
- [x] 4.5 Show `DebriefReport` modal when state reaches `DEBRIEF`

## 5. Cleanup and Verification

- [x] 5.1 Search all files for references to removed states (`PLAYER_DECISION`, `ROUND_RESULT`, `SUBMIT_BARGAIN`) and clean up
- [x] 5.2 Verify the full flow works: pitch → panel → deals on stage → pick deal → debrief pops
- [x] 5.3 Verify reject-all flow: pitch → panel → deals → reject all → debrief pops
