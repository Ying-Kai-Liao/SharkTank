import feedbackMatrix from "../../data/mock-feedback-results.json";

function sanitizeDecisionType(value) {
  return value === "accept" ? "accept" : "disaccept";
}

function sanitizeTier(value) {
  if (value === "good" || value === "medium" || value === "bad") {
    return value;
  }

  return "medium";
}

function pickParagraph(decisionType, scoreTier) {
  const paragraphPool = feedbackMatrix?.paragraphs?.[decisionType]?.[scoreTier] || [];
  if (Array.isArray(paragraphPool) && paragraphPool.length > 0) {
    return paragraphPool[0];
  }

  return feedbackMatrix?.defaultParagraph || "Feedback unavailable.";
}

export async function GET(request) {
  const url = new URL(request.url);
  const decisionType = sanitizeDecisionType(url.searchParams.get("decisionType"));
  const scoreTier = sanitizeTier(url.searchParams.get("scoreTier"));
  const rawScore = Number(url.searchParams.get("score"));
  const acceptedJudgeId = url.searchParams.get("acceptedJudgeId") || null;

  const score = Number.isFinite(rawScore) ? Math.max(0, Math.round(rawScore)) : 0;
  const feedbackParagraph = pickParagraph(decisionType, scoreTier);

  return Response.json({
    score,
    scoreTier,
    decisionType,
    acceptedJudgeId,
    feedbackParagraph
  });
}
