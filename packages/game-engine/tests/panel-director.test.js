import test from "node:test";
import assert from "node:assert/strict";

import {
  DIRECTOR_DECISIONS,
  PANEL_EVENT_TYPES
} from "../../contracts/src/index.js";
import { validateJudgeBundle } from "../../contracts/src/index.js";
import {
  applyAction,
  createInitialGameState,
  decideContinuation,
  InvalidActionError,
  JUDGE_PROFILES,
  PLAYER_ACTIONS,
  PITCH_CLOSE_REASONS,
  PITCH_SOURCE_TYPES,
  ROUND_STATES,
  selectNextJudge
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

function createPitchedState() {
  let state = createInitialGameState({ pitchDurationSeconds: 12 });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.START_PITCH,
    payload: {
      startedAtMs: 1_000,
      durationSeconds: 12,
      sourceType: PITCH_SOURCE_TYPES.MOCK
    }
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_PITCH_TRANSCRIPT,
    payload: {
      eventId: "mock-0",
      sequence: 0,
      text: "We built a revenue coach for subscription merchants with strong retention.",
      receivedAtMs: 1_100,
      sourceType: PITCH_SOURCE_TYPES.MOCK
    }
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.CLOSE_PITCH,
    payload: { nowMs: 3_000, reason: PITCH_CLOSE_REASONS.MANUAL }
  });
  return state;
}

function enterPanel(state) {
  return applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE,
    payload: createJudgeBundle(state.evaluation)
  });
}

test("advance from pitch-closed enters panel state by default", () => {
  let state = createPitchedState();
  state = enterPanel(state);

  assert.equal(state.currentState, ROUND_STATES.PANEL);
  assert.ok(state.panel);
  assert.equal(state.panel.turn, 0);
  assert.equal(state.panel.events.length, 0);
  assert.equal(state.panel.awaitingAnswer, false);
  assert.equal(state.panel.closed, false);
  assert.equal(state.panel.budget.maxTurns, 6);
  assert.equal(state.panel.budget.maxPerJudgeFollowups, 2);
});

test("advance-panel-turn emits a judge question event and enables founder answer", () => {
  let state = createPitchedState();
  state = enterPanel(state);
  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
    payload: { question: "How do you retain customers?" }
  });

  assert.equal(state.currentState, ROUND_STATES.PANEL);
  assert.equal(state.panel.turn, 1);
  assert.equal(state.panel.awaitingAnswer, true);
  assert.equal(state.panel.events.length, 1);

  const event = state.panel.events[0];
  assert.equal(event.type, PANEL_EVENT_TYPES.JUDGE_QUESTION);
  assert.equal(event.turn, 1);
  assert.ok(event.judgeId);
  assert.ok(event.judgeName);
  assert.equal(event.text, "How do you retain customers?");
});

test("submit-answer in panel emits founder answer event and disables awaiting", () => {
  let state = createPitchedState();
  state = enterPanel(state);
  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
    payload: { question: "What is your retention rate?" }
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_ANSWER,
    payload: { answer: "Our retention rate is strong because customers see revenue growth." }
  });

  assert.equal(state.currentState, ROUND_STATES.PANEL);
  assert.equal(state.panel.awaitingAnswer, false);
  assert.equal(state.panel.events.length, 2);

  const answerEvent = state.panel.events[1];
  assert.equal(answerEvent.type, PANEL_EVENT_TYPES.FOUNDER_ANSWER);
  assert.equal(answerEvent.turn, 1);
  assert.match(answerEvent.text, /retention rate is strong/);
});

