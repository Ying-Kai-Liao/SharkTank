import assert from "node:assert/strict";
import test from "node:test";

import {
  createFinalizedPitch,
  createPitchTimerState,
  PITCH_CLOSE_REASONS,
  PITCH_SOURCE_TYPES,
  validateFinalizedPitch,
  validatePitchStart,
  validatePitchTimerState,
  validatePitchTranscriptUpdate
} from "../src/index.js";

test("pitch contract validators accept valid start, update, timer, and finalized payloads", () => {
  const start = {
    durationSeconds: 45,
    startedAtMs: 1_000,
    sourceType: PITCH_SOURCE_TYPES.MOCK
  };
  const update = {
    eventId: "mock-1",
    sequence: 0,
    text: "We help local shops keep loyal customers with subscription rewards.",
    receivedAtMs: 1_250,
    sourceType: PITCH_SOURCE_TYPES.MOCK
  };

  validatePitchStart(start);
  validatePitchTranscriptUpdate(update);

  const timer = createPitchTimerState({
    durationSeconds: start.durationSeconds,
    startedAtMs: start.startedAtMs,
    nowMs: 11_100
  });
  validatePitchTimerState(timer);
  assert.equal(timer.remainingSeconds, 35);

  const finalizedPitch = createFinalizedPitch({
    updates: [update],
    durationSeconds: start.durationSeconds,
    startedAtMs: start.startedAtMs,
    closedAtMs: 12_000,
    closeReason: PITCH_CLOSE_REASONS.MANUAL
  });

  validateFinalizedPitch(finalizedPitch);
  assert.match(finalizedPitch.text, /local shops keep loyal customers/i);
});

test("finalized pitch validation rejects empty transcript output", () => {
  assert.throws(() => {
    validateFinalizedPitch({
      text: "",
      updates: [],
      durationSeconds: 45,
      startedAtMs: 1_000,
      closedAtMs: 2_000,
      closeReason: PITCH_CLOSE_REASONS.TIMER_EXPIRED
    });
  }, /Finalized pitch output/);
});
