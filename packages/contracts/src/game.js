export const ROUND_STATES = Object.freeze({
  LOBBY: "LOBBY",
  PITCH: "PITCH",
  PITCH_CLOSED: "PITCH_CLOSED",
  JUDGE_REACTIONS: "JUDGE_REACTIONS",
  FOLLOW_UP: "FOLLOW_UP",
  DEALS: "DEALS",
  PLAYER_DECISION: "PLAYER_DECISION",
  ROUND_RESULT: "ROUND_RESULT"
});

export const PLAYER_ACTIONS = Object.freeze({
  START_PITCH: "start_pitch",
  SUBMIT_PITCH_TRANSCRIPT: "submit_pitch_transcript",
  CLOSE_PITCH: "close_pitch",
  SUBMIT_ANSWER: "submit_answer",
  ACCEPT_DEAL: "accept_deal",
  REJECT_DEAL: "reject_deal",
  ADVANCE: "advance_when_timer_expires",
  SUBMIT_BARGAIN: "submit_bargain",
  DECLINE_QUESTION: "decline_question"
});

export const NEGOTIATION_ACTION_TYPES = Object.freeze([
  "answer",
  "bargain",
  "accept",
  "refuse",
  "decline"
]);

export const BARGAIN_LIMITS = Object.freeze({
  minEquityDelta: -5,
  maxEquityDelta: 5,
  minAmountChangePct: -0.20,
  maxAmountChangePct: 0.20
});

export const PITCH_CLOSE_REASONS = Object.freeze({
  MANUAL: "manual",
  TIMER_EXPIRED: "timer_expired"
});

export const PITCH_SOURCE_TYPES = Object.freeze({
  MOCK: "mock",
  LIVE_STT: "live_stt"
});

export const EVALUATION_DIMENSIONS = Object.freeze([
  "clarity",
  "confidence",
  "originality",
  "business_viability"
]);

export const REQUIRED_AI_FIELDS = Object.freeze([
  "judgeId",
  "judgeName",
  "sentiment",
  "shortReaction",
  "question",
  "rationaleTags"
]);

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

export function isPitchSourceType(value) {
  return Object.values(PITCH_SOURCE_TYPES).includes(value);
}

export function isPitchCloseReason(value) {
  return Object.values(PITCH_CLOSE_REASONS).includes(value);
}

export function isPitchStartShape(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      isPositiveInteger(value.durationSeconds) &&
      isFiniteNumber(value.startedAtMs) &&
      isPitchSourceType(value.sourceType)
  );
}

export function validatePitchStart(value) {
  if (!isPitchStartShape(value)) {
    throw new Error("Pitch start payload must include a positive duration, start time, and supported source type.");
  }
}

export function isPitchTranscriptUpdateShape(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      hasText(value.text) &&
      isFiniteNumber(value.receivedAtMs) &&
      Number.isInteger(value.sequence) &&
      value.sequence >= 0 &&
      isPitchSourceType(value.sourceType) &&
      (value.eventId === undefined || hasText(value.eventId))
  );
}

export function validatePitchTranscriptUpdate(value) {
  if (!isPitchTranscriptUpdateShape(value)) {
    throw new Error("Pitch transcript updates must include text, sequence, received time, and supported source type.");
  }
}

export function createPitchTimerState({ durationSeconds, startedAtMs, closedAtMs = null, nowMs = startedAtMs }) {
  if (!isPositiveInteger(durationSeconds) || !isFiniteNumber(startedAtMs)) {
    throw new Error("Pitch timer state requires a positive duration and finite start time.");
  }

  if (closedAtMs !== null && !isFiniteNumber(closedAtMs)) {
    throw new Error("Pitch timer state requires a finite close time when closed.");
  }

  if (!isFiniteNumber(nowMs)) {
    throw new Error("Pitch timer state requires a finite current time.");
  }

  const closesAtMs = startedAtMs + durationSeconds * 1000;
  const effectiveNowMs = closedAtMs ?? nowMs;
  const remainingMs = Math.max(0, closesAtMs - effectiveNowMs);

  return {
    durationSeconds,
    startedAtMs,
    closesAtMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    isClosed: closedAtMs !== null,
    isExpired: effectiveNowMs >= closesAtMs
  };
}

export function isPitchTimerStateShape(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      isPositiveInteger(value.durationSeconds) &&
      isFiniteNumber(value.startedAtMs) &&
      isFiniteNumber(value.closesAtMs) &&
      isFiniteNumber(value.remainingSeconds) &&
      value.remainingSeconds >= 0 &&
      typeof value.isClosed === "boolean" &&
      typeof value.isExpired === "boolean"
  );
}

export function validatePitchTimerState(value) {
  if (!isPitchTimerStateShape(value)) {
    throw new Error("Pitch timer state must include timing bounds, remaining seconds, and closure flags.");
  }
}

function normalizeFinalizedPitchText(updates) {
  return updates
    .map((update) => update.text.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function createFinalizedPitch({
  updates,
  durationSeconds,
  startedAtMs,
  closedAtMs,
  closeReason
}) {
  if (!Array.isArray(updates)) {
    throw new Error("Finalized pitch requires transcript updates.");
  }

  const finalizedPitch = {
    text: normalizeFinalizedPitchText(updates),
    updates,
    durationSeconds,
    startedAtMs,
    closedAtMs,
    closeReason
  };

  validateFinalizedPitch(finalizedPitch);
  return finalizedPitch;
}

export function isFinalizedPitchShape(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      hasText(value.text) &&
      Array.isArray(value.updates) &&
      value.updates.length > 0 &&
      value.updates.every(isPitchTranscriptUpdateShape) &&
      isPositiveInteger(value.durationSeconds) &&
      isFiniteNumber(value.startedAtMs) &&
      isFiniteNumber(value.closedAtMs) &&
      value.closedAtMs >= value.startedAtMs &&
      isPitchCloseReason(value.closeReason)
  );
}

export function validateFinalizedPitch(value) {
  if (!isFinalizedPitchShape(value)) {
    throw new Error(
      "Finalized pitch output must include non-empty text, transcript updates, timing bounds, and a supported close reason."
    );
  }
}

export function isNegotiationActionShape(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      NEGOTIATION_ACTION_TYPES.includes(value.type) &&
      (value.offerId === undefined || hasText(value.offerId)) &&
      (value.terms === undefined || (typeof value.terms === "object" && value.terms !== null)) &&
      (value.answer === undefined || typeof value.answer === "string")
  );
}

export function validateNegotiationAction(value) {
  if (!isNegotiationActionShape(value)) {
    throw new Error("Negotiation action must have a valid type, and optional offerId (string), terms (object), or answer (string).");
  }
}

export function isBargainPayloadShape(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      hasText(value.offerId) &&
      value.terms &&
      typeof value.terms === "object" &&
      isFiniteNumber(value.terms.amount) &&
      isFiniteNumber(value.terms.equity)
  );
}

export function validateBargainPayload(value) {
  if (!isBargainPayloadShape(value)) {
    throw new Error("Bargain payload must include an offerId (string) and terms with finite amount and equity.");
  }
}
