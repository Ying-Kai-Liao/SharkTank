import {
  DEFAULT_PANEL_BUDGET,
  DIRECTOR_DECISIONS,
  PANEL_EVENT_TYPES
} from "../../contracts/src/index.js";

export function decideContinuation(panelState, judgeResponses) {
  if (!panelState || panelState.closed) {
    return {
      decision: DIRECTOR_DECISIONS.CLOSE,
      reason: "panel_not_active"
    };
  }

  const { budget, turn, events, judgeFollowupCounts } = panelState;

  if (turn >= budget.maxTurns) {
    return {
      decision: DIRECTOR_DECISIONS.CLOSE,
      reason: "max_turns_reached"
    };
  }

  const eligibleJudges = getEligibleJudges(panelState, judgeResponses);

  if (!eligibleJudges.length) {
    return {
      decision: DIRECTOR_DECISIONS.CLOSE,
      reason: "no_eligible_judges"
    };
  }

  if (hasNoProgressCondition(events)) {
    return {
      decision: DIRECTOR_DECISIONS.CLOSE,
      reason: "no_progress"
    };
  }

  return {
    decision: DIRECTOR_DECISIONS.CONTINUE,
    reason: "eligible_judges_remain"
  };
}

export function selectNextJudge(panelState, judgeResponses) {
  const eligible = getEligibleJudges(panelState, judgeResponses);

  if (!eligible.length) {
    throw new Error("No eligible judges available for the next panel turn.");
  }

  const lastQuestionEvent = [...panelState.events]
    .reverse()
    .find((event) => event.type === PANEL_EVENT_TYPES.JUDGE_QUESTION);

  const lastJudgeId = lastQuestionEvent?.judgeId;

  const nonRepeat = eligible.filter((judge) => judge.judgeId !== lastJudgeId);
  const pool = nonRepeat.length ? nonRepeat : eligible;

  const lowestCount = Math.min(...pool.map((judge) => panelState.judgeFollowupCounts[judge.judgeId] || 0));
  const leastUsed = pool.filter(
    (judge) => (panelState.judgeFollowupCounts[judge.judgeId] || 0) === lowestCount
  );

  return leastUsed[0];
}

function getEligibleJudges(panelState, judgeResponses) {
  return judgeResponses.filter((judge) => {
    const count = panelState.judgeFollowupCounts[judge.judgeId] || 0;
    return count < panelState.budget.maxPerJudgeFollowups;
  });
}

function hasNoProgressCondition(events) {
  const answerEvents = events.filter((event) => event.type === PANEL_EVENT_TYPES.FOUNDER_ANSWER);

  if (answerEvents.length < 2) {
    return false;
  }

  const lastTwo = answerEvents.slice(-2);
  return lastTwo[0].text === lastTwo[1].text;
}
