import test from "node:test";
import assert from "node:assert/strict";

import { validateJudgeBundle } from "../../contracts/src/index.js";
import {
  InvalidActionError,
  applyAction,
  createInitialGameState,
  evaluatePitch,
  JUDGE_PROFILES,
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

  const bundle = {
    judgeResponses,
    leadQuestion: question
  };

  validateJudgeBundle(bundle);
  return bundle;
}

test("valid state transitions complete a round", () => {
  let state = createInitialGameState();

  state = applyAction(state, {
    type: "submit_pitch",
    payload: {
      pitch: "We run a subscription platform for indie game studios with strong retention and clear revenue."
    }
  });
  assert.equal(state.currentState, ROUND_STATES.PITCH_SUBMITTED);

  state = applyAction(state, {
    type: "advance_when_timer_expires",
    payload: createJudgeBundle(state.evaluation)
  });
  assert.equal(state.currentState, ROUND_STATES.JUDGE_REACTIONS);

  state = applyAction(state, { type: "advance_when_timer_expires" });
  assert.equal(state.currentState, ROUND_STATES.FOLLOW_UP);

  state = applyAction(state, {
    type: "submit_answer",
    payload: {
      answer: "We already have paid pilots, recurring revenue, and signed customers who renew monthly."
    }
  });
  assert.equal(state.currentState, ROUND_STATES.DEALS);
  assert.ok(state.offers.length >= 1);

  state = applyAction(state, { type: "advance_when_timer_expires" });
  assert.equal(state.currentState, ROUND_STATES.PLAYER_DECISION);

  state = applyAction(state, {
    type: "accept_deal",
    payload: { dealId: state.offers[0].id }
  });
  assert.equal(state.currentState, ROUND_STATES.ROUND_RESULT);
  assert.match(state.roundResult.headline, /Deal accepted/);
});

test("invalid actions are rejected without mutating the existing state", () => {
  const initialState = createInitialGameState();
  const snapshot = structuredClone(initialState);

  assert.throws(() => {
    applyAction(initialState, {
      type: "submit_answer",
      payload: { answer: "We already have traction." }
    });
  }, InvalidActionError);

  assert.deepEqual(initialState, snapshot);
});

test("deal actions are blocked before deals are available", () => {
  let state = createInitialGameState();
  state = applyAction(state, {
    type: "submit_pitch",
    payload: {
      pitch: "A marketplace for local makers with curated discovery and cleaner margins."
    }
  });

  assert.throws(() => {
    applyAction(state, {
      type: "accept_deal",
      payload: { dealId: "fake-offer" }
    });
  }, InvalidActionError);
});

test("a full local round can end without taking a deal", () => {
  let state = createInitialGameState();
  const pitch = "An AI revenue coach for service businesses with subscription pricing and clear customer value.";

  state = applyAction(state, {
    type: "submit_pitch",
    payload: { pitch }
  });

  const evaluation = evaluatePitch(pitch);
  state = applyAction(state, {
    type: "advance_when_timer_expires",
    payload: createJudgeBundle(evaluation)
  });
  state = applyAction(state, { type: "advance_when_timer_expires" });
  state = applyAction(state, {
    type: "submit_answer",
    payload: {
      answer: "We already have paying customers, strong retention, and a pricing model that improves margin over time."
    }
  });
  state = applyAction(state, { type: "advance_when_timer_expires" });
  state = applyAction(state, { type: "reject_deal" });

  assert.equal(state.currentState, ROUND_STATES.ROUND_RESULT);
  assert.match(state.roundResult.headline, /walked away|No deal/i);
  assert.ok(state.transcript.length >= 5);
});
