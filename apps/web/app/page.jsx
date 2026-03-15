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
const RESULT_ANIMATION_MS = 1800;
const COUNTDOWN_START = 3;
const COUNTDOWN_TICK_MS = 800;
const COUNTDOWN_START_HOLD_MS = 520;

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

function resolveScoreTier(score) {
  if (score >= 80) {
    return "good";
  }

  if (score >= 62) {
    return "medium";
  }

  return "bad";
}

function buildRoundResultSummary(state, acceptedJudgeId) {
  const score = averageEvaluationScore(state.evaluation);
  const decisionType = acceptedJudgeId ? "accept" : "disaccept";

  return {
    score,
    scoreTier: resolveScoreTier(score),
    decisionType,
    catchphrase:
      state.roundResult?.summary ||
      state.roundResult?.headline ||
      "The round has been resolved from the deterministic game state."
  };
}

export default function Page() {
  const router = useRouter();
  const hasNavigatedFeedbackRef = useRef(false);
  const audioContextRef = useRef(null);
  const ambienceOscRef = useRef(null);
  const ambienceGainRef = useRef(null);
  const currentAmbienceModeRef = useRef(null);
  const hasPlayedResultChimeRef = useRef(false);
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
  const [roundResult, setRoundResult] = useState(null);
  const [liveReactionEvent, setLiveReactionEvent] = useState(null);
  const [bargainMode, setBargainMode] = useState(false);
  const [bargainOfferId, setBargainOfferId] = useState(null);
  const [bargainAmount, setBargainAmount] = useState("");
  const [bargainEquity, setBargainEquity] = useState("");
  const [pitchSourceType, setPitchSourceType] = useState(PITCH_SOURCE_TYPES.MOCK);
  const [mediaRecorderAvailable, setMediaRecorderAvailable] = useState(false);
  const [countdownValue, setCountdownValue] = useState(null);
  const [pendingPitchSourceType, setPendingPitchSourceType] = useState(null);

  const activeOfferLine = OFFER_CONVERSATION[offerLineIndex] || null;
  const pitchTimer = getPitchTimerSnapshot(roundState, nowMs);
  const pitchTranscriptText = joinTranscriptUpdates(roundState.pitchCapture.transcriptUpdates);
  const offersByJudge = Object.fromEntries(roundState.offers.map((offer) => [offer.judgeId, offer]));
  const offerJudgeIds = roundState.offers.map((offer) => offer.judgeId);
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

  function ensureAudioContext() {
    if (typeof window === "undefined") {
      return null;
    }

    if (!audioContextRef.current) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) {
        return null;
      }
      audioContextRef.current = new Ctor();
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {
        // Browser autoplay policies may keep audio suspended until more gestures.
      });
    }

    return audioContextRef.current;
  }

  function stopAmbience() {
    if (ambienceOscRef.current) {
      ambienceOscRef.current.stop();
      ambienceOscRef.current.disconnect();
      ambienceOscRef.current = null;
    }

    if (ambienceGainRef.current) {
      ambienceGainRef.current.disconnect();
      ambienceGainRef.current = null;
    }

    currentAmbienceModeRef.current = null;
  }

  function playAmbience(mode) {
    if (currentAmbienceModeRef.current === mode) {
      return;
    }

    const ctx = ensureAudioContext();
    if (!ctx) {
      return;
    }

    stopAmbience();

    const modeConfig = {
      intro: { freq: 128, gain: 0.018 },
      countdown: { freq: 112, gain: 0.02 },
      pitch: { freq: 142, gain: 0.022 },
      judging: { freq: 174, gain: 0.018 },
      offers: { freq: 154, gain: 0.018 }
    };

    const config = modeConfig[mode];
    if (!config) {
      return;
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(config.gain, ctx.currentTime);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(config.freq, ctx.currentTime);
    osc.connect(gain);
    osc.start();

    ambienceGainRef.current = gain;
    ambienceOscRef.current = osc;
    currentAmbienceModeRef.current = mode;
  }

  function playCountdownBeep(step) {
    const ctx = ensureAudioContext();
    if (!ctx) {
      return;
    }

    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    const isStart = step === "start";

    osc.type = "square";
    osc.frequency.setValueAtTime(isStart ? 880 : 600, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(isStart ? 0.08 : 0.05, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (isStart ? 0.2 : 0.12));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (isStart ? 0.22 : 0.14));
  }

  function playResultChime(isWin) {
    const ctx = ensureAudioContext();
    if (!ctx) {
      return;
    }

    const notes = isWin ? [523.25, 659.25, 783.99] : [392, 349.23, 293.66];
    notes.forEach((freq, index) => {
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();
      const start = ctx.currentTime + index * 0.09;
      const end = start + 0.18;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.01);
    });
  }

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
    setRoundResult(null);
    resetLiveReactionState();
  }

  function moveToFeedbackScreen() {
    if (!roundResult || hasNavigatedFeedbackRef.current) {
      return;
    }

    hasNavigatedFeedbackRef.current = true;

    const query = new URLSearchParams({
      score: String(roundResult.score),
      scoreTier: String(roundResult.scoreTier),
      decisionType: String(roundResult.decisionType)
    });

    if (acceptedOfferJudgeId) {
      query.set("acceptedJudgeId", acceptedOfferJudgeId);
    }

    startTransition(() => {
      router.push(`/feedback?${query.toString()}`);
    });
  }

  function startPitchRound(selectedSourceType) {
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
    setRoundResult(null);
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

  function handleStart() {
    stopCapture("restart");
    hasNavigatedFeedbackRef.current = false;
    hasPlayedResultChimeRef.current = false;
    ensureAudioContext();
    setPendingPitchSourceType(pitchSourceType);
    setCountdownValue(COUNTDOWN_START);
    setPhase("countdown");
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

      const decisionState = commitRoundAction({
        type: PLAYER_ACTIONS.ADVANCE
      });

      if (!decisionState.offers.length) {
        commitRoundAction({
          type: PLAYER_ACTIONS.ADVANCE
        });
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

      if (OFFER_CONVERSATION.length) {
        setOfferLineIndex(0);
        setPhase("offer-dialogue");
      } else {
        const decisionState = commitRoundAction({
          type: PLAYER_ACTIONS.ADVANCE
        });

        if (!decisionState.offers.length) {
          commitRoundAction({
            type: PLAYER_ACTIONS.ADVANCE
          });
        } else {
          setPhase("offer-select");
        }
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

  function handleStartBargain(offerId) {
    const offer = roundState.offers.find((o) => o.id === offerId);
    if (!offer) return;
    setBargainMode(true);
    setBargainOfferId(offerId);
    setBargainAmount(String(offer.amount));
    setBargainEquity(String(offer.equity));
  }

  function handleSubmitBargain() {
    if (!bargainOfferId) return;
    const amount = Number(bargainAmount);
    const equity = Number(bargainEquity);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(equity) || equity < 0 || equity > 100) return;

    commitRoundAction({
      type: PLAYER_ACTIONS.SUBMIT_BARGAIN,
      payload: {
        offerId: bargainOfferId,
        terms: { amount, equity }
      }
    });

    setBargainMode(false);
    setBargainOfferId(null);
    setBargainAmount("");
    setBargainEquity("");
  }

  function handleCancelBargain() {
    setBargainMode(false);
    setBargainOfferId(null);
    setBargainAmount("");
    setBargainEquity("");
  }

  function handleDeclineQuestion() {
    commitRoundAction({
      type: PLAYER_ACTIONS.DECLINE_QUESTION
    });
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
    if (phase !== "countdown" || countdownValue === null) {
      return;
    }

    if (countdownValue >= 0) {
      playCountdownBeep(countdownValue);
    } else {
      playCountdownBeep("start");
    }

    const timeoutId = setTimeout(() => {
      if (countdownValue > 0) {
        setCountdownValue((current) => current - 1);
        return;
      }

      if (countdownValue === 0) {
        setCountdownValue(-1);
        return;
      }

      const sourceToStart = pendingPitchSourceType || pitchSourceType;
      setCountdownValue(null);
      setPendingPitchSourceType(null);
      startPitchRound(sourceToStart);
    }, countdownValue >= 0 ? COUNTDOWN_TICK_MS : COUNTDOWN_START_HOLD_MS);

    return () => clearTimeout(timeoutId);
  }, [phase, countdownValue, pendingPitchSourceType, pitchSourceType]);

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
    if (roundState.currentState !== ROUND_STATES.ROUND_RESULT) {
      return;
    }

    setRoundResult(buildRoundResultSummary(roundState, acceptedOfferJudgeId));
    if (phase !== "result-animation" && phase !== "result") {
      setPhase("result-animation");
    }
  }, [acceptedOfferJudgeId, phase, roundState]);

  useEffect(() => {
    if (phase !== "result-animation" || !roundResult) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setPhase("result");
    }, RESULT_ANIMATION_MS);

    return () => clearTimeout(timeoutId);
  }, [phase, roundResult]);

  useEffect(() => {
    if (phase !== "result" || !roundResult || hasNavigatedFeedbackRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      moveToFeedbackScreen();
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [phase, roundResult]);

  useEffect(() => {
    if (phase === "intro") {
      playAmbience("intro");
      return;
    }

    if (phase === "countdown") {
      playAmbience("countdown");
      return;
    }

    if (phase === "pitch") {
      playAmbience("pitch");
      return;
    }

    if (phase === "judging") {
      playAmbience("judging");
      return;
    }

    if (phase === "offer-dialogue" || phase === "offer-select") {
      playAmbience("offers");
      return;
    }

    stopAmbience();
  }, [phase]);

  useEffect(() => {
    if (phase !== "result" || !roundResult || hasPlayedResultChimeRef.current) {
      return;
    }

    playResultChime(roundResult.scoreTier !== "bad");
    hasPlayedResultChimeRef.current = true;
  }, [phase, roundResult]);

  useEffect(() => {
    return () => {
      stopCapture("unmount");
      stopAmbience();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {
          // Ignore close errors during teardown.
        });
      }
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

      {phase === "countdown" && (
        <section className="absolute inset-0 z-40 flex items-center justify-center bg-black/68 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-white/25 bg-black/78 p-6 text-center backdrop-blur md:p-8">
            <p className="font-display text-sm uppercase tracking-[0.22em] text-white/70 md:text-base">Pitch starts in</p>
            <p className="font-display mt-3 text-7xl text-white md:text-9xl">
              {countdownValue !== null && countdownValue >= 0 ? countdownValue : "START"}
            </p>
          </div>
        </section>
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

      {(phase === "judging" || phase === "offer-select") && (allowedActions.includes(PLAYER_ACTIONS.DECLINE_QUESTION) || allowedActions.includes(PLAYER_ACTIONS.SUBMIT_BARGAIN)) && (
        <section className="absolute inset-x-0 bottom-3 z-50 px-3 md:bottom-6 md:px-6">
          <div className="mx-auto w-full max-w-4xl rounded-3xl border border-white/25 bg-black/82 px-4 py-4 shadow-dialogue backdrop-blur md:px-6 md:py-5">
            <p className="font-display text-lg text-white md:text-xl">Negotiation Actions</p>

            {!bargainMode && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {allowedActions.includes(PLAYER_ACTIONS.DECLINE_QUESTION) && (
                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={handleDeclineQuestion}
                    className="rounded-xl border border-white/45 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 md:text-base"
                  >
                    Decline to Answer
                  </button>
                )}
                {allowedActions.includes(PLAYER_ACTIONS.SUBMIT_BARGAIN) && roundState.offers.map((offer) => (
                  <button
                    suppressHydrationWarning
                    key={offer.id}
                    type="button"
                    onClick={() => handleStartBargain(offer.id)}
                    className="rounded-xl border border-amber-400/60 bg-amber-500/15 px-5 py-2 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/25 md:text-base"
                  >
                    Bargain with {offer.judgeName}
                  </button>
                ))}
              </div>
            )}

            {bargainMode && (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-white/80">Propose revised terms for this offer:</p>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block">
                    <span className="text-xs text-white/70">Amount ($)</span>
                    <input
                      type="number"
                      value={bargainAmount}
                      onChange={(e) => setBargainAmount(e.target.value)}
                      className="mt-1 block w-32 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs text-white/70">Equity (%)</span>
                    <input
                      type="number"
                      value={bargainEquity}
                      onChange={(e) => setBargainEquity(e.target.value)}
                      className="mt-1 block w-24 rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={handleSubmitBargain}
                    className="rounded-xl border border-green-400/60 bg-green-500/15 px-5 py-2 text-sm font-semibold text-green-200 transition hover:bg-green-500/25 md:text-base"
                  >
                    Submit Bargain
                  </button>
                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={handleCancelBargain}
                    className="rounded-xl border border-white/30 bg-white/5 px-5 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10 md:text-base"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {phase === "result-animation" && (
        <section className="pointer-events-none absolute inset-0 z-40 overflow-hidden bg-black/30">
          <span className="result-triangle result-triangle-a" />
          <span className="result-triangle result-triangle-b" />
          <span className="result-triangle result-triangle-c" />
          <span className="result-triangle result-triangle-d" />
          <span className="result-triangle result-triangle-e" />
          <span className="result-triangle result-triangle-f" />
          <span className="result-triangle result-triangle-g" />
          <span className="result-triangle result-triangle-h" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40 bg-black/45 px-6 py-4 text-center backdrop-blur">
            <p className="font-display text-xl text-white/90 md:text-2xl">Computing Result</p>
          </div>
        </section>
      )}

      {phase === "result" && roundResult && (
        <section className="absolute inset-0 z-40 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-xl rounded-3xl border border-white/25 bg-black/78 p-6 text-center backdrop-blur md:p-8">
            <p className="font-display text-4xl text-white md:text-6xl">Score {roundResult.score}</p>
            <p className="mt-3 text-base uppercase tracking-wide text-white/80 md:text-lg">{roundResult.scoreTier} result</p>
            <p className="mt-4 text-sm text-white/95 md:text-base">{roundResult.catchphrase}</p>
            <p className="mt-4 text-xs text-white/70 md:text-sm">
              Decision: {roundResult.decisionType === "accept" ? "Accepted an offer" : "Rejected available offers"}
            </p>
            <button
              suppressHydrationWarning
              type="button"
              onClick={moveToFeedbackScreen}
              className="mt-6 rounded-xl border border-white/45 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 md:text-base"
            >
              Continue to Feedback
            </button>
            <p className="mt-3 text-xs text-white/70 md:text-sm">Moving to feedback screen...</p>
          </div>
        </section>
      )}
    </main>
  );
}
