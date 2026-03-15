import {
  LIVE_REACTION_PREFERRED_SOURCES,
  LIVE_REACTION_SOURCE_TYPES,
  createLiveJudgeReactionRequest,
  validateLiveJudgeReactionEvent
} from "../../../packages/contracts/src/index.js";

export const DEFAULT_LIVE_REACTION_CADENCE_MS = 4_000;
export const DEFAULT_MINIMUM_TRANSCRIPT_CHARS = 48;

const NEUTRAL_REACTION = Object.freeze({
  mood: "neutral",
  presenceState: "engaged",
  confidenceBand: "low",
  animationCue: "listen"
});

const POSITIVE_HINTS = Object.freeze([
  "growth",
  "margin",
  "retention",
  "revenue",
  "pilot",
  "traction",
  "customers",
  "repeat",
  "signed",
  "conversion",
  "ltv",
  "cac",
  "gmv",
  "%",
  "$"
]);

const MOAT_HINTS = Object.freeze([
  "defensible",
  "exclusive",
  "brand",
  "patent",
  "network",
  "distribution",
  "switching cost",
  "workflow",
  "embedded"
]);

const EXECUTION_HINTS = Object.freeze([
  "team",
  "ship",
  "launch",
  "operator",
  "execute",
  "hiring",
  "weeks",
  "months",
  "pipeline"
]);

const UNCLEAR_HINTS = Object.freeze([
  "maybe",
  "probably",
  "sort of",
  "kind of",
  "hopefully",
  "soon"
]);

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function countMatches(text, hints) {
  return hints.reduce((total, hint) => total + (text.includes(hint) ? 1 : 0), 0);
}

function normalizeJudgeKey(judge) {
  return `${judge.id} ${judge.name}`.trim().toLowerCase();
}

