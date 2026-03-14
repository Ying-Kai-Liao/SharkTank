# SharkTank

SharkTank is a web-based Shark Tank style game built as a monorepo with a clear split between UI, deterministic game state, and AI-generated dialogue.

## Current Direction

The near-term goal is to build a practical MVP first and leave richer "fun" layers for later.

That means the first version should optimize for:

- a playable end-to-end round
- clear system boundaries
- deterministic game outcomes
- structured AI outputs instead of freeform game logic

The first version should not prioritize:

- voice input or output
- facial expressions or animation-driven logic
- long-term judge memory
- judge-to-judge discussion loops
- complex social or party-game behavior

## Core Rule

The LLM does not own game truth.

AI can generate dialogue, sentiment, and follow-up questions. The game engine and backend own scores, rounds, timers, transitions, rules, and outcomes.

## Architecture

- `Next.js` owns the web app, routing, game screens, and player interactions.
- `InsForge` owns auth, persistence, sessions, transcripts, and realtime sync.
- `FastAPI` owns LLM-facing logic such as pitch analysis, judge dialogue generation, and structured response suggestions.
- `packages/game-engine` owns deterministic round flow, scoring, timers, legal actions, and deal logic.

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
FastAPI -> AI analysis and judge dialogue
Game Engine -> rules, timers, scores, outcomes
```

## System Visualization

```text
                              +----------------------+
                              |      Player UI       |
                              |      Next.js         |
                              +----------+-----------+
                                         |
                                         | player actions
                                         v
                    +-------------------------------------------+
                    |        Server Orchestration Layer         |
                    | validate action, load state, apply rules  |
                    +-------------------+-----------------------+
                                        |
                  +---------------------+---------------------+
                  |                                           |
                  v                                           v
      +---------------------------+              +---------------------------+
      | packages/game-engine      |              |    apps/ai-service        |
      | deterministic authority   |              |   dialogue + analysis     |
      | states, timers, scoring   |              | structured suggestions    |
      +-------------+-------------+              +-------------+-------------+
                    |                                            ^
                    | canonical state + events                   |
                    v                                            |
      +---------------------------------------------------------------+
      |                        infra/insforge                         |
      | auth, persistence, session records, transcripts, realtime    |
      +-----------------------------+---------------------------------+
                                    |
                                    | synced session state
                                    v
                              +-----+------+
                              |  Clients    |
                              | players /   |
                              | spectators  |
                              +------------+
```

Rule of thumb:

- `game-engine` decides what is true
- `ai-service` decides how it sounds
- `insforge` stores and distributes the result

## Practical MVP Loop

The first playable slice should be:

```text
PITCH
  -> ENGINE EVALUATION
  -> JUDGE REACTIONS
  -> FOLLOW-UP QUESTION
  -> PLAYER ANSWER
  -> DEAL OFFERS
  -> PLAYER DECISION
  -> ROUND RESULT
```

This keeps the product focused on a real loop instead of spreading effort across voice, presentation polish, and advanced AI behavior too early.

## Authoritative Game Loop

The game should be modeled as a state machine.

```text
  +--------+      +-----------------+      +-----------------+
  | LOBBY  | ---> | PITCH_SUBMITTED | ---> | JUDGE_REACTIONS |
  +--------+      +-----------------+      +-----------------+
                                                 |
                                                 v
                                         +---------------+
                                         |   FOLLOW_UP   |
                                         +-------+-------+
                                                 |
                                                 v
                                         +---------------+
                                         |     DEALS     |
                                         +-------+-------+
                                                 |
                                                 v
                                         +---------------+
                                         |PLAYER_DECISION|
                                         +-------+-------+
                                                 |
                                                 v
                                         +---------------+
                                         | ROUND_RESULT  |
                                         +---------------+
```

Legal player actions for MVP:

- `submit_pitch`
- `submit_answer`
- `accept_deal`
- `reject_deal`
- `advance_when_timer_expires`

## Evaluation Model

The engine should evaluate a small deterministic rubric first:

- `clarity`
- `confidence`
- `originality`
- `business_viability`

Judges can then weight those dimensions differently while still staying deterministic at the rules layer.

Example:

- Judge 1 favors `confidence`
- Judge 2 favors `business_viability`
- Judge 3 favors `originality`

## AI Contract

The AI service should return structured data that the game engine can safely consume.

Example response shape:

```text
sentiment: skeptical | interested | impressed
short_reaction: string
question: string
rationale_tags: [unclear_market, strong_confidence, weak_monetization]
```

AI may suggest flavor and analysis, but it must not directly decide score changes, state transitions, or outcomes.

## Build Order

Recommended implementation order:

1. Scaffold the monorepo layout.
2. Define shared contracts.
3. Build the deterministic game engine as a pure package.
4. Add persistence for sessions, rounds, transcripts, offers, and score snapshots.
5. Add a server-side orchestration path that applies actions and calls AI only when needed.
6. Build a minimal web UI for a single playable round.
7. Add realtime sync after the single-user loop works.

## Whiteboard Flow

This is the cleaned-up version of the original sketch, aligned to MVP scope.

```text
 +------------------+
 |  Player submits  |
 |      pitch       |
 +--------+---------+
          |
          v
 +------------------+
 |  Game engine     |
 | scores rubric    |
 | clarity          |
 | confidence       |
 | originality      |
 | viability        |
 +--------+---------+
          |
          | structured context
          v
 +------------------+
 |   AI service     |
 | generates:       |
 | - judge reaction |
 | - follow-up Q    |
 | - rationale tags |
 +--------+---------+
          |
          v
 +------------------+
 |   Player reply   |
 +--------+---------+
          |
          v
 +------------------+
 |  Game engine     |
 | decides offers   |
 | and legal moves  |
 +--------+---------+
          |
          v
 +------------------+
 | accept / reject  |
 | round result     |
 +------------------+
```
