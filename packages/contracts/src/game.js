export const ROUND_STATES = Object.freeze({
  LOBBY: "LOBBY",
  PITCH_SUBMITTED: "PITCH_SUBMITTED",
  JUDGE_REACTIONS: "JUDGE_REACTIONS",
  FOLLOW_UP: "FOLLOW_UP",
  DEALS: "DEALS",
  PLAYER_DECISION: "PLAYER_DECISION",
  ROUND_RESULT: "ROUND_RESULT"
});

export const PLAYER_ACTIONS = Object.freeze({
  SUBMIT_PITCH: "submit_pitch",
  SUBMIT_ANSWER: "submit_answer",
  ACCEPT_DEAL: "accept_deal",
  REJECT_DEAL: "reject_deal",
  ADVANCE: "advance_when_timer_expires"
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
