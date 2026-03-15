import { EVALUATION_DIMENSIONS } from "../../contracts/src/index.js";
import { buildJudgeScorecard } from "./offers.js";

function getTopDimension(evaluation) {
  return [...EVALUATION_DIMENSIONS].sort((left, right) => evaluation[right] - evaluation[left])[0];
}

export function buildDebriefData(evaluation, judges, options = {}) {
  const scorecard = buildJudgeScorecard(evaluation, judges);
  const topDimension = getTopDimension(evaluation);
  const offers = options.offers || [];
  const offerByJudge = Object.fromEntries(offers.map((offer) => [offer.judgeId, offer]));

  const judgeEntries = scorecard.map((entry) => {
    const offer = offerByJudge[entry.judge.id] || null;

    return {
      judgeId: entry.judge.id,
      judgeName: entry.judge.name,
      title: entry.judge.title,
      weightedScore: entry.score,
      evaluation: Object.fromEntries(
        EVALUATION_DIMENSIONS.map((dimension) => [dimension, evaluation[dimension]])
      ),
      weights: { ...entry.judge.weights },
      topDimension,
      focusText: entry.judge.focus,
      madeOffer: offer !== null,
      offerSummary: offer
        ? `$${offer.amount.toLocaleString()} for ${offer.equity}%`
        : null,
      narrative: null
    };
  });

  return {
    judges: judgeEntries,
    topDimension,
    averageScore: Math.round(
      EVALUATION_DIMENSIONS.reduce((total, dimension) => total + evaluation[dimension], 0) /
        EVALUATION_DIMENSIONS.length
    )
  };
}
