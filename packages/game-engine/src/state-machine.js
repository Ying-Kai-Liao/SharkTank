import {
  createFinalizedPitch,
  createPitchTimerState,
  DEFAULT_PANEL_BUDGET,
  PANEL_EVENT_TYPES,
  PLAYER_ACTIONS,
  PITCH_CLOSE_REASONS,
  PITCH_SOURCE_TYPES,
  ROUND_STATES,
  validateBargainPayload,
  validateDebriefPayload,
  validateJudgeBundle,
  validatePanelBudget,
  validatePitchStart,
  validatePitchTranscriptUpdate
} from "../../contracts/src/index.js";
import { JUDGE_PROFILES } from "./judges.js";
import { clampBargainTerms, createRevisedOffer, createRoundResult, generateOffers } from "./offers.js";
import { decideContinuation, selectNextJudge } from "./panel-director.js";
import { evaluateAnswer, evaluatePitch, mergeEvaluations } from "./scoring.js";

export const DEFAULT_PITCH_DURATION_SECONDS = 45;

export class InvalidActionError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidActionError";
  }
}

function createPitchCaptureState(durationSeconds = DEFAULT_PITCH_DURATION_SECONDS) {
  return {
    durationSeconds,
    sourceType: null,
    startedAtMs: null,
    closedAtMs: null,
    closeReason: null,
    transcriptUpdates: [],
    finalizedPitch: null
  };
}

function clonePitchCapture(pitchCapture, updates = {}) {
  return {
    ...pitchCapture,
    ...updates,
    transcriptUpdates: updates.transcriptUpdates ?? [...pitchCapture.transcriptUpdates]
  };
}

function clonePanelState(panel) {
  if (!panel) {
    return null;
  }

  return {
    ...panel,
    budget: { ...panel.budget },
    events: [...panel.events],
    judgeFollowupCounts: { ...panel.judgeFollowupCounts }
  };
}

function cloneState(state, updates) {
  return {
    ...state,
    ...updates,
    transcript: updates.transcript ?? [...state.transcript],
    judgeResponses: updates.judgeResponses ?? [...state.judgeResponses],
    offers: updates.offers ?? [...state.offers],
    founderActions: updates.founderActions ?? [...state.founderActions],
    pitchCapture: updates.pitchCapture ?? clonePitchCapture(state.pitchCapture),
    panel: updates.panel !== undefined ? updates.panel : clonePanelState(state.panel)
  };
}

function appendFounderAction(state, action) {
  return [...state.founderActions, action];
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

function readActionTime(action, key) {
  const value = action?.payload?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : Date.now();
}

export function createPanelStateFromBudget(budget = DEFAULT_PANEL_BUDGET) {
  return {
    budget: { ...budget },
    turn: 0,
    events: [],
    judgeFollowupCounts: {},
    awaitingAnswer: false,
    closed: false
  };
}

export function createInitialGameState(options = {}) {
  const pitchDurationSeconds = Number.isInteger(options.pitchDurationSeconds) && options.pitchDurationSeconds > 0
    ? options.pitchDurationSeconds
    : DEFAULT_PITCH_DURATION_SECONDS;

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
    debrief: null,
    transcript: [],
    founderActions: [],
    pitchCapture: createPitchCaptureState(pitchDurationSeconds),
    panel: null
  };
}

export function getPitchTimerSnapshot(state, nowMs = Date.now()) {
  if (!state?.pitchCapture || !Number.isFinite(state.pitchCapture.startedAtMs)) {
    return null;
  }

  return createPitchTimerState({
    durationSeconds: state.pitchCapture.durationSeconds,
    startedAtMs: state.pitchCapture.startedAtMs,
    closedAtMs: state.pitchCapture.closedAtMs,
    nowMs
  });
}

