import assert from "node:assert/strict";
import test from "node:test";

import {
  JUDGE_TURN_INTENTS,
  JUDGE_VISIBLE_STATUSES,
  isJudgeTurnIntentShape,
  isJudgeVisibleStatusShape,
  isJudgeTurnOutputShape,
  isJudgeServiceInputShape,
  createJudgeServiceInput
} from "../../../packages/contracts/src/index.js";
import { judgeTurnIntentSchema } from "../src/validation.js";

// -- Fixtures --

const activeJudgeFixture = {
  judgeId: "rhea",
  judgeName: "Rhea Kapoor",
  intent: "ask",
  status: "active",
  dialogue: "I need to understand the retention model better.",
  question: "What is your 12-month churn rate?",
  rationaleTags: ["retention", "churn"],
  score: 55,
  confidence: 60,
  concerns: ["churn_rate"]
};

const waitingJudgeFixture = {
  judgeId: "marco",
  judgeName: "Marco Huang",
  intent: "wait",
  status: "waiting",
  dialogue: "I want to hear more before committing.",
  rationaleTags: ["patience"],
  score: 50,
  confidence: 45,
  concerns: []
};

const supportiveJudgeFixture = {
  judgeId: "anika",
  judgeName: "Anika Johal",
  intent: "support",
  status: "supportive",
  dialogue: "The unit economics are strong, I am in.",
  rationaleTags: ["unit_economics"],
  score: 65,
  confidence: 72,
  concerns: []
};

const offeringJudgeFixture = {
  judgeId: "rhea",
  judgeName: "Rhea Kapoor",
  intent: "offer",
  status: "offering",
  dialogue: "I want to make an offer.",
  rationaleTags: ["strong_metrics"],
  score: 82,
  confidence: 85,
  concerns: []
};

const droppedOutJudgeFixture = {
  judgeId: "marco",
  judgeName: "Marco Huang",
  intent: "drop_out",
  status: "out",
  dialogue: "This is not for me.",
  rationaleTags: ["poor_fit"],
  score: 20,
  confidence: 90,
  concerns: ["market_size"]
};

// -- Tests --

test("turn intent schema validates correct shapes", () => {
  const result = judgeTurnIntentSchema.safeParse(activeJudgeFixture);
  assert.equal(result.success, true);
  assert.equal(result.data.judgeId, "rhea");
  assert.equal(result.data.intent, "ask");
  assert.equal(result.data.status, "active");
});

