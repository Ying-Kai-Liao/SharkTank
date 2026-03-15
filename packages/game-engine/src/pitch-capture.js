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

export function createLivePitchTranscriptSource({
  transcribeEndpoint = "/api/transcribe",
  chunkIntervalMs = 3_000
} = {}) {
  let mediaRecorder = null;
  let stream = null;
  let chunkTimer = null;
  let sequence = 0;
  let stopped = false;

  function releaseStream() {
    if (stream) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
      stream = null;
    }
  }

  function stopRecorder() {
    stopped = true;

    if (chunkTimer !== null) {
      clearInterval(chunkTimer);
      chunkTimer = null;
    }

    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try {
        mediaRecorder.stop();
      } catch {
        // Recorder may already be inactive.
      }
    }

    mediaRecorder = null;
    releaseStream();
  }

  return {
    sourceType: PITCH_SOURCE_TYPES.LIVE_STT,

    start({ emitUpdate, startedAtMs = Date.now() }) {
      stopped = false;
      sequence = 0;

      async function beginCapture() {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          // Microphone permission denied or unavailable -- emit an error
          // indicator so the UI can respond, but do not crash the game loop.
          emitUpdate({
            eventId: "live-mic-error",
            sequence: 0,
            text: "[microphone unavailable]",
            receivedAtMs: Date.now(),
            sourceType: PITCH_SOURCE_TYPES.LIVE_STT
          });
          return;
        }

        if (stopped) {
          releaseStream();
          return;
        }

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        mediaRecorder = new MediaRecorder(stream, { mimeType });
        let chunks = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          if (!chunks.length) {
            return;
          }

          const blob = new Blob(chunks, { type: mimeType });
          chunks = [];

          const currentSequence = sequence++;
          const formData = new FormData();
          formData.append("audio", blob, `chunk-${currentSequence}.webm`);
          formData.append("sequence", String(currentSequence));

          try {
            const response = await fetch(transcribeEndpoint, {
              method: "POST",
              body: formData
            });

            if (!response.ok) {
              return;
            }

            const payload = await response.json();
            const text = (payload.text || "").trim();

            if (!text) {
              return;
            }

            emitUpdate({
              eventId: `live-${currentSequence}`,
              sequence: currentSequence,
              text,
              receivedAtMs: Date.now(),
              sourceType: PITCH_SOURCE_TYPES.LIVE_STT
            });
          } catch {
            // Network error -- silently skip this chunk.
          }
        };

        mediaRecorder.start();

        // Split recording into chunks at the configured interval.
        chunkTimer = setInterval(() => {
          if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop();
            // Restart recording for the next chunk.
            try {
              mediaRecorder.start();
            } catch {
              // Stream may have been released.
            }
          }
        }, chunkIntervalMs);
      }

      beginCapture();

      return () => {
        stopRecorder();
      };
    },

    stop() {
      stopRecorder();
    }
  };
}
