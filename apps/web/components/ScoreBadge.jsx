export default function ScoreBadge({ score }) {
  return (
    <div className="font-display absolute left-4 top-4 z-30 text-3xl uppercase tracking-wide text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.8)] md:left-6 md:top-6 md:text-5xl">
      Score {String(score).padStart(3, "0")}
    </div>
  );
}
