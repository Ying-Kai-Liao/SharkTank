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

export function isSpeechRecognitionSupported() {
  return typeof window !== "undefined" &&
    (typeof window.SpeechRecognition === "function" ||
     typeof window.webkitSpeechRecognition === "function");
}

export function createLivePitchTranscriptSource() {
  let recognition = null;
  let sequence = 0;

  return {
    sourceType: PITCH_SOURCE_TYPES.LIVE_STT,
    start({ emitUpdate }) {
      if (!isSpeechRecognitionSupported()) {
        return () => {};
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            const text = result[0].transcript.trim();
            if (text) {
              const currentSequence = sequence++;
              emitUpdate({
                eventId: `live-${currentSequence}`,
                sequence: currentSequence,
                text,
                receivedAtMs: Date.now(),
                sourceType: PITCH_SOURCE_TYPES.LIVE_STT
              });
            }
          }
        }
      };

      recognition.onerror = () => {};

      recognition.onend = () => {
        if (recognition) {
          try {
            recognition.start();
          } catch {
            // Already started or stopped intentionally
          }
        }
      };

      recognition.start();

      return () => {
        const ref = recognition;
        recognition = null;
        sequence = 0;
        if (ref) {
          try { ref.stop(); } catch { /* already stopped */ }
        }
      };
    },
    stop() {
      const ref = recognition;
      recognition = null;
      sequence = 0;
      if (ref) {
        try { ref.stop(); } catch { /* already stopped */ }
      }
    }
  };
}
