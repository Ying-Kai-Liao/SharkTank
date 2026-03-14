import assert from "node:assert/strict";
import test from "node:test";

import {
  createConcurrencyLimiter,
  executeProviderOperation,
  ProviderExecutionError
} from "../src/resilience.js";

function createRetryPolicy(overrides = {}) {
  return {
    maxAttempts: 3,
    baseBackoffMs: 10,
    jitterMs: 0,
    maxBackoffMs: 40,
    ...overrides
  };
}

function createMetadata(overrides = {}) {
  return {
    stage: "draft",
    turn: 0,
    judgeId: "rhea",
    judgeName: "Rhea",
    ...overrides
  };
}

test("transient provider failures are retried before succeeding", async () => {
  let attempts = 0;
  const sleeps = [];

  const result = await executeProviderOperation({
    limiter: createConcurrencyLimiter(2),
    retryPolicy: createRetryPolicy(),
    metadata: createMetadata(),
    sleepFn: async (delayMs) => {
      sleeps.push(delayMs);
    },
    operation: async () => {
      attempts += 1;

      if (attempts < 3) {
        const error = new Error("Rate limit exceeded");
        error.status = 429;
        throw error;
      }

      return { ok: true };
    }
  });

  assert.equal(attempts, 3);
  assert.deepEqual(sleeps, [10, 20]);
  assert.equal(result.diagnostics.retryCount, 2);
  assert.equal(result.diagnostics.exhausted, false);
  assert.equal(result.diagnostics.failures.length, 2);
});

test("non-retryable provider failures stop immediately", async () => {
  await assert.rejects(
    () =>
      executeProviderOperation({
        limiter: createConcurrencyLimiter(1),
        retryPolicy: createRetryPolicy(),
        metadata: createMetadata(),
        operation: async () => {
          const error = new Error("Invalid request payload");
          error.status = 400;
          throw error;
        }
      }),
    (error) => {
      assert.ok(error instanceof ProviderExecutionError);
      assert.equal(error.diagnostics.retryCount, 0);
      assert.equal(error.diagnostics.failures.length, 1);
      assert.equal(error.diagnostics.failures[0].retryable, false);
      return true;
    }
  );
});

test("retryable failures surface exhaustion metadata once backoff attempts are spent", async () => {
  const sleeps = [];

  await assert.rejects(
    () =>
      executeProviderOperation({
        limiter: createConcurrencyLimiter(1),
        retryPolicy: createRetryPolicy({
          maxAttempts: 3,
          baseBackoffMs: 5,
          maxBackoffMs: 10
        }),
        metadata: createMetadata({
          stage: "discussion",
          turn: 1
        }),
        sleepFn: async (delayMs) => {
          sleeps.push(delayMs);
        },
        operation: async () => {
          const error = new Error("Upstream temporarily unavailable");
          error.status = 503;
          throw error;
        }
      }),
    (error) => {
      assert.ok(error instanceof ProviderExecutionError);
      assert.equal(error.diagnostics.attempts, 3);
      assert.equal(error.diagnostics.retryCount, 2);
      assert.equal(error.diagnostics.exhausted, true);
      assert.equal(error.diagnostics.failures.length, 3);
      assert.deepEqual(sleeps, [5, 10]);
      return true;
    }
  );
});
