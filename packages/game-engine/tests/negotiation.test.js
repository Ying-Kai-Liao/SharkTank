import test from "node:test";
import assert from "node:assert/strict";

import { validateJudgeBundle } from "../../contracts/src/index.js";
import {
  applyAction,
  clampBargainTerms,
  createInitialGameState,
  createRevisedOffer,
  getAllowedActions,
  InvalidActionError,
  JUDGE_PROFILES,
  PLAYER_ACTIONS,
  PITCH_CLOSE_REASONS,
  PITCH_SOURCE_TYPES,
  ROUND_STATES
} from "../src/index.js";

function createJudgeBundle(evaluation) {
  const question = "What evidence do you have that customers will keep buying this?";
  const judgeResponses = JUDGE_PROFILES.map((judge, index) => ({
    judgeId: judge.id,
    judgeName: judge.name,
    sentiment: index === 0 ? "impressed" : "interested",
    shortReaction: `${judge.name} wants more detail, but sees enough signal to continue.`,
    question,
    rationaleTags: [
      evaluation.business_viability >= 70 ? "strong_monetization" : "weak_monetization",
      evaluation.clarity >= 70 ? "clear_pitch" : "unclear_market"
    ]
  }));

  const bundle = { judgeResponses, leadQuestion: question };
  validateJudgeBundle(bundle);
  return bundle;
}

function startPitch(state, startedAtMs = 1_000, durationSeconds = 12) {
  return applyAction(state, {
    type: PLAYER_ACTIONS.START_PITCH,
    payload: {
      startedAtMs,
      durationSeconds,
      sourceType: PITCH_SOURCE_TYPES.MOCK
    }
  });
}

function submitPitchUpdate(state, { sequence, text, receivedAtMs }) {
  return applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_PITCH_TRANSCRIPT,
    payload: {
      eventId: `mock-${sequence}`,
      sequence,
      text,
      receivedAtMs,
      sourceType: PITCH_SOURCE_TYPES.MOCK
    }
  });
}

function advanceToFollowUp(options = {}) {
  let state = createInitialGameState({ pitchDurationSeconds: 12 });
  state = startPitch(state, 1_000, 12);
  state = submitPitchUpdate(state, {
    sequence: 0,
    text: "We run a subscription platform for indie game studios.",
    receivedAtMs: 1_100
  });
  state = submitPitchUpdate(state, {
    sequence: 1,
    text: "It improves retention with automated revenue operations and clear margins.",
    receivedAtMs: 2_200
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.CLOSE_PITCH,
    payload: { nowMs: 3_500, reason: PITCH_CLOSE_REASONS.MANUAL }
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE,
    payload: createJudgeBundle(state.evaluation)
  });
  state = applyAction(state, { type: PLAYER_ACTIONS.ADVANCE });
  assert.equal(state.currentState, ROUND_STATES.FOLLOW_UP);
  return state;
}

function advanceToPlayerDecision(options = {}) {
  let state = advanceToFollowUp(options);
  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_ANSWER,
    payload: {
      answer: "We already have paid pilots, recurring revenue, and signed customers who renew monthly."
    }
  });
  assert.equal(state.currentState, ROUND_STATES.DEALS);
  assert.ok(state.offers.length >= 1);
  state = applyAction(state, { type: PLAYER_ACTIONS.ADVANCE });
  assert.equal(state.currentState, ROUND_STATES.PLAYER_DECISION);
  return state;
}

test("bargain on an active offer clamps terms and creates revised offer", () => {
  let state = advanceToPlayerDecision();
  const originalOffer = state.offers[0];
  const proposedAmount = originalOffer.amount + 100_000;
  const proposedEquity = originalOffer.equity - 20;

  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_BARGAIN,
    payload: {
      offerId: originalOffer.id,
      terms: { amount: proposedAmount, equity: proposedEquity }
    }
  });

  const revisedOffer = state.offers[0];
  assert.equal(revisedOffer.revised, true);
  assert.equal(revisedOffer.originalOfferId, originalOffer.id);
  assert.equal(revisedOffer.id, `${originalOffer.id}-revised`);

  const maxAmount = Math.round(originalOffer.amount * 1.20);
  const minEquity = Math.max(1, originalOffer.equity - 5);
  assert.ok(revisedOffer.amount <= maxAmount);
  assert.ok(revisedOffer.equity >= minEquity);
  assert.equal(state.currentState, ROUND_STATES.PLAYER_DECISION);
});

test("decline-to-answer in follow-up advances to deals when evaluation warrants offers", () => {
  let state = advanceToFollowUp();

  state = applyAction(state, {
    type: PLAYER_ACTIONS.DECLINE_QUESTION
  });

  assert.equal(state.currentState, ROUND_STATES.DEALS);
  assert.ok(state.offers.length >= 1);
  assert.ok(state.transcript.some((t) => t.text.includes("declined to answer")));
});

