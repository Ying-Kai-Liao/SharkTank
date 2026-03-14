import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateJudgeBundle } from "../../../packages/contracts/src/index.js";
import { JUDGE_PROFILES } from "../../../packages/game-engine/src/index.js";
import { createJudgeOrchestrationService, InMemoryJudgeMemoryStore } from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(name) {
  return JSON.parse(readFileSync(path.join(__dirname, "fixtures", name), "utf-8"));
}

function createInput(name, overrides = {}) {
  return {
    ...loadFixture(name),
    judges: JUDGE_PROFILES,
    ...overrides
  };
}

function createTestService(options = {}) {
  const config = {
    provider: "heuristic",
    discussionMaxTurns: 2,
    disagreementThreshold: 14,
    minimumQuestionVariance: 2,
    providerRetryAttempts: 3,
    providerRetryBaseBackoffMs: 5,
    providerRetryJitterMs: 0,
    providerRetryMaxBackoffMs: 20,
    providerMaxConcurrency: 2,
    providerMinimumSuccessRatio: 0.5,
    openAiModel: "gpt-4.1-mini",
    ...(options.config ?? {})
  };
  const { config: _ignoredConfig, ...restOptions } = options;

  return createJudgeOrchestrationService({
    config,
    ...restOptions
  });
}

test("fixture output is a valid structured judge bundle", async () => {
  const service = createTestService();
  const result = await service.run(createInput("aligned-round.json"), { includeDebug: true });

  validateJudgeBundle(result.bundle);
  assert.equal(result.bundle.judgeResponses.length, JUDGE_PROFILES.length);
  assert.equal(result.bundle.judgeResponses[0].judgeId, "rhea");
});

test("discussion is skipped when judge drafts already align", async () => {
  const service = createTestService({
    memoryStore: new InMemoryJudgeMemoryStore()
  });
  const result = await service.run(createInput("aligned-round.json"), { includeDebug: true });

  assert.equal(result.debug.discussionTriggered, false);
  assert.equal(result.debug.discussionTurns, 0);
});

test("discussion stays bounded when the policy triggers panel debate", async () => {
  const fixture = createInput("disagreement-round.json");
  const service = createTestService();
  const result = await service.run(fixture, { includeDebug: true });

  assert.equal(result.debug.discussionTriggered, true);
  assert.ok(result.debug.discussionTurns <= fixture.discussionPolicy.maxTurns);
  assert.ok(result.debug.discussionLog.length >= JUDGE_PROFILES.length);
});

test("finalization does not expose authoritative state or internal traces", async () => {
  const service = createTestService();
  const result = await service.run(createInput("aligned-round.json"), { includeDebug: true });

  assert.ok(!("offers" in result.bundle));
  assert.ok(!("discussionLog" in result.bundle));
  assert.ok(result.bundle.judgeResponses.every((response) => !("score" in response)));
  assert.ok(result.debug.memoryWrites.every((entry) => !("evaluation" in entry)));
});

test("judge draft generation respects the configured provider concurrency limit", async () => {
  let activeCalls = 0;
  let maxActiveCalls = 0;
  const service = createTestService({
    provider: {
      name: "concurrency-test",
      async generateJudgeDraft({ judge }) {
        activeCalls += 1;
        maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
        await new Promise((resolve) => setTimeout(resolve, 40));
        activeCalls -= 1;

        return {
          judgeId: judge.id,
          judgeName: judge.name,
          sentiment: "interested",
          shortReaction: `${judge.name} is testing parallel draft generation.`,
          question: `What makes ${judge.name} care enough to continue?`,
          rationaleTags: ["parallel_generation"],
          score: 70,
          confidence: 68,
          concerns: ["parallelism"]
        };
      },
      async reviseJudgeDraft({ draft }) {
        return draft;
      }
    }
  });

  const startedAt = Date.now();
  await service.run(createInput("aligned-round.json"));
  const duration = Date.now() - startedAt;

  assert.equal(maxActiveCalls, 2);
  assert.ok(duration >= 70);
  assert.ok(duration < 140);
});

