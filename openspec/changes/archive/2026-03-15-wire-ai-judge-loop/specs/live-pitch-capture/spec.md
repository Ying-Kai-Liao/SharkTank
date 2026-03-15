## ADDED Requirements

### Requirement: Founder pitch is captured from live speech
The system SHALL use the Web Speech API to transcribe the founder's spoken pitch in real time and feed transcript updates into the existing pitch capture pipeline.

#### Scenario: Speech recognition emits transcript updates during pitch
- **WHEN** the pitch phase is active and the browser supports SpeechRecognition
- **THEN** each recognized speech segment is emitted as a transcript update through the existing `emitUpdate` callback with a unique `eventId`, incrementing `sequence`, and `sourceType` of `live_stt`

#### Scenario: Browser does not support speech recognition
- **WHEN** the pitch phase starts and `SpeechRecognition` is not available
- **THEN** the system falls back to the mock transcript source and logs a warning

### Requirement: Live speech adapter conforms to the existing source interface
The live speech transcript source SHALL implement the same `{ sourceType, start, stop }` interface as `createMockPitchTranscriptSource()` so it can be used interchangeably with `createPitchCaptureAdapter()`.

#### Scenario: Adapter is stopped mid-pitch
- **WHEN** `stop()` is called on the live source (manual close or timer expiry)
- **THEN** the SpeechRecognition instance stops listening and no further updates are emitted

### Requirement: Continuous listening during the pitch window
The live speech source SHALL listen continuously (not single-utterance) for the duration of the pitch timer so the founder can speak naturally without restarting recognition.

#### Scenario: Founder pauses and resumes speaking
- **WHEN** the founder pauses mid-sentence and resumes
- **THEN** recognition continues and new segments are emitted as additional transcript updates
