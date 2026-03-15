"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applyAction,
  createInitialGameState,
  createLivePitchTranscriptSource,
  createMockPitchTranscriptSource,
  createPitchCaptureAdapter,
  getAllowedActions,
  getPitchTimerSnapshot,
  JUDGE_PROFILES,
  PANEL_EVENT_TYPES,
  PLAYER_ACTIONS,
  PITCH_CLOSE_REASONS,
  PITCH_SOURCE_TYPES,
  ROUND_STATES
} from "@sharktank/game-engine";
import offerConversation from "./data/mock-offer-conversation.json";
import DebriefReport from "../components/DebriefReport";
import ScoreBadge from "../components/ScoreBadge";
import StageScene from "../components/StageScene";

const PITCH_SECONDS = 45;
const LIVE_REACTION_POLL_MS = 1_200;
const STAGE_JUDGES = Object.freeze([
  { id: "cat", name: "Zephyr Valtos" },
  { id: "dog", name: "Ryo Barkman" },
  { id: "shark", name: "Mara Finley" }
]);
const JUDGE_NAMES = {
  cat: "Zephyr Valtos",
  dog: "Ryo Barkman",
  shark: "Mara Finley"
};
const JUDGE_TO_STAGE = {
  rhea: "cat",
  marco: "dog",
  tori: "shark"
};
const OFFER_CONVERSATION = offerConversation.conversation || [];
function createRoundState() {
  return createInitialGameState({
    pitchDurationSeconds: PITCH_SECONDS
  });
}