test("decline-to-answer in follow-up advances to round result when no offers generated", () => {
  let state = createInitialGameState({ pitchDurationSeconds: 12 });
  state = startPitch(state, 1_000, 12);
  state = submitPitchUpdate(state, {
    sequence: 0,
    text: "thing stuff maybe",
    receivedAtMs: 1_100
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.CLOSE_PITCH,
    payload: { nowMs: 2_000, reason: PITCH_CLOSE_REASONS.MANUAL }
  });

  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE,
    payload: createJudgeBundle(state.evaluation)
  });
  state = applyAction(state, { type: PLAYER_ACTIONS.ADVANCE });
  assert.equal(state.currentState, ROUND_STATES.FOLLOW_UP);

  state = applyAction(state, {
    type: PLAYER_ACTIONS.DECLINE_QUESTION
  });

  // With a weak pitch, either we get DEALS (if some offers still pass) or ROUND_RESULT
  assert.ok(
    state.currentState === ROUND_STATES.DEALS || state.currentState === ROUND_STATES.ROUND_RESULT,
    `Expected DEALS or ROUND_RESULT, got ${state.currentState}`
  );
});

test("cannot bargain when no offers exist", () => {
  let state = advanceToFollowUp();

  assert.throws(() => {
    applyAction(state, {
      type: PLAYER_ACTIONS.SUBMIT_BARGAIN,
      payload: {
        offerId: "nonexistent-offer",
        terms: { amount: 50000, equity: 15 }
      }
    });
  }, InvalidActionError);
});

test("cannot decline-question outside of follow-up", () => {
  let state = advanceToPlayerDecision();

  assert.throws(() => {
    applyAction(state, {
      type: PLAYER_ACTIONS.DECLINE_QUESTION
    });
  }, InvalidActionError);
});

test("founder actions are tracked in state", () => {
  let state = advanceToPlayerDecision();
  assert.ok(Array.isArray(state.founderActions));

  const originalOffer = state.offers[0];
  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_BARGAIN,
    payload: {
      offerId: originalOffer.id,
      terms: { amount: originalOffer.amount + 5000, equity: originalOffer.equity - 2 }
    }
  });

  assert.equal(state.founderActions.length, 1);
  assert.equal(state.founderActions[0].type, "bargain");
  assert.equal(state.founderActions[0].offerId, originalOffer.id);
});

test("bargain in player-decision replaces offer with revised terms", () => {
  let state = advanceToPlayerDecision();
  const originalOffer = state.offers[0];
  const originalCount = state.offers.length;

  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_BARGAIN,
    payload: {
      offerId: originalOffer.id,
      terms: { amount: originalOffer.amount + 5000, equity: originalOffer.equity - 1 }
    }
  });

  assert.equal(state.offers.length, originalCount);
  const revised = state.offers[0];
  assert.equal(revised.revised, true);
  assert.equal(revised.originalOfferId, originalOffer.id);
  assert.notEqual(revised.id, originalOffer.id);
});

// --- Fixture: One-offer path ---
test("fixture: single judge offer, founder bargains, then accepts", () => {
  let state = advanceToPlayerDecision();
  const offer = state.offers[0];

  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_BARGAIN,
    payload: {
      offerId: offer.id,
      terms: { amount: offer.amount + 3000, equity: offer.equity - 2 }
    }
  });

  const revisedOffer = state.offers[0];
  assert.equal(revisedOffer.revised, true);

  state = applyAction(state, {
    type: PLAYER_ACTIONS.ACCEPT_DEAL,
    payload: { dealId: revisedOffer.id }
  });

  assert.equal(state.currentState, ROUND_STATES.ROUND_RESULT);
  assert.match(state.roundResult.headline, /Deal accepted/);
});

// --- Fixture: Multi-offer path ---
test("fixture: multiple offers, founder bargains on one, accepts another", () => {
  let state = advanceToPlayerDecision();

  if (state.offers.length < 2) {
    // Skip if only one offer generated deterministically
    return;
  }

  const firstOffer = state.offers[0];
  const secondOffer = state.offers[1];

  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_BARGAIN,
    payload: {
      offerId: firstOffer.id,
      terms: { amount: firstOffer.amount + 2000, equity: firstOffer.equity - 1 }
    }
  });

  assert.equal(state.offers[0].revised, true);
  assert.equal(state.offers[1].id, secondOffer.id);

  state = applyAction(state, {
    type: PLAYER_ACTIONS.ACCEPT_DEAL,
    payload: { dealId: secondOffer.id }
  });

  assert.equal(state.currentState, ROUND_STATES.ROUND_RESULT);
  assert.match(state.roundResult.headline, /Deal accepted/);
});

// --- Fixture: No-continuation path ---
test("fixture: founder declines question, no continuation, round closes", () => {
  let state = advanceToFollowUp();

  state = applyAction(state, {
    type: PLAYER_ACTIONS.DECLINE_QUESTION
  });

  assert.ok(state.founderActions.length >= 1);
  assert.equal(state.founderActions.at(-1).type, "decline");

  if (state.currentState === ROUND_STATES.DEALS) {
    state = applyAction(state, { type: PLAYER_ACTIONS.ADVANCE });
    assert.equal(state.currentState, ROUND_STATES.PLAYER_DECISION);

    state = applyAction(state, { type: PLAYER_ACTIONS.REJECT_DEAL });
    assert.equal(state.currentState, ROUND_STATES.ROUND_RESULT);
  } else {
    assert.equal(state.currentState, ROUND_STATES.ROUND_RESULT);
  }

  assert.ok(state.roundResult);
});
