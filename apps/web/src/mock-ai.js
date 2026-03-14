import { buildJudgeScorecard, JUDGE_PROFILES } from "../../../packages/game-engine/src/index.js";

function getTagsFromEvaluation(evaluation) {
  const tags = [];

  if (evaluation.business_viability >= 70) {
    tags.push("strong_monetization");
  } else {
    tags.push("weak_monetization");
  }

  if (evaluation.clarity >= 70) {
    tags.push("clear_pitch");
  } else {
    tags.push("unclear_market");
  }

  if (evaluation.confidence >= 70) {
    tags.push("strong_confidence");
  } else {
    tags.push("hesitant_delivery");
  }

  if (evaluation.originality >= 70) {
    tags.push("novel_angle");
  } else {
    tags.push("crowded_space");
  }

  return tags;
}

function buildQuestion(judge, evaluation) {
  if (judge.id === "rhea") {
    return evaluation.business_viability >= 70
      ? "Walk me through the first three revenue milestones you expect to hit."
      : "Where does the money actually come from, and why will customers keep paying?";
  }

  if (judge.id === "marco") {
    return evaluation.originality >= 70
      ? "What protects this from becoming a feature that a bigger competitor copies next quarter?"
      : "Why does this deserve to exist if customers can already solve the problem another way?";
  }

  return evaluation.confidence >= 70
    ? "What proof do you have that your team can execute faster than everyone else?"
    : "Why should anyone trust you to pull this off right now?";
}

function pickSentiment(score) {
  if (score >= 78) {
    return "impressed";
  }

  if (score >= 62) {
    return "interested";
  }

  return "skeptical";
}

function buildReaction(judge, sentiment, pitch) {
  const fragments = {
    impressed: {
      rhea: "The economics sound tight enough that I can see a route to a real business.",
      marco: "There is enough edge here that I would keep leaning in.",
      tori: "You sound like someone who knows exactly where the company is going."
    },
    interested: {
      rhea: "I see signal here, but I still need cleaner numbers.",
      marco: "The shape is promising, but I am not convinced the wedge is durable yet.",
      tori: "You have momentum, but the conviction is not fully landing for me."
    },
    skeptical: {
      rhea: "I do not trust the business model yet.",
      marco: "This feels easy to copy unless you sharpen the moat fast.",
      tori: "The idea is moving faster than the proof."
    }
  };

  return `${fragments[sentiment][judge.id]} Pitch cue: "${pitch.slice(0, 72)}${pitch.length > 72 ? "..." : ""}"`;
}

export function createJudgeBundle({ evaluation, pitch, judges = JUDGE_PROFILES }) {
  const scorecard = buildJudgeScorecard(evaluation, judges);

  const judgeResponses = scorecard.map((entry) => {
    const sentiment = pickSentiment(entry.score);
    return {
      judgeId: entry.judge.id,
      judgeName: entry.judge.name,
      sentiment,
      shortReaction: buildReaction(entry.judge, sentiment, pitch),
      question: buildQuestion(entry.judge, evaluation),
      rationaleTags: getTagsFromEvaluation(evaluation)
    };
  });

  const leadJudge = scorecard[0]?.judge ?? judges[0];
  const leadQuestion = buildQuestion(leadJudge, evaluation);

  return {
    judgeResponses,
    leadQuestion
  };
}
