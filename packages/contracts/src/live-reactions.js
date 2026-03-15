import { isPitchTranscriptUpdateShape } from "./game.js";

export const LIVE_REACTION_SOURCE_TYPES = Object.freeze({
  MOCK: "mock",
  PROVIDER: "provider",
  FALLBACK: "fallback"
});

export const LIVE_REACTION_PREFERRED_SOURCES = Object.freeze({
  MOCK: "mock",
  PROVIDER: "provider"
});

export const LIVE_REACTION_MOODS = Object.freeze([
  "positive",
  "neutral",
  "negative"
]);

export const LIVE_REACTION_PRESENCE_STATES = Object.freeze([
  "neutral",
  "engaged",
  "understanding",
  "confused",
  "skeptical",
  "impressed"
]);

export const LIVE_REACTION_CONFIDENCE_BANDS = Object.freeze([
  "low",
  "medium",
  "high"
]);

export const LIVE_REACTION_ANIMATION_CUES = Object.freeze([
  "idle",
  "listen",
  "lean_in",
  "nod",
  "tilt_head",
  "frown",
  "smile"
]);

const LIVE_REACTION_FORBIDDEN_FIELDS = Object.freeze([
  "acceptedDealId",
  "evaluation",
  "nextState",
  "offers",
  "roundResult",
  "score"
]);

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function hasForbiddenFields(value) {
  return LIVE_REACTION_FORBIDDEN_FIELDS.some((field) => field in value);
}

export function isLiveReactionPreferredSource(value) {
  return Object.values(LIVE_REACTION_PREFERRED_SOURCES).includes(value);
}

export function isLiveReactionSourceType(value) {
  return Object.values(LIVE_REACTION_SOURCE_TYPES).includes(value);
}

export function isLiveReactionJudgeShape(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      hasText(value.judgeId) &&
      hasText(value.judgeName) &&
      LIVE_REACTION_MOODS.includes(value.mood) &&
      LIVE_REACTION_PRESENCE_STATES.includes(value.presenceState) &&
      LIVE_REACTION_CONFIDENCE_BANDS.includes(value.confidenceBand) &&
      typeof value.authoritative === "boolean" &&
      value.authoritative === false &&
      !hasForbiddenFields(value) &&
      (value.animationCue === undefined || LIVE_REACTION_ANIMATION_CUES.includes(value.animationCue)) &&
      (value.summary === undefined || hasText(value.summary))
  );
}

export function validateLiveReactionJudge(value) {
  if (!isLiveReactionJudgeShape(value)) {
    throw new Error(
      "Live judge reactions must be presentation-only, include a mood and presence state, and omit authoritative game fields."
    );
  }
}

export function isLiveJudgeReactionRequestShape(value) {
  if (!value || typeof value !== "object" || hasForbiddenFields(value)) {
    return false;
  }

  return (
    hasText(value.roundId) &&
    isFiniteNumber(value.generatedAtMs) &&
    typeof value.presentationOnly === "boolean" &&
    value.presentationOnly === true &&
    isLiveReactionPreferredSource(value.preferredSource) &&
    Array.isArray(value.judges) &&
    value.judges.length > 0 &&
    value.judges.every((judge) => judge && typeof judge === "object" && hasText(judge.id) && hasText(judge.name)) &&
    Array.isArray(value.transcriptUpdates) &&
    value.transcriptUpdates.every(isPitchTranscriptUpdateShape) &&
    (value.lastReactionAtMs === undefined || value.lastReactionAtMs === null || isFiniteNumber(value.lastReactionAtMs)) &&
    (value.lastTranscriptSequence === undefined ||
      value.lastTranscriptSequence === null ||
      isNonNegativeInteger(value.lastTranscriptSequence))
  );
}

export function validateLiveJudgeReactionRequest(value) {
  if (!isLiveJudgeReactionRequestShape(value)) {
    throw new Error(
      "Live reaction requests must be presentation-only and include judges, transcript updates, a preferred source, and timing metadata."
    );
  }
}

export function createLiveJudgeReactionRequest(input) {
  const normalized = {
    roundId: input?.roundId?.trim?.() || "",
    generatedAtMs: input?.generatedAtMs,
    presentationOnly: input?.presentationOnly === true,
    preferredSource: input?.preferredSource ?? LIVE_REACTION_PREFERRED_SOURCES.MOCK,
    judges: Array.isArray(input?.judges)
      ? input.judges.map((judge) => ({
          id: judge?.id?.trim?.() || "",
          name: judge?.name?.trim?.() || ""
        }))
      : [],
    transcriptUpdates: Array.isArray(input?.transcriptUpdates) ? input.transcriptUpdates : [],
    lastReactionAtMs: input?.lastReactionAtMs ?? null,
    lastTranscriptSequence: input?.lastTranscriptSequence ?? null
  };

  LIVE_REACTION_FORBIDDEN_FIELDS.forEach((field) => {
    if (field in (input ?? {})) {
      normalized[field] = input[field];
    }
  });

  validateLiveJudgeReactionRequest(normalized);
  return normalized;
}

export function isLiveJudgeReactionEventShape(value) {
  if (!value || typeof value !== "object" || hasForbiddenFields(value)) {
    return false;
  }

  const judges = Array.isArray(value.judges) ? value.judges : [];
  const uniqueJudgeIds = new Set(judges.map((judge) => judge?.judgeId));

  return (
    value.type === "live_judge_reaction" &&
    hasText(value.roundId) &&
    isFiniteNumber(value.generatedAtMs) &&
    typeof value.presentationOnly === "boolean" &&
    value.presentationOnly === true &&
    isLiveReactionSourceType(value.sourceType) &&
    hasText(value.providerName) &&
    (value.transcriptSequence === null || isNonNegativeInteger(value.transcriptSequence)) &&
    judges.length > 0 &&
    uniqueJudgeIds.size === judges.length &&
    judges.every(isLiveReactionJudgeShape)
  );
}

export function validateLiveJudgeReactionEvent(value) {
  if (!isLiveJudgeReactionEventShape(value)) {
    throw new Error(
      "Live reaction events must stay presentation-only, include a supported source type, and contain unique judge reactions."
    );
  }
}
