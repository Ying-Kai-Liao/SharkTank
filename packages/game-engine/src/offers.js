import { BARGAIN_LIMITS, EVALUATION_DIMENSIONS } from "../../contracts/src/index.js";

function roundCurrency(value) {
  return Math.round(value / 5000) * 5000;
}

function getTopDimension(evaluation) {
  return [...EVALUATION_DIMENSIONS].sort((left, right) => evaluation[right] - evaluation[left])[0];
}

export function buildJudgeScorecard(evaluation, judges) {
  return judges
    .map((judge) => {
      const score = EVALUATION_DIMENSIONS.reduce((total, dimension) => {
        return total + evaluation[dimension] * judge.weights[dimension];
      }, 0);

      return {
        judge,
        score: Math.round(score)
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function generateOffers(evaluation, judges) {
  const scorecard = buildJudgeScorecard(evaluation, judges);
  const topDimension = getTopDimension(evaluation);

  return scorecard
    .filter((entry, index) => entry.score >= 60 || index === 0)
    .map((entry, index) => {
      const amountBase = 45000 + evaluation.business_viability * 800 + evaluation.confidence * 250;
      const amount = roundCurrency(amountBase - index * 10000);
      const equity = Math.max(8, Math.min(28, Math.round(30 - entry.score / 4)));

      return {
        id: `${entry.judge.id}-offer-${index + 1}`,
        judgeId: entry.judge.id,
        judgeName: entry.judge.name,
        amount,
        equity,
        score: entry.score,
        rationale: `${entry.judge.name} is leaning on ${topDimension.replace("_", " ")} and wants proof the execution holds.`
      };
    });
}

export function clampBargainTerms(originalOffer, proposedTerms) {
  const minAmount = Math.round(originalOffer.amount * (1 + BARGAIN_LIMITS.minAmountChangePct));
  const maxAmount = Math.round(originalOffer.amount * (1 + BARGAIN_LIMITS.maxAmountChangePct));
  const minEquity = Math.max(1, originalOffer.equity + BARGAIN_LIMITS.minEquityDelta);
  const maxEquity = Math.min(100, originalOffer.equity + BARGAIN_LIMITS.maxEquityDelta);

  return {
    amount: Math.max(minAmount, Math.min(maxAmount, Math.round(proposedTerms.amount))),
    equity: Math.max(minEquity, Math.min(maxEquity, Math.round(proposedTerms.equity)))
  };
}

export function createRevisedOffer(originalOffer, clampedTerms) {
  return {
    ...originalOffer,
    id: `${originalOffer.id}-revised`,
    amount: clampedTerms.amount,
    equity: clampedTerms.equity,
    revised: true,
    originalOfferId: originalOffer.id
  };
}

export function createRoundResult({ evaluation, offers, decision }) {
  const topDimension = getTopDimension(evaluation).replace("_", " ");
  const averageScore = Math.round(
    EVALUATION_DIMENSIONS.reduce((total, dimension) => total + evaluation[dimension], 0) /
      EVALUATION_DIMENSIONS.length
  );

  if (decision?.type === "accepted" && decision.offer) {
    return {
      headline: `Deal accepted with ${decision.offer.judgeName}`,
      summary: `You took $${decision.offer.amount.toLocaleString()} for ${decision.offer.equity}% equity.`,
      explanation: `The round closed around ${topDimension}. Your deterministic average score was ${averageScore}, strong enough to unlock an offer with a judge score of ${decision.offer.score}.`
    };
  }

  if (decision?.type === "rejected" && offers.length) {
    return {
      headline: "You walked away from the table",
      summary: "The sharks made offers, but you kept the company.",
      explanation: `The strongest signal was ${topDimension}, with a deterministic average score of ${averageScore}. The offers were real, but the founder chose not to trade equity today.`
    };
  }

  return {
    headline: "No deal this round",
    summary: "The judges did not move from interest to commitment.",
    explanation: `The deterministic rubric averaged ${averageScore}. The pitch showed its best strength in ${topDimension}, but not enough combined signal to close a deal.`
  };
}