function buildTranscriptExcerpt(transcriptUpdates) {
  return transcriptUpdates
    .slice(-3)
    .map((update) => update.text.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function getLatestTranscriptSequence(transcriptUpdates) {
  if (!transcriptUpdates.length) {
    return null;
  }

  return transcriptUpdates[transcriptUpdates.length - 1].sequence;
}

function createJudgeSummary(judge, presenceState, excerpt) {
  const summaryFragments = {
    engaged: `${judge.name} is tracking the pitch momentum.`,
    understanding: `${judge.name} is following the logic and evidence.`,
    confused: `${judge.name} needs the founder to tighten the explanation.`,
    skeptical: `${judge.name} is still unconvinced by the core claim.`,
    impressed: `${judge.name} hears a strong signal worth leaning into.`,
    neutral: `${judge.name} is watching without committing yet.`
  };
  const summary = summaryFragments[presenceState] ?? summaryFragments.neutral;

  if (!hasText(excerpt)) {
    return summary;
  }

  const excerptFragment = excerpt.length > 72 ? `${excerpt.slice(0, 72)}...` : excerpt;
  return `${summary} Cue: "${excerptFragment}"`;
}

function resolveJudgeReaction(judge, excerpt) {
  const normalizedExcerpt = excerpt.toLowerCase();
  const positiveSignals = countMatches(normalizedExcerpt, POSITIVE_HINTS);
  const unclearSignals = countMatches(normalizedExcerpt, UNCLEAR_HINTS);
  const judgeKey = normalizeJudgeKey(judge);

  let reaction = { ...NEUTRAL_REACTION };

  if (judgeKey.includes("cat") || judgeKey.includes("zephyr")) {
    reaction =
      positiveSignals >= 2
        ? { mood: "positive", presenceState: "understanding", confidenceBand: "medium", animationCue: "nod" }
        : unclearSignals > 0
          ? { mood: "negative", presenceState: "confused", confidenceBand: "low", animationCue: "tilt_head" }
          : { mood: "neutral", presenceState: "engaged", confidenceBand: "medium", animationCue: "listen" };
  } else if (judgeKey.includes("dog") || judgeKey.includes("ryo")) {
    const moatSignals = countMatches(normalizedExcerpt, MOAT_HINTS);
    reaction =
      moatSignals >= 1
        ? { mood: "positive", presenceState: "engaged", confidenceBand: "medium", animationCue: "lean_in" }
        : positiveSignals >= 3
          ? { mood: "neutral", presenceState: "engaged", confidenceBand: "medium", animationCue: "listen" }
          : { mood: "negative", presenceState: "skeptical", confidenceBand: "medium", animationCue: "frown" };
  } else if (judgeKey.includes("shark") || judgeKey.includes("mara")) {
    const executionSignals = countMatches(normalizedExcerpt, EXECUTION_HINTS);
    reaction =
      executionSignals >= 1 && positiveSignals >= 1
        ? { mood: "positive", presenceState: "impressed", confidenceBand: "high", animationCue: "smile" }
        : unclearSignals > 1
          ? { mood: "negative", presenceState: "skeptical", confidenceBand: "medium", animationCue: "frown" }
          : { mood: "neutral", presenceState: "engaged", confidenceBand: "medium", animationCue: "lean_in" };
  }

  return {
    judgeId: judge.id,
    judgeName: judge.name,
    ...reaction,
    summary: createJudgeSummary(judge, reaction.presenceState, excerpt),
    authoritative: false
  };
}

function createReactionEvent({ request, sourceType, providerName }) {
  const excerpt = buildTranscriptExcerpt(request.transcriptUpdates);

  const event = {
    type: "live_judge_reaction",
    roundId: request.roundId,
    generatedAtMs: request.generatedAtMs,
    presentationOnly: true,
    sourceType,
    providerName,
    transcriptSequence: getLatestTranscriptSequence(request.transcriptUpdates),
    judges: request.judges.map((judge) => resolveJudgeReaction(judge, excerpt))
  };

  validateLiveJudgeReactionEvent(event);
  return event;
}

export function createMockLiveReactionProvider() {
  return {
    name: "mock-live-reactions",
    async generate(request) {
      return createReactionEvent({
        request,
        sourceType: LIVE_REACTION_SOURCE_TYPES.MOCK,
        providerName: "mock-live-reactions"
      });
    }
  };
}

export function createProviderLiveReactionProvider(options = {}) {
  if (typeof options.generate !== "function") {
    throw new Error("Provider-backed live reaction adapters require a generate function.");
  }

  return {
    name: options.name?.trim?.() || "provider-live-reactions",
    async generate(request) {
      const rawEvent = await options.generate(request);
      const event = {
        ...rawEvent,
        type: "live_judge_reaction",
        roundId: rawEvent?.roundId ?? request.roundId,
        generatedAtMs: rawEvent?.generatedAtMs ?? request.generatedAtMs,
        presentationOnly: true,
        sourceType: LIVE_REACTION_SOURCE_TYPES.PROVIDER,
        providerName: options.name?.trim?.() || "provider-live-reactions",
        transcriptSequence: rawEvent?.transcriptSequence ?? getLatestTranscriptSequence(request.transcriptUpdates)
      };

      validateLiveJudgeReactionEvent(event);
      return event;
    }
  };
}

export function createLiveJudgeReactionService(options = {}) {
  const cadenceMs =
    Number.isFinite(options.cadenceMs) && options.cadenceMs >= 0
      ? options.cadenceMs
      : DEFAULT_LIVE_REACTION_CADENCE_MS;
  const minimumTranscriptChars =
    Number.isFinite(options.minimumTranscriptChars) && options.minimumTranscriptChars >= 0
      ? options.minimumTranscriptChars
      : DEFAULT_MINIMUM_TRANSCRIPT_CHARS;
  const mockProvider = options.mockProvider ?? createMockLiveReactionProvider();
  const provider = options.provider ?? null;

  return {
    async run(input) {
      const request = createLiveJudgeReactionRequest(input);
      const transcriptSequence = getLatestTranscriptSequence(request.transcriptUpdates);
      const transcriptExcerpt = buildTranscriptExcerpt(request.transcriptUpdates);
      const cadenceRemainingMs =
        request.lastReactionAtMs === null ? 0 : Math.max(0, cadenceMs - (request.generatedAtMs - request.lastReactionAtMs));

      if (!hasText(transcriptExcerpt) || transcriptExcerpt.length < minimumTranscriptChars) {
        return {
          emitted: false,
          reason: "insufficient_context",
          cadenceRemainingMs,
          transcriptSequence
        };
      }

      if (request.lastReactionAtMs !== null && request.generatedAtMs - request.lastReactionAtMs < cadenceMs) {
        return {
          emitted: false,
          reason: "cadence_wait",
          cadenceRemainingMs,
          transcriptSequence
        };
      }

      if (request.lastTranscriptSequence !== null && transcriptSequence === request.lastTranscriptSequence) {
        return {
          emitted: false,
          reason: "no_new_transcript",
          cadenceRemainingMs: 0,
          transcriptSequence
        };
      }

      const wantsProvider = request.preferredSource === LIVE_REACTION_PREFERRED_SOURCES.PROVIDER;

      if (wantsProvider && provider) {
        try {
          return {
            emitted: true,
            event: await provider.generate(request),
            fallbackUsed: false
          };
        } catch {
          return {
            emitted: true,
            event: createReactionEvent({
              request,
              sourceType: LIVE_REACTION_SOURCE_TYPES.FALLBACK,
              providerName: mockProvider.name
            }),
            fallbackUsed: true
          };
        }
      }

      if (wantsProvider && !provider) {
        return {
          emitted: true,
          event: createReactionEvent({
            request,
            sourceType: LIVE_REACTION_SOURCE_TYPES.FALLBACK,
            providerName: mockProvider.name
          }),
          fallbackUsed: true
        };
      }

      return {
        emitted: true,
        event: await mockProvider.generate(request),
        fallbackUsed: false
      };
    }
  };
}
