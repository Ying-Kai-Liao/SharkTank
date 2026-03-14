import { createJudgeServiceInput } from "../../../packages/contracts/src/index.js";
import { loadAiServiceConfig } from "./config.js";
import { createJudgeOrchestrationGraph } from "./graph.js";
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

  return {
    minimumSuccessfulJudges: result.minimumSuccessfulJudges,
    successfulJudgeCount: result.successfulJudgeCount,
    retryAttempts: diagnostics.reduce((total, entry) => total + entry.retryCount, 0),
    fallbackCount: diagnostics.filter((entry) => entry.fallbackUsed).length,
    degraded: diagnostics.some((entry) => entry.fallbackUsed),
    exhaustedCalls,
    diagnostics
  };
}

export function createJudgeOrchestrationService(options = {}) {
  const config = options.config ?? loadAiServiceConfig();
  const provider = options.provider ?? createJudgeProvider(config);
  const memoryStore = options.memoryStore ?? new InMemoryJudgeMemoryStore();

  return {
    async run(input, runOptions = {}) {
      const request = createJudgeServiceInput({
        ...input,
        discussionPolicy: {
          maxTurns: config.discussionMaxTurns,
          disagreementThreshold: config.disagreementThreshold,
          minimumQuestionVariance: config.minimumQuestionVariance,
          ...(input?.discussionPolicy ?? {})
        }
      });
      const graph = createJudgeOrchestrationGraph(request.judges);
      const result = await graph.invoke(
        {
          request,
          config,
          provider,
          memoryStore
        },
        {
          recursionLimit: Math.max(12, request.discussionPolicy.maxTurns * 4 + 8)
        }
      );

      if (runOptions.includeDebug) {
        return {
          bundle: result.finalBundle,
          debug: {
            provider: provider.name,
            usedPlaceholderProvider: Boolean(provider.placeholder),
            discussionTriggered: result.discussionDecision.shouldDiscuss,
            discussionReason: result.discussionDecision.reason,
            disagreementScore: result.discussionDecision.disagreementScore,
            discussionTurns: result.discussionTurn,
            discussionLog: result.discussionLog,
            memoryWrites: result.memoryWrites,
            resilience: buildResilienceDebug(result)
          }
        };
      }

      return result.finalBundle;
    }
  };
}

const defaultService = createJudgeOrchestrationService();

export async function orchestrateJudgePanel(input, runOptions) {
  return defaultService.run(input, runOptions);
}
