import dotenv from "dotenv";
import { z } from "zod";

import { DEFAULT_DISCUSSION_POLICY } from "../../../packages/contracts/src/index.js";

dotenv.config({ quiet: true });

const configSchema = z.object({
  provider: z.enum(["heuristic", "openai"]).default("heuristic"),
  deliberationMaxRounds: z.coerce.number().int().min(0).default(DEFAULT_DISCUSSION_POLICY.maxRounds),
  disagreementThreshold: z.coerce.number().int().min(0).default(DEFAULT_DISCUSSION_POLICY.disagreementThreshold),
  minimumQuestionVariance: z.coerce.number().int().min(1).default(DEFAULT_DISCUSSION_POLICY.minimumQuestionVariance),
  maxPeerQueriesPerRound: z.coerce.number().int().min(0).default(DEFAULT_DISCUSSION_POLICY.maxPeerQueriesPerRound),
  maxPeerTargets: z.coerce.number().int().min(1).default(DEFAULT_DISCUSSION_POLICY.maxPeerTargets),
  providerRetryAttempts: z.coerce.number().int().min(1).default(3),
  providerRetryBaseBackoffMs: z.coerce.number().int().min(0).default(40),
  providerRetryJitterMs: z.coerce.number().int().min(0).default(20),
  providerRetryMaxBackoffMs: z.coerce.number().int().min(0).default(200),
  providerMaxConcurrency: z.coerce.number().int().min(1).default(2),
  providerMinimumSuccessRatio: z.coerce.number().gt(0).lte(1).default(0.5),
  openAiApiKey: z.string().trim().optional(),
  openAiModel: z.string().trim().default("gpt-4.1-mini")
});

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeAiServiceConfig(input = {}) {
  const config = configSchema.parse({
    provider: input.provider,
    deliberationMaxRounds: input.deliberationMaxRounds ?? input.discussionMaxTurns,
    disagreementThreshold: input.disagreementThreshold,
    minimumQuestionVariance: input.minimumQuestionVariance,
    maxPeerQueriesPerRound: input.maxPeerQueriesPerRound,
    maxPeerTargets: input.maxPeerTargets,
    providerRetryAttempts: input.providerRetryAttempts,
    providerRetryBaseBackoffMs: input.providerRetryBaseBackoffMs,
    providerRetryJitterMs: input.providerRetryJitterMs,
    providerRetryMaxBackoffMs: input.providerRetryMaxBackoffMs,
    providerMaxConcurrency: input.providerMaxConcurrency,
    providerMinimumSuccessRatio: input.providerMinimumSuccessRatio,
    openAiApiKey: input.openAiApiKey,
    openAiModel: input.openAiModel
  });

  return {
    ...config,
    deliberationMaxRounds: clampNumber(config.deliberationMaxRounds, 0, 3),
    maxPeerQueriesPerRound: clampNumber(config.maxPeerQueriesPerRound, 0, 3),
    maxPeerTargets: clampNumber(config.maxPeerTargets, 1, 3)
  };
}

export function loadAiServiceConfig(env = process.env) {
  const config = normalizeAiServiceConfig({
    provider: env.JUDGE_ORCHESTRATION_PROVIDER,
    deliberationMaxRounds: env.JUDGE_DELIBERATION_MAX_ROUNDS ?? env.JUDGE_DISCUSSION_MAX_TURNS,
    disagreementThreshold: env.JUDGE_DISCUSSION_DISAGREEMENT_THRESHOLD,
    minimumQuestionVariance: env.JUDGE_DISCUSSION_MIN_QUESTION_VARIANCE,
    maxPeerQueriesPerRound: env.JUDGE_PEER_QUERY_MAX_QUERIES_PER_ROUND,
    maxPeerTargets: env.JUDGE_PEER_QUERY_MAX_TARGETS,
    providerRetryAttempts: env.JUDGE_PROVIDER_RETRY_ATTEMPTS,
    providerRetryBaseBackoffMs: env.JUDGE_PROVIDER_RETRY_BASE_BACKOFF_MS,
    providerRetryJitterMs: env.JUDGE_PROVIDER_RETRY_JITTER_MS,
    providerRetryMaxBackoffMs: env.JUDGE_PROVIDER_RETRY_MAX_BACKOFF_MS,
    providerMaxConcurrency: env.JUDGE_PROVIDER_MAX_CONCURRENCY,
    providerMinimumSuccessRatio: env.JUDGE_PROVIDER_MINIMUM_SUCCESS_RATIO,
    openAiApiKey: env.OPENAI_API_KEY,
    openAiModel: env.OPENAI_MODEL
  });

  if (config.provider === "openai" && !config.openAiApiKey) {
    throw new Error("OPENAI_API_KEY is required when JUDGE_ORCHESTRATION_PROVIDER=openai.");
  }

  return config;
}
