import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { LIVE_REACTION_SOURCE_TYPES, validateLiveJudgeReactionEvent } from "../../../packages/contracts/src/index.js";
import {
  createLiveJudgeReactionService,
  createMockLiveReactionProvider,
  createProviderLiveReactionProvider
} from "../src/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixture(name) {
  return JSON.parse(readFileSync(path.join(__dirname, "fixtures", name), "utf-8"));
}

test("mock live reaction provider emits structured stage cues", async () => {
  const provider = createMockLiveReactionProvider();
  const request = loadFixture("live-reaction-request.json");
  const event = await provider.generate({
    ...request,
    preferredSource: "mock"
  });

  validateLiveJudgeReactionEvent(event);
  assert.equal(event.sourceType, LIVE_REACTION_SOURCE_TYPES.MOCK);
  assert.equal(event.judges.length, 3);
  assert.ok(event.judges.every((judge) => judge.authoritative === false));
});

test("live reaction service falls back when provider mode is requested without a provider", async () => {
  const service = createLiveJudgeReactionService({
    cadenceMs: 3_000
  });
  const request = loadFixture("live-reaction-request.json");
  const result = await service.run(request);

  assert.equal(result.emitted, true);
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.event.sourceType, LIVE_REACTION_SOURCE_TYPES.FALLBACK);
  validateLiveJudgeReactionEvent(result.event);
});

test("live reaction service respects cadence and does not emit on every transcript change", async () => {
  const service = createLiveJudgeReactionService({
    cadenceMs: 6_000
  });
  const request = loadFixture("live-reaction-request.json");
  const result = await service.run({
    ...request,
    generatedAtMs: 12_500,
    lastReactionAtMs: 11_000,
    lastTranscriptSequence: 1
  });

  assert.equal(result.emitted, false);
  assert.equal(result.reason, "cadence_wait");
  assert.ok(result.cadenceRemainingMs > 0);
});

test("provider-backed live reactions keep the same non-authoritative event contract", async () => {
  const provider = createProviderLiveReactionProvider({
    name: "test-provider",
    async generate(request) {
      return {
        roundId: request.roundId,
        judges: request.judges.map((judge, index) => ({
          judgeId: judge.id,
          judgeName: judge.name,
          mood: index === 0 ? "positive" : "neutral",
          presenceState: index === 0 ? "impressed" : "engaged",
          confidenceBand: index === 0 ? "high" : "medium",
          animationCue: index === 0 ? "smile" : "listen",
          summary: `${judge.name} is reacting to the live pitch.`,
          authoritative: false
        }))
      };
    }
  });
  const service = createLiveJudgeReactionService({
    cadenceMs: 3_000,
    provider
  });
  const request = loadFixture("live-reaction-request.json");
  const result = await service.run(request);

  assert.equal(result.emitted, true);
  assert.equal(result.fallbackUsed, false);
  assert.equal(result.event.sourceType, LIVE_REACTION_SOURCE_TYPES.PROVIDER);
  assert.ok(!("score" in result.event));
  assert.ok(!("offers" in result.event));
  validateLiveJudgeReactionEvent(result.event);
});
