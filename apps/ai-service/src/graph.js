import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { validateJudgeBundle } from "../../../packages/contracts/src/index.js";
import { buildRoundContext } from "./context.js";
import { createJudgeToolRegistry } from "./judges.js";
import { createJudgeMemoryNamespaces, createRoundMemorySnapshot } from "./memory.js";
import { evaluateDiscussionNeed, shouldContinueDiscussion } from "./policy.js";
import {
  createFallbackJudgeDraft,
  createFallbackPeerConsultation,
  createNoopPeerConsultation
} from "./providers.js";
import {
  classifyProviderFailure,
  createConcurrencyLimiter,
  executeProviderOperation,
  getMinimumSuccessfulJudges,
  ProviderExecutionError
} from "./resilience.js";
import {
  discussionEntrySchema,
  judgeTurnIntentSchema,
  memoryObservationSchema,
  peerQueryLogEntrySchema
} from "./validation.js";

function mergeByJudgeId(current, update) {
  const next = [...current];

  for (const item of update) {
    const index = next.findIndex((entry) => entry.judgeId === item.judgeId);

    if (index === -1) {
      next.push(item);
      continue;
    }

    next[index] = item;
  }

  return next;
}

const graphState = Annotation.Root({
  request: Annotation(),
  config: Annotation(),
  provider: Annotation(),
  providerLimiter: Annotation(),
  memoryStore: Annotation(),
  memoryNamespaces: Annotation(),
  roundMemory: Annotation(),
  context: Annotation(),
  minimumSuccessfulJudges: Annotation({
    default: () => 0
  }),
  successfulJudgeCount: Annotation({
    default: () => 0
  }),
  judgeDrafts: Annotation({
    reducer: mergeByJudgeId,
    default: () => []
  }),
  peerConsultations: Annotation({
    reducer: mergeByJudgeId,
    default: () => []
  }),
  providerDiagnostics: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),
  discussionDecision: Annotation(),
  deliberationRound: Annotation({
    default: () => 0
  }),
  discussionTurn: Annotation({
    default: () => 0
  }),
  discussionLog: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),
  peerQueryLog: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),
  finalBundle: Annotation(),
  memoryWrites: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),
  replanMode: Annotation({
    default: () => false
  }),
  turnIntents: Annotation({
    reducer: mergeByJudgeId,
    default: () => []
  }),
  founderActions: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),
  turnNumber: Annotation({
    default: () => 0
  })
});

async function buildContextNode(state) {
  const memoryNamespaces = Object.fromEntries(
    state.request.judges.map((judge) => [
      judge.id,
      createJudgeMemoryNamespaces({
        roundId: state.request.roundId,
        sessionId: state.request.sessionId,
        founderId: state.request.founderId,
        judgeId: judge.id
      })
    ])
  );

  return {
    memoryNamespaces,
    providerLimiter: createConcurrencyLimiter(state.config.providerMaxConcurrency),
    roundMemory: createRoundMemorySnapshot(state.request),
    context: buildRoundContext(state.request),
    minimumSuccessfulJudges: getMinimumSuccessfulJudges(
      state.request.judges.length,
      state.config.providerMinimumSuccessRatio
    ),
    deliberationRound: 0,
    discussionTurn: 0
  };
}

function routeAfterDrafts(state) {
  return state.discussionDecision.shouldDiscuss && state.request.discussionPolicy.maxRounds > 0
    ? "peer_consultation"
    : "finalize";
}

function routeAfterDeliberation(state) {
  return shouldContinueDiscussion(state.judgeDrafts, state.request.discussionPolicy, state.deliberationRound)
    ? "peer_consultation"
    : "finalize";
}

async function discussionRouterNode(state) {
  return {
    discussionDecision: evaluateDiscussionNeed(state.judgeDrafts, state.request.discussionPolicy)
  };
}

function buildProviderMetadata({ stage, judge, turn = 0 }) {
  return {
    stage,
    turn,
    judgeId: judge.id,
    judgeName: judge.name
  };
}

