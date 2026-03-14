import { createJudgeServiceInput, validateJudgeBundle } from "../../../packages/contracts/src/index.js";
import { createJudgeBundle as createMockJudgeBundle } from "./mock-ai.js";

export function resolveAiTransport() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return "service";
  }

  const searchMode = new URLSearchParams(window.location.search).get("ai");
  return searchMode || document.body.dataset.aiMode || "service";
}

export function buildJudgeBundleRequest({ state, judges, roundId = "web-demo-round", sessionId = "web-demo", founderId = "local-founder" }) {
  return createJudgeServiceInput({
    roundId,
    sessionId,
    founderId,
    pitch: state.pitch,
    evaluation: state.evaluation,
    judges,
    transcript: state.transcript
  });
}

export async function requestJudgeBundleFromService(request, { endpoint = "/api/judge-bundle", fetchImpl = fetch } = {}) {
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Judge orchestration request failed.");
  }

  validateJudgeBundle(payload);
  return payload;
}

export async function createJudgeBundleForRound({
  state,
  judges,
  transport = "service",
  serviceInvoker,
  fetchImpl
}) {
  if (transport === "mock") {
    const bundle = createMockJudgeBundle({
      evaluation: state.evaluation,
      pitch: state.pitch,
      judges
    });
    validateJudgeBundle(bundle);
    return bundle;
  }

  const request = buildJudgeBundleRequest({ state, judges });

  if (serviceInvoker) {
    const bundle = await serviceInvoker(request);
    validateJudgeBundle(bundle);
    return bundle;
  }

  return requestJudgeBundleFromService(request, { fetchImpl });
}
