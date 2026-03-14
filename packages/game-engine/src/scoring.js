import { EVALUATION_DIMENSIONS } from "../../contracts/src/index.js";

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function countMatches(tokens, words) {
  return tokens.filter((token) => words.includes(token)).length;
}

function computeWordCountScore(tokens, preferredMin, preferredMax) {
  if (!tokens.length) {
    return 20;
  }

  if (tokens.length < preferredMin) {
    return 45 + tokens.length * 2;
  }

  if (tokens.length > preferredMax) {
    return 90 - Math.min(tokens.length - preferredMax, 15) * 2;
  }

  return 84;
}

export function evaluatePitch(pitch) {
  const trimmedPitch = pitch.trim();

  if (!trimmedPitch) {
    throw new Error("Pitch text is required.");
  }

  const tokens = tokenize(trimmedPitch);
  const wordCountScore = computeWordCountScore(tokens, 12, 50);

  const clarity =
    wordCountScore +
    countMatches(tokens, ["for", "helps", "because", "who", "with", "without"]) * 3 -
    countMatches(tokens, ["thing", "stuff", "maybe"]) * 4;

  const confidence =
    52 +
    countMatches(tokens, ["will", "strong", "proven", "confident", "clear", "fast", "ready"]) * 6 -
    countMatches(tokens, ["maybe", "might", "hope", "guess", "probably"]) * 7;

  const originality =
    48 +
    countMatches(tokens, ["unique", "novel", "first", "ai", "community", "creator", "robot"]) * 5 -
    countMatches(tokens, ["another", "same", "copy"]) * 5;

  const businessViability =
    46 +
    countMatches(tokens, ["subscription", "revenue", "margin", "market", "customer", "b2b", "b2c", "sales"]) * 5 -
    countMatches(tokens, ["free", "viral", "someday", "later"]) * 4;

  return {
    clarity: clamp(clarity),
    confidence: clamp(confidence),
    originality: clamp(originality),
    business_viability: clamp(businessViability)
  };
}

export function evaluateAnswer(answer) {
  const trimmedAnswer = answer.trim();

  if (!trimmedAnswer) {
    throw new Error("A follow-up answer is required.");
  }

  const tokens = tokenize(trimmedAnswer);

  return {
    clarity: clamp(8 + countMatches(tokens, ["because", "customer", "problem", "market"]) * 4, 0, 14),
    confidence: clamp(6 + countMatches(tokens, ["will", "already", "traction", "signed", "growing"]) * 4, 0, 14),
    originality: clamp(4 + countMatches(tokens, ["unique", "differentiated", "moat", "exclusive"]) * 4, 0, 12),
    business_viability: clamp(7 + countMatches(tokens, ["revenue", "margin", "pricing", "retention", "paid"]) * 4, 0, 16)
  };
}

export function mergeEvaluations(baseEvaluation, answerBoost) {
  return Object.fromEntries(
    EVALUATION_DIMENSIONS.map((dimension) => [
      dimension,
      clamp(baseEvaluation[dimension] + answerBoost[dimension])
    ])
  );
}