function getRetryPolicy(config) {
  return {
    maxAttempts: config.providerRetryAttempts,
    baseBackoffMs: config.providerRetryBaseBackoffMs,
    jitterMs: config.providerRetryJitterMs,
    maxBackoffMs: config.providerRetryMaxBackoffMs
  };
}

function buildFallbackDiagnostics(error, metadata) {
  if (error instanceof ProviderExecutionError) {
    return {
      ...error.diagnostics,
      fallbackUsed: true
    };
  }

  return {
    ...metadata,
    attempts: 1,
    retryCount: 0,
    backoffMs: [],
    exhausted: true,
    fallbackUsed: true,
    failures: [
      {
        attempt: 1,
        ...classifyProviderFailure(error)
      }
    ]
  };
}

function createJudgeMemoryView(state, judge) {
  const namespaces = state.memoryNamespaces[judge.id];

  return {
    persona: state.memoryStore.getPersona(namespaces.persona),
    episodic: state.memoryStore.listEpisodes(namespaces.episodic)
  };
}

async function executeDraftWithResilience(state, judge) {
  const metadata = buildProviderMetadata({
    stage: "draft",
    judge
  });

  try {
    const result = await executeProviderOperation({
      limiter: state.providerLimiter,
      operation: () =>
        state.provider.generateJudgeDraft({
          judge,
          context: state.context,
          memoryStore: state.memoryStore,
          request: {
            ...state.request,
            memoryNamespaces: state.memoryNamespaces
          }
        }),
      retryPolicy: getRetryPolicy(state.config),
      metadata
    });

    return {
      draft: result.value,
      diagnostic: result.diagnostics
    };
  } catch (error) {
    return {
      draft: createFallbackJudgeDraft({
        judge,
        context: state.context
      }),
      diagnostic: buildFallbackDiagnostics(error, metadata)
    };
  }
}

async function executePeerConsultationWithResilience(state, { judge, draft, peerDrafts, turn }) {
  const metadata = buildProviderMetadata({
    stage: "peer_consultation",
    judge,
    turn
  });
  const memoryView = createJudgeMemoryView(state, judge);
  const toolRegistry = createJudgeToolRegistry({
    judge,
    context: state.context,
    memoryView,
    peerAgentContext: {
      peerDrafts,
      maxQueriesPerRound: state.request.discussionPolicy.maxPeerQueriesPerRound,
      maxPeerTargets: Math.min(state.request.discussionPolicy.maxPeerTargets, Math.max(1, peerDrafts.length))
    }
  });

  try {
    const result = await executeProviderOperation({
      limiter: state.providerLimiter,
      operation: () =>
        state.provider.queryPeerAgents
          ? state.provider.queryPeerAgents({
              judge,
              draft,
              peerDrafts,
              turn,
              toolRegistry,
              policy: state.request.discussionPolicy
            })
          : createNoopPeerConsultation({ judge, turn }),
      retryPolicy: getRetryPolicy(state.config),
      metadata
    });

    return {
      consultation: result.value,
      diagnostic: result.diagnostics
    };
  } catch (error) {
    return {
      consultation: createFallbackPeerConsultation({
        judge,
        turn
      }),
      diagnostic: buildFallbackDiagnostics(error, metadata)
    };
  }
}

async function executeRevisionWithResilience(state, { judge, draft, peerDrafts, peerConsultation, turn }) {
  const metadata = buildProviderMetadata({
    stage: "discussion",
    judge,
    turn
  });

  try {
    const result = await executeProviderOperation({
      limiter: state.providerLimiter,
      operation: () =>
        state.provider.reviseJudgeDraft({
          judge,
          draft,
          peerDrafts,
          peerConsultation,
          turn
        }),
      retryPolicy: getRetryPolicy(state.config),
      metadata
    });

    return {
      draft: result.value,
      diagnostic: result.diagnostics
    };
  } catch (error) {
    return {
      draft: createFallbackJudgeDraft({
        judge,
        context: state.context,
        draft
      }),
      diagnostic: buildFallbackDiagnostics(error, metadata)
    };
  }
}

