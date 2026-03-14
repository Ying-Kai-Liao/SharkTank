import { buildJudgeScorecard } from "../../../packages/game-engine/src/index.js";

function getEvaluationTags(evaluation) {
  const tags = [];

  tags.push(evaluation.business_viability >= 70 ? "strong_monetization" : "weak_monetization");
  tags.push(evaluation.clarity >= 70 ? "clear_pitch" : "unclear_market");
  tags.push(evaluation.confidence >= 70 ? "strong_confidence" : "hesitant_delivery");
  tags.push(evaluation.originality >= 70 ? "novel_angle" : "crowded_space");

  return tags;
}

export function buildRoundContext(request) {
  const scorecard = buildJudgeScorecard(request.evaluation, request.judges);

  return {
    roundId: request.roundId,
    pitch: request.pitch,
    evaluation: structuredClone(request.evaluation),
    transcript: structuredClone(request.transcript),
    sharedTags: getEvaluationTags(request.evaluation),
    scorecard
  };
}

export function getJudgeScore(scorecard, judgeId) {
  return scorecard.find((entry) => entry.judge.id === judgeId)?.score ?? 0;
}
