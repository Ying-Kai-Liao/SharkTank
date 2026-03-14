## Why

The current demo uses a short local countdown and does not treat pitch capture as a first-class round capability. A dedicated pitch-capture change is needed so timer behavior, transcript finalization, and STT/mock input can be implemented and tested independently before the rest of the panel loop is wired in.

## What Changes

- Add a timed pitch phase with configurable duration and explicit start/close behavior.
- Add contracts for pitch transcript updates and finalized pitch transcript output.
- Support both live STT input and local/mock transcript sources behind the same capture interface.
- Update the local demo round flow so pitch capture becomes a real phase rather than a UI-only countdown.

## Capabilities

### New Capabilities
- `timed-pitch-capture`: Captures a founder pitch within a configured timer window and produces a finalized transcript for downstream evaluation.

### Modified Capabilities
- `demo-core-loop`: Change the local demo flow so rounds begin with an explicit timed pitch-capture phase and finalized pitch transcript handling.

## Impact

- Affected code will likely include [apps/web](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/apps/web), [packages/contracts](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/packages/contracts), and [packages/game-engine](/C:/Users/lykev/OneDrive/Documents/Workspace/projects/SharkTank/packages/game-engine).
- New contracts will be needed for pitch timer state, transcript events, and finalized pitch payloads.
