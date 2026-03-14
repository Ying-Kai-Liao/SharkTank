import { EVALUATION_DIMENSIONS, REQUIRED_AI_FIELDS } from "./game.js";

export const AI_SENTIMENTS = Object.freeze([
  "skeptical",
  "interested",
  "impressed"
]);

export const DEFAULT_DISCUSSION_POLICY = Object.freeze({
  maxTurns: 2,
  disagreementThreshold: 14,
  minimumQuestionVariance: 2
});

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function isEvaluationShape(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  return EVALUATION_DIMENSIONS.every((dimension) => {
    return isFiniteNumber(value[dimension]) && value[dimension] >= 0 && value[dimension] <= 100;
  });
}

export function isJudgeProfileShape(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (!hasText(value.id) || !hasText(value.name) || !hasText(value.title) || !hasText(value.focus)) {
    return false;
  }

  if (!value.weights || typeof value.weights !== "object") {
    return false;
  }

  return EVALUATION_DIMENSIONS.every((dimension) => isFiniteNumber(value.weights[dimension]));
}

export function isTranscriptEntryShape(value) {
  return Boolean(value && typeof value === "object" && hasText(value.speaker) && hasText(value.text));
}

export function isJudgeServiceInputShape(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const discussionPolicy = value.discussionPolicy ?? DEFAULT_DISCUSSION_POLICY;

  return (
    hasText(value.roundId) &&
    hasText(value.sessionId) &&
    hasText(value.founderId) &&
    hasText(value.pitch) &&
    isEvaluationShape(value.evaluation) &&
    Array.isArray(value.judges) &&
    value.judges.length > 0 &&
    value.judges.every(isJudgeProfileShape) &&
    Array.isArray(value.transcript) &&
    value.transcript.every(isTranscriptEntryShape) &&
    isFiniteNumber(discussionPolicy.maxTurns) &&
    discussionPolicy.maxTurns >= 0 &&
    isFiniteNumber(discussionPolicy.disagreementThreshold) &&
    discussionPolicy.disagreementThreshold >= 0 &&
    isFiniteNumber(discussionPolicy.minimumQuestionVariance) &&
    discussionPolicy.minimumQuestionVariance >= 1
  );
}

export function createJudgeServiceInput(input) {
  const normalized = {
    roundId: input?.roundId?.trim?.() || "local-round",
    sessionId: input?.sessionId?.trim?.() || "local-session",
    founderId: input?.founderId?.trim?.() || "local-founder",
    pitch: input?.pitch?.trim?.() || "",
    evaluation: input?.evaluation ?? null,
    judges: Array.isArray(input?.judges) ? input.judges : [],
    transcript: Array.isArray(input?.transcript) ? input.transcript : [],
    discussionPolicy: {
      ...DEFAULT_DISCUSSION_POLICY,
      ...(input?.discussionPolicy ?? {})
    }
  };

  validateJudgeServiceInput(normalized);
  return normalized;
}

export function validateJudgeServiceInput(input) {
  if (!isJudgeServiceInputShape(input)) {
    throw new Error(
      "AI service input must include round context, evaluation, transcript entries, judge profiles, and a valid discussion policy."
    );
  }
}

export function isJudgeResponseShape(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (!AI_SENTIMENTS.includes(value.sentiment)) {
    return false;
  }

  if (!REQUIRED_AI_FIELDS.every((field) => field in value)) {
    return false;
  }

  if (!hasText(value.shortReaction) || !hasText(value.question)) {
    return false;
  }

  if (!Array.isArray(value.rationaleTags) || !value.rationaleTags.length) {
    return false;
  }

  return value.rationaleTags.every(hasText);
}

export function validateJudgeBundle(bundle) {
  if (!bundle || typeof bundle !== "object") {
    throw new Error("A judge bundle is required to advance into reactions.");
  }

  if (!Array.isArray(bundle.judgeResponses) || !bundle.judgeResponses.length) {
    throw new Error("Judge responses are required to render the judge table.");
  }

  if (typeof bundle.leadQuestion !== "string" || !bundle.leadQuestion.trim()) {
    throw new Error("A lead question is required before the follow-up stage.");
  }

  const seenJudgeIds = new Set();

  for (const response of bundle.judgeResponses) {
    if (!isJudgeResponseShape(response)) {
      throw new Error("Judge responses must match the shared AI response contract.");
    }

    if (seenJudgeIds.has(response.judgeId)) {
      throw new Error("Judge responses must contain unique judge ids.");
    }

    seenJudgeIds.add(response.judgeId);
  }
}
