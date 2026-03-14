import assert from "node:assert/strict";
import test from "node:test";

import {
  createJudgeServiceInput,
  DEFAULT_DISCUSSION_POLICY,
  normalizeDiscussionPolicy
} from "../src/index.js";

const judge = {
  id: "rhea",
  name: "Rhea",
  title: "Growth investor",
  focus: "unit economics",
  weights: {
    clarity: 1,
    confidence: 1,
    originality: 1,
    business_viability: 1
  }
};

const baseInput = {
  roundId: "round-1",
  sessionId: "session-1",
  founderId: "founder-1",
  pitch: "A strong founder pitch.",
  evaluation: {
    clarity: 75,
    confidence: 74,
    originality: 76,
    business_viability: 77
  },
  judges: [judge],
  transcript: [
    {
      speaker: "Founder",
      text: "We have early traction and clear margins."
    }
  ]
};

test("normalizeDiscussionPolicy clamps deliberation rounds and peer-query bounds", () => {
  const policy = normalizeDiscussionPolicy({
    maxRounds: 9,
    disagreementThreshold: 20,
    minimumQuestionVariance: 3,
    maxPeerQueriesPerRound: 7,
    maxPeerTargets: 8
  });

  assert.deepEqual(policy, {
    maxRounds: 3,
    disagreementThreshold: 20,
    minimumQuestionVariance: 3,
    maxPeerQueriesPerRound: 3,
    maxPeerTargets: 3
  });
});

test("createJudgeServiceInput accepts legacy maxTurns and normalizes to maxRounds", () => {
  const request = createJudgeServiceInput({
    ...baseInput,
    discussionPolicy: {
      maxTurns: 2,
      disagreementThreshold: 10,
      minimumQuestionVariance: 4
    }
  });

  assert.equal(request.discussionPolicy.maxRounds, 2);
  assert.equal("maxTurns" in request.discussionPolicy, false);
  assert.equal(request.discussionPolicy.maxPeerQueriesPerRound, DEFAULT_DISCUSSION_POLICY.maxPeerQueriesPerRound);
  assert.equal(request.discussionPolicy.maxPeerTargets, DEFAULT_DISCUSSION_POLICY.maxPeerTargets);
});

test("createJudgeServiceInput fills missing deliberation settings from defaults", () => {
  const request = createJudgeServiceInput(baseInput);

  assert.deepEqual(request.discussionPolicy, DEFAULT_DISCUSSION_POLICY);
});
