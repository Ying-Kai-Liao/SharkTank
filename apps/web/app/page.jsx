"use client";

import { useEffect, useState } from "react";
import judgeDialogues from "./data/mock-judge-dialogues.json";
import offerConversation from "./data/mock-offer-conversation.json";
import ScoreBadge from "../components/ScoreBadge";
import StageScene from "../components/StageScene";

const PITCH_SECONDS = 5;
const JUDGE_NAMES = {
  cat: "Zephyr Valtos",
  dog: "Ryo Barkman",
  shark: "Mara Finley"
};
const DIALOGUE_GROUPS = judgeDialogues.groups || [];
const OFFER_CONVERSATION = offerConversation.conversation || [];
const OFFER_BY_JUDGE = offerConversation.offers || {};
const OFFER_JUDGE_IDS = Object.entries(OFFER_BY_JUDGE)
  .filter(([, offer]) => Boolean(offer))
  .map(([judgeId]) => judgeId);
const RESULT_ANIMATION_MS = 1800;

function formatTime(secondsLeft) {
  const minutes = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(1 , "0");
  const seconds = (secondsLeft % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function formatOffer(offer) {
  if (!offer) {
    return "No offer";
  }

  return `$${Number(offer.amount || 0).toLocaleString()} for ${Number(offer.equity || 0)}%`;
}

export default function Page() {
  const [phase, setPhase] = useState("intro");
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(PITCH_SECONDS);
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
  const [isResolvingResult, setIsResolvingResult] = useState(false);

  const activeGroup = DIALOGUE_GROUPS[groupIndex] || null;
  const activeLine = activeGroup?.dialogues?.[lineIndex] || null;
  const activeOfferLine = OFFER_CONVERSATION[offerLineIndex] || null;

  const activeSpeakerId =
    phase === "judging" && !chatEnabled && !judgingFinished && activeLine ? activeLine.speakerId : null;

  const activeOfferSpeakerId = phase === "offer-dialogue" && activeOfferLine ? activeOfferLine.speakerId : null;

  const spotlightSpeakerId = activeSpeakerId || activeOfferSpeakerId;

  const rejectedOfferCount = OFFER_JUDGE_IDS.filter((judgeId) => offerDecisions[judgeId] === "rejected").length;
  const allOffersRejected = OFFER_JUDGE_IDS.length > 0 && rejectedOfferCount === OFFER_JUDGE_IDS.length;

  const speakerName =
    phase === "offer-dialogue" && activeOfferSpeakerId ? JUDGE_NAMES[activeOfferSpeakerId] || "Judge"
      : phase === "judging" && activeSpeakerId ? JUDGE_NAMES[activeSpeakerId] || "Judge"
      : phase === "judging" && chatEnabled ? "Your Turn"
      : phase === "offer-select" ? "Offer Decision"
      : "";

  const dialogueText =
    phase === "offer-dialogue" && activeOfferLine ? activeOfferLine.text
      : phase === "offer-select" && acceptedOfferJudgeId
        ? `You accepted ${JUDGE_NAMES[acceptedOfferJudgeId]}'s offer: ${formatOffer(OFFER_BY_JUDGE[acceptedOfferJudgeId])}.`
        : phase === "offer-select" && allOffersRejected
          ? "You disaccepted all offers. Hover judges to review their offer cards again."
          : phase === "offer-select" && !OFFER_JUDGE_IDS.length
            ? "No judges made an offer this round."
            : phase === "offer-select"
              ? "Hover each judge. A triangle offer card will appear, then click Accept or Reject All Offer."
              : phase === "judging" && !chatEnabled && activeLine ? activeLine.text
      : phase === "judging" && judgingFinished
        ? "All scripted judge dialogue is complete. You can keep chatting freely now."
        : phase === "judging"
          ? "Reply to the judges to continue."
          : "";

  const statusText =
    phase === "offer-dialogue" && activeOfferLine
      ? `Offer conversation ${offerLineIndex + 1}/${OFFER_CONVERSATION.length}`
      : phase === "offer-select" && acceptedOfferJudgeId
        ? "Deal locked. You can still hover judges to inspect cards."
        : phase === "offer-select"
          ? `Offers available: ${OFFER_JUDGE_IDS.length} • Rejected: ${rejectedOfferCount}`
          : phase === "judging" && !chatEnabled && activeGroup
      ? `Group ${groupIndex + 1}/${DIALOGUE_GROUPS.length} • Dialogue ${lineIndex + 1}/${activeGroup.dialogues.length}`
      : phase === "judging" && !judgingFinished
        ? "Send your reply. After you send, the next group of judge dialogue will appear."
        : phase === "judging" && judgingFinished
          ? `Player replies sent: ${chatHistory.length}`
          : "";

  const showAdvance =
    (phase === "judging" && !chatEnabled && !!activeLine) ||
    (phase === "offer-dialogue" && !!activeOfferLine);

  async function resolveRoundResult(decisionType, acceptedJudgeId = null) {
    if (isResolvingResult || phase === "result-animation" || phase === "result") {
      return;
    }

    setIsResolvingResult(true);

    try {
      const response = await fetch("/api/round-result", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          decisionType,
          acceptedJudgeId,
          offersAvailable: OFFER_JUDGE_IDS.length
        })
      });

      const payload = response.ok ? await response.json() : null;

      setRoundResult(
        payload || {
          score: 40,
          scoreTier: "bad",
          decisionType,
          catchphrase: "No judge accepted this round. Regroup and sharpen the next pitch."
        }
      );
      setPhase("result-animation");
    } catch {
      setRoundResult({
        score: 40,
        scoreTier: "bad",
        decisionType,
        catchphrase: "No judge accepted this round. Regroup and sharpen the next pitch."
      });
      setPhase("result-animation");
    } finally {
      setIsResolvingResult(false);
    }
  }

  function handleStart() {
    setTimeLeft(PITCH_SECONDS);
    setCountdown(3);
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
    setIsResolvingResult(false);
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
    setIsResolvingResult(false);
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

      if (!OFFER_JUDGE_IDS.length) {
        void resolveRoundResult("disaccept");
        return;
      }

      setPhase("offer-select");
    }
  }

  async function handleAcceptOffer(judgeId) {
    const offer = OFFER_BY_JUDGE[judgeId];
    if (!offer) {
      return;
    }

    setAcceptedOfferJudgeId(judgeId);
    setOfferDecisions(() => {
      const next = {};
      OFFER_JUDGE_IDS.forEach((id) => {
        next[id] = id === judgeId ? "accepted" : "rejected";
      });
      return next;
    });

    await resolveRoundResult("accept", judgeId);
  }

  async function handleRejectAllOffers() {
    const next = {};
    OFFER_JUDGE_IDS.forEach((judgeId) => {
      next[judgeId] = "rejected";
    });

    setOfferDecisions(next);
    setAcceptedOfferJudgeId(null);
    await resolveRoundResult("disaccept");
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

    if (OFFER_CONVERSATION.length) {
      setPhase("offer-dialogue");
      setOfferLineIndex(0);
      return;
    }

    setPhase("offer-select");
  }

  useEffect(() => {
    if (phase !== "countdown") {
      return;
    }

    if (countdown === 0) {
      setPhase("pitch");
      return;
    }

    const timeoutId = setTimeout(() => {
      setCountdown((current) => current - 1);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [phase, countdown]);

  useEffect(() => {
    if (phase !== "pitch") {
      return;
    }

    if (timeLeft === 0) {
      setPhase("judging");
      initializeJudgingFlow();
      return;
    }

    const timeoutId = setTimeout(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [phase, timeLeft]);

  useEffect(() => {
    if (phase !== "result-animation" || !roundResult) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setPhase("result");
    }, RESULT_ANIMATION_MS);

    return () => clearTimeout(timeoutId);
  }, [phase, roundResult]);

  return (
    <main className="relative h-screen overflow-hidden bg-black text-white">
      <ScoreBadge score={70} />
      <StageScene
        activeSpeakerId={spotlightSpeakerId}
        judgeReactions={judgeReactions}
        offersByJudge={OFFER_BY_JUDGE}
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

      {phase === "pitch" && (
        <div className="font-display absolute right-4 top-4 z-30 rounded-xl border border-white/30 bg-black/55 px-4 py-2 text-xl tracking-wide md:right-6 md:top-6 md:text-3xl">
          Pitch {formatTime(timeLeft)}
        </div>
      )}

      {phase === "intro" && (
        <section className="absolute inset-0 z-40 flex items-center justify-center bg-black/62 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/20 bg-black/75 p-6 backdrop-blur md:p-8">
            <h2 className="font-display mb-4 text-2xl leading-tight md:text-4xl">Pitch Instructions</h2>
            <p className="mb-3 text-sm text-white/90 md:text-lg">
              You will have {formatTime(PITCH_SECONDS)} to present your product idea to the judges.
            </p>
            <p className="mb-6 text-sm text-white/75 md:text-base">
              When you press Start, a 3-2-1 countdown begins, then your pitch timer starts.
            </p>
            <button
              suppressHydrationWarning
              type="button"
              onClick={handleStart}
              className="rounded-xl border border-white/45 bg-white/10 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/20 md:text-lg"
            >
              Start
            </button>
          </div>
        </section>
      )}

      {phase === "countdown" && (
        <section className="absolute inset-0 z-40 flex items-center justify-center bg-black/55">
          <p className="font-display text-[6rem] leading-none text-white drop-shadow-[0_8px_22px_rgba(0,0,0,0.6)] md:text-[10rem]">
            {countdown}
          </p>
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
              Decision: {roundResult.decisionType === "accept" ? "Accepted an offer" : "Disaccepted offers"}
            </p>
            <button
              suppressHydrationWarning
              type="button"
              onClick={handleStart}
              className="mt-6 rounded-xl border border-white/45 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 md:text-base"
            >
              Play Again
            </button>
          </div>
        </section>
      )}

    </main>
  );
}
