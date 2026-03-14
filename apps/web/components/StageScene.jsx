import DialoguePanel from "./DialoguePanel";

const characters = [
  {
    id: "cat",
    name: "Zephyr Valtos",
    side: "left",
    src: "/assets/characters/sitting/cat_sitting/cat_sitting_01.png",
    heightClass: "h-[50vh] md:h-[70vh]"
  },
  {
    id: "dog",
    name: "Ryo Barkman",
    side: "center",
    src: "/assets/characters/sitting/dog_sitting/dog_sitting_01.png",
    heightClass: "h-[48vh] md:h-[72vh]"
  },
  {
    id: "shark",
    name: "Mara Finley",
    side: "right",
    src: "/assets/characters/sitting/shark_sitting/shark_sitting_01.png",
    heightClass: "h-[47vh] md:h-[73vh]"
  }
];

const sideClassMap = {
  left: "justify-self-end pr-20 md:pr-6",
  center: "justify-self-center",
  right: "justify-self-start pl-0 md:pl-6"
};

export default function StageScene() {
  return (
    <section className="stage-backdrop absolute inset-0 flex w-full items-end overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(255,223,145,0.22),transparent_52%)]" />
      <div className="relative z-20 mx-auto grid w-full max-w-[1200px] grid-cols-3 items-end gap-2 px-2 pb-14 md:gap-6 md:px-6 md:pb-16 lg:px-12">
        {characters.map((character) => (
          <figure key={character.id} className={`${sideClassMap[character.side]} m-0 flex items-end`}>
            <img
              src={character.src}
              alt={character.name}
              className={`pixel-crisp w-auto max-w-[320px] drop-shadow-[0_15px_24px_rgba(0,0,0,0.72)] md:max-w-[420px] ${character.heightClass} ${character.id === "cat" ? "-scale-x-100" : ""}`}
            />
          </figure>
        ))}
      </div>
      <DialoguePanel />
    </section>
  );
}
