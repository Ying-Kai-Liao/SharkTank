import { createJudgeServiceInput } from "../../../packages/contracts/src/index.js";
import { loadAiServiceConfig, normalizeAiServiceConfig } from "./config.js";
import { createJudgeOrchestrationGraph, createJudgeReplanGraph } from "./graph.js";
import { InMemoryJudgeMemoryStore } from "./memory.js";
import { createJudgeProvider } from "./providers.js";

function buildResilienceDebug(result) {
  const diagnostics = result.providerDiagnostics ?? [];
  const exhaustedCalls = diagnostics
    .filter((entry) => entry.exhausted)
    .map((entry) => ({
      stage: entry.stage,
      turn: entry.turn,
      judgeId: entry.judgeId,
      judgeName: entry.judgeName,
      attempts: entry.attempts,
      fallbackUsed: entry.fallbackUsed,
      failures: entry.failures
    }));
  const stageCounts = diagnostics.reduce((counts, entry) => {
    counts[entry.stage] = (counts[entry.stage] ?? 0) + 1;
    return counts;
  }, {});

  return {
    minimumSuccessfulJudges: result.minimumSuccessfulJudges,
    successfulJudgeCount: result.successfulJudgeCount,
    retryAttempts: diagnostics.reduce((total, entry) => total + entry.retryCount, 0),
    fallbackCount: diagnostics.filter((entry) => entry.fallbackUsed).length,
    degraded: diagnostics.some((entry) => entry.fallbackUsed),
    exhaustedCalls,
    stageCounts,
    diagnostics
  };
}

export function createJudgeOrchestrationService(options = {}) {
  const config = normalizeAiServiceConfig(options.config ?? loadAiServiceConfig());
  const provider = options.provider ?? createJudgeProvider(config);
  const memoryStore = options.memoryStore ?? new InMemoryJudgeMemoryStore();

  return {
    async run(input, runOptions = {}) {
      const request = createJudgeServiceInput({
        ...input,
        discussionPolicy: {
          maxRounds: config.deliberationMaxRounds,
          disagreementThreshold: config.disagreementThreshold,
          minimumQuestionVariance: config.minimumQuestionVariance,
          maxPeerQueriesPerRound: config.maxPeerQueriesPerRound,
          maxPeerTargets: config.maxPeerTargets,
          ...(input?.discussionPolicy ?? {})
        }
      });
      const graph = createJudgeOrchestrationGraph();
      const result = await graph.invoke(
        {
          request,
          config,
          provider,
          memoryStore
        },
        {
          recursionLimit: Math.max(16, request.discussionPolicy.maxRounds * 6 + 10)
        }
      );

      if (runOptions.includeDebug) {
        const peerQueries = result.peerQueryLog ?? [];
        const usedPeerQueries = peerQueries.filter((entry) => entry.queryUsed);

        return {
          bundle: result.finalBundle,
          debug: {
            provider: provider.name,
            usedPlaceholderProvider: Boolean(provider.placeholder),
            discussionTriggered: result.discussionDecision.shouldDiscuss,
            deliberationTriggered: result.discussionDecision.shouldDiscuss,
            discussionReason: result.discussionDecision.reason,
            deliberationReason: result.discussionDecision.reason,
            disagreementScore: result.discussionDecision.disagreementScore,
            discussionTurns: result.discussionTurn,
            deliberationRounds: result.deliberationRound,
            discussionLog: result.discussionLog,
            deliberationLog: result.discussionLog,
            peerQueries,
            peerQueryCount: usedPeerQueries.length,
            toolUsage: {
              peerQueries: usedPeerQueries.length,
              maxPeerQueriesPerRound: request.discussionPolicy.maxPeerQueriesPerRound
            },
            memoryWrites: result.memoryWrites,
            resilience: buildResilienceDebug(result)
          }
        };
      }

      return result.finalBundle;
    },

    async replan(input, runOptions = {}) {
      const request = createJudgeServiceInput({
        ...input,
        discussionPolicy: {
          maxRounds: config.deliberationMaxRounds,
          disagreementThreshold: config.disagreementThreshold,
          minimumQuestionVariance: config.minimumQuestionVariance,
          maxPeerQueriesPerRound: config.maxPeerQueriesPerRound,
          maxPeerTargets: config.maxPeerTargets,
          ...(input?.discussionPolicy ?? {})
        }
      });
      const graph = createJudgeReplanGraph();
      const result = await graph.invoke(
        {
          request,
          config,
          provider,
          memoryStore,
          replanMode: true,
          turnNumber: request.turnNumber,
          founderActions: request.founderActions
        },
        {
          recursionLimit: Math.max(16, request.discussionPolicy.maxRounds * 6 + 10)
        }
      );

      if (runOptions.includeDebug) {
        return {
          turnIntents: result.turnIntents,
          debug: {
            provider: provider.name,
            usedPlaceholderProvider: Boolean(provider.placeholder),
            turnNumber: result.turnNumber,
            founderActions: result.founderActions,
            resilience: buildResilienceDebug(result)
          }
        };
      }

      return { turnIntents: result.turnIntents };
    }
  };
}

const defaultService = createJudgeOrchestrationService();

export async function orchestrateJudgePanel(input, runOptions) {
  return defaultService.run(input, runOptions);
}
