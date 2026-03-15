import assert from "node:assert/strict";
import test from "node:test";

import {
  LIVE_REACTION_PREFERRED_SOURCES,
  LIVE_REACTION_SOURCE_TYPES,
  createLiveJudgeReactionRequest,
  validateLiveJudgeReactionEvent
} from "../src/index.js";

const transcriptUpdate = {
  eventId: "pitch-2",
  sequence: 2,
  text: "We retain 84% of small retailers after three months.",
  receivedAtMs: 2_500,
  sourceType: "mock"
};

test("createLiveJudgeReactionRequest accepts presentation-only reaction inputs", () => {
  const request = createLiveJudgeReactionRequest({
    roundId: "local-round",
    generatedAtMs: 3_000,
    presentationOnly: true,
    preferredSource: LIVE_REACTION_PREFERRED_SOURCES.PROVIDER,
    judges: [
      { id: "cat", name: "Zephyr Valtos" },
      { id: "dog", name: "Ryo Barkman" }
    ],
    transcriptUpdates: [transcriptUpdate],
    lastReactionAtMs: null,
    lastTranscriptSequence: 1
  });

  assert.equal(request.preferredSource, LIVE_REACTION_PREFERRED_SOURCES.PROVIDER);
  assert.equal(request.judges.length, 2);
  assert.equal(request.presentationOnly, true);
});

test("createLiveJudgeReactionRequest rejects authoritative fields", () => {
  assert.throws(() => {
    createLiveJudgeReactionRequest({
      roundId: "local-round",
      generatedAtMs: 3_000,
      presentationOnly: true,
      preferredSource: LIVE_REACTION_PREFERRED_SOURCES.MOCK,
      judges: [{ id: "cat", name: "Zephyr Valtos" }],
      transcriptUpdates: [transcriptUpdate],
      evaluation: {
        clarity: 80
      }
    });
  }, /presentation-only/);
});

test("validateLiveJudgeReactionEvent accepts structured non-authoritative judge cues", () => {
  const event = {
    type: "live_judge_reaction",
    roundId: "local-round",
    generatedAtMs: 4_000,
    presentationOnly: true,
    sourceType: LIVE_REACTION_SOURCE_TYPES.MOCK,
    providerName: "mock-live-reactions",
    transcriptSequence: 2,
    judges: [
      {
        judgeId: "cat",
        judgeName: "Zephyr Valtos",
        mood: "positive",
        presenceState: "understanding",
        confidenceBand: "medium",
        animationCue: "nod",
        summary: "Follows the retention proof and leans in.",
        authoritative: false
      },
      {
        judgeId: "dog",
        judgeName: "Ryo Barkman",
        mood: "negative",
        presenceState: "skeptical",
        confidenceBand: "medium",
        animationCue: "frown",
        summary: "Still wants clearer moat evidence.",
        authoritative: false
      }
    ]
  };

  validateLiveJudgeReactionEvent(event);
});

test("validateLiveJudgeReactionEvent rejects duplicate judge ids and authoritative cues", () => {
  assert.throws(() => {
    validateLiveJudgeReactionEvent({
      type: "live_judge_reaction",
      roundId: "local-round",
      generatedAtMs: 4_000,
      presentationOnly: true,
      sourceType: LIVE_REACTION_SOURCE_TYPES.PROVIDER,
      providerName: "provider-live-reactions",
      transcriptSequence: 2,
      judges: [
        {
          judgeId: "cat",
          judgeName: "Zephyr Valtos",
          mood: "neutral",
          presenceState: "engaged",
          confidenceBand: "high",
          animationCue: "lean_in",
          authoritative: false
        },
        {
          judgeId: "cat",
          judgeName: "Zephyr Valtos",
          mood: "positive",
          presenceState: "impressed",
          confidenceBand: "high",
          animationCue: "smile",
          authoritative: true
        }
      ]
    });
  }, /presentation-only/);
});
