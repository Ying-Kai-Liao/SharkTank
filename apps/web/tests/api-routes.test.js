import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test, { after, before } from "node:test";

const DEV_SERVER_PORT = 3107;
const DEV_SERVER_URL = `http://127.0.0.1:${DEV_SERVER_PORT}`;
const SERVER_START_TIMEOUT_MS = 45_000;
const REQUEST_TIMEOUT_MS = 8_000;

let serverProcess = null;

function createTimeoutSignal(timeoutMs) {
  return AbortSignal.timeout(timeoutMs);
}

async function waitForServer() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < SERVER_START_TIMEOUT_MS) {
    try {
      const response = await fetch(
        `${DEV_SERVER_URL}/api/feedback?score=0&scoreTier=medium&decisionType=disaccept`,
        { signal: createTimeoutSignal(REQUEST_TIMEOUT_MS) }
      );

      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the timeout expires.
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  throw new Error("Timed out waiting for Next.js API server to start.");
}

async function jsonRequest(pathname, init = {}) {
  const response = await fetch(`${DEV_SERVER_URL}${pathname}`, {
    ...init,
    signal: createTimeoutSignal(REQUEST_TIMEOUT_MS)
  });

  const payload = await response.json();
  return { response, payload };
}

before(async () => {
  const spawnArgs =
    process.platform === "win32"
      ? ["cmd.exe", ["/d", "/s", "/c", `npm run dev -w @sharktank/web -- --port ${DEV_SERVER_PORT}`]]
      : ["npm", ["run", "dev", "-w", "@sharktank/web", "--", "--port", String(DEV_SERVER_PORT)]];

  serverProcess = spawn(spawnArgs[0], spawnArgs[1], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(DEV_SERVER_PORT)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  serverProcess.stdout?.on("data", () => {
    // Keep stream attached so buffers do not fill up in long runs.
  });

  serverProcess.stderr?.on("data", () => {
    // Keep stream attached so buffers do not fill up in long runs.
  });

  await waitForServer();
});

after(async () => {
  if (!serverProcess) {
    return;
  }

  const processToStop = serverProcess;
  serverProcess = null;

  processToStop.kill("SIGTERM");
  await new Promise((resolve) => processToStop.once("exit", resolve));
});

test("GET /api/feedback sanitizes unsupported inputs", async () => {
  const { response, payload } = await jsonRequest(
    "/api/feedback?score=17.8&scoreTier=unknown&decisionType=wrong&acceptedJudgeId=cat"
  );

  assert.equal(response.status, 200);
  assert.equal(payload.score, 18);
  assert.equal(payload.scoreTier, "medium");
  assert.equal(payload.decisionType, "disaccept");
  assert.equal(payload.acceptedJudgeId, "cat");
  assert.equal(typeof payload.feedbackParagraph, "string");
  assert.ok(payload.feedbackParagraph.length > 0);
});

test("POST /api/judge-reactions returns normalized reaction set", async () => {
  const { response, payload } = await jsonRequest("/api/judge-reactions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ groupIndex: -1, playerMessage: "Testing reaction mapping" })
  });

  assert.equal(response.status, 200);
  assert.equal(typeof payload.sourceGroupId, "string");
  assert.equal(typeof payload.reactions, "object");

  for (const judgeId of ["cat", "dog", "shark"]) {
    assert.ok(["positive", "negative", "neutral", "surprised"].includes(payload.reactions[judgeId]));
  }
});

test("POST /api/round-result returns an accept result payload", async () => {
  const { response, payload } = await jsonRequest("/api/round-result", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ decisionType: "accept", acceptedJudgeId: "dog" })
  });

  assert.equal(response.status, 200);
  assert.equal(payload.decisionType, "accept");
  assert.ok(["good", "medium"].includes(payload.scoreTier));
  assert.equal(typeof payload.score, "number");
  assert.equal(Number.isFinite(payload.score), true);
  assert.equal(typeof payload.catchphrase, "string");
  assert.ok(payload.catchphrase.length > 0);
});