import test from "node:test";
import assert from "node:assert/strict";

import { validateJudgeBundle } from "../../contracts/src/index.js";
import {
  applyAction,
  buildDebriefData,
  buildJudgeScorecard,
  createInitialGameState,
  getAllowedActions,
  InvalidActionError,
  JUDGE_PROFILES,
  PLAYER_ACTIONS,
  PITCH_CLOSE_REASONS,
  PITCH_SOURCE_TYPES,
  ROUND_STATES
} from "../src/index.js";

function startPitch(state, startedAtMs = 1_000, durationSeconds = 12) {
  return applyAction(state, {
    type: PLAYER_ACTIONS.START_PITCH,
    payload: { startedAtMs, durationSeconds, sourceType: PITCH_SOURCE_TYPES.MOCK }
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

function createJudgeBundle(evaluation) {
  const question = "What evidence do you have?";
  const judgeResponses = JUDGE_PROFILES.map((judge, index) => ({
    judgeId: judge.id,
    judgeName: judge.name,
    sentiment: index === 0 ? "impressed" : "interested",
    shortReaction: `${judge.name} sees signal.`,
    question,
    rationaleTags: ["needs_follow_up"]
  }));

  const bundle = { judgeResponses, leadQuestion: question };
  validateJudgeBundle(bundle);
  return bundle;
}

function advanceToRoundResult(state) {
  let s = createInitialGameState({ pitchDurationSeconds: 12 });
  s = startPitch(s, 2_000, 12);
  s = submitPitchUpdate(s, { sequence: 0, text: "We run a subscription platform for indie game studios.", receivedAtMs: 2_100 });
  s = submitPitchUpdate(s, { sequence: 1, text: "It improves retention with automated revenue operations and clear margins.", receivedAtMs: 3_000 });
  s = applyAction(s, { type: PLAYER_ACTIONS.CLOSE_PITCH, payload: { nowMs: 4_200, reason: PITCH_CLOSE_REASONS.MANUAL } });
  s = applyAction(s, { type: PLAYER_ACTIONS.ADVANCE, payload: { ...createJudgeBundle(s.evaluation), usePanel: false } });
  s = applyAction(s, { type: PLAYER_ACTIONS.ADVANCE });
  s = applyAction(s, { type: PLAYER_ACTIONS.SUBMIT_ANSWER, payload: { answer: "We have paid pilots and recurring revenue from signed customers." } });
  s = applyAction(s, { type: PLAYER_ACTIONS.ADVANCE });
  s = applyAction(s, { type: PLAYER_ACTIONS.ACCEPT_DEAL, payload: { dealId: s.offers[0].id } });
  return s;
}

function createMinimalDebrief(evaluation) {
  const debriefData = buildDebriefData(evaluation, JUDGE_PROFILES);
  return debriefData;
}

test("ROUND_RESULT transitions to DEBRIEF with valid debrief payload", () => {
  const state = advanceToRoundResult();
  assert.equal(state.currentState, ROUND_STATES.ROUND_RESULT);

  const debrief = createMinimalDebrief(state.evaluation);
  const next = applyAction(state, {
    type: PLAYER_ACTIONS.REQUEST_DEBRIEF,
    payload: { debrief }
  });

  assert.equal(next.currentState, ROUND_STATES.DEBRIEF);
  assert.deepEqual(next.debrief, debrief);
});

test("REQUEST_DEBRIEF rejects when not in ROUND_RESULT state", () => {
  const state = createInitialGameState();
  assert.equal(state.currentState, ROUND_STATES.LOBBY);

  assert.throws(() => {
    applyAction(state, {
      type: PLAYER_ACTIONS.REQUEST_DEBRIEF,
      payload: { debrief: { judges: [], topDimension: "clarity" } }
    });
  }, InvalidActionError);
});

test("ROUND_RESULT allows both REQUEST_DEBRIEF and ADVANCE (skip path)", () => {
  const state = advanceToRoundResult();
  assert.equal(state.currentState, ROUND_STATES.ROUND_RESULT);

  const allowed = getAllowedActions(state);
  assert.ok(allowed.includes(PLAYER_ACTIONS.REQUEST_DEBRIEF));
  assert.ok(allowed.includes(PLAYER_ACTIONS.ADVANCE));
});

test("buildDebriefData output matches buildJudgeScorecard results", () => {
  const evaluation = { clarity: 72, confidence: 58, originality: 85, business_viability: 48 };
  const debrief = buildDebriefData(evaluation, JUDGE_PROFILES);
  const scorecard = buildJudgeScorecard(evaluation, JUDGE_PROFILES);

  assert.equal(debrief.judges.length, JUDGE_PROFILES.length);

  for (const entry of scorecard) {
    const debriefJudge = debrief.judges.find((j) => j.judgeId === entry.judge.id);
    assert.ok(debriefJudge, `Missing debrief entry for ${entry.judge.id}`);
    assert.equal(debriefJudge.weightedScore, entry.score);
  }

  assert.equal(debrief.topDimension, "originality");
});

test("buildDebriefData includes offer status when offers provided", () => {
  const evaluation = { clarity: 72, confidence: 58, originality: 85, business_viability: 48 };
  const offers = [{ judgeId: "rhea", amount: 50000, equity: 15 }];
  const debrief = buildDebriefData(evaluation, JUDGE_PROFILES, { offers });

  const rhea = debrief.judges.find((j) => j.judgeId === "rhea");
  assert.equal(rhea.madeOffer, true);
  assert.ok(rhea.offerSummary.includes("50,000"));

  const marco = debrief.judges.find((j) => j.judgeId === "marco");
  assert.equal(marco.madeOffer, false);
  assert.equal(marco.offerSummary, null);
});