export function getAllowedActions(state, options = {}) {
  const pitchTimer = getPitchTimerSnapshot(state, options.nowMs ?? Date.now());

  switch (state.currentState) {
    case ROUND_STATES.LOBBY:
      return [PLAYER_ACTIONS.START_PITCH];
    case ROUND_STATES.PITCH:
      if (pitchTimer?.isExpired) {
        return [PLAYER_ACTIONS.CLOSE_PITCH];
      }

      return [PLAYER_ACTIONS.SUBMIT_PITCH_TRANSCRIPT, PLAYER_ACTIONS.CLOSE_PITCH];
    case ROUND_STATES.PITCH_CLOSED:
    case ROUND_STATES.JUDGE_REACTIONS:
    case ROUND_STATES.DEALS:
      return [PLAYER_ACTIONS.ADVANCE];
    case ROUND_STATES.FOLLOW_UP: {
      const followUpActions = [PLAYER_ACTIONS.SUBMIT_ANSWER, PLAYER_ACTIONS.DECLINE_QUESTION];
      if (state.offers.length) {
        followUpActions.push(PLAYER_ACTIONS.SUBMIT_BARGAIN);
      }
      return followUpActions;
    }
    case ROUND_STATES.PANEL:
      if (state.panel?.awaitingAnswer) {
        return [PLAYER_ACTIONS.SUBMIT_ANSWER];
      }
      return [PLAYER_ACTIONS.ADVANCE_PANEL_TURN];
    case ROUND_STATES.PLAYER_DECISION:
      return state.offers.length
        ? [PLAYER_ACTIONS.ACCEPT_DEAL, PLAYER_ACTIONS.REJECT_DEAL, PLAYER_ACTIONS.SUBMIT_BARGAIN]
        : [PLAYER_ACTIONS.ADVANCE];
    case ROUND_STATES.ROUND_RESULT:
      return [PLAYER_ACTIONS.REQUEST_DEBRIEF, PLAYER_ACTIONS.ADVANCE];
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

function finalizePitch(state, action) {
  assertAction(state.currentState, ROUND_STATES.PITCH, action.type);

  const nowMs = readActionTime(action, "nowMs");
  const pitchTimer = getPitchTimerSnapshot(state, nowMs);

  if (!pitchTimer) {
    throw new InvalidActionError("Pitch timing is unavailable for this round.");
  }

  const requestedReason = action.payload?.reason;
  const closeReason = pitchTimer.isExpired ? PITCH_CLOSE_REASONS.TIMER_EXPIRED : requestedReason;

  if (!Object.values(PITCH_CLOSE_REASONS).includes(closeReason)) {
    throw new InvalidActionError("Pitch close reason must be manual or timer_expired.");
  }

  const closedAtMs = closeReason === PITCH_CLOSE_REASONS.TIMER_EXPIRED ? pitchTimer.closesAtMs : nowMs;
  const transcriptUpdates = state.pitchCapture.transcriptUpdates.length
    ? state.pitchCapture.transcriptUpdates
    : [
      {
        eventId: "fallback-0",
        sequence: 0,
        text: "Founder provided a brief opening statement.",
        receivedAtMs: closedAtMs,
        sourceType: state.pitchCapture.sourceType ?? PITCH_SOURCE_TYPES.MOCK
      }
    ];

  const finalizedPitch = createFinalizedPitch({
    updates: transcriptUpdates,
    durationSeconds: state.pitchCapture.durationSeconds,
    startedAtMs: state.pitchCapture.startedAtMs,
    closedAtMs,
    closeReason
  });
  const evaluation = evaluatePitch(finalizedPitch.text);

  return cloneState(state, {
    currentState: ROUND_STATES.PITCH_CLOSED,
    pitch: finalizedPitch.text,
    evaluation,
    transcript: appendTranscript(state, "Founder", finalizedPitch.text),
    pitchCapture: clonePitchCapture(state.pitchCapture, {
      closedAtMs,
      closeReason,
      finalizedPitch
    })
  });
}

export function applyAction(state, action) {
  switch (action.type) {
    case PLAYER_ACTIONS.START_PITCH: {
      assertAction(state.currentState, ROUND_STATES.LOBBY, action.type);
      const startPayload = {
        durationSeconds:
          Number.isInteger(action.payload?.durationSeconds) && action.payload.durationSeconds > 0
            ? action.payload.durationSeconds
            : state.pitchCapture.durationSeconds,
        startedAtMs: readActionTime(action, "startedAtMs"),
        sourceType: action.payload?.sourceType ?? PITCH_SOURCE_TYPES.MOCK
      };

      validatePitchStart(startPayload);

      return cloneState(state, {
        currentState: ROUND_STATES.PITCH,
        pitch: "",
        answer: "",
        evaluation: null,
        judgeResponses: [],
        leadQuestion: "",
        offers: [],
        acceptedDealId: null,
        roundResult: null,
        transcript: [],
        founderActions: [],
        pitchCapture: {
          durationSeconds: startPayload.durationSeconds,
          sourceType: startPayload.sourceType,
          startedAtMs: startPayload.startedAtMs,
          closedAtMs: null,
          closeReason: null,
          transcriptUpdates: [],
          finalizedPitch: null
        }
      });
    }
    case PLAYER_ACTIONS.SUBMIT_PITCH_TRANSCRIPT: {
      assertAction(state.currentState, ROUND_STATES.PITCH, action.type);
      const update = {
        eventId: action.payload?.eventId,
        sequence: action.payload?.sequence,
        text: action.payload?.text,
        receivedAtMs: readActionTime(action, "receivedAtMs"),
        sourceType: action.payload?.sourceType ?? state.pitchCapture.sourceType ?? PITCH_SOURCE_TYPES.MOCK
      };

      validatePitchTranscriptUpdate(update);

      if (state.pitchCapture.closedAtMs !== null) {
        throw new InvalidActionError("Pitch capture is already closed.");
      }

      const pitchTimer = getPitchTimerSnapshot(state, update.receivedAtMs);
      if (!pitchTimer || pitchTimer.isExpired) {
        throw new InvalidActionError("Cannot accept transcript updates after the pitch timer has expired.");
      }

      return cloneState(state, {
        pitchCapture: clonePitchCapture(state.pitchCapture, {
          transcriptUpdates: [...state.pitchCapture.transcriptUpdates, update]
        })
      });
    }
    case PLAYER_ACTIONS.CLOSE_PITCH:
      return finalizePitch(state, action);
    case PLAYER_ACTIONS.ADVANCE: {
      if (state.currentState === ROUND_STATES.PITCH_CLOSED) {
        validateJudgeBundle(action.payload);
        const judgeResponses = action.payload.judgeResponses;
        const usePanel = action.payload.usePanel !== false;

        if (usePanel) {
          const panelBudget = action.payload.panelBudget || DEFAULT_PANEL_BUDGET;
          validatePanelBudget(panelBudget);

          return cloneState(state, {
            currentState: ROUND_STATES.PANEL,
            judgeResponses,
            leadQuestion: action.payload.leadQuestion,
            panel: createPanelStateFromBudget(panelBudget),
            transcript: [
              ...state.transcript,
              ...judgeResponses.map((response) => ({
                speaker: response.judgeName,
                text: response.shortReaction
              }))
            ]
          });
        }

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
    case PLAYER_ACTIONS.ADVANCE_PANEL_TURN: {
      assertAction(state.currentState, ROUND_STATES.PANEL, action.type);

      if (!state.panel || state.panel.closed) {
        throw new InvalidActionError("Panel is not active.");
      }

      if (state.panel.awaitingAnswer) {
        throw new InvalidActionError("Cannot advance panel turn while awaiting a founder answer.");
      }

      const decision = decideContinuation(state.panel, state.judgeResponses);

      if (decision.decision === "close") {
        const closeEvent = {
          type: PANEL_EVENT_TYPES.PANEL_CLOSED,
          turn: state.panel.turn,
          reason: decision.reason
        };
        const evaluation = state.evaluation;
        const offers = generateOffers(evaluation, JUDGE_PROFILES);

        return cloneState(state, {
          currentState: ROUND_STATES.DEALS,
          offers,
          panel: {
            ...state.panel,
            events: [...state.panel.events, closeEvent],
            closed: true
          }
        });
      }

      const nextJudge = selectNextJudge(state.panel, state.judgeResponses);
      const questionText = action.payload?.question || nextJudge.question || "Tell me more about your approach.";
      const nextTurn = state.panel.turn + 1;
      const questionEvent = {
        type: PANEL_EVENT_TYPES.JUDGE_QUESTION,
        turn: nextTurn,
        judgeId: nextJudge.judgeId,
        judgeName: nextJudge.judgeName,
        text: questionText
      };

      return cloneState(state, {
        panel: {
          ...state.panel,
          turn: nextTurn,
          events: [...state.panel.events, questionEvent],
          awaitingAnswer: true,
          judgeFollowupCounts: {
            ...state.panel.judgeFollowupCounts,
            [nextJudge.judgeId]: (state.panel.judgeFollowupCounts[nextJudge.judgeId] || 0) + 1
          }
        },
        transcript: appendTranscript(state, nextJudge.judgeName, questionText)
      });
    }
    case PLAYER_ACTIONS.SUBMIT_ANSWER: {
      if (state.currentState === ROUND_STATES.PANEL) {
        if (!state.panel || !state.panel.awaitingAnswer) {
          throw new InvalidActionError("Panel is not awaiting a founder answer.");
        }

        const answer = action.payload?.answer?.trim();
        if (!answer) {
          throw new InvalidActionError("A follow-up answer is required.");
        }

        const answerBoost = evaluateAnswer(answer);
        const evaluation = mergeEvaluations(state.evaluation, answerBoost);
        const answerEvent = {
          type: PANEL_EVENT_TYPES.FOUNDER_ANSWER,
          turn: state.panel.turn,
          text: answer
        };

        return cloneState(state, {
          answer,
          evaluation,
          panel: {
            ...state.panel,
            events: [...state.panel.events, answerEvent],
            awaitingAnswer: false
          },
          transcript: appendTranscript(state, "Founder", answer)
        });
      }

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
    case PLAYER_ACTIONS.SUBMIT_BARGAIN: {
      if (state.currentState !== ROUND_STATES.FOLLOW_UP && state.currentState !== ROUND_STATES.PLAYER_DECISION) {
        throw new InvalidActionError(`Cannot use "${action.type}" while round state is ${state.currentState}.`);
      }

      if (!state.offers.length) {
        throw new InvalidActionError("Cannot bargain when no offers exist.");
      }

      validateBargainPayload(action.payload);

      const targetOffer = state.offers.find((offer) => offer.id === action.payload.offerId);
      if (!targetOffer) {
        throw new InvalidActionError("The referenced offer does not exist.");
      }

      const clampedTerms = clampBargainTerms(targetOffer, action.payload.terms);
      const revisedOffer = createRevisedOffer(targetOffer, clampedTerms);
      const updatedOffers = state.offers.map((offer) =>
        offer.id === targetOffer.id ? revisedOffer : offer
      );

      const founderAction = { type: "bargain", offerId: targetOffer.id, terms: clampedTerms };

      return cloneState(state, {
        offers: updatedOffers,
        transcript: appendTranscript(
          state,
          "Founder",
          `Founder proposes revised terms: $${clampedTerms.amount.toLocaleString()} for ${clampedTerms.equity}% equity.`
        ),
        founderActions: appendFounderAction(state, founderAction)
      });
    }
    case PLAYER_ACTIONS.DECLINE_QUESTION: {
      assertAction(state.currentState, ROUND_STATES.FOLLOW_UP, action.type);

      const declineAction = { type: "decline" };
      const offers = generateOffers(state.evaluation, JUDGE_PROFILES);

      if (offers.length) {
        return cloneState(state, {
          currentState: ROUND_STATES.DEALS,
          offers,
          transcript: appendTranscript(state, "Founder", "Founder declined to answer the question."),
          founderActions: appendFounderAction(state, declineAction)
        });
      }

      const roundResult = createRoundResult({
        evaluation: state.evaluation,
        offers: [],
        decision: { type: "no_offer" }
      });

      return cloneState(state, {
        currentState: ROUND_STATES.ROUND_RESULT,
        roundResult,
        transcript: appendTranscript(state, "Founder", "Founder declined to answer. No offers were generated."),
        founderActions: appendFounderAction(state, declineAction)
      });
    }
    case PLAYER_ACTIONS.REQUEST_DEBRIEF: {
      assertAction(state.currentState, ROUND_STATES.ROUND_RESULT, action.type);
      validateDebriefPayload(action.payload?.debrief);

      return cloneState(state, {
        currentState: ROUND_STATES.DEBRIEF,
        debrief: action.payload.debrief
      });
    }
    default:
      throw new InvalidActionError(`Unknown action "${action.type}".`);
  }
}