test("panel closes when max turns reached and transitions to deals", () => {
  let state = createPitchedState();
  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE,
    payload: {
      ...createJudgeBundle(state.evaluation),
      panelBudget: { maxTurns: 2, maxPerJudgeFollowups: 2 }
    }
  });

  // Turn 1
  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
    payload: { question: "Tell us about revenue." }
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_ANSWER,
    payload: { answer: "We have subscription revenue with paid customers." }
  });

  // Turn 2
  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
    payload: { question: "What about margins?" }
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_ANSWER,
    payload: { answer: "Our margin is strong because we automate retention." }
  });

  // Turn 3 should close because maxTurns=2 is reached
  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
    payload: {}
  });

  assert.equal(state.currentState, ROUND_STATES.DEALS);
  assert.ok(state.panel.closed);

  const closeEvent = state.panel.events.find((e) => e.type === PANEL_EVENT_TYPES.PANEL_CLOSED);
  assert.ok(closeEvent);
  assert.equal(closeEvent.reason, "max_turns_reached");
});

test("panel closes when no eligible judges remain", () => {
  let state = createPitchedState();
  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE,
    payload: {
      ...createJudgeBundle(state.evaluation),
      panelBudget: { maxTurns: 10, maxPerJudgeFollowups: 1 }
    }
  });

  // Each judge gets exactly 1 followup (3 judges × 1 = 3 turns)
  for (let i = 0; i < 3; i++) {
    state = applyAction(state, {
      type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
      payload: {}
    });
    state = applyAction(state, {
      type: PLAYER_ACTIONS.SUBMIT_ANSWER,
      payload: { answer: `Answer ${i + 1}: we have strong revenue and traction.` }
    });
  }

  // Next advance should close: all judges exhausted
  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
    payload: {}
  });

  assert.equal(state.currentState, ROUND_STATES.DEALS);
  assert.ok(state.panel.closed);

  const closeEvent = state.panel.events.find((e) => e.type === PANEL_EVENT_TYPES.PANEL_CLOSED);
  assert.equal(closeEvent.reason, "no_eligible_judges");
});

test("panel full round completes through to deal acceptance", () => {
  let state = createPitchedState();
  state = enterPanel(state);

  // Run panel turns until it closes
  let turns = 0;
  while (state.currentState === ROUND_STATES.PANEL && turns < 20) {
    state = applyAction(state, {
      type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
      payload: {}
    });

    if (state.currentState !== ROUND_STATES.PANEL) {
      break;
    }

    state = applyAction(state, {
      type: PLAYER_ACTIONS.SUBMIT_ANSWER,
      payload: { answer: "Our revenue model has paid customers with strong retention margins." }
    });
    turns++;
  }

  assert.equal(state.currentState, ROUND_STATES.DEALS);
  assert.ok(state.offers.length >= 1);

  state = applyAction(state, {
    type: PLAYER_ACTIONS.ACCEPT_DEAL,
    payload: { dealId: state.offers[0].id }
  });
  assert.equal(state.currentState, ROUND_STATES.DEBRIEF);
  assert.match(state.roundResult.headline, /Deal accepted/);
});

test("panel events form a replayable event stream", () => {
  let state = createPitchedState();
  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE,
    payload: {
      ...createJudgeBundle(state.evaluation),
      panelBudget: { maxTurns: 2, maxPerJudgeFollowups: 2 }
    }
  });

  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
    payload: { question: "First question" }
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_ANSWER,
    payload: { answer: "First answer with revenue details." }
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
    payload: { question: "Second question" }
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_ANSWER,
    payload: { answer: "Second answer about customer traction." }
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
    payload: {}
  });

  const events = state.panel.events;
  const types = events.map((e) => e.type);

  assert.deepEqual(types, [
    PANEL_EVENT_TYPES.JUDGE_QUESTION,
    PANEL_EVENT_TYPES.FOUNDER_ANSWER,
    PANEL_EVENT_TYPES.JUDGE_QUESTION,
    PANEL_EVENT_TYPES.FOUNDER_ANSWER,
    PANEL_EVENT_TYPES.PANEL_CLOSED
  ]);

  assert.equal(events[0].turn, 1);
  assert.equal(events[1].turn, 1);
  assert.equal(events[2].turn, 2);
  assert.equal(events[3].turn, 2);
});

