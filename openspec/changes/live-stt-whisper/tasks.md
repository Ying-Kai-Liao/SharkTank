## 1. Server-Side Transcription Endpoint

- [x] 1.1 Add `openai` dependency to `apps/web/package.json`
- [x] 1.2 Create `/api/transcribe` route that accepts audio file via FormData, calls OpenAI Whisper (`whisper-1`), and returns `{ text, sequence }`
- [x] 1.3 Handle error cases: missing API key (500), invalid/missing audio (400), Whisper API errors (502)

## 2. Browser Audio Capture

- [x] 2.1 Implement `createLivePitchTranscriptSource({ transcribeEndpoint, chunkIntervalMs })` in `packages/game-engine/src/pitch-capture.js` using MediaRecorder + getUserMedia
- [x] 2.2 Record audio as `audio/webm;codecs=opus`, split into ~3s chunks, POST each to the transcribe endpoint
- [x] 2.3 Emit transcript updates via `emitUpdate` matching `isPitchTranscriptUpdateShape`, skip empty text
- [x] 2.4 Handle microphone permission denial gracefully (emit error indicator, don't crash game loop)
- [x] 2.5 Stop MediaRecorder and release audio tracks on `stop()`

## 3. UI Source Selection

- [x] 3.1 Add source toggle (Mock / Live Microphone) to the intro screen in `apps/web/app/page.jsx`
- [x] 3.2 Wire `handleStart()` to use the selected source factory and pass the correct `sourceType` to the pitch start action
- [x] 3.3 Disable live STT option with tooltip when MediaRecorder is unavailable

## 4. Integration & Testing

- [x] 4.1 Verify live source conforms to PitchCaptureAdapter interface
- [x] 4.2 Verify `/api/transcribe` returns correct shape for all error paths
- [x] 4.3 Verify UI toggle correctly switches between mock and live sources