async function draftJudgesNode(state) {
  const draftResults = await Promise.all(state.request.judges.map((judge) => executeDraftWithResilience(state, judge)));
  const successfulJudgeCount = draftResults.filter((result) => !result.diagnostic.fallbackUsed).length;

  if (successfulJudgeCount < state.minimumSuccessfulJudges) {
    throw new Error(
      `Judge orchestration fell below the minimum viable panel threshold (${successfulJudgeCount}/${state.minimumSuccessfulJudges} live completions).`
    );
  }

  return {
    successfulJudgeCount,
    judgeDrafts: draftResults.map((result) => result.draft),
    providerDiagnostics: draftResults.map((result) => result.diagnostic)
  };
}

async function peerConsultationNode(state) {
  const nextTurn = state.deliberationRound + 1;
  const consultationResults = await Promise.all(
    state.request.judges.map((judge, index) => {
      const currentDraft = state.judgeDrafts.find((draft) => draft.judgeId === judge.id) ?? state.judgeDrafts[index];
      const peerDrafts = state.judgeDrafts.filter((draft) => draft.judgeId !== judge.id);

      if (!currentDraft) {
        throw new Error(`Missing draft for judge ${judge.id} before deliberation.`);
      }

      return executePeerConsultationWithResilience(state, {
        judge,
        draft: currentDraft,
        peerDrafts,
        turn: nextTurn
      });
    })
  );

  return {
    peerConsultations: consultationResults.map((result) => result.consultation),
    peerQueryLog: consultationResults.map((result) =>
      peerQueryLogEntrySchema.parse({
        turn: result.consultation.turn,
        judgeId: result.consultation.judgeId,
        judgeName: result.consultation.judgeName,
        queryUsed: result.consultation.queryUsed,
        question: result.consultation.question,
        targetJudgeIds: result.consultation.targetJudgeIds,
        responseCount: result.consultation.responses.length,
        reason: result.consultation.reason
      })
    ),
    providerDiagnostics: consultationResults.map((result) => result.diagnostic)
  };
}

async function deliberationNode(state) {
  const nextTurn = state.deliberationRound + 1;
  const revisionResults = await Promise.all(
    state.request.judges.map((judge, index) => {
      const currentDraft = state.judgeDrafts.find((draft) => draft.judgeId === judge.id) ?? state.judgeDrafts[index];
      const peerDrafts = state.judgeDrafts.filter((draft) => draft.judgeId !== judge.id);
      const peerConsultation =
        state.peerConsultations.find((consultation) => consultation.judgeId === judge.id) ??
        createNoopPeerConsultation({ judge, turn: nextTurn });

      if (!currentDraft) {
        throw new Error(`Missing draft for judge ${judge.id} before discussion.`);
      }

      return executeRevisionWithResilience(state, {
        judge,
        draft: currentDraft,
        peerDrafts,
        peerConsultation,
        turn: nextTurn
      });
    })
  );
  const revisedDrafts = revisionResults.map((result) => result.draft);
  const discussionEntries = revisedDrafts.map((revisedDraft) => {
    const consultation = state.peerConsultations.find((entry) => entry.judgeId === revisedDraft.judgeId);
    const consultationSummary =
      consultation?.queryUsed && consultation.responses.length
        ? ` after consulting ${consultation.responses.map((response) => response.judgeName).join(", ")}`
        : "";

    return discussionEntrySchema.parse({
      turn: nextTurn,
      speaker: revisedDraft.judgeName,
      summary: `${revisedDraft.judgeName} pressure-tests the panel${consultationSummary} around ${
        revisedDraft.concerns[0] ?? "risk"
      }.`
    });
  });

  return {
    deliberationRound: nextTurn,
    discussionTurn: nextTurn,
    judgeDrafts: revisedDrafts,
    discussionLog: discussionEntries,
    providerDiagnostics: revisionResults.map((result) => result.diagnostic)
  };
}

