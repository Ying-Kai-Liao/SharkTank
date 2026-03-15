# live-judge-stage-reactions Specification

## Purpose
TBD - created by archiving change live-judge-stage-reactions. Update Purpose after archive.

## Requirements
### Requirement: Realtime stage reactions during the pitch
The system SHALL generate live judge reaction cues during the active pitch window based on the in-progress pitch context.

#### Scenario: Judges react while the founder is speaking
- **WHEN** the pitch is active and transcript context is available
- **THEN** the system produces reaction cues for one or more judges without waiting for the pitch to end

### Requirement: Reaction cues support expressive presence states
The system SHALL support stage-facing reaction cues that can represent understanding, confusion, skepticism, engagement, or other presentation-safe judge presence states.

#### Scenario: Reaction cue maps to expressive presence
- **WHEN** a live judge reaction is emitted during the pitch
- **THEN** the reaction includes a structured presence signal that the frontend can render as an expression, posture change, or mocked equivalent

### Requirement: Reactions remain non-authoritative
Live judge reaction cues SHALL affect presentation only and SHALL NOT change deterministic scores, legal transitions, offer validity, or round closure.

#### Scenario: Live confusion cue does not change game truth
- **WHEN** a judge emits a skeptical or confused live reaction during the pitch
- **THEN** the system may update the UI to reflect that reaction but does not alter deterministic round state from that cue alone

### Requirement: Source-flexible reaction generation
The system SHALL support either mocked live reactions or provider-backed realtime reactions through the same reaction event contract.

#### Scenario: Mock reaction provider can substitute for realtime generation
- **WHEN** the local demo runs without a realtime provider
- **THEN** the system still emits valid live judge reaction events that the frontend can render
