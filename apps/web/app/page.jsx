import ScoreBadge from "../components/ScoreBadge";
import StageScene from "../components/StageScene";

export default function Page() {
  return (
    <main className="relative h-screen overflow-hidden bg-black text-white">
      <ScoreBadge score={70} />
      <StageScene />
    </main>
  );
}
