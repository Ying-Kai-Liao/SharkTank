import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const configSchema = z.object({
  provider: z.enum(["heuristic", "openai"]).default("heuristic"),
  discussionMaxTurns: z.coerce.number().int().min(0).default(2),
  disagreementThreshold: z.coerce.number().int().min(0).default(14),
  minimumQuestionVariance: z.coerce.number().int().min(1).default(2),
  providerRetryAttempts: z.coerce.number().int().min(1).default(3),
  providerRetryBaseBackoffMs: z.coerce.number().int().min(0).default(40),
  providerRetryJitterMs: z.coerce.number().int().min(0).default(20),
  providerRetryMaxBackoffMs: z.coerce.number().int().min(0).default(200),
  providerMaxConcurrency: z.coerce.number().int().min(1).default(2),
  providerMinimumSuccessRatio: z.coerce.number().gt(0).lte(1).default(0.5),
  openAiApiKey: z.string().trim().optional(),
  openAiModel: z.string().trim().default("gpt-4.1-mini")
});

export function loadAiServiceConfig(env = process.env) {
  const config = configSchema.parse({
    provider: env.JUDGE_ORCHESTRATION_PROVIDER,
    discussionMaxTurns: env.JUDGE_DISCUSSION_MAX_TURNS,
    disagreementThreshold: env.JUDGE_DISCUSSION_DISAGREEMENT_THRESHOLD,
    minimumQuestionVariance: env.JUDGE_DISCUSSION_MIN_QUESTION_VARIANCE,
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
