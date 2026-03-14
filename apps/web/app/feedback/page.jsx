"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const JUDGE_NAMES = {
  cat: "Zephyr Valtos",
  dog: "Ryo Barkman",
  shark: "Mara Finley"
};

function formatDecision(decisionType) {
  return decisionType === "accept" ? "Accepted Offer" : "Disaccepted Offers";
}

export default function FeedbackPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const score = searchParams.get("score") || "0";
    const scoreTier = searchParams.get("scoreTier") || "medium";
    const decisionType = searchParams.get("decisionType") || "disaccept";
    const acceptedJudgeId = searchParams.get("acceptedJudgeId") || "";

    let cancelled = false;

    async function loadFeedback() {
      setLoading(true);
      setError("");

      try {
        const query = new URLSearchParams({
          score,
          scoreTier,
          decisionType
        });

        if (acceptedJudgeId) {
          query.set("acceptedJudgeId", acceptedJudgeId);
        }

        const response = await fetch(`/api/feedback?${query.toString()}`);
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
                <div className="rounded-xl border border-white/20 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-white/70">Score</p>
                  <p className="font-display mt-2 text-3xl text-white">{feedback.score}</p>
                </div>

                <div className="rounded-xl border border-white/20 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-white/70">Offer Decision</p>
                  <p className="mt-2 text-base text-white md:text-lg">{formatDecision(feedback.decisionType)}</p>
                </div>

                <div className="rounded-xl border border-white/20 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-white/70">Score Tier</p>
                  <p className="mt-2 text-base uppercase text-white md:text-lg">{feedback.scoreTier}</p>
                </div>
              </div>

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
