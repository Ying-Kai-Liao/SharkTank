## 1. Planning Contracts

- [ ] 1.1 Define shared contract types for per-turn judge intents and visible judge statuses
- [ ] 1.2 Extend AI-service input/output validation to accept repeated round context for later planning turns

## 2. AI-Service Replanning

- [ ] 2.1 Extend the judge orchestration entry points to re-plan after founder actions during an active round
- [ ] 2.2 Reuse bounded peer consultation during eligible replanning turns without enabling recursive loops
- [ ] 2.3 Emit status and intent together from each planning step so downstream consumers can render panel state consistently

## 3. Tests And Integration

- [ ] 3.1 Add orchestration tests for mixed judge intents, repeated planning after founder actions, and bounded deliberation
- [ ] 3.2 Preserve the current one-shot bundle path as a fallback until repeated planning is wired into the round flow
- [ ] 3.3 Add fixtures for active, waiting, supportive, offering, and dropped-out judge states
