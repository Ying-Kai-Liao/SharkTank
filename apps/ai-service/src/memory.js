import { memoryObservationSchema } from "./validation.js";

function createNamespaceKey(namespace) {
  return [
    namespace.layer,
    namespace.sessionId,
    namespace.founderId,
    namespace.roundId ?? "shared",
    namespace.judgeId
  ].join(":");
}

export function createJudgeMemoryNamespaces({ roundId, sessionId, founderId, judgeId }) {
  return {
    round: {
      layer: "round",
      roundId,
      sessionId,
      founderId,
      judgeId
    },
    episodic: {
      layer: "episodic",
      roundId,
      sessionId,
      founderId,
      judgeId
    },
    persona: {
      layer: "persona",
      roundId: "persona",
      sessionId: "persona",
      founderId: "persona",
      judgeId
    }
  };
}

export function createRoundMemorySnapshot(request) {
  return Object.freeze({
    roundId: request.roundId,
    pitch: request.pitch,
    evaluation: structuredClone(request.evaluation),
    transcript: structuredClone(request.transcript)
  });
}

export class InMemoryJudgeMemoryStore {
  constructor(seed = {}) {
    this.episodicMemory = new Map(Object.entries(seed.episodicMemory ?? {}));
    this.personaMemory = new Map(Object.entries(seed.personaMemory ?? {}));
  }

  getPersona(namespace) {
    return structuredClone(this.personaMemory.get(createNamespaceKey(namespace)) ?? null);
  }

  setPersona(namespace, value) {
    this.personaMemory.set(createNamespaceKey(namespace), structuredClone(value));
  }

  listEpisodes(namespace) {
    return structuredClone(this.episodicMemory.get(createNamespaceKey(namespace)) ?? []);
  }

  appendEpisode(namespace, observation) {
    const safeObservation = memoryObservationSchema.parse(observation);
    const key = createNamespaceKey(namespace);
    const entries = this.episodicMemory.get(key) ?? [];
    const nextEntries = [...entries, structuredClone(safeObservation)].slice(-6);
    this.episodicMemory.set(key, nextEntries);
    return structuredClone(nextEntries);
  }
}