test("debug output includes discussion retry diagnostics", async () => {
  const revisionAttempts = new Map();
  const service = createTestService({
    provider: {
      name: "discussion-retry-test",
      async generateJudgeDraft({ judge }) {
        return {
          judgeId: judge.id,
          judgeName: judge.name,
          sentiment: judge.id === "rhea" ? "skeptical" : "interested",
          shortReaction: `${judge.name} wants more clarity before leaning in.`,
          question: `What shifts ${judge.name}'s position?`,
          rationaleTags: ["panel_pressure"],
          score: judge.id === "rhea" ? 61 : 75,
          confidence: 70,
          concerns: ["traction"]
        };
      },
      async reviseJudgeDraft({ judge, draft }) {
        const attempt = (revisionAttempts.get(judge.id) ?? 0) + 1;
        revisionAttempts.set(judge.id, attempt);

        if (judge.id === "rhea" && attempt === 1) {
          const error = new Error("Rate limit exceeded");
          error.status = 429;
          throw error;
        }

        return {
          ...draft,
          sentiment: "interested"
        };
      }
    }
  });

  const result = await service.run(createInput("disagreement-round.json"), { includeDebug: true });
  const retryEntry = result.debug.resilience.diagnostics.find(
    (entry) => entry.stage === "discussion" && entry.judgeId === "rhea"
  );

  assert.equal(result.debug.discussionTriggered, true);
  assert.equal(retryEntry.retryCount, 1);
  assert.equal(retryEntry.exhausted, false);
  assert.equal(retryEntry.failures.length, 1);
});

test("one exhausted judge draft falls back while preserving a valid bundle", async () => {
  const service = createTestService({
    config: {
      providerRetryAttempts: 2,
      providerRetryBaseBackoffMs: 0,
      providerRetryMaxBackoffMs: 0
    },
    provider: {
      name: "degraded-panel-test",
      async generateJudgeDraft({ judge }) {
        if (judge.id === "marco") {
          const error = new Error("Upstream temporarily unavailable");
          error.status = 503;
          throw error;
        }

        return {
          judgeId: judge.id,
          judgeName: judge.name,
          sentiment: "interested",
          shortReaction: `${judge.name} is still engaged but wants firmer proof.`,
          question: `What convinces ${judge.name} to keep going?`,
          rationaleTags: ["resilience_test"],
          score: 72,
          confidence: 69,
          concerns: ["traction"]
        };
      },
      async reviseJudgeDraft({ draft }) {
        return draft;
      }
    }
  });

  const result = await service.run(createInput("aligned-round.json"), { includeDebug: true });
  const exhaustedCall = result.debug.resilience.exhaustedCalls.find((entry) => entry.judgeId === "marco");

  validateJudgeBundle(result.bundle);
  assert.equal(result.bundle.judgeResponses.length, JUDGE_PROFILES.length);
  assert.equal(result.debug.resilience.degraded, true);
  assert.equal(result.debug.resilience.fallbackCount, 1);
  assert.equal(result.debug.resilience.successfulJudgeCount, 2);
  assert.equal(result.debug.resilience.minimumSuccessfulJudges, 2);
  assert.equal(exhaustedCall.fallbackUsed, true);
});

test("the service aborts when live provider completions fall below the minimum panel threshold", async () => {
  const service = createTestService({
    config: {
      providerRetryAttempts: 1
    },
    provider: {
      name: "threshold-test",
      async generateJudgeDraft() {
        const error = new Error("Rate limit exceeded");
        error.status = 429;
        throw error;
      },
      async reviseJudgeDraft({ draft }) {
        return draft;
      }
    }
  });

  await assert.rejects(
    () => service.run(createInput("aligned-round.json")),
    /minimum viable panel threshold/
  );
});
