"use client";

const DIMENSION_LABELS = {
  clarity: "Clarity",
  confidence: "Confidence",
  originality: "Originality",
  business_viability: "Viability"
};

const SENTIMENT_LABELS = {
  skeptical: "Skeptical",
  interested: "Interested",
  impressed: "Impressed"
};

function EvaluationBar({ label, score }) {
  const filled = Math.round(score / 10);

  return (
    <div className="flex items-center gap-2 text-xs text-white/60">
      <span className="w-16 shrink-0">{label}</span>
      <div className="flex gap-px">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={`inline-block h-2 w-3 rounded-sm ${i < filled ? "bg-white/50" : "bg-white/10"}`}
          />
        ))}
      </div>
      <span className="w-6 text-right tabular-nums">{score}</span>
    </div>
  );
}

function JudgeDebriefCard({ entry, sentiment }) {
  const narrative = entry.narrative;
  const sentimentLabel = SENTIMENT_LABELS[sentiment] || sentiment;
  const dominantWeight = Object.entries(entry.weights || {}).sort(([, a], [, b]) => b - a)[0];
  const dominantDimensionLabel = dominantWeight
    ? `${DIMENSION_LABELS[dominantWeight[0]] || dominantWeight[0]}\u00D7${dominantWeight[1]}`
    : "";

  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur">
      <div className="flex items-baseline justify-between">
        <div>
          <h3 className="font-display text-lg text-white">{entry.judgeName}</h3>
          <p className="text-xs uppercase tracking-wide text-white/50">{entry.title}</p>
        </div>
        <span className="rounded-full border border-white/20 bg-white/8 px-3 py-1 text-xs text-white/70">
          {sentimentLabel}
        </span>
      </div>

      {narrative ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm italic leading-relaxed text-white/90">
            &ldquo;{narrative.journeyNarrative}&rdquo;
          </p>
          <div className="flex items-start gap-2 text-xs text-white/60">
            <span className="mt-px shrink-0 text-white/40">Turning point:</span>
            <span>{narrative.keyMoment}</span>
          </div>
          <div className="rounded-lg border border-amber-400/20 bg-amber-500/8 px-3 py-2">
            <p className="text-xs text-amber-200/80">
              &ldquo;{narrative.improvementHint}&rdquo;
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <p className="text-sm text-white/60 italic">{entry.focusText}</p>
        </div>
      )}

      <div className="mt-4 space-y-1 border-t border-white/10 pt-3">
        {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
          <EvaluationBar key={key} label={label} score={entry.evaluation?.[key] ?? 0} />
        ))}
        <div className="mt-2 flex items-center justify-between text-xs text-white/40">
          <span>Weighted: {entry.weightedScore}</span>
          {dominantDimensionLabel && <span>{dominantDimensionLabel}</span>}
        </div>
      </div>

      {entry.madeOffer && entry.offerSummary && (
        <div className="mt-2 text-xs text-green-300/60">
          Offered: {entry.offerSummary}
        </div>
      )}
    </div>
  );
}

function LoadingCard({ entry }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 p-5 backdrop-blur animate-pulse">
      <h3 className="font-display text-lg text-white">{entry.judgeName}</h3>
      <p className="text-xs uppercase tracking-wide text-white/50">{entry.title}</p>
      <div className="mt-4 space-y-2">
        <div className="h-3 w-3/4 rounded bg-white/10" />
        <div className="h-3 w-1/2 rounded bg-white/10" />
      </div>
      <div className="mt-4 space-y-1 border-t border-white/10 pt-3">
        {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
          <EvaluationBar key={key} label={label} score={entry.evaluation?.[key] ?? 0} />
        ))}
      </div>
    </div>
  );
}

export default function DebriefReport({ debrief, judgeResponses, loading, onSkip, onProceed }) {
  const sentimentByJudge = Object.fromEntries(
    (judgeResponses || []).map((r) => [r.judgeId, r.sentiment])
  );

  return (
    <section className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-black/70 p-4">
      <div className="w-full max-w-3xl space-y-4">
        <div className="text-center">
          <h2 className="font-display text-2xl text-white md:text-4xl">Judges&apos; Debrief</h2>
          <p className="mt-1 text-sm text-white/60">What the judges were really thinking</p>
        </div>

        {debrief?.judges?.map((entry) =>
          loading && !entry.narrative ? (
            <LoadingCard key={entry.judgeId} entry={entry} />
          ) : (
            <JudgeDebriefCard
              key={entry.judgeId}
              entry={entry}
              sentiment={sentimentByJudge[entry.judgeId] || "interested"}
            />
          )
        )}

        {debrief && (
          <div className="rounded-2xl border border-white/15 bg-white/5 p-4 text-center backdrop-blur">
            <p className="text-xs uppercase tracking-wide text-white/50">Overall average</p>
            <p className="font-display mt-1 text-3xl text-white">{debrief.averageScore}</p>
            <p className="mt-1 text-xs text-white/40">
              Strongest dimension: {DIMENSION_LABELS[debrief.topDimension] || debrief.topDimension}
            </p>
          </div>
        )}

        <div className="flex justify-center gap-3 pb-4">
          {onSkip && (
            <button
              suppressHydrationWarning
              type="button"
              onClick={onSkip}
              className="rounded-xl border border-white/30 bg-white/5 px-5 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/10"
            >
              Skip
            </button>
          )}
          {onProceed && (
            <button
              suppressHydrationWarning
              type="button"
              onClick={onProceed}
              className="rounded-xl border border-white/45 bg-white/10 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
