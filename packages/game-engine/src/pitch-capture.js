import { PITCH_SOURCE_TYPES } from "../../contracts/src/index.js";

export const DEFAULT_MOCK_PITCH_SEGMENTS = Object.freeze([
  "We built a revenue coach for independent retailers.",
  "It analyzes customer history and recommends retention campaigns in minutes.",
  "Merchants use it to improve repeat purchases without hiring an expensive growth team."
]);

function toTranscriptUpdate(update, sourceType, now) {
  return {
    eventId: update.eventId,
    sequence: Number.isInteger(update.sequence) ? update.sequence : 0,
    text: update.text,
    receivedAtMs:
      typeof update.receivedAtMs === "number" && Number.isFinite(update.receivedAtMs) ? update.receivedAtMs : now(),
    sourceType: update.sourceType ?? sourceType
  };
}

export function createPitchCaptureAdapter({ source, onTranscriptUpdate, now = () => Date.now() }) {
  let stopCurrent = null;

  return {
    sourceType: source.sourceType,
    start(context = {}) {
      this.stop("restart");
      stopCurrent =
        source.start({
          ...context,
          emitUpdate: (update) => {
            onTranscriptUpdate(toTranscriptUpdate(update, source.sourceType, now));
          }
        }) ?? null;
    },
    stop(reason = "stop") {
      if (typeof stopCurrent === "function") {
        stopCurrent();
        stopCurrent = null;
      }

      if (typeof source.stop === "function") {
        source.stop(reason);
      }
    }
  };
}

export function createMockPitchTranscriptSource({
  segments = DEFAULT_MOCK_PITCH_SEGMENTS,
  intervalMs = 1_400
} = {}) {
  const activeTimeouts = new Set();

  return {
    sourceType: PITCH_SOURCE_TYPES.MOCK,
    start({ emitUpdate, startedAtMs = Date.now() }) {
      segments.forEach((text, index) => {
        const timeoutId = setTimeout(() => {
          activeTimeouts.delete(timeoutId);
          emitUpdate({
            eventId: `mock-${index + 1}`,
            sequence: index,
            text,
            receivedAtMs: startedAtMs + index * intervalMs,
            sourceType: PITCH_SOURCE_TYPES.MOCK
          });
        }, index * intervalMs);

        activeTimeouts.add(timeoutId);
      });

      return () => {
        for (const timeoutId of activeTimeouts) {
          clearTimeout(timeoutId);
        }

        activeTimeouts.clear();
      };
    },
    stop() {
      for (const timeoutId of activeTimeouts) {
        clearTimeout(timeoutId);
      }

      activeTimeouts.clear();
    }
  };
}

export function createLivePitchTranscriptSource() {
  return {
    sourceType: PITCH_SOURCE_TYPES.LIVE_STT,
    start() {
      return () => {};
    },
    stop() {}
  };
}
