import test from "node:test";
import assert from "node:assert/strict";

import { validateJudgeBundle } from "../../contracts/src/index.js";
import {
  applyAction,
  createInitialGameState,
  getPitchTimerSnapshot,
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

  const bundle = {
    judgeResponses,
    leadQuestion: question
  };

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

test("pitch timer expiration closes capture and finalizes transcript", () => {
  let state = createInitialGameState({ pitchDurationSeconds: 5 });
  state = startPitch(state, 1_000, 5);
  state = submitPitchUpdate(state, {
    sequence: 0,
    text: "We help retailers keep customers coming back.",
    receivedAtMs: 1_100
  });
  state = submitPitchUpdate(state, {
    sequence: 1,
    text: "Our software automates repeat-purchase campaigns with clear revenue lift.",
    receivedAtMs: 2_200
  });

  state = applyAction(state, {
    type: PLAYER_ACTIONS.CLOSE_PITCH,
    payload: {
      nowMs: 8_500,
      reason: PITCH_CLOSE_REASONS.TIMER_EXPIRED
    }
  });

  assert.equal(state.currentState, ROUND_STATES.PITCH_CLOSED);
  assert.equal(state.pitchCapture.closeReason, PITCH_CLOSE_REASONS.TIMER_EXPIRED);
  assert.match(state.pitchCapture.finalizedPitch.text, /retailers keep customers/i);
  assert.equal(state.pitchCapture.finalizedPitch.closedAtMs, 6_000);
  assert.equal(state.transcript.at(-1)?.text, state.pitchCapture.finalizedPitch.text);

  const pitchTimer = getPitchTimerSnapshot(state, 9_000);
  assert.equal(pitchTimer.remainingSeconds, 0);
  assert.equal(pitchTimer.isClosed, true);
});

test("manual pitch close preserves remaining time and can advance into reactions", () => {
  let state = createInitialGameState({ pitchDurationSeconds: 10 });
  state = startPitch(state, 500, 10);
  state = submitPitchUpdate(state, {
    sequence: 0,
    text: "We built a subscription retention coach for small merchants.",
    receivedAtMs: 1_000
  });

  state = applyAction(state, {
    type: PLAYER_ACTIONS.CLOSE_PITCH,
    payload: {
      nowMs: 3_500,
      reason: PITCH_CLOSE_REASONS.MANUAL
    }
  });

  assert.equal(state.currentState, ROUND_STATES.PITCH_CLOSED);
  assert.equal(state.pitchCapture.closeReason, PITCH_CLOSE_REASONS.MANUAL);

  const pitchTimer = getPitchTimerSnapshot(state, 7_500);
  assert.equal(pitchTimer.remainingSeconds, 7);

  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE,
    payload: { ...createJudgeBundle(state.evaluation), usePanel: false }
  });

  assert.equal(state.currentState, ROUND_STATES.JUDGE_REACTIONS);
  assert.equal(state.judgeResponses.length, JUDGE_PROFILES.length);
});

test("late transcript updates are rejected after pitch closure without mutating state", () => {
  let state = createInitialGameState({ pitchDurationSeconds: 8 });
  state = startPitch(state, 1_000, 8);
  state = submitPitchUpdate(state, {
    sequence: 0,
    text: "We help service businesses improve customer retention.",
    receivedAtMs: 1_250
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.CLOSE_PITCH,
    payload: {
      nowMs: 2_000,
      reason: PITCH_CLOSE_REASONS.MANUAL
    }
  });

  const snapshot = structuredClone(state);

  assert.throws(() => {
    submitPitchUpdate(state, {
      sequence: 1,
      text: "This should not be accepted after the pitch closes.",
      receivedAtMs: 2_500
    });
  }, InvalidActionError);

  assert.deepEqual(state, snapshot);
});

test("a full local round still completes from timed pitch capture to deal acceptance (legacy flow)", () => {
  let state = createInitialGameState({ pitchDurationSeconds: 12 });
  state = startPitch(state, 2_000, 12);
  state = submitPitchUpdate(state, {
    sequence: 0,
    text: "We run a subscription platform for indie game studios.",
    receivedAtMs: 2_100
  });
  state = submitPitchUpdate(state, {
    sequence: 1,
    text: "It improves retention with automated revenue operations and clear margins.",
    receivedAtMs: 3_000
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.CLOSE_PITCH,
    payload: {
      nowMs: 4_200,
      reason: PITCH_CLOSE_REASONS.MANUAL
    }
  });
  assert.equal(state.currentState, ROUND_STATES.PITCH_CLOSED);

  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE,
    payload: { ...createJudgeBundle(state.evaluation), usePanel: false }
  });
  assert.equal(state.currentState, ROUND_STATES.JUDGE_REACTIONS);

  state = applyAction(state, { type: PLAYER_ACTIONS.ADVANCE });
  assert.equal(state.currentState, ROUND_STATES.FOLLOW_UP);

  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_ANSWER,
    payload: {
      answer: "We already have paid pilots, recurring revenue, and signed customers who renew monthly."
    }
  });
  assert.equal(state.currentState, ROUND_STATES.DEALS);
  assert.ok(state.offers.length >= 1);

  state = applyAction(state, {
    type: PLAYER_ACTIONS.ACCEPT_DEAL,
    payload: { dealId: state.offers[0].id }
  });
  assert.equal(state.currentState, ROUND_STATES.DEBRIEF);
  assert.match(state.roundResult.headline, /Deal accepted/);
});