test("turn intent schema rejects invalid intents", () => {
  const invalid = { ...activeJudgeFixture, intent: "dance" };
  const result = judgeTurnIntentSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("turn intent schema rejects invalid statuses", () => {
  const invalid = { ...activeJudgeFixture, status: "flying" };
  const result = judgeTurnIntentSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("turn intent schema rejects missing judgeId", () => {
  const { judgeId: _ignored, ...invalid } = activeJudgeFixture;
  const result = judgeTurnIntentSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

test("mixed judge intents are supported", () => {
  const fixtures = [activeJudgeFixture, waitingJudgeFixture, offeringJudgeFixture];
  const results = fixtures.map((fixture) => judgeTurnIntentSchema.safeParse(fixture));

  assert.equal(results.every((result) => result.success), true);
  assert.equal(results[0].data.intent, "ask");
  assert.equal(results[1].data.intent, "wait");
  assert.equal(results[2].data.intent, "offer");
});

test("judge turn output shape validates correctly", () => {
  assert.equal(
    isJudgeTurnOutputShape({
      judgeId: "rhea",
      intent: "ask",
      status: "active"
    }),
    true
  );

  assert.equal(
    isJudgeTurnOutputShape({
      judgeId: "rhea",
      intent: "ask",
      status: "active",
      dialogue: "Some words",
      question: "A question?"
    }),
    true
  );
});

test("judge turn output shape rejects invalid objects", () => {
  assert.equal(isJudgeTurnOutputShape(null), false);
  assert.equal(isJudgeTurnOutputShape({}), false);
  assert.equal(isJudgeTurnOutputShape({ judgeId: "rhea", intent: "dance", status: "active" }), false);
  assert.equal(isJudgeTurnOutputShape({ judgeId: "rhea", intent: "ask", status: "flying" }), false);
  assert.equal(isJudgeTurnOutputShape({ judgeId: "", intent: "ask", status: "active" }), false);
  assert.equal(
    isJudgeTurnOutputShape({ judgeId: "rhea", intent: "ask", status: "active", dialogue: 42 }),
    false
  );
});

test("judge visible status shape validates correctly", () => {
  for (const status of JUDGE_VISIBLE_STATUSES) {
    assert.equal(isJudgeVisibleStatusShape(status), true);
  }

  assert.equal(isJudgeVisibleStatusShape("flying"), false);
  assert.equal(isJudgeVisibleStatusShape(null), false);
  assert.equal(isJudgeVisibleStatusShape(42), false);
});

test("judge turn intent shape validates correctly", () => {
  for (const intent of JUDGE_TURN_INTENTS) {
    assert.equal(isJudgeTurnIntentShape(intent), true);
  }

  assert.equal(isJudgeTurnIntentShape("dance"), false);
  assert.equal(isJudgeTurnIntentShape(null), false);
  assert.equal(isJudgeTurnIntentShape(42), false);
});

test("replanning input accepts turnNumber and founderActions", () => {
  const baseInput = {
    roundId: "round-1",
    sessionId: "session-1",
    founderId: "founder-1",
    pitch: "A pitch about analytics",
    evaluation: { clarity: 80, confidence: 75, originality: 70, business_viability: 85 },
    judges: [
      {
        id: "rhea",
        name: "Rhea Kapoor",
        title: "Managing Partner",
        focus: "Market potential",
        weights: { clarity: 0.2, confidence: 0.3, originality: 0.2, business_viability: 0.3 }
      }
    ],
    transcript: [{ speaker: "Founder", text: "We help gyms grow." }],
    turnNumber: 2,
    founderActions: [{ speaker: "Founder", text: "Our churn is below 3%." }]
  };

  assert.equal(isJudgeServiceInputShape(baseInput), true);
});

test("replanning input works without turnNumber and founderActions", () => {
  const baseInput = {
    roundId: "round-1",
    sessionId: "session-1",
    founderId: "founder-1",
    pitch: "A pitch about analytics",
    evaluation: { clarity: 80, confidence: 75, originality: 70, business_viability: 85 },
    judges: [
      {
        id: "rhea",
        name: "Rhea Kapoor",
        title: "Managing Partner",
        focus: "Market potential",
        weights: { clarity: 0.2, confidence: 0.3, originality: 0.2, business_viability: 0.3 }
      }
    ],
    transcript: [{ speaker: "Founder", text: "We help gyms grow." }]
  };

  assert.equal(isJudgeServiceInputShape(baseInput), true);
});

test("replanning input rejects invalid turnNumber", () => {
  const baseInput = {
    roundId: "round-1",
    sessionId: "session-1",
    founderId: "founder-1",
    pitch: "A pitch about analytics",
    evaluation: { clarity: 80, confidence: 75, originality: 70, business_viability: 85 },
    judges: [
      {
        id: "rhea",
        name: "Rhea Kapoor",
        title: "Managing Partner",
        focus: "Market potential",
        weights: { clarity: 0.2, confidence: 0.3, originality: 0.2, business_viability: 0.3 }
      }
    ],
    transcript: [{ speaker: "Founder", text: "We help gyms grow." }],
    turnNumber: -1
  };

  assert.equal(isJudgeServiceInputShape(baseInput), false);
});

test("replanning input rejects invalid founderActions", () => {
  const baseInput = {
    roundId: "round-1",
    sessionId: "session-1",
    founderId: "founder-1",
    pitch: "A pitch about analytics",
    evaluation: { clarity: 80, confidence: 75, originality: 70, business_viability: 85 },
    judges: [
      {
        id: "rhea",
        name: "Rhea Kapoor",
        title: "Managing Partner",
        focus: "Market potential",
        weights: { clarity: 0.2, confidence: 0.3, originality: 0.2, business_viability: 0.3 }
      }
    ],
    transcript: [{ speaker: "Founder", text: "We help gyms grow." }],
    founderActions: [{ speaker: "", text: "" }]
  };

  assert.equal(isJudgeServiceInputShape(baseInput), false);
});

test("createJudgeServiceInput normalizes turnNumber and founderActions", () => {
  const result = createJudgeServiceInput({
    roundId: "round-1",
    sessionId: "session-1",
    founderId: "founder-1",
    pitch: "A pitch about analytics",
    evaluation: { clarity: 80, confidence: 75, originality: 70, business_viability: 85 },
    judges: [
      {
        id: "rhea",
        name: "Rhea Kapoor",
        title: "Managing Partner",
        focus: "Market potential",
        weights: { clarity: 0.2, confidence: 0.3, originality: 0.2, business_viability: 0.3 }
      }
    ],
    transcript: [{ speaker: "Founder", text: "We help gyms grow." }]
  });

  assert.equal(result.turnNumber, 0);
  assert.deepEqual(result.founderActions, []);
});

test("createJudgeServiceInput preserves provided turnNumber and founderActions", () => {
  const founderActions = [{ speaker: "Founder", text: "Our churn is below 3%." }];
  const result = createJudgeServiceInput({
    roundId: "round-1",
    sessionId: "session-1",
    founderId: "founder-1",
    pitch: "A pitch about analytics",
    evaluation: { clarity: 80, confidence: 75, originality: 70, business_viability: 85 },
    judges: [
      {
        id: "rhea",
        name: "Rhea Kapoor",
        title: "Managing Partner",
        focus: "Market potential",
        weights: { clarity: 0.2, confidence: 0.3, originality: 0.2, business_viability: 0.3 }
      }
    ],
    transcript: [{ speaker: "Founder", text: "We help gyms grow." }],
    turnNumber: 3,
    founderActions
  });

  assert.equal(result.turnNumber, 3);
  assert.deepEqual(result.founderActions, founderActions);
});

test("fixture for active judge state validates", () => {
  const result = judgeTurnIntentSchema.safeParse(activeJudgeFixture);
  assert.equal(result.success, true);
  assert.equal(result.data.status, "active");
  assert.equal(result.data.intent, "ask");
});

test("fixture for waiting judge state validates", () => {
  const result = judgeTurnIntentSchema.safeParse(waitingJudgeFixture);
  assert.equal(result.success, true);
  assert.equal(result.data.status, "waiting");
  assert.equal(result.data.intent, "wait");
});

test("fixture for supportive judge state validates", () => {
  const result = judgeTurnIntentSchema.safeParse(supportiveJudgeFixture);
  assert.equal(result.success, true);
  assert.equal(result.data.status, "supportive");
  assert.equal(result.data.intent, "support");
});

test("fixture for offering judge state validates", () => {
  const result = judgeTurnIntentSchema.safeParse(offeringJudgeFixture);
  assert.equal(result.success, true);
  assert.equal(result.data.status, "offering");
  assert.equal(result.data.intent, "offer");
});

test("fixture for dropped-out judge state validates", () => {
  const result = judgeTurnIntentSchema.safeParse(droppedOutJudgeFixture);
  assert.equal(result.success, true);
  assert.equal(result.data.status, "out");
  assert.equal(result.data.intent, "drop_out");
});
