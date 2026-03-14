function MicrophoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
      <path
        fill="currentColor"
        d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 1 1-14 0 1 1 0 1 1 2 0 5 5 0 0 0 10 0ZM11 21a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0v-2Z"
      />
    </svg>
  );
}

export default function DialoguePanel({
  speakerName,
  text,
  chatEnabled,
  inputValue,
  onInputChange,
  onSend,
  onAdvance,
  showAdvance,
  statusText
}) {
  const sendDisabled = !chatEnabled || !inputValue.trim();

  function handleSubmit(event) {
    event.preventDefault();
    if (sendDisabled) {
      return;
    }
    onSend();
  }

  return (
    <section className="absolute inset-x-0 bottom-3 z-30 px-3 md:bottom-6 md:px-6">
      <div className="mx-auto w-full max-w-6xl rounded-3xl border border-white/15 bg-stage-panel/92 px-4 pb-4 pt-3 shadow-dialogue backdrop-blur md:px-6 md:pb-5 md:pt-4">
        <div className="mb-4 space-y-2.5">
          <p className="text-lg font-semibold leading-tight text-stage-text md:text-xl">{speakerName}</p>
          <p className="max-w-4xl text-sm text-stage-text/95 md:text-[1.1rem] md:leading-[1.35]">
            {text}
          </p>
        </div>

        <div className="mb-4 h-px w-full bg-white/20" />

        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-stage-muted md:text-sm">
          <div className="flex items-center gap-3">
            <MicrophoneIcon />
            <span>{chatEnabled ? "Press Enter or click Send" : "Read all judge dialogue first"}</span>
          </div>

          {showAdvance && (
            <button
              type="button"
              onClick={onAdvance}
              className="rounded-md border border-white/40 px-3 py-1 text-xs font-semibold text-white transition hover:bg-white/10 md:text-sm"
            >
              Next
            </button>
          )}
        </div>

        {statusText && <p className="mb-3 text-xs text-white/75 md:text-sm">{statusText}</p>}

        <form className="flex w-full items-center gap-2 md:gap-3" onSubmit={handleSubmit}>
          <label htmlFor="message-input" className="sr-only">
            Enter Message
          </label>
          <input
            id="message-input"
            name="message"
            placeholder="Enter Message..."
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            disabled={!chatEnabled}
            className="h-10 flex-1 rounded-md border border-white/45 bg-black/35 px-3 text-sm text-white outline-none ring-0 placeholder:text-white/75 focus:border-white md:h-12 md:px-4 md:text-xl"
          />
          <button
            type="submit"
            disabled={sendDisabled}
            className="h-10 min-w-20 rounded-md border border-white/55 bg-black/20 px-4 text-base font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 md:h-12 md:min-w-28 md:text-2xl"
          >
            Send
          </button>
        </form>
      </div>
    </section>
  );
}
