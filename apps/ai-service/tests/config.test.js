import assert from "node:assert/strict";
import test from "node:test";

import { loadAiServiceConfig, normalizeAiServiceConfig } from "../src/config.js";

test("normalizeAiServiceConfig supports legacy discussionMaxTurns and clamps rounds", () => {
  const config = normalizeAiServiceConfig({
    provider: "heuristic",
    discussionMaxTurns: 8,
    maxPeerQueriesPerRound: 9,
    maxPeerTargets: 7
  });

  assert.equal(config.deliberationMaxRounds, 3);
  assert.equal(config.maxPeerQueriesPerRound, 3);
  assert.equal(config.maxPeerTargets, 3);
});

test("loadAiServiceConfig reads the new deliberation env names", () => {
  const config = loadAiServiceConfig({
    JUDGE_ORCHESTRATION_PROVIDER: "heuristic",
    JUDGE_DELIBERATION_MAX_ROUNDS: "2",
    JUDGE_PEER_QUERY_MAX_QUERIES_PER_ROUND: "1",
    JUDGE_PEER_QUERY_MAX_TARGETS: "2"
  });

  assert.equal(config.deliberationMaxRounds, 2);
  assert.equal(config.maxPeerQueriesPerRound, 1);
  assert.equal(config.maxPeerTargets, 2);
});
