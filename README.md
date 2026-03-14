# SharkTank

SharkTank is a web-based Shark Tank style game built as a monorepo with a clear split between UI, game state, and AI behavior.

## Architecture

- `Next.js` owns the web app, routing, game screens, and client interactions.
- `InsForge` owns auth, database records, sessions, transcripts, and realtime sync.
- `FastAPI` owns LLM-facing logic such as pitch analysis, shark personalities, response generation, and deal suggestions.

## Core Rule

The LLM does not own game truth.

AI can generate dialogue, judgments, and flavor. Backend and database systems own scores, rounds, timers, rules, and outcomes.

## Monorepo Shape

```text
apps/web
apps/ai-service
packages/contracts
packages/game-engine
infra/insforge
```

## Responsibility Split

```text
Next.js -> UI and player interactions
InsForge -> auth, persistence, realtime state sync
FastAPI -> AI analysis and shark responses
```
