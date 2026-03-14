import { discussionDecisionSchema } from "./validation.js";

function sentimentToScore(sentiment) {
  if (sentiment === "impressed") {
    return 3;
  }

  if (sentiment === "interested") {
    return 2;
  }

  return 1;
}

export function evaluateDiscussionNeed(drafts, policy) {
  const sentimentSpread =
    Math.max(...drafts.map((draft) => sentimentToScore(draft.sentiment))) -
    Math.min(...drafts.map((draft) => sentimentToScore(draft.sentiment)));
  const uniqueQuestions = new Set(drafts.map((draft) => draft.question)).size;
  const disagreementScore = sentimentSpread * 10 + Math.max(0, uniqueQuestions - 1) * 4;
  const shouldDiscuss =
    disagreementScore >= policy.disagreementThreshold || uniqueQuestions < policy.minimumQuestionVariance;

  return discussionDecisionSchema.parse({
    shouldDiscuss,
    reason: shouldDiscuss
      ? "Drafts show enough disagreement or overlap to justify a short panel discussion."
      : "Drafts are already aligned enough to finalize immediately.",
    disagreementScore
  });
}

export function shouldContinueDiscussion(drafts, policy, round) {
  if (round >= policy.maxRounds) {
    return false;
  }

  const uniqueSentiments = new Set(drafts.map((draft) => draft.sentiment)).size;
  const uniqueQuestions = new Set(drafts.map((draft) => draft.question)).size;
  return uniqueSentiments > 1 || uniqueQuestions > policy.minimumQuestionVariance;
}
