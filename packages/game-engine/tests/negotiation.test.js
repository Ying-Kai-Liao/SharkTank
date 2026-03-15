import test from "node:test";
import assert from "node:assert/strict";

import { validateJudgeBundle } from "../../contracts/src/index.js";
import {
  applyAction,
  createInitialGameState,
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

function advanceToFollowUp() {
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
    payload: { ...createJudgeBundle(state.evaluation), usePanel: false }
  });
  state = applyAction(state, { type: PLAYER_ACTIONS.ADVANCE });
  assert.equal(state.currentState, ROUND_STATES.FOLLOW_UP);
  return state;
}

function advanceToDeals() {
  let state = advanceToFollowUp();
  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_ANSWER,
    payload: {
      answer: "We already have paid pilots, recurring revenue, and signed customers who renew monthly."
    }
  });
  assert.equal(state.currentState, ROUND_STATES.DEALS);
  assert.ok(state.offers.length >= 1);
  return state;
}

test("accept deal transitions from DEALS directly to DEBRIEF", () => {
  let state = advanceToDeals();

  state = applyAction(state, {
    type: PLAYER_ACTIONS.ACCEPT_DEAL,
    payload: { dealId: state.offers[0].id }
  });

  assert.equal(state.currentState, ROUND_STATES.DEBRIEF);
  assert.match(state.roundResult.headline, /Deal accepted/);
});

test("reject deal transitions from DEALS directly to DEBRIEF", () => {
  let state = advanceToDeals();

  state = applyAction(state, {
    type: PLAYER_ACTIONS.REJECT_DEAL
  });

  assert.equal(state.currentState, ROUND_STATES.DEBRIEF);
  assert.ok(state.roundResult);
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

test("decline-to-answer always transitions to DEALS", () => {
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
    payload: { ...createJudgeBundle(state.evaluation), usePanel: false }
  });
  state = applyAction(state, { type: PLAYER_ACTIONS.ADVANCE });
  assert.equal(state.currentState, ROUND_STATES.FOLLOW_UP);

  state = applyAction(state, {
    type: PLAYER_ACTIONS.DECLINE_QUESTION
  });

  assert.equal(state.currentState, ROUND_STATES.DEALS);
});

test("cannot decline-question outside of follow-up", () => {
  let state = advanceToDeals();

  assert.throws(() => {
    applyAction(state, {
      type: PLAYER_ACTIONS.DECLINE_QUESTION
    });
  }, InvalidActionError);
});

test("founder actions are tracked in state", () => {
  let state = advanceToFollowUp();

  state = applyAction(state, {
    type: PLAYER_ACTIONS.DECLINE_QUESTION
  });

  assert.ok(Array.isArray(state.founderActions));
  assert.equal(state.founderActions.length, 1);
  assert.equal(state.founderActions[0].type, "decline");
});

test("fixture: founder declines question, then accepts or round closes", () => {
  let state = advanceToFollowUp();

  state = applyAction(state, {
    type: PLAYER_ACTIONS.DECLINE_QUESTION
  });

  assert.equal(state.currentState, ROUND_STATES.DEALS);
  assert.ok(state.founderActions.length >= 1);
  assert.equal(state.founderActions.at(-1).type, "decline");

  if (state.offers.length) {
    state = applyAction(state, {
      type: PLAYER_ACTIONS.REJECT_DEAL
    });
    assert.equal(state.currentState, ROUND_STATES.DEBRIEF);
  } else {
    state = applyAction(state, { type: PLAYER_ACTIONS.ADVANCE });
    assert.equal(state.currentState, ROUND_STATES.DEBRIEF);
  }

  assert.ok(state.roundResult);
});