async function finalizeNode(state) {
  const sortedDrafts = [...state.judgeDrafts].sort((left, right) => right.score - left.score);
  const leadQuestion = sortedDrafts[0]?.question ?? state.judgeDrafts[0]?.question ?? "";
  const finalBundle = {
    judgeResponses: sortedDrafts.map((draft) => ({
      judgeId: draft.judgeId,
      judgeName: draft.judgeName,
      sentiment: draft.sentiment,
      shortReaction: draft.shortReaction,
      question: draft.question,
      rationaleTags: draft.rationaleTags
    })),
    leadQuestion
  };

  validateJudgeBundle(finalBundle);

  return {
    finalBundle
  };
}

async function persistMemoryNode(state) {
  const writes = state.judgeDrafts.map((draft) => {
    const observation = memoryObservationSchema.parse({
      judgeId: draft.judgeId,
      sentiment: draft.sentiment,
      concern: draft.concerns[0] ?? "follow_up",
      question: draft.question,
      rationaleTags: draft.rationaleTags
    });

    state.memoryStore.appendEpisode(state.memoryNamespaces[draft.judgeId].episodic, observation);
    return observation;
  });

  return {
    memoryWrites: writes
  };
}

function deriveIntentFromDraft(draft) {
  if (draft.score <= 30) {
    return "drop_out";
  }

  if (draft.question && draft.question.trim().length > 0 && draft.score <= 60) {
    return "ask";
  }

  if (draft.score > 70) {
    return "offer";
  }

  if (draft.concerns.length === 0 && draft.score > 50) {
    return "support";
  }

  if (draft.concerns.length > 0) {
    return "revise";
  }

  return "wait";
}

function mapIntentToStatus(intent) {
  const mapping = {
    ask: "active",
    wait: "waiting",
    offer: "offering",
    revise: "evaluating",
    support: "supportive",
    drop_out: "out"
  };

  return mapping[intent] ?? "evaluating";
}

async function replanJudgesNode(state) {
  const replanResults = await Promise.all(
    state.request.judges.map(async (judge) => {
      const existingDraft = state.judgeDrafts.find((draft) => draft.judgeId === judge.id);

      if (!existingDraft) {
        const result = await executeDraftWithResilience(state, judge);
        const intent = deriveIntentFromDraft(result.draft);
        const status = mapIntentToStatus(intent);

        return {
          draft: result.draft,
          intent: {
            judgeId: judge.id,
            judgeName: judge.name,
            intent,
            status,
            dialogue: result.draft.shortReaction,
            question: result.draft.question,
            rationaleTags: result.draft.rationaleTags,
            score: result.draft.score,
            confidence: result.draft.confidence,
            concerns: result.draft.concerns
          },
          diagnostic: result.diagnostic
        };
      }

      const metadata = buildProviderMetadata({ stage: "replan", judge });

      try {
        const result = await executeProviderOperation({
          limiter: state.providerLimiter,
          operation: () =>
            state.provider.generateJudgeDraft({
              judge,
              context: state.context,
              memoryStore: state.memoryStore,
              request: {
                ...state.request,
                founderActions: state.founderActions,
                turnNumber: state.turnNumber,
                memoryNamespaces: state.memoryNamespaces
              }
            }),
          retryPolicy: getRetryPolicy(state.config),
          metadata
        });

        const updatedDraft = result.value;
        const intent = deriveIntentFromDraft(updatedDraft);
        const status = mapIntentToStatus(intent);

        return {
          draft: updatedDraft,
          intent: {
            judgeId: judge.id,
            judgeName: judge.name,
            intent,
            status,
            dialogue: updatedDraft.shortReaction,
            question: updatedDraft.question,
            rationaleTags: updatedDraft.rationaleTags,
            score: updatedDraft.score,
            confidence: updatedDraft.confidence,
            concerns: updatedDraft.concerns
          },
          diagnostic: result.diagnostics
        };
      } catch (error) {
        const intent = deriveIntentFromDraft(existingDraft);
        const status = mapIntentToStatus(intent);

        return {
          draft: existingDraft,
          intent: {
            judgeId: judge.id,
            judgeName: judge.name,
            intent,
            status,
            dialogue: existingDraft.shortReaction,
            question: existingDraft.question,
            rationaleTags: existingDraft.rationaleTags,
            score: existingDraft.score,
            confidence: existingDraft.confidence,
            concerns: existingDraft.concerns
          },
          diagnostic: buildFallbackDiagnostics(error, metadata)
        };
      }
    })
  );

  return {
    judgeDrafts: replanResults.map((result) => result.draft),
    turnIntents: replanResults.map((result) => result.intent),
    providerDiagnostics: replanResults.map((result) => result.diagnostic)
  };
}

