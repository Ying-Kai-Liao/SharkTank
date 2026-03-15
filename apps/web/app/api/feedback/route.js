function sanitizeDecisionType(value) {
  return value === "accept" ? "accept" : "disaccept";
}

function sanitizeTier(value) {
  if (value === "good" || value === "medium" || value === "bad") {
    return value;
  }

  return "medium";
}

function synthesizeFeedback({ score, scoreTier, decisionType, transcript }) {
  const hasTranscript = transcript && transcript.trim().length > 0;

  const tierDescriptions = {
    good: "strong",
    medium: "moderate",
    bad: "weak"
  };

  const tierAdvice = {
    good: "Continue refining your pitch to maintain this momentum in future rounds.",
    medium: "Focus on strengthening your key differentiators and backing claims with concrete numbers.",
    bad: "Consider reworking your core value proposition and practicing concise delivery before the next round."
  };

  const decisionPhrase = decisionType === "accept"
    ? "You secured a deal this round."
    : "No deal was closed this round.";

  const tierLabel = tierDescriptions[scoreTier] || "moderate";
  const advice = tierAdvice[scoreTier] || tierAdvice.medium;

  let paragraph = `Your pitch scored ${score}, placing it in the ${tierLabel} range. ${decisionPhrase}`;

  if (hasTranscript) {
    const wordCount = transcript.split(/\s+/).length;
    if (wordCount < 15) {
      paragraph += " Your pitch was quite brief -- consider expanding on your value proposition and market opportunity.";
    } else if (wordCount > 80) {
      paragraph += " Your pitch covered a lot of ground. Tightening the narrative could help judges follow your core thesis more easily.";
    } else {
      paragraph += " Your pitch length was well-balanced for the time available.";
    }
  }

  paragraph += ` ${advice}`;

  return paragraph;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const decisionType = sanitizeDecisionType(body?.decisionType);
    const scoreTier = sanitizeTier(body?.scoreTier);
    const rawScore = Number(body?.score);
    const acceptedJudgeId = body?.acceptedJudgeId || null;
    const transcript = body?.transcript || "";

    const score = Number.isFinite(rawScore) ? Math.max(0, Math.round(rawScore)) : 0;
    const feedbackParagraph = synthesizeFeedback({ score, scoreTier, decisionType, transcript });

    return Response.json({
      score,
      scoreTier,
      decisionType,
      acceptedJudgeId,
      feedbackParagraph
    });
  } catch {
    return Response.json(
      { error: "feedback_unavailable" },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  const url = new URL(request.url);
  const decisionType = sanitizeDecisionType(url.searchParams.get("decisionType"));
  const scoreTier = sanitizeTier(url.searchParams.get("scoreTier"));
  const rawScore = Number(url.searchParams.get("score"));
  const acceptedJudgeId = url.searchParams.get("acceptedJudgeId") || null;

  const score = Number.isFinite(rawScore) ? Math.max(0, Math.round(rawScore)) : 0;
  const feedbackParagraph = synthesizeFeedback({ score, scoreTier, decisionType, transcript: "" });

  return Response.json({
    score,
    scoreTier,
    decisionType,
    acceptedJudgeId,
    feedbackParagraph
  });
}
