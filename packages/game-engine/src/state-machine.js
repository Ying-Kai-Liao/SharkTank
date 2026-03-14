import {
  PLAYER_ACTIONS,
  ROUND_STATES,
  validateJudgeBundle
} from "../../contracts/src/index.js";
import { JUDGE_PROFILES } from "./judges.js";
import { createRoundResult, generateOffers } from "./offers.js";
import { evaluateAnswer, evaluatePitch, mergeEvaluations } from "./scoring.js";

export class InvalidActionError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidActionError";
  }
}

function cloneState(state, updates) {
  return {
    ...state,
    ...updates,
    transcript: updates.transcript ?? [...state.transcript]
  };
}

function appendTranscript(state, speaker, text) {
  return [
    ...state.transcript,
    {
      speaker,
      text
    }
  ];
}

function assertAction(currentState, expectedState, actionType) {
  if (currentState !== expectedState) {
    throw new InvalidActionError(`Cannot use "${actionType}" while round state is ${currentState}.`);
  }
}

export function createInitialGameState() {
  return {
    currentState: ROUND_STATES.LOBBY,
    pitch: "",
    answer: "",
    evaluation: null,
    judgeResponses: [],
    leadQuestion: "",
    offers: [],
    acceptedDealId: null,
    roundResult: null,
    transcript: []
  };
}

export function getAllowedActions(state) {
  switch (state.currentState) {
    case ROUND_STATES.LOBBY:
      return [PLAYER_ACTIONS.SUBMIT_PITCH];
    case ROUND_STATES.PITCH_SUBMITTED:
    case ROUND_STATES.JUDGE_REACTIONS:
    case ROUND_STATES.DEALS:
      return [PLAYER_ACTIONS.ADVANCE];
    case ROUND_STATES.FOLLOW_UP:
      return [PLAYER_ACTIONS.SUBMIT_ANSWER];
    case ROUND_STATES.PLAYER_DECISION:
      return state.offers.length
        ? [PLAYER_ACTIONS.ACCEPT_DEAL, PLAYER_ACTIONS.REJECT_DEAL]
        : [PLAYER_ACTIONS.ADVANCE];
    default:
      return [];
  }
}

function resolveDealAcceptance(state, dealId) {
  const selectedOffer = state.offers.find((offer) => offer.id === dealId);

  if (!selectedOffer) {
    throw new InvalidActionError("The selected deal does not exist.");
  }

  const roundResult = createRoundResult({
    evaluation: state.evaluation,
    offers: state.offers,
    decision: {
      type: "accepted",
      offer: selectedOffer
    }
  });

  return cloneState(state, {
    currentState: ROUND_STATES.ROUND_RESULT,
    acceptedDealId: selectedOffer.id,
    roundResult,
    transcript: appendTranscript(
      state,
      selectedOffer.judgeName,
      `Deal accepted: $${selectedOffer.amount.toLocaleString()} for ${selectedOffer.equity}% equity.`
    )
  });
}

function resolveDealRejection(state) {
  const roundResult = createRoundResult({
    evaluation: state.evaluation,
    offers: state.offers,
    decision: {
      type: state.offers.length ? "rejected" : "no_offer"
    }
  });

  return cloneState(state, {
    currentState: ROUND_STATES.ROUND_RESULT,
    roundResult,
    transcript: appendTranscript(
      state,
      "Founder",
      state.offers.length ? "Founder rejected every offer." : "No offers arrived. The round closes without a deal."
    )
  });
}

export function applyAction(state, action) {
  switch (action.type) {
    case PLAYER_ACTIONS.SUBMIT_PITCH: {
      assertAction(state.currentState, ROUND_STATES.LOBBY, action.type);
      const pitch = action.payload?.pitch?.trim();
      const evaluation = evaluatePitch(pitch);

      return cloneState(state, {
        currentState: ROUND_STATES.PITCH_SUBMITTED,
        pitch,
        evaluation,
        transcript: appendTranscript(state, "Founder", pitch)
      });
    }
    case PLAYER_ACTIONS.ADVANCE: {
      if (state.currentState === ROUND_STATES.PITCH_SUBMITTED) {
        validateJudgeBundle(action.payload);
        const judgeResponses = action.payload.judgeResponses;

        return cloneState(state, {
          currentState: ROUND_STATES.JUDGE_REACTIONS,
          judgeResponses,
          leadQuestion: action.payload.leadQuestion,
          transcript: [
            ...state.transcript,
            ...judgeResponses.map((response) => ({
              speaker: response.judgeName,
              text: response.shortReaction
            }))
          ]
        });
      }

      if (state.currentState === ROUND_STATES.JUDGE_REACTIONS) {
        return cloneState(state, {
          currentState: ROUND_STATES.FOLLOW_UP
        });
      }

      if (state.currentState === ROUND_STATES.DEALS) {
        return cloneState(state, {
          currentState: ROUND_STATES.PLAYER_DECISION
        });
      }

      if (state.currentState === ROUND_STATES.PLAYER_DECISION && !state.offers.length) {
        return resolveDealRejection(state);
      }

      throw new InvalidActionError(`Cannot advance from ${state.currentState}.`);
    }
    case PLAYER_ACTIONS.SUBMIT_ANSWER: {
      assertAction(state.currentState, ROUND_STATES.FOLLOW_UP, action.type);
      const answer = action.payload?.answer?.trim();
      const answerBoost = evaluateAnswer(answer);
      const evaluation = mergeEvaluations(state.evaluation, answerBoost);
      const offers = generateOffers(evaluation, JUDGE_PROFILES);

      return cloneState(state, {
        currentState: ROUND_STATES.DEALS,
        answer,
        evaluation,
        offers,
        transcript: appendTranscript(state, "Founder", answer)
      });
    }
    case PLAYER_ACTIONS.ACCEPT_DEAL: {
      assertAction(state.currentState, ROUND_STATES.PLAYER_DECISION, action.type);

      if (!state.offers.length) {
        throw new InvalidActionError("There are no deals to accept.");
      }

      return resolveDealAcceptance(state, action.payload?.dealId);
    }
    case PLAYER_ACTIONS.REJECT_DEAL: {
      assertAction(state.currentState, ROUND_STATES.PLAYER_DECISION, action.type);

      if (!state.offers.length) {
        throw new InvalidActionError("There are no deals to reject.");
      }

      return resolveDealRejection(state);
    }
    default:
      throw new InvalidActionError(`Unknown action "${action.type}".`);
  }
}
