import DialoguePanel from "./DialoguePanel";
import { useState } from "react";

const characters = [
  {
    id: "cat",
    name: "Zephyr Valtos",
    side: "left",
    sittingSrc: "/assets/characters/sitting/cat_sitting/cat_sitting_01.png",
    sittingPositiveSrc: "/assets/characters/sitting_positive/Cat_IdlePositive/Cat_IdlePositive_01.png",
    sittingNegativeSrc: "/assets/characters/sitting_negative/Cat_IdleNegative/Cat_IdleNegative.png",
    standingSrc: "/assets/characters/standing/cat_standing/cat_standing_01.png",
    heightClass: "h-[50vh] md:h-[70vh]"
  },
  {
    id: "dog",
    name: "Ryo Barkman",
    side: "center",
    sittingSrc: "/assets/characters/sitting/dog_sitting/dog_sitting_01.png",
    sittingPositiveSrc: "/assets/characters/sitting_positive/Dog_IdlePositive/Dog_IdlePositive_01.png",
    sittingNegativeSrc: "/assets/characters/sitting_negative/Dog_IdleNegative/Dog_IdleNegative_01.png",
    standingSrc: "/assets/characters/standing/dog_standing/dog_standing_01.png",
    heightClass: "h-[48vh] md:h-[72vh]"
  },
  {
    id: "shark",
    name: "Mara Finley",
    side: "right",
    sittingSrc: "/assets/characters/sitting/shark_sitting/shark_sitting_01.png",
    sittingPositiveSrc: "/assets/characters/sitting_positive/Shark_IdlePositive/Shark_IdlePositive_01.png",
    sittingNegativeSrc: "/assets/characters/sitting_negative/Shark_IdleNegative/Shark_IdleNegative_01.png",
    standingSrc: "/assets/characters/standing/shark_standing/shark_standing_01.png",
    heightClass: "h-[47vh] md:h-[73vh]"
  }
];

const sideClassMap = {
  left: "justify-self-end pr-20 md:pr-6",
  center: "justify-self-center",
  right: "justify-self-start pl-0 md:pl-6"
};

export default function StageScene({
  activeSpeakerId,
  judgeReactions,
  offersByJudge,
  offerDecisions,
  offerSelectionEnabled,
  onAcceptOffer,
  onRejectAllOffers,
  speakerName,
  dialogueText,
  chatEnabled,
  inputValue,
  onInputChange,
  onSend,
  onAdvance,
  showAdvance,
  statusText
}) {
  const [hoveredJudgeId, setHoveredJudgeId] = useState(null);

  const focusedJudgeId = offerSelectionEnabled ? hoveredJudgeId : activeSpeakerId;

  function formatOffer(offer) {
    if (!offer) {
      return "No offer";
    }

    return `$${Number(offer.amount || 0).toLocaleString()} for ${Number(offer.equity || 0)}%`;
  }

  function resolveSprite(character) {
    if (character.id === activeSpeakerId) {
      return character.standingSrc;
    }

    const reaction = judgeReactions?.[character.id];
    if (reaction === "positive") {
      return character.sittingPositiveSrc;
    }

    if (reaction === "negative") {
      return character.sittingNegativeSrc;
    }

    return character.sittingSrc;
  }

  return (
    <section className="stage-backdrop absolute inset-0 flex w-full items-end overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(255,223,145,0.22),transparent_52%)]" />
      {focusedJudgeId && <div className="pointer-events-none absolute inset-0 z-10 bg-black/65" />}
      <div className="relative z-20 mx-auto grid w-full max-w-[1200px] grid-cols-3 items-end gap-2 px-2 pb-14 md:gap-6 md:px-6 md:pb-16 lg:px-12">
        {characters.map((character) => (
          <figure
            key={character.id}
            className={`${sideClassMap[character.side]} group relative m-0 flex items-end`}
            onMouseEnter={() => {
              if (offerSelectionEnabled) {
                setHoveredJudgeId(character.id);
              }
            }}
            onMouseLeave={() => {
              if (offerSelectionEnabled) {
                setHoveredJudgeId(null);
              }
            }}
          >
            <img
              src={resolveSprite(character)}
              alt={character.name}
              className={`pixel-crisp w-auto max-w-[320px] drop-shadow-[0_15px_24px_rgba(0,0,0,0.72)] md:max-w-[420px] ${character.heightClass} ${character.id === "cat" ? "-scale-x-100" : ""} ${focusedJudgeId && character.id !== focusedJudgeId ? "opacity-15 saturate-0 brightness-40" : "opacity-100"}`}
            />

            {offerSelectionEnabled && (
              <div className="absolute -top-14 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 group-hover:flex">
                <div className="h-0 w-0 border-l-8 border-r-8 border-t-10 border-l-transparent border-r-transparent border-t-white/70" />
                {offersByJudge?.[character.id] ? (
                  <div className="min-w-[210px] rounded-xl border border-white/35 bg-black/82 p-2 text-center text-xs text-white md:text-sm">
                    <p className="mb-2 font-semibold">{formatOffer(offersByJudge[character.id])}</p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => onAcceptOffer(character.id)}
                        className="rounded-md border border-emerald-300/70 px-2 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-400/20"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={onRejectAllOffers}
                        className="rounded-md border border-rose-300/70 px-2 py-1 text-[11px] font-semibold text-rose-200 transition hover:bg-rose-400/20"
                      >
                        Reject All Offer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/30 bg-black/82 px-3 py-2 text-xs text-white/85 md:text-sm">
                    No offer from this judge
                  </div>
                )}
              </div>
            )}

            {offerSelectionEnabled && offerDecisions?.[character.id] && (
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md border border-white/35 bg-black/70 px-2 py-1 text-[10px] uppercase tracking-wide text-white/90">
                {offerDecisions[character.id]}
              </div>
            )}
          </figure>
        ))}
      </div>

      {offerSelectionEnabled ? (
        <section className="absolute inset-x-0 bottom-3 z-30 px-3 md:bottom-6 md:px-6">
          <div className="mx-auto w-full max-w-4xl rounded-3xl border border-white/25 bg-black/82 px-4 py-4 text-center shadow-dialogue backdrop-blur md:px-6 md:py-5">
            <p className="font-display text-xl text-white md:text-2xl">Choose Judge Offer</p>
            <p className="mt-2 text-sm text-white/90 md:text-base">{dialogueText}</p>
            {statusText ? <p className="mt-2 text-xs text-white/70 md:text-sm">{statusText}</p> : null}
            <p className="mt-3 text-xs text-white/70 md:text-sm">Hover a judge to see the triangle offer card, then click Accept or Reject All Offer.</p>
          </div>
        </section>
      ) : (
        <DialoguePanel
          speakerName={speakerName}
          text={dialogueText}
          chatEnabled={chatEnabled}
          inputValue={inputValue}
          onInputChange={onInputChange}
          onSend={onSend}
          onAdvance={onAdvance}
          showAdvance={showAdvance}
          statusText={statusText}
        />
      )}
    </section>
  );
}
