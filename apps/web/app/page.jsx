"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  applyAction,
  createInitialGameState,
  createMockPitchTranscriptSource,
  createPitchCaptureAdapter,
  getPitchTimerSnapshot,
  JUDGE_PROFILES,
  PLAYER_ACTIONS,
  PITCH_CLOSE_REASONS,
  PITCH_SOURCE_TYPES,
  ROUND_STATES
} from "@sharktank/game-engine";
import judgeDialogues from "./data/mock-judge-dialogues.json";
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
const DIALOGUE_GROUPS = judgeDialogues.groups || [];
const OFFER_CONVERSATION = offerConversation.conversation || [];
const RESULT_ANIMATION_MS = 1800;
const COUNTDOWN_START = 3;
const COUNTDOWN_TICK_MS = 800;
const COUNTDOWN_START_HOLD_MS = 520;
const WINNING_SCORE_TIERS = new Set(["medium", "good"]);
const AUDIO_PATHS = {
  countdown: "/assets/music/Countdown.mp3",
  debate: "/assets/music/DebateMusic.mp3",
  lobby: "/assets/music/LobbyMusic.mp3",
  nothing: "/assets/music/NothingMusic.mp3",
  losing: "/assets/music/Losing.mp3",
  winning: "/assets/music/Winning.mp3"
};

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
  const decisionType = acceptedJudgeId ? "accept" : state.offers.length ? "reject" : "game_over";
  const scoreTier = decisionType === "game_over" ? "bad" : resolveScoreTier(score);

  return {
    score,
    scoreTier,
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
  const countdownAudioRef = useRef(null);
  const debateMusicRef = useRef(null);
  const lobbyMusicRef = useRef(null);
  const nothingMusicRef = useRef(null);
  const losingAudioRef = useRef(null);
  const winningAudioRef = useRef(null);
  const activeBackgroundTrackRef = useRef(null);
  const hasPlayedResultAudioRef = useRef(false);
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
  const [groupIndex, setGroupIndex] = useState(0);
  const [lineIndex, setLineIndex] = useState(0);
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
  const [countdownValue, setCountdownValue] = useState(null);

  const activeGroup = DIALOGUE_GROUPS[groupIndex] || null;
  const activeLine = activeGroup?.dialogues?.[lineIndex] || null;
  const activeOfferLine = OFFER_CONVERSATION[offerLineIndex] || null;
  const pitchTimer = getPitchTimerSnapshot(roundState, nowMs);
  const pitchTranscriptText = joinTranscriptUpdates(roundState.pitchCapture.transcriptUpdates);
  const offersByJudge = Object.fromEntries(roundState.offers.map((offer) => [offer.judgeId, offer]));
  const offerJudgeIds = roundState.offers.map((offer) => offer.judgeId);
  const liveJudgePresence = Object.fromEntries(
    (liveReactionEvent?.judges || []).map((judge) => [judge.judgeId, judge])
  );

  const activeSpeakerId =
    phase === "judging" && !chatEnabled && !judgingFinished && activeLine ? activeLine.speakerId : null;
  const activeOfferSpeakerId = phase === "offer-dialogue" && activeOfferLine ? activeOfferLine.speakerId : null;
  const spotlightSpeakerId = activeSpeakerId || activeOfferSpeakerId;

  const rejectedOfferCount = offerJudgeIds.filter((judgeId) => offerDecisions[judgeId] === "rejected").length;
  const allOffersRejected = offerJudgeIds.length > 0 && rejectedOfferCount === offerJudgeIds.length;
  const displayScore = averageEvaluationScore(roundState.evaluation);

  const speakerName =
    phase === "offer-dialogue" && activeOfferSpeakerId ? JUDGE_NAMES[activeOfferSpeakerId] || "Judge"
      : phase === "judging" && activeSpeakerId ? JUDGE_NAMES[activeSpeakerId] || "Judge"
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
              : phase === "judging" && !chatEnabled && activeLine ? activeLine.text
                : phase === "judging"
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
      ? `Source: ${roundState.pitchCapture.sourceType} | Live presence: ${liveReactionEvent?.sourceType || "warming_up"}`
      : phase === "pitch-closed"
        ? `Closed: ${roundState.pitchCapture.closeReason || PITCH_CLOSE_REASONS.MANUAL}`
        : phase === "offer-dialogue" && activeOfferLine
          ? `Offer conversation ${offerLineIndex + 1}/${OFFER_CONVERSATION.length}`
          : phase === "offer-select" && acceptedOfferJudgeId
            ? "Deal locked. You can still hover judges to inspect the cards."
            : phase === "offer-select"
              ? `Offers available: ${offerJudgeIds.length} | Rejected: ${rejectedOfferCount}`
              : phase === "judging" && !chatEnabled && activeGroup
                ? `Group ${groupIndex + 1}/${DIALOGUE_GROUPS.length} | Dialogue ${lineIndex + 1}/${activeGroup.dialogues.length}`
                : phase === "judging" && !judgingFinished
                  ? "Send your reply. The next scripted judge group will appear after your answer."
                  : phase === "judging" && judgingFinished
                    ? `Player replies sent: ${chatHistory.length}`
                    : "";

  const showAdvance =
    (phase === "judging" && !chatEnabled && Boolean(activeLine)) ||
    (phase === "offer-dialogue" && Boolean(activeOfferLine));

  function playAudioEffect(audioRef) {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.currentTime = 0;
    const playback = audio.play();
    if (playback && typeof playback.catch === "function") {
      playback.catch(() => {
        // Ignore autoplay policy errors; user interaction will unlock audio.
      });
    }
  }

  function stopBackgroundMusic() {
    if (debateMusicRef.current) {
      debateMusicRef.current.pause();
      debateMusicRef.current.currentTime = 0;
    }

    if (lobbyMusicRef.current) {
      lobbyMusicRef.current.pause();
      lobbyMusicRef.current.currentTime = 0;
    }

    if (nothingMusicRef.current) {
      nothingMusicRef.current.pause();
      nothingMusicRef.current.currentTime = 0;
    }

    activeBackgroundTrackRef.current = null;
  }

  function playBackgroundMusic(trackKey) {
    if (!trackKey || activeBackgroundTrackRef.current === trackKey) {
      return;
    }

    if (trackKey === "debate") {
      if (lobbyMusicRef.current) {
        lobbyMusicRef.current.pause();
        lobbyMusicRef.current.currentTime = 0;
      }
      if (nothingMusicRef.current) {
        nothingMusicRef.current.pause();
        nothingMusicRef.current.currentTime = 0;
      }
      const debate = debateMusicRef.current;
      if (debate) {
        debate.currentTime = 0;
        const playback = debate.play();
        if (playback && typeof playback.catch === "function") {
          playback.catch(() => {
            // Ignore autoplay policy errors; user interaction will unlock audio.
          });
        }
      }
    }

    if (trackKey === "lobby") {
      if (debateMusicRef.current) {
        debateMusicRef.current.pause();
        debateMusicRef.current.currentTime = 0;
      }
      if (nothingMusicRef.current) {
        nothingMusicRef.current.pause();
        nothingMusicRef.current.currentTime = 0;
      }
      const lobby = lobbyMusicRef.current;
      if (lobby) {
        lobby.currentTime = 0;
        const playback = lobby.play();
        if (playback && typeof playback.catch === "function") {
          playback.catch(() => {
            // Ignore autoplay policy errors; user interaction will unlock audio.
          });
        }
      }
    }

    if (trackKey === "nothing") {
      if (debateMusicRef.current) {
        debateMusicRef.current.pause();
        debateMusicRef.current.currentTime = 0;
      }
      if (lobbyMusicRef.current) {
        lobbyMusicRef.current.pause();
        lobbyMusicRef.current.currentTime = 0;
      }
      const nothing = nothingMusicRef.current;
      if (nothing) {
        nothing.currentTime = 0;
        const playback = nothing.play();
        if (playback && typeof playback.catch === "function") {
          playback.catch(() => {
            // Ignore autoplay policy errors; user interaction will unlock audio.
          });
        }
      }
    }

    activeBackgroundTrackRef.current = trackKey;
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
    if (!DIALOGUE_GROUPS.length) {
      setJudgingFinished(true);
      setChatEnabled(true);
      return;
    }

    setGroupIndex(0);
    setLineIndex(0);
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

  function handleStart() {
    stopCapture("restart");
    hasNavigatedFeedbackRef.current = false;
    hasPlayedResultAudioRef.current = false;
    setCountdownValue(COUNTDOWN_START);
    setPhase("countdown");

    setGroupIndex(0);
    setLineIndex(0);
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
  }

  function startPitchRound() {
    if (countdownAudioRef.current) {
      countdownAudioRef.current.pause();
      countdownAudioRef.current.currentTime = 0;
    }

    const initialState = createRoundState();
    const startedAtMs = Date.now();
    const startedState = applyAction(initialState, {
      type: PLAYER_ACTIONS.START_PITCH,
      payload: {
        durationSeconds: PITCH_SECONDS,
        startedAtMs,
        sourceType: PITCH_SOURCE_TYPES.MOCK
      }
    });

    setRoundStateValue(startedState);
    setNowMs(startedAtMs);
    setPhase("pitch");

    const adapter = createPitchCaptureAdapter({
      source: createMockPitchTranscriptSource(),
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
    if (phase === "judging") {
      if (!activeGroup || chatEnabled) {
        return;
      }

      if (lineIndex < activeGroup.dialogues.length - 1) {
        setLineIndex((current) => current + 1);
        return;
      }

      setChatEnabled(true);
      return;
    }

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
        setPhase("result");
        return;
      }

      setPhase("offer-select");
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

  async function handleSendMessage() {
    const trimmedMessage = chatInput.trim();

    if (!trimmedMessage || !chatEnabled) {
      return;
    }

    setChatHistory((current) => [...current, trimmedMessage]);
    setChatInput("");

    try {
      const response = await fetch("/api/judge-reactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          groupIndex,
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

    if (groupIndex < DIALOGUE_GROUPS.length - 1) {
      setGroupIndex((current) => current + 1);
      setLineIndex(0);
      setChatEnabled(false);
      return;
    }

    setJudgingFinished(true);
    setChatEnabled(false);

    commitRoundAction({
      type: PLAYER_ACTIONS.ADVANCE
    });
    const dealsState = commitRoundAction({
      type: PLAYER_ACTIONS.SUBMIT_ANSWER,
      payload: {
        answer: trimmedMessage
      }
    });

    if (!dealsState.offers.length) {
      commitRoundAction({
        type: PLAYER_ACTIONS.ADVANCE
      });
      setPhase("result");
      return;
    }

    if (OFFER_CONVERSATION.length) {
      setOfferLineIndex(0);
      setPhase("offer-dialogue");
      return;
    }

    const decisionState = commitRoundAction({
      type: PLAYER_ACTIONS.ADVANCE
    });

    if (dealsState.currentState === ROUND_STATES.DEALS) {
      setPhase("offer-select");
    }
  }

  useEffect(() => {
    countdownAudioRef.current = new Audio(AUDIO_PATHS.countdown);
    debateMusicRef.current = new Audio(AUDIO_PATHS.debate);
    debateMusicRef.current.loop = true;
    debateMusicRef.current.volume = 0.45;
    lobbyMusicRef.current = new Audio(AUDIO_PATHS.lobby);
    lobbyMusicRef.current.loop = true;
    lobbyMusicRef.current.volume = 0.4;
    nothingMusicRef.current = new Audio(AUDIO_PATHS.nothing);
    nothingMusicRef.current.loop = true;
    nothingMusicRef.current.volume = 0.35;
    losingAudioRef.current = new Audio(AUDIO_PATHS.losing);
    winningAudioRef.current = new Audio(AUDIO_PATHS.winning);

    return () => {
      stopBackgroundMusic();

      if (countdownAudioRef.current) {
        countdownAudioRef.current.pause();
        countdownAudioRef.current = null;
      }

      debateMusicRef.current = null;
      lobbyMusicRef.current = null;
      nothingMusicRef.current = null;

      if (losingAudioRef.current) {
        losingAudioRef.current.pause();
        losingAudioRef.current = null;
      }

      if (winningAudioRef.current) {
        winningAudioRef.current.pause();
        winningAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (phase !== "countdown" || countdownValue === null) {
      return;
    }

    playAudioEffect(countdownAudioRef);

    const timeoutId = setTimeout(() => {
      if (countdownValue > 0) {
        setCountdownValue((current) => current - 1);
        return;
      }

      if (countdownValue === 0) {
        setCountdownValue(-1);
        return;
      }

      setCountdownValue(null);
      startPitchRound();
    }, countdownValue >= 0 ? COUNTDOWN_TICK_MS : COUNTDOWN_START_HOLD_MS);

    return () => clearTimeout(timeoutId);
  }, [phase, countdownValue]);

  useEffect(() => {
    const isJudgeTalking =
      (phase === "judging" && !chatEnabled && Boolean(activeLine)) ||
      (phase === "offer-dialogue" && Boolean(activeOfferLine));

    const isPlayerPitchingOrWriting = phase === "pitch" || (phase === "judging" && chatEnabled);

    const shouldSilenceBackgroundMusic =
      phase === "countdown" ||
      phase === "result-animation" ||
      phase === "result";

    if (shouldSilenceBackgroundMusic) {
      stopBackgroundMusic();
      return;
    }

    if (isJudgeTalking) {
      playBackgroundMusic("debate");
      return;
    }

    if (isPlayerPitchingOrWriting) {
      playBackgroundMusic("lobby");
      return;
    }

    playBackgroundMusic("nothing");
  }, [phase, chatEnabled, activeLine, activeOfferLine]);

  useEffect(() => {
    if (phase !== "result" || !roundResult || hasPlayedResultAudioRef.current) {
      return;
    }

    if (WINNING_SCORE_TIERS.has(roundResult.scoreTier)) {
      playAudioEffect(winningAudioRef);
    } else {
      playAudioEffect(losingAudioRef);
    }

    hasPlayedResultAudioRef.current = true;
  }, [phase, roundResult]);

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
    }, 900);

    return () => clearTimeout(timeoutId);
  }, [phase, roundState.currentState, roundState.evaluation]);

  useEffect(() => {
    if (phase !== "offer-select" || offerJudgeIds.length > 0) {
      return;
    }
    // No offers exist – immediately resolve as game over
    commitRoundAction({ type: PLAYER_ACTIONS.ADVANCE });
  }, [phase, offerJudgeIds.length]);

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
        onEndGame={() =>
          offerJudgeIds.length > 0
            ? handleRejectAllOffers()
            : commitRoundAction({ type: PLAYER_ACTIONS.ADVANCE })
        }
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

      {phase === "countdown" && (
        <section className="absolute inset-0 z-50 flex items-center justify-center bg-black/62">
          <p className="font-display text-[6rem] leading-none text-white drop-shadow-[0_8px_22px_rgba(0,0,0,0.6)] md:text-[10rem]">
            {countdownValue !== null && countdownValue >= 0 ? countdownValue : "START"}
          </p>
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
              Decision: {roundResult.decisionType === "accept" ? "Accepted an offer" : roundResult.decisionType === "game_over" ? "Game over - no offers" : "Rejected available offers"}
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
