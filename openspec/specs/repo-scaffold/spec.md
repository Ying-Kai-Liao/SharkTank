# repo-scaffold Specification

## Purpose
TBD - created by archiving change scaffold-demo-core-loop. Update Purpose after archive.
## Requirements
### Requirement: Monorepo folder scaffold
The repository SHALL include the planned top-level monorepo directories `apps/web`, `apps/ai-service`, `packages/contracts`, `packages/game-engine`, and `infra/insforge`.

#### Scenario: Planned folders exist
- **WHEN** a contributor inspects the repository after the change is applied
- **THEN** the planned monorepo directories are present at the documented top-level paths

### Requirement: Initial implementation focus
The repository SHALL make the first implementation path explicit by placing working demo code only where it is required for the local-first demo and leaving future services as placeholders until later changes.

#### Scenario: Working code is limited to MVP packages
- **WHEN** a contributor inspects the scaffolded repository
- **THEN** the first implementation work is centered in `apps/web`, `packages/contracts`, and `packages/game-engine`

#### Scenario: Future service placeholders are explicit
- **WHEN** a contributor inspects `apps/ai-service` or `infra/insforge`
- **THEN** the repository makes clear that those locations are reserved for later implementation rather than already functional services

### Requirement: Scaffold supports future extraction
The repository SHALL organize demo code so that AI and infrastructure concerns can later be extracted into dedicated services without changing the authoritative role of the game engine.

#### Scenario: Shared boundaries are preserved
- **WHEN** the demo uses judge output or engine state
- **THEN** the repository structure preserves shared contracts and engine ownership boundaries needed for future service separation

