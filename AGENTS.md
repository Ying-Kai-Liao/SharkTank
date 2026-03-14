# Repository Guidelines

## Project Structure & Module Organization

This repository is currently a bootstrap with architecture and OpenSpec metadata only. The intended monorepo layout is:

- `apps/web` for the Next.js game UI
- `apps/ai-service` for the FastAPI LLM service
- `packages/contracts` for shared request/response schemas
- `packages/game-engine` for deterministic game rules and scoring
- `infra/insforge` for auth, database, and realtime infrastructure
- `openspec/` for change proposals, designs, and specs

Keep the LLM out of core game truth. Dialogue can be AI-generated; rounds, timers, scores, and outcomes must stay deterministic.
Treat `openspec/` as the development documentation source of truth across the repository. Capture proposed changes, design decisions, scope updates, and implementation tasks there rather than scattering them across ad hoc notes.

## Build, Test, and Development Commands

No application build or test scripts are committed yet. Until scaffolding lands:

- `git status` checks local changes before and after work
- `git checkout -b <branch-name>` starts work when you are on `main`
- `git log --oneline` reviews recent commit history

When app code is added, expose repo-level scripts instead of requiring contributors to guess per-package commands.

## Coding Style & Naming Conventions

Use clear, small modules and keep shared logic in `packages/` instead of duplicating it across services. Prefer:

- TypeScript for web and shared contracts
- Python for AI-service logic
- kebab-case for directories and branch names
- imperative, concise commit subjects

Document any formatter or linter in the root config once introduced.

## Testing Guidelines

Add tests alongside the code they verify. Favor fast, deterministic tests for `packages/game-engine` and contract validation before adding end-to-end coverage. Name tests after behavior, for example `pitch-round-completes-on-timer`.

## Commit & Pull Request Guidelines

If you are on `main`, create a new branch before making changes. Keep commits focused and use short imperative subjects, consistent with the current history, for example `Add architecture overview`.

PRs should include:

- a short summary of the change
- linked issue or spec/change name when applicable
- screenshots for UI work
- notes on testing performed

## Security & Configuration Tips

Do not commit local agent folders or generated skill files. Keep secrets in `.env` files only, and never let AI output become the source of truth for gameplay state.