async function finalizeTurnIntentsNode(state) {
  const validated = state.turnIntents.map((intent) => judgeTurnIntentSchema.parse(intent));

  return {
    turnIntents: validated
  };
}

function routeAfterBuildContext(state) {
  return state.replanMode ? "replan_judges" : "draft_judges";
}

function routeAfterReplan(state) {
  const hasDisagreement = evaluateDiscussionNeed(state.judgeDrafts, state.request.discussionPolicy);

  if (hasDisagreement.shouldDiscuss && state.request.discussionPolicy.maxRounds > 0) {
    return "peer_consultation";
  }

  return "finalize_turn_intents";
}

export function createJudgeOrchestrationGraph() {
  const workflow = new StateGraph(graphState).addNode("build_context", buildContextNode);

  workflow.addEdge(START, "build_context");

  workflow
    .addNode("draft_judges", draftJudgesNode)
    .addNode("discussion_router", discussionRouterNode)
    .addNode("peer_consultation", peerConsultationNode)
    .addNode("deliberation", deliberationNode)
    .addNode("finalize", finalizeNode)
    .addNode("persist_memory", persistMemoryNode)
    .addEdge("build_context", "draft_judges")
    .addEdge("draft_judges", "discussion_router")
    .addConditionalEdges("discussion_router", routeAfterDrafts, {
      peer_consultation: "peer_consultation",
      finalize: "finalize"
    })
    .addEdge("peer_consultation", "deliberation")
    .addConditionalEdges("deliberation", routeAfterDeliberation, {
      peer_consultation: "peer_consultation",
      finalize: "finalize"
    })
    .addEdge("finalize", "persist_memory")
    .addEdge("persist_memory", END);

  return workflow.compile();
}

export function createJudgeReplanGraph() {
  const workflow = new StateGraph(graphState).addNode("build_context", buildContextNode);

  workflow.addEdge(START, "build_context");

  workflow
    .addNode("replan_judges", replanJudgesNode)
    .addNode("peer_consultation", peerConsultationNode)
    .addNode("deliberation", deliberationNode)
    .addNode("finalize_turn_intents", finalizeTurnIntentsNode)
    .addNode("persist_memory", persistMemoryNode)
    .addConditionalEdges("build_context", routeAfterBuildContext, {
      replan_judges: "replan_judges",
      draft_judges: "build_context"
    })
    .addConditionalEdges("replan_judges", routeAfterReplan, {
      peer_consultation: "peer_consultation",
      finalize_turn_intents: "finalize_turn_intents"
    })
    .addEdge("peer_consultation", "deliberation")
    .addConditionalEdges("deliberation", routeAfterDeliberation, {
      peer_consultation: "peer_consultation",
      finalize: "finalize_turn_intents"
    })
    .addEdge("finalize_turn_intents", "persist_memory")
    .addEdge("persist_memory", END);

  return workflow.compile();
}