test("cannot advance panel turn while awaiting founder answer", () => {
  let state = createPitchedState();
  state = enterPanel(state);
  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
    payload: {}
  });

  assert.equal(state.panel.awaitingAnswer, true);

  assert.throws(() => {
    applyAction(state, {
      type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
      payload: {}
    });
  }, InvalidActionError);
});

test("cannot submit answer in panel when not awaiting", () => {
  let state = createPitchedState();
  state = enterPanel(state);

  assert.equal(state.panel.awaitingAnswer, false);

  assert.throws(() => {
    applyAction(state, {
      type: PLAYER_ACTIONS.SUBMIT_ANSWER,
      payload: { answer: "Premature answer." }
    });
  }, InvalidActionError);
});

test("director decideContinuation returns continue when budget remains", () => {
  const panelState = {
    budget: { maxTurns: 6, maxPerJudgeFollowups: 2 },
    turn: 2,
    events: [],
    judgeFollowupCounts: { rhea: 1 },
    awaitingAnswer: false,
    closed: false
  };

  const judgeResponses = JUDGE_PROFILES.map((j) => ({
    judgeId: j.id,
    judgeName: j.name
  }));

  const result = decideContinuation(panelState, judgeResponses);
  assert.equal(result.decision, DIRECTOR_DECISIONS.CONTINUE);
});

test("director decideContinuation returns close at max turns", () => {
  const panelState = {
    budget: { maxTurns: 3, maxPerJudgeFollowups: 2 },
    turn: 3,
    events: [],
    judgeFollowupCounts: {},
    awaitingAnswer: false,
    closed: false
  };

  const judgeResponses = JUDGE_PROFILES.map((j) => ({
    judgeId: j.id,
    judgeName: j.name
  }));

  const result = decideContinuation(panelState, judgeResponses);
  assert.equal(result.decision, DIRECTOR_DECISIONS.CLOSE);
  assert.equal(result.reason, "max_turns_reached");
});

test("director selectNextJudge rotates between eligible judges", () => {
  const judgeResponses = JUDGE_PROFILES.map((j) => ({
    judgeId: j.id,
    judgeName: j.name
  }));

  const panelState = {
    budget: { maxTurns: 6, maxPerJudgeFollowups: 2 },
    turn: 1,
    events: [
      { type: PANEL_EVENT_TYPES.JUDGE_QUESTION, turn: 1, judgeId: "rhea", judgeName: "Rhea Stone", text: "Q1" }
    ],
    judgeFollowupCounts: { rhea: 1 },
    awaitingAnswer: false,
    closed: false
  };

  const next = selectNextJudge(panelState, judgeResponses);
  assert.notEqual(next.judgeId, "rhea");
});

test("evaluation improves across multiple panel answers", () => {
  let state = createPitchedState();
  const initialEvaluation = { ...state.evaluation };

  state = enterPanel(state);
  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
    payload: { question: "Tell us about revenue." }
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_ANSWER,
    payload: { answer: "We have strong recurring revenue with paid customers and high retention." }
  });

  const afterFirstAnswer = { ...state.evaluation };

  state = applyAction(state, {
    type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
    payload: { question: "What about growth?" }
  });
  state = applyAction(state, {
    type: PLAYER_ACTIONS.SUBMIT_ANSWER,
    payload: { answer: "Already signed customers with growing traction and revenue margin." }
  });

  const afterSecondAnswer = { ...state.evaluation };

  const avgInitial = Object.values(initialEvaluation).reduce((a, b) => a + b, 0) / 4;
  const avgFirst = Object.values(afterFirstAnswer).reduce((a, b) => a + b, 0) / 4;
  const avgSecond = Object.values(afterSecondAnswer).reduce((a, b) => a + b, 0) / 4;

  assert.ok(avgFirst >= avgInitial, "First answer should improve or maintain evaluation");
  assert.ok(avgSecond >= avgFirst, "Second answer should improve or maintain evaluation");
});
