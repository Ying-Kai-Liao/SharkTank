function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error ?? "Unknown provider error."));
}

function extractStatus(error) {
  const status = error?.status ?? error?.statusCode ?? error?.response?.status;
  return Number.isFinite(status) ? Number(status) : null;
}

function extractCode(error) {
  const code = error?.code ?? error?.cause?.code ?? error?.response?.data?.error?.code;
  return typeof code === "string" && code.trim() ? code.trim() : null;
}

function isRetryableStatus(status) {
  return status === 408 || status === 409 || status === 429 || (status !== null && status >= 500);
}

function isRetryableCode(code) {
  return [
    "ECONNABORTED",
    "ECONNREFUSED",
    "ECONNRESET",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "ENOTFOUND",
    "ETIMEDOUT",
    "rate_limit_exceeded",
    "server_error",
    "temporarily_unavailable"
  ].includes(code);
}

function isRetryableMessage(message) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("rate limit") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout") ||
    normalized.includes("overloaded") ||
    normalized.includes("connection reset") ||
    normalized.includes("connection aborted") ||
    normalized.includes("network error") ||
    normalized.includes("fetch failed")
  );
}

export function classifyProviderFailure(error) {
  const normalizedError = normalizeError(error);
  const status = extractStatus(normalizedError);
  const code = extractCode(normalizedError);
  const message = normalizedError.message || "Unknown provider error.";
  const retryable =
    normalizedError.name === "AbortError" ||
    isRetryableStatus(status) ||
    isRetryableCode(code) ||
    isRetryableMessage(message);

  return {
    name: normalizedError.name || "Error",
    message,
    status,
    code,
    retryable
  };
}

export function computeBackoffDelayMs(attemptNumber, retryPolicy, random = Math.random) {
  const exponent = Math.max(0, attemptNumber - 1);
  const baseDelay = Math.min(
    retryPolicy.maxBackoffMs,
    retryPolicy.baseBackoffMs * 2 ** exponent
  );
  const jitter = retryPolicy.jitterMs > 0 ? Math.floor(random() * (retryPolicy.jitterMs + 1)) : 0;

  return Math.min(retryPolicy.maxBackoffMs, baseDelay + jitter);
}

export class ProviderExecutionError extends Error {
  constructor(message, { cause, diagnostics }) {
    super(message, { cause });
    this.name = "ProviderExecutionError";
    this.diagnostics = diagnostics;
  }
}

export function createConcurrencyLimiter(limit) {
  let activeCount = 0;
  const queue = [];

  function scheduleNext() {
    if (activeCount >= limit || queue.length === 0) {
      return;
    }

    const next = queue.shift();
    activeCount += 1;

    Promise.resolve()
      .then(next.task)
      .then(next.resolve, next.reject)
      .finally(() => {
        activeCount -= 1;
        scheduleNext();
      });
  }

  return {
    limit,
    run(task) {
      return new Promise((resolve, reject) => {
        queue.push({ task, resolve, reject });
        scheduleNext();
      });
    }
  };
}

export function getMinimumSuccessfulJudges(totalJudges, minimumSuccessRatio) {
  return Math.max(1, Math.min(totalJudges, Math.ceil(totalJudges * minimumSuccessRatio)));
}

export async function executeProviderOperation({
  limiter,
  operation,
  retryPolicy,
  metadata,
  sleepFn = sleep,
  random = Math.random
}) {
  const failures = [];
  const backoffMs = [];

  for (let attempt = 1; attempt <= retryPolicy.maxAttempts; attempt += 1) {
    try {
      const value = await limiter.run(operation);

      return {
        value,
        diagnostics: {
          ...metadata,
          attempts: attempt,
          retryCount: attempt - 1,
          backoffMs,
          exhausted: false,
          fallbackUsed: false,
          failures
        }
      };
    } catch (error) {
      const failure = classifyProviderFailure(error);
      failures.push({
        attempt,
        ...failure
      });

      if (!failure.retryable || attempt >= retryPolicy.maxAttempts) {
        throw new ProviderExecutionError(
          `${metadata.stage} provider call failed for judge ${metadata.judgeId}.`,
          {
            cause: normalizeError(error),
            diagnostics: {
              ...metadata,
              attempts: attempt,
              retryCount: attempt - 1,
              backoffMs,
              exhausted: true,
              fallbackUsed: false,
              failures
            }
          }
        );
      }

      const delayMs = computeBackoffDelayMs(attempt, retryPolicy, random);
      backoffMs.push(delayMs);
      await sleepFn(delayMs);
    }
  }

  throw new ProviderExecutionError("Provider execution exited without a result.", {
    cause: new Error("Missing provider result."),
    diagnostics: {
      ...metadata,
      attempts: retryPolicy.maxAttempts,
      retryCount: Math.max(0, retryPolicy.maxAttempts - 1),
      backoffMs,
      exhausted: true,
      fallbackUsed: false,
      failures
    }
  });
}
