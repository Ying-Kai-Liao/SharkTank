import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction,
  createInitialGameState,
  JUDGE_PROFILES,
  ROUND_STATES
} from "../../../packages/game-engine/src/index.js";
import { validateJudgeBundle } from "../../../packages/contracts/src/index.js";
import { createJudgeOrchestrationService } from "../../ai-service/src/index.js";
import { createJudgeBundleForRound } from "../src/judge-bundle-client.js";

function createPitchSubmittedState() {
  return applyAction(createInitialGameState(), {
    type: "submit_pitch",
    payload: {
      pitch: "We make a subscription CFO dashboard for independent creators with predictable retention and better margins."
    }
  });
}

test("the demo loop accepts either the local mock adapter or the orchestration service", async () => {
  const baseState = createPitchSubmittedState();
  const service = createJudgeOrchestrationService({
    config: {
      provider: "heuristic",
      discussionMaxTurns: 2,
      disagreementThreshold: 14,
      minimumQuestionVariance: 2,
      openAiModel: "gpt-4.1-mini"
    }
  });

  const mockBundle = await createJudgeBundleForRound({
    state: baseState,
    judges: JUDGE_PROFILES,
    transport: "mock"
  });
  const serviceBundle = await createJudgeBundleForRound({
    state: baseState,
    judges: JUDGE_PROFILES,
    transport: "service",
    serviceInvoker: (request) => service.run(request)
  });

  validateJudgeBundle(mockBundle);
  validateJudgeBundle(serviceBundle);

  const mockState = applyAction(baseState, {
    type: "advance_when_timer_expires",
    payload: mockBundle
  });
  const serviceState = applyAction(baseState, {
    type: "advance_when_timer_expires",
    payload: serviceBundle
  });

  assert.equal(mockState.currentState, ROUND_STATES.JUDGE_REACTIONS);
  assert.equal(serviceState.currentState, ROUND_STATES.JUDGE_REACTIONS);
  assert.equal(mockState.judgeResponses.length, JUDGE_PROFILES.length);
  assert.equal(serviceState.judgeResponses.length, JUDGE_PROFILES.length);
  assert.equal(typeof mockState.leadQuestion, "string");
  assert.equal(typeof serviceState.leadQuestion, "string");
});
