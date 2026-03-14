import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { validateJudgeBundle } from "../../../packages/contracts/src/index.js";
import { buildRoundContext } from "./context.js";
import { createJudgeMemoryNamespaces, createRoundMemorySnapshot } from "./memory.js";
import { evaluateDiscussionNeed, shouldContinueDiscussion } from "./policy.js";
import { createFallbackJudgeDraft } from "./providers.js";
import {
  classifyProviderFailure,
  createConcurrencyLimiter,
  executeProviderOperation,
  getMinimumSuccessfulJudges,
  ProviderExecutionError
} from "./resilience.js";
import { discussionEntrySchema, memoryObservationSchema } from "./validation.js";

function mergeByJudgeId(current, update) {
  const next = [...current];

  for (const draft of update) {
    const index = next.findIndex((entry) => entry.judgeId === draft.judgeId);

    if (index === -1) {
      next.push(draft);
      continue;
    }

    next[index] = draft;
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
  providerDiagnostics: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),
  discussionDecision: Annotation(),
  discussionTurn: Annotation({
    default: () => 0
  }),
  discussionLog: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => []
  }),
  finalBundle: Annotation(),
  memoryWrites: Annotation({
    reducer: (current, update) => [...current, ...update],
    default: () => []
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
    discussionTurn: 0
  };
}

function routeAfterDrafts(state) {
  return state.discussionDecision.shouldDiscuss ? "discussion" : "finalize";
}

function routeAfterDiscussion(state) {
  return shouldContinueDiscussion(state.judgeDrafts, state.request.discussionPolicy, state.discussionTurn)
    ? "discussion"
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

async function executeRevisionWithResilience(state, { judge, draft, peerDrafts, turn }) {
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

async function discussionNode(state) {
  const nextTurn = state.discussionTurn + 1;
  const revisionResults = await Promise.all(
    state.request.judges.map((judge, index) => {
      const currentDraft = state.judgeDrafts.find((draft) => draft.judgeId === judge.id) ?? state.judgeDrafts[index];
      const peerDrafts = state.judgeDrafts.filter((draft) => draft.judgeId !== judge.id);

      if (!currentDraft) {
        throw new Error(`Missing draft for judge ${judge.id} before discussion.`);
      }

      return executeRevisionWithResilience(state, {
        judge,
        draft: currentDraft,
        peerDrafts,
        turn: nextTurn
      });
    })
  );
  const revisedDrafts = revisionResults.map((result) => result.draft);
  const discussionEntries = revisedDrafts.map((revisedDraft) =>
    discussionEntrySchema.parse({
      turn: nextTurn,
      speaker: revisedDraft.judgeName,
      summary: `${revisedDraft.judgeName} pressure-tests the panel around ${revisedDraft.concerns[0] ?? "risk"}.`
    })
  );

  return {
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

export function createJudgeOrchestrationGraph(judges) {
  const workflow = new StateGraph(graphState).addNode("build_context", buildContextNode);

  workflow.addEdge(START, "build_context");

  workflow
    .addNode("draft_judges", draftJudgesNode)
    .addNode("discussion_router", discussionRouterNode)
    .addNode("discussion", discussionNode)
    .addNode("finalize", finalizeNode)
    .addNode("persist_memory", persistMemoryNode)
    .addEdge("build_context", "draft_judges")
    .addEdge("draft_judges", "discussion_router")
    .addConditionalEdges("discussion_router", routeAfterDrafts, {
      discussion: "discussion",
      finalize: "finalize"
    })
    .addConditionalEdges("discussion", routeAfterDiscussion, {
      discussion: "discussion",
      finalize: "finalize"
    })
    .addEdge("finalize", "persist_memory")
    .addEdge("persist_memory", END);

  return workflow.compile();
}
