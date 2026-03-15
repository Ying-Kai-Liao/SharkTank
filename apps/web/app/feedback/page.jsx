"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

const JUDGE_NAMES = {
  cat: "Zephyr Valtos",
  dog: "Ryo Barkman",
  shark: "Mara Finley"
};

function formatDecision(decisionType) {
  return decisionType === "accept" ? "Accepted Offer" : "Disaccepted Offers";
}

function letterGrade(score) {
  if (score >= 90) return { letter: "S", color: "text-yellow-300", bar: "bg-yellow-300" };
  if (score >= 80) return { letter: "A", color: "text-emerald-300", bar: "bg-emerald-400" };
  if (score >= 65) return { letter: "B", color: "text-sky-300", bar: "bg-sky-400" };
  if (score >= 50) return { letter: "C", color: "text-amber-300", bar: "bg-amber-400" };
  if (score >= 35) return { letter: "D", color: "text-orange-400", bar: "bg-orange-400" };
  return { letter: "F", color: "text-rose-400", bar: "bg-rose-500" };
}

const DIMENSION_LABELS = {
  clarity: "Clarity",
  confidence: "Confidence",
  originality: "Originality",
  business_viability: "Business Viability",
};

function FeedbackPageContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState("");
    const [evaluation, setEvaluation] = useState(null);
  const resultAudioRef = useRef(null);

  function stopResultAudio() {
    if (!resultAudioRef.current) {
      return;
    }

    resultAudioRef.current.pause();
    resultAudioRef.current.currentTime = 0;
  }

  function playResultAudio(src) {
    if (typeof window === "undefined" || !src) {
      return;
    }

    if (!resultAudioRef.current) {
      resultAudioRef.current = new Audio(src);
      resultAudioRef.current.volume = 0.55;
    } else if (!resultAudioRef.current.src.endsWith(src)) {
      stopResultAudio();
      resultAudioRef.current = new Audio(src);
      resultAudioRef.current.volume = 0.55;
    }

    resultAudioRef.current.play().catch(() => {
      // Browser autoplay rules may block playback until user interaction.
    });
  }

  useEffect(() => {
    const score = searchParams.get("score") || "0";
    const evalParam = searchParams.get("eval");
    if (evalParam) {
      try {
        setEvaluation(JSON.parse(evalParam));
      } catch {
        // ignore malformed eval
      }
    }

    const scoreTier = searchParams.get("scoreTier") || "medium";
    const decisionType = searchParams.get("decisionType") || "disaccept";
    const acceptedJudgeId = searchParams.get("acceptedJudgeId") || "";

    let cancelled = false;

    async function loadFeedback() {
      setLoading(true);
      setError("");

      try {
        const transcript = searchParams.get("transcript") || "";

        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            score,
            scoreTier,
            decisionType,
            acceptedJudgeId: acceptedJudgeId || null,
            transcript
          })
        });
        const payload = response.ok ? await response.json() : null;

        if (!cancelled) {
          if (!payload) {
            setError("Failed to load feedback result.");
            setFeedback(null);
          } else {
            setFeedback(payload);
          }
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load feedback result.");
          setFeedback(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadFeedback();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (loading || error || !feedback) {
      return;
    }

    if (feedback.scoreTier === "good") {
      playResultAudio("/assets/music/Victory.mp3");
      return;
    }

    if (feedback.scoreTier === "bad") {
      playResultAudio("/assets/music/Fail.mp3");
      return;
    }

    stopResultAudio();
  }, [loading, error, feedback]);

  useEffect(() => {
    return () => {
      stopResultAudio();
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.18),transparent_36%),radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(180deg,#02050d_0%,#060b17_45%,#020407_100%)]" />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-5 md:p-8">
        <div className="w-full rounded-3xl border border-white/20 bg-black/70 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur md:p-8">
          <h1 className="font-display text-3xl leading-tight text-white md:text-5xl">Round Feedback</h1>

          {loading && (
            <p className="mt-6 text-sm text-white/80 md:text-base">Loading feedback from API...</p>
          )}

          {!loading && error && (
            <p className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200 md:text-base">
              {error}
            </p>
          )}

          {!loading && !error && feedback && (
            <>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-white/20 bg-white/5 p-4 flex flex-col items-center justify-center">
                  <p className="text-xs uppercase tracking-wider text-white/70">Total Score</p>
                  <p className="font-display mt-2 text-4xl text-white">{feedback.score}<span className="text-lg text-white/50">/100</span></p>
                </div>

                <div className={`rounded-xl border border-white/20 bg-white/5 p-4 flex flex-col items-center justify-center`}>
                  <p className="text-xs uppercase tracking-wider text-white/70">Grade</p>
                  <p className={`font-display mt-2 text-5xl font-bold ${letterGrade(Number(feedback.score)).color}`}>
                    {letterGrade(Number(feedback.score)).letter}
                  </p>
                </div>

                <div className="rounded-xl border border-white/20 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-white/70">Offer Decision</p>
                  <p className="mt-2 text-base text-white md:text-lg">{formatDecision(feedback.decisionType)}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-white/50">{feedback.scoreTier} tier</p>
                </div>
              </div>

              {evaluation && (
                <div className="mt-5 rounded-2xl border border-white/20 bg-white/5 p-5">
                  <p className="mb-4 text-xs uppercase tracking-wider text-white/70">Score Breakdown</p>
                  <div className="flex flex-col gap-3">
                    {Object.entries(DIMENSION_LABELS).map(([key, label]) => {
                      const val = evaluation[key] ?? 0;
                      const grade = letterGrade(val);
                      return (
                        <div key={key}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <span className="text-white/85">{label}</span>
                            <span className={`font-semibold ${grade.color}`}>{val} <span className="text-white/50 font-normal text-xs">({grade.letter})</span></span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                            <div className={`h-full rounded-full ${grade.bar} transition-all`} style={{ width: `${val}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-white/20 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-wider text-white/70">Feedback Paragraph</p>
                <p className="mt-3 text-sm leading-relaxed text-white/95 md:text-base">
                  {feedback.feedbackParagraph}
                </p>
              </div>

              {feedback.decisionType === "accept" && feedback.acceptedJudgeId && (
                <p className="mt-4 text-sm text-white/80 md:text-base">
                  Accepted Judge: {JUDGE_NAMES[feedback.acceptedJudgeId] || feedback.acceptedJudgeId}
                </p>
              )}
            </>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl border border-white/45 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20 md:text-base"
            >
              Play Again
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense
      fallback={
        <main className="relative min-h-screen overflow-hidden bg-black text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.18),transparent_36%),radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(180deg,#02050d_0%,#060b17_45%,#020407_100%)]" />
          <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl items-center justify-center p-5 md:p-8">
            <div className="w-full rounded-3xl border border-white/20 bg-black/70 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)] backdrop-blur md:p-8">
              <h1 className="font-display text-3xl leading-tight text-white md:text-5xl">Round Feedback</h1>
              <p className="mt-6 text-sm text-white/80 md:text-base">Loading feedback from API...</p>
            </div>
          </section>
        </main>
      }
    >
      <FeedbackPageContent />
    </Suspense>
  );
}