function formatTime(secondsLeft) {
  const safeSeconds = Math.max(0, secondsLeft);
  const minutes = Math.floor(safeSeconds / 60).toString();
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatOffer(offer) {
  if (!offer) {
    return "No offer";
  }

  return `$${Number(offer.amount || 0).toLocaleString()} for ${Number(offer.equity || 0)}%`;
}

function joinTranscriptUpdates(updates) {
  return updates
    .map((update) => update.text.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function createJudgeBundle(evaluation) {
  const leadQuestion = "What evidence do you have that customers will keep buying this?";

  return {
    leadQuestion,
    judgeResponses: JUDGE_PROFILES.map((judge, index) => ({
      judgeId: judge.id,
      judgeName: judge.name,
      sentiment: index === 0 ? "impressed" : "interested",
      shortReaction: `${judge.name} sees enough traction to keep pressing on the core business case.`,
      question: leadQuestion,
      rationaleTags: [
        evaluation.business_viability >= 70 ? "strong_monetization" : "needs_revenue_proof",
        evaluation.clarity >= 70 ? "clear_pitch" : "needs_clarity"
      ]
    }))
  };
}

function averageEvaluationScore(evaluation) {
  if (!evaluation) {
    return 0;
  }

  const values = Object.values(evaluation);
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

export default function Page() {
  const router = useRouter();
  const hasNavigatedFeedbackRef = useRef(false);
  const roundStateRef = useRef(createRoundState());
  const captureAdapterRef = useRef(null);
  const liveReactionRequestRef = useRef(false);
  const liveReactionMetaRef = useRef({
    lastReactionAtMs: null,
    lastTranscriptSequence: null
  });

  const [phase, setPhase] = useState("intro");
  const [roundState, setRoundState] = useState(roundStateRef.current);
  const [nowMs, setNowMs] = useState(Date.now());
  const [chatEnabled, setChatEnabled] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [judgingFinished, setJudgingFinished] = useState(false);
  const [judgeReactions, setJudgeReactions] = useState({});
  const [offerLineIndex, setOfferLineIndex] = useState(0);
  const [offerDecisions, setOfferDecisions] = useState({});
  const [acceptedOfferJudgeId, setAcceptedOfferJudgeId] = useState(null);
  const [liveReactionEvent, setLiveReactionEvent] = useState(null);
  const [pitchSourceType, setPitchSourceType] = useState(PITCH_SOURCE_TYPES.MOCK);
  const [mediaRecorderAvailable, setMediaRecorderAvailable] = useState(false);
  const [debriefData, setDebriefData] = useState(null);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const debriefFetchedRef = useRef(false);

  const activeOfferLine = OFFER_CONVERSATION[offerLineIndex] || null;
  const pitchTimer = getPitchTimerSnapshot(roundState, nowMs);
  const pitchTranscriptText = joinTranscriptUpdates(roundState.pitchCapture.transcriptUpdates);
  const offersByJudge = Object.fromEntries(
    roundState.offers.map((offer) => [JUDGE_TO_STAGE[offer.judgeId] || offer.judgeId, offer])
  );
  const offerJudgeIds = roundState.offers.map((offer) => JUDGE_TO_STAGE[offer.judgeId] || offer.judgeId);
  const allowedActions = getAllowedActions(roundState, { nowMs });
  const liveJudgePresence = Object.fromEntries(
    (liveReactionEvent?.judges || []).map((judge) => [judge.judgeId, judge])
  );

  const panelEvents = roundState.panel?.events || [];
  const latestPanelQuestion = [...panelEvents]
    .reverse()
    .find((event) => event.type === PANEL_EVENT_TYPES.JUDGE_QUESTION);
  const panelAwaitingAnswer = roundState.panel?.awaitingAnswer || false;
  const panelTurn = roundState.panel?.turn || 0;
  const panelMaxTurns = roundState.panel?.budget?.maxTurns || 0;
  const panelSpeakerStageId = latestPanelQuestion ? JUDGE_TO_STAGE[latestPanelQuestion.judgeId] || null : null;

  const activeSpeakerId =
    phase === "judging" && panelAwaitingAnswer && panelSpeakerStageId ? panelSpeakerStageId : null;
  const activeOfferSpeakerId = phase === "offer-dialogue" && activeOfferLine ? activeOfferLine.speakerId : null;
  const spotlightSpeakerId = activeSpeakerId || activeOfferSpeakerId;

  const rejectedOfferCount = offerJudgeIds.filter((judgeId) => offerDecisions[judgeId] === "rejected").length;
  const allOffersRejected = offerJudgeIds.length > 0 && rejectedOfferCount === offerJudgeIds.length;
  const displayScore = averageEvaluationScore(roundState.evaluation);

  const speakerName =
    phase === "offer-dialogue" && activeOfferSpeakerId ? JUDGE_NAMES[activeOfferSpeakerId] || "Judge"
      : phase === "judging" && panelAwaitingAnswer && panelSpeakerStageId
        ? JUDGE_NAMES[panelSpeakerStageId] || "Judge"
        : phase === "judging" && chatEnabled ? "Your Turn"
          : phase === "offer-select" ? "Offer Decision"
            : phase === "pitch" ? "Pitch Capture"
              : phase === "pitch-closed" ? "Pitch Locked"
                : "";

  const dialogueText =
    phase === "offer-dialogue" && activeOfferLine ? activeOfferLine.text
      : phase === "offer-select" && acceptedOfferJudgeId
        ? `You accepted ${JUDGE_NAMES[acceptedOfferJudgeId]}'s offer: ${formatOffer(offersByJudge[acceptedOfferJudgeId])}.`
        : phase === "offer-select" && allOffersRejected
          ? "You rejected every available offer. Hover judges to inspect the cards again."
          : phase === "offer-select" && !offerJudgeIds.length
            ? "No judges made an offer this round."
            : phase === "offer-select"
              ? "Hover each judge to inspect the offer card, then accept one or reject them all."
              : phase === "judging" && panelAwaitingAnswer && latestPanelQuestion
                ? latestPanelQuestion.text
                : phase === "judging" && chatEnabled
                  ? "Reply to the judges to continue the round."
                  : phase === "pitch" && pitchTranscriptText
                    ? pitchTranscriptText
                    : phase === "pitch"
                      ? "Mock transcript capture is running. The engine will finalize this pitch when the timer closes."
                      : phase === "pitch-closed"
                        ? roundState.pitchCapture.finalizedPitch?.text || "Pitch finalized."
                        : "";

  const statusText =
    phase === "pitch" && pitchTimer
      ? `Source: ${roundState.pitchCapture.sourceType} | Live presence: ${liveReactionEvent?.sourceType || "warming_up"} | Remaining: ${formatTime(pitchTimer.remainingSeconds)}`
      : phase === "pitch-closed"
        ? `Closed: ${roundState.pitchCapture.closeReason || PITCH_CLOSE_REASONS.MANUAL}`
        : phase === "offer-dialogue" && activeOfferLine
          ? `Offer conversation ${offerLineIndex + 1}/${OFFER_CONVERSATION.length}`
          : phase === "offer-select" && acceptedOfferJudgeId
            ? "Deal locked. You can still hover judges to inspect the cards."
            : phase === "offer-select"
              ? `Offers available: ${offerJudgeIds.length} | Rejected: ${rejectedOfferCount}`
              : phase === "judging" && panelTurn > 0
                ? `Panel turn ${panelTurn}/${panelMaxTurns} | ${panelAwaitingAnswer ? "Awaiting your answer" : "Judge deliberating..."}`
                : phase === "judging" && judgingFinished
                  ? `Player replies sent: ${chatHistory.length}`
                  : "";

  const showAdvance = phase === "offer-dialogue" && Boolean(activeOfferLine);

  function setRoundStateValue(nextState) {
    roundStateRef.current = nextState;
    setRoundState(nextState);
  }

  function stopCapture(reason) {
    captureAdapterRef.current?.stop(reason);
    captureAdapterRef.current = null;
  }

  function resetLiveReactionState() {
    liveReactionMetaRef.current = {
      lastReactionAtMs: null,
      lastTranscriptSequence: null
    };
    liveReactionRequestRef.current = false;
    setLiveReactionEvent(null);
  }

  function commitRoundAction(action, options = {}) {
    try {
      const nextState = applyAction(roundStateRef.current, action);
      setRoundStateValue(nextState);
      return nextState;
    } catch (error) {
      if (options.swallowInvalid && error?.name === "InvalidActionError") {
        return roundStateRef.current;
      }

      throw error;
    }
  }

  function initializeJudgingFlow() {
    setChatEnabled(false);
    setJudgingFinished(false);
    setJudgeReactions({});
    setOfferLineIndex(0);
    setOfferDecisions({});
    setAcceptedOfferJudgeId(null);
    setDebriefData(null);
    setDebriefLoading(false);
    debriefFetchedRef.current = false;
    resetLiveReactionState();
  }

  function moveToFeedbackScreen() {
    if (hasNavigatedFeedbackRef.current) {
      return;
    }

    hasNavigatedFeedbackRef.current = true;

    const score = averageEvaluationScore(roundStateRef.current.evaluation);
    const scoreTier = score >= 80 ? "good" : score >= 62 ? "medium" : "bad";
    const decisionType = acceptedOfferJudgeId ? "accept" : "disaccept";

    const query = new URLSearchParams({
      score: String(score),
      scoreTier,
      decisionType
    });

    if (acceptedOfferJudgeId) {
      query.set("acceptedJudgeId", acceptedOfferJudgeId);
    }

    startTransition(() => {
      router.push(`/feedback?${query.toString()}`);
    });
  }

  function handleStart() {
    stopCapture("restart");
    hasNavigatedFeedbackRef.current = false;

    const selectedSourceType = pitchSourceType;
    const initialState = createRoundState();
    const startedAtMs = Date.now();
    const startedState = applyAction(initialState, {
      type: PLAYER_ACTIONS.START_PITCH,
      payload: {
        durationSeconds: PITCH_SECONDS,
        startedAtMs,
        sourceType: selectedSourceType
      }
    });

    setRoundStateValue(startedState);
    setNowMs(startedAtMs);
    setPhase("pitch");
    setChatEnabled(false);
    setChatInput("");
    setChatHistory([]);
    setJudgingFinished(false);
    setJudgeReactions({});
    setOfferLineIndex(0);
    setOfferDecisions({});
    setAcceptedOfferJudgeId(null);
    setDebriefData(null);
    setDebriefLoading(false);
    debriefFetchedRef.current = false;
    resetLiveReactionState();

    const source =
      selectedSourceType === PITCH_SOURCE_TYPES.LIVE_STT
        ? createLivePitchTranscriptSource({ transcribeEndpoint: "/api/transcribe", chunkIntervalMs: 3_000 })
        : createMockPitchTranscriptSource();

    const adapter = createPitchCaptureAdapter({
      source,
      onTranscriptUpdate: (update) => {
        commitRoundAction(
          {
            type: PLAYER_ACTIONS.SUBMIT_PITCH_TRANSCRIPT,
            payload: update
          },
          { swallowInvalid: true }
        );
      }
    });

    captureAdapterRef.current = adapter;
    adapter.start({
      startedAtMs
    });
  }

  function handleManualClosePitch() {
    stopCapture("manual-close");
    const nextState = commitRoundAction({
      type: PLAYER_ACTIONS.CLOSE_PITCH,
      payload: {
        nowMs: Date.now(),
        reason: PITCH_CLOSE_REASONS.MANUAL
      }
    });

    if (nextState.currentState === ROUND_STATES.PITCH_CLOSED) {
      setPhase("pitch-closed");
    }
  }

  function handleAdvanceDialogue() {
    if (phase === "offer-dialogue") {
      if (!activeOfferLine) {
        return;
      }

      if (offerLineIndex < OFFER_CONVERSATION.length - 1) {
        setOfferLineIndex((current) => current + 1);
        return;
      }

      if (!roundStateRef.current.offers.length) {
        commitRoundAction({ type: PLAYER_ACTIONS.ADVANCE });
        return;
      }

      setPhase("offer-select");
    }
  }

  function advancePanelTurn(questionText) {
    const nextState = commitRoundAction({
      type: PLAYER_ACTIONS.ADVANCE_PANEL_TURN,
      payload: questionText ? { question: questionText } : {}
    });

    if (nextState.currentState === ROUND_STATES.DEALS) {
      setJudgingFinished(true);
      setChatEnabled(false);

      if (!nextState.offers.length) {
        commitRoundAction({ type: PLAYER_ACTIONS.ADVANCE });
      } else if (OFFER_CONVERSATION.length) {
        setOfferLineIndex(0);
        setPhase("offer-dialogue");
      } else {
        setPhase("offer-select");
      }
      return;
    }

    if (nextState.panel?.awaitingAnswer) {
      setChatEnabled(true);
    }
  }

  function handleAcceptOffer(judgeId) {
    const offer = offersByJudge[judgeId];
    if (!offer) {
      return;
    }

    setAcceptedOfferJudgeId(judgeId);
    setOfferDecisions(() => {
      const next = {};
      offerJudgeIds.forEach((id) => {
        next[id] = id === judgeId ? "accepted" : "rejected";
      });
      return next;
    });

    commitRoundAction({
      type: PLAYER_ACTIONS.ACCEPT_DEAL,
      payload: { dealId: offer.id }
    });
  }

  function handleRejectAllOffers() {
    const next = {};
    offerJudgeIds.forEach((judgeId) => {
      next[judgeId] = "rejected";
    });

    setOfferDecisions(next);
    setAcceptedOfferJudgeId(null);
    commitRoundAction({
      type: PLAYER_ACTIONS.REJECT_DEAL
    });
  }

  function handleDeclineQuestion() {
    const nextState = commitRoundAction({
      type: PLAYER_ACTIONS.DECLINE_QUESTION
    });

    if (nextState.currentState === ROUND_STATES.DEALS) {
      if (nextState.offers.length) {
        if (OFFER_CONVERSATION.length) {
          setOfferLineIndex(0);
          setPhase("offer-dialogue");
        } else {
          setPhase("offer-select");
        }
      } else {
        commitRoundAction({ type: PLAYER_ACTIONS.ADVANCE });
      }
    }
  }

  async function handleSendMessage() {
    const trimmedMessage = chatInput.trim();

    if (!trimmedMessage || !chatEnabled) {
      return;
    }

    setChatHistory((current) => [...current, trimmedMessage]);
    setChatInput("");
    setChatEnabled(false);

    try {
      const panelTurnIndex = roundStateRef.current.panel?.turn || 0;
      const response = await fetch("/api/judge-reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          groupIndex: panelTurnIndex,
          playerMessage: trimmedMessage
        })
      });

      if (response.ok) {
        const payload = await response.json();
        if (payload?.reactions && typeof payload.reactions === "object") {
          setJudgeReactions(payload.reactions);
        }
      }
    } catch {
      // Keep current reaction sprites if mock API is unavailable.
    }

    if (judgingFinished) {
      return;
    }

    commitRoundAction({
      type: PLAYER_ACTIONS.SUBMIT_ANSWER,
      payload: { answer: trimmedMessage }
    });

    advancePanelTurn();
  }

  useEffect(() => {
    setMediaRecorderAvailable(
      typeof window !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      typeof navigator?.mediaDevices?.getUserMedia === "function"
    );
  }, []);

  useEffect(() => {
    if (roundState.currentState !== ROUND_STATES.PITCH) {
      return;
    }

    const intervalId = setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => clearInterval(intervalId);
  }, [roundState.currentState]);

  useEffect(() => {
    if (phase !== "pitch" || roundState.currentState !== ROUND_STATES.PITCH) {
      return;
    }

    let cancelled = false;

    async function pollLiveReactions() {
      if (liveReactionRequestRef.current) {
        return;
      }

      const transcriptUpdates = roundStateRef.current.pitchCapture.transcriptUpdates;
      if (!transcriptUpdates.length) {
        return;
      }

      liveReactionRequestRef.current = true;

      try {
        const response = await fetch("/api/live-judge-reactions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            roundId: "local-round",
            generatedAtMs: Date.now(),
            presentationOnly: true,
            preferredSource: "provider",
            judges: STAGE_JUDGES,
            transcriptUpdates,
            lastReactionAtMs: liveReactionMetaRef.current.lastReactionAtMs,
            lastTranscriptSequence: liveReactionMetaRef.current.lastTranscriptSequence
          })
        });

        if (!response.ok) {
          return;
        }

        const payload = await response.json();

        if (!cancelled && payload?.emitted && payload?.event) {
          setLiveReactionEvent(payload.event);
          liveReactionMetaRef.current = {
            lastReactionAtMs: payload.event.generatedAtMs,
            lastTranscriptSequence: payload.event.transcriptSequence
          };
        }
      } catch {
        // Live pitch reactions stay cosmetic, so the stage keeps the last cue on fetch failure.
      } finally {
        liveReactionRequestRef.current = false;
      }
    }

    pollLiveReactions();
    const intervalId = setInterval(pollLiveReactions, LIVE_REACTION_POLL_MS);

    return () => {
      cancelled = true;
      liveReactionRequestRef.current = false;
      clearInterval(intervalId);
    };
  }, [phase, roundState.currentState]);

  useEffect(() => {
    if (roundState.currentState !== ROUND_STATES.PITCH || !pitchTimer?.isExpired) {
      return;
    }

    stopCapture("timer-expired");
    const nextState = commitRoundAction({
      type: PLAYER_ACTIONS.CLOSE_PITCH,
      payload: {
        nowMs: pitchTimer.closesAtMs,
        reason: PITCH_CLOSE_REASONS.TIMER_EXPIRED
      }
    });

    if (nextState.currentState === ROUND_STATES.PITCH_CLOSED) {
      setPhase("pitch-closed");
    }
  }, [pitchTimer?.closesAtMs, pitchTimer?.isExpired, roundState.currentState]);

  useEffect(() => {
    if (roundState.currentState !== ROUND_STATES.PITCH_CLOSED || phase !== "pitch-closed") {
      return;
    }

    const timeoutId = setTimeout(() => {
      initializeJudgingFlow();
      commitRoundAction({
        type: PLAYER_ACTIONS.ADVANCE,
        payload: createJudgeBundle(roundState.evaluation)
      });
      setPhase("judging");
      advancePanelTurn();
    }, 900);

    return () => clearTimeout(timeoutId);
  }, [phase, roundState.currentState, roundState.evaluation]);

  useEffect(() => {
    if (roundState.currentState !== ROUND_STATES.DEBRIEF) {
      return;
    }

    setPhase("debrief");

    if (debriefFetchedRef.current) {
      return;
    }

    debriefFetchedRef.current = true;
    setDebriefLoading(true);

    fetch("/api/judge-debrief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evaluation: roundState.evaluation,
        judgeResponses: roundState.judgeResponses,
        transcript: roundState.transcript,
        offers: roundState.offers,
        roundId: "local-round",
        sessionId: "local-session",
        founderId: "local-founder"
      })
    })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error("Debrief fetch failed")))
      .then((data) => {
        setDebriefData(data.debrief);
        setDebriefLoading(false);
      })
      .catch(() => {
        setDebriefLoading(false);
      });
  }, [roundState.currentState]);

  // Auto-navigate removed: player now chooses between debrief and feedback

  useEffect(() => {
    return () => {
      stopCapture("unmount");
    };
  }, []);

  return (
    <main className="relative h-screen overflow-hidden bg-black text-white">
      <ScoreBadge score={displayScore} />
      <StageScene
        activeSpeakerId={spotlightSpeakerId}
        judgeReactions={judgeReactions}
        liveJudgePresence={liveJudgePresence}
        livePresenceEnabled={phase === "pitch"}
        offersByJudge={offersByJudge}
        offerDecisions={offerDecisions}
        offerSelectionEnabled={phase === "offer-select"}
        onAcceptOffer={handleAcceptOffer}
        onRejectAllOffers={handleRejectAllOffers}
        speakerName={speakerName}
        dialogueText={dialogueText}
        chatEnabled={phase === "judging" ? chatEnabled : false}
        inputValue={chatInput}
        onInputChange={setChatInput}
        onSend={handleSendMessage}
        onAdvance={handleAdvanceDialogue}
        showAdvance={showAdvance}
        statusText={statusText}
      />

      {phase === "pitch" && pitchTimer && (
        <>
          <div className="font-display absolute right-4 top-4 z-30 rounded-xl border border-white/30 bg-black/55 px-4 py-2 text-xl tracking-wide md:right-6 md:top-6 md:text-3xl">
            Pitch {formatTime(pitchTimer.remainingSeconds)}
          </div>

          <section className="absolute inset-x-0 bottom-3 z-30 px-3 md:bottom-6 md:px-6">
            <div className="mx-auto w-full max-w-4xl rounded-3xl border border-white/25 bg-black/82 px-4 py-4 shadow-dialogue backdrop-blur md:px-6 md:py-5">
              <p className="font-display text-xl text-white md:text-2xl">Timed Pitch Capture</p>
              <p className="mt-2 text-sm text-white/90 md:text-base">
                {pitchTranscriptText || "Listening for transcript updates from the mock capture source..."}
              </p>
              <p className="mt-2 text-xs text-white/75 md:text-sm">
                Live judge presence runs through a separate presentation-only adapter and never changes deterministic scores or round flow.
              </p>
              <p className="mt-2 text-xs text-white/70 md:text-sm">
                Structured updates are captured into the deterministic round state and will be finalized when the pitch closes.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  suppressHydrationWarning
                  type="button"
                  onClick={handleManualClosePitch}
                  className="rounded-xl border border-white/45 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 md:text-base"
                >
                  Close Pitch Early
                </button>
                <span className="text-xs uppercase tracking-wide text-white/65 md:text-sm">
                  Source {roundState.pitchCapture.sourceType}
                </span>
              </div>
            </div>
          </section>
        </>
      )}

      {phase === "intro" && (
        <section className="absolute inset-0 z-40 flex items-center justify-center bg-black/62 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/20 bg-black/75 p-6 backdrop-blur md:p-8">
            <h2 className="font-display mb-4 text-2xl leading-tight md:text-4xl">Pitch Instructions</h2>
            <p className="mb-3 text-sm text-white/90 md:text-lg">
              You will have {formatTime(PITCH_SECONDS)} to present your product idea to the judges.
            </p>
            <p className="mb-6 text-sm text-white/75 md:text-base">
              Starting the round opens a real pitch-capture phase. The timer, transcript finalization, and pitch close all come from structured round state.
            </p>
            <div className="mb-5 flex items-center gap-3">
              <span className="text-sm text-white/80">Source:</span>
              <button
                suppressHydrationWarning
                type="button"
                onClick={() => setPitchSourceType(PITCH_SOURCE_TYPES.MOCK)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                  pitchSourceType === PITCH_SOURCE_TYPES.MOCK
                    ? "border-white/60 bg-white/20 text-white"
                    : "border-white/25 bg-white/5 text-white/60 hover:bg-white/10"
                }`}
              >
                Mock
              </button>
              <div className="relative">
                <button
                  suppressHydrationWarning
                  type="button"
                  onClick={() => {
                    if (mediaRecorderAvailable) {
                      setPitchSourceType(PITCH_SOURCE_TYPES.LIVE_STT);
                    }
                  }}
                  disabled={!mediaRecorderAvailable}
                  title={!mediaRecorderAvailable ? "Live microphone requires a browser with MediaRecorder and getUserMedia support" : undefined}
                  className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                    pitchSourceType === PITCH_SOURCE_TYPES.LIVE_STT
                      ? "border-white/60 bg-white/20 text-white"
                      : mediaRecorderAvailable
                        ? "border-white/25 bg-white/5 text-white/60 hover:bg-white/10"
                        : "cursor-not-allowed border-white/15 bg-white/5 text-white/30"
                  }`}
                >
                  Live Microphone
                </button>
              </div>
            </div>
            <button
              suppressHydrationWarning
              type="button"
              onClick={handleStart}
              className="rounded-xl border border-white/45 bg-white/10 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/20 md:text-lg"
            >
              Start Pitch
            </button>
          </div>
        </section>
      )}

      {phase === "pitch-closed" && (
        <section className="absolute inset-0 z-40 flex items-center justify-center bg-black/58 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/20 bg-black/78 p-6 backdrop-blur md:p-8">
            <p className="font-display text-2xl text-white md:text-4xl">Pitch Captured</p>
            <p className="mt-3 text-sm text-white/90 md:text-base">
              {roundState.pitchCapture.finalizedPitch?.text}
            </p>
            <p className="mt-4 text-xs uppercase tracking-wide text-white/65 md:text-sm">
              Closing reason: {roundState.pitchCapture.closeReason}
            </p>
          </div>
        </section>
      )}

      {phase === "judging" && allowedActions.includes(PLAYER_ACTIONS.DECLINE_QUESTION) && (
        <section className="absolute inset-x-0 bottom-3 z-50 px-3 md:bottom-6 md:px-6">
          <div className="mx-auto w-full max-w-4xl rounded-3xl border border-white/25 bg-black/82 px-4 py-4 shadow-dialogue backdrop-blur md:px-6 md:py-5">
            <p className="font-display text-lg text-white md:text-xl">Negotiation Actions</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                suppressHydrationWarning
                type="button"
                onClick={handleDeclineQuestion}
                className="rounded-xl border border-white/45 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 md:text-base"
              >
                Decline to Answer
              </button>
            </div>
          </div>
        </section>
      )}

      {phase === "debrief" && (
        <DebriefReport
          debrief={debriefData}
          judgeResponses={roundState.judgeResponses}
          loading={debriefLoading}
          onSkip={moveToFeedbackScreen}
          onProceed={moveToFeedbackScreen}
        />
      )}
    </main>
  );
}
