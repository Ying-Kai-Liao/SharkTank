import OpenAI from "openai";

import { createJudgePersona, createJudgeToolRegistry } from "./judges.js";
import { getJudgeScore } from "./context.js";
import { judgeDraftSchema } from "./validation.js";

function pickSentiment(score) {
  if (score >= 78) {
    return "impressed";
  }

  if (score >= 62) {
    return "interested";
  }

  return "skeptical";
}

function formatDimension(dimension) {
  return dimension.replaceAll("_", " ");
}

async function buildQuestion(judge, probeResult) {
  if (judge.id === "rhea") {
    return probeResult.note.includes("scale")
      ? "Which revenue milestone proves this can scale without collapsing margin?"
      : "What evidence says this business model works beyond the first customers?";
  }

  if (judge.id === "marco") {
    return probeResult.note.includes("protected")
      ? "What stops a bigger player from copying this once the market wakes up?"
      : "Why does this company deserve to exist if the moat is still this thin?";
  }

  return probeResult.note.includes("decisive")
    ? "What proof shows your team can execute faster than the opportunity moves?"
    : "Why should anyone trust this team to deliver under pressure right now?";
}

function buildReaction({ judge, sentiment, quote, probeResult, memoryResult, score, tags }) {
  const cue = quote.length > 84 ? `${quote.slice(0, 84)}...` : quote;
  const memoryNote = memoryResult.lastConcern ? ` Last round concern: ${memoryResult.lastConcern}.` : "";
  const sentimentFragments = {
    impressed: `${judge.name} hears strong signal in ${formatDimension(probeResult.dimension)}.`,
    interested: `${judge.name} sees promise but still wants firmer proof around ${probeResult.emphasis}.`,
    skeptical: `${judge.name} is not convinced the ${probeResult.emphasis} story is ready yet.`
  };

  return `${sentimentFragments[sentiment]} ${probeResult.note} Score cue ${score}. Founder quote: "${cue}".${memoryNote} Tags: ${tags.join(", ")}.`;
}

export function createFallbackJudgeDraft({ judge, context, draft }) {
  if (draft) {
    return judgeDraftSchema.parse(structuredClone(draft));
  }

  const score = getJudgeScore(context.scorecard, judge.id);

  return judgeDraftSchema.parse({
    judgeId: judge.id,
    judgeName: judge.name,
    sentiment: pickSentiment(score),
    shortReaction: `${judge.name} wants a sharper answer anchored in ${judge.focus.toLowerCase()}.`,
    question: "What proof should make this judge lean in further?",
    rationaleTags: context.sharedTags,
    score,
    confidence: Math.min(100, Math.round((score + context.evaluation.confidence) / 2)),
    concerns: [judge.focus.toLowerCase(), "follow_up"]
  });
}

function createHeuristicProvider() {
  return {
    name: "heuristic",
    async generateJudgeDraft({ judge, context, memoryStore, request }) {
      const persona = createJudgePersona(judge);
      const namespaces = request.memoryNamespaces[judge.id];
      const episodic = memoryStore.listEpisodes(namespaces.episodic);
      const memoryView = {
        persona: memoryStore.getPersona(namespaces.persona),
        episodic
      };

      if (!memoryView.persona) {
        memoryStore.setPersona(namespaces.persona, persona.stablePreferences);
      }

      const tools = createJudgeToolRegistry({ judge, context, memoryView });
      const roundSnapshot = await tools.read_round_snapshot.invoke({});
      const memoryResult = await tools.recall_judge_memory.invoke({});
      const probeResult = await tools.judge_probe.invoke({});
      const score = getJudgeScore(context.scorecard, judge.id);
      const sentiment = pickSentiment(score);
      const question = await buildQuestion(judge, probeResult);

      return judgeDraftSchema.parse({
        judgeId: judge.id,
        judgeName: judge.name,
        sentiment,
        shortReaction: buildReaction({
          judge,
          sentiment,
          quote: roundSnapshot.quote,
          probeResult,
          memoryResult,
          score,
          tags: context.sharedTags
        }),
        question,
        rationaleTags: context.sharedTags,
        score,
        confidence: Math.min(100, Math.round((score + context.evaluation.confidence) / 2)),
        concerns: [probeResult.emphasis, formatDimension(probeResult.dimension)]
      });
    },
    async reviseJudgeDraft({ judge, draft, peerDrafts }) {
      const strongestPeer = [...peerDrafts].sort((left, right) => right.score - left.score)[0];

      if (!strongestPeer || strongestPeer.sentiment === draft.sentiment) {
        return draft;
      }

      const upgradedSentiment =
        strongestPeer.sentiment === "impressed" && draft.sentiment === "skeptical"
          ? "interested"
          : draft.sentiment;
      const discussionNote = ` After hearing the panel, ${judge.name} narrows the gap without conceding deterministic authority.`;

      return judgeDraftSchema.parse({
        ...draft,
        sentiment: upgradedSentiment,
        shortReaction: `${draft.shortReaction}${discussionNote}`,
        confidence: Math.min(100, draft.confidence + 4)
      });
    }
  };
}

function extractJsonObject(text) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response did not contain a JSON object.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

function normalizeSentiment(value, fallback = "interested") {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized.includes("impress")) {
    return "impressed";
  }

  if (normalized.includes("interest") || normalized.includes("curious") || normalized.includes("positive")) {
    return "interested";
  }

  if (normalized.includes("skept") || normalized.includes("doubt") || normalized.includes("concern")) {
    return "skeptical";
  }

  return fallback;
}

function normalizeStringArray(values, fallback) {
  const normalized = (Array.isArray(values) ? values : fallback)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);

  return normalized.length ? normalized : fallback;
}

function normalizeRationaleTags(values, fallback) {
  return normalizeStringArray(values, fallback).map((value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
}

function normalizeJudgeDraftPayload(payload, fallback) {
  const base = fallback ?? {
    judgeId: "",
    judgeName: "",
    sentiment: "interested",
    shortReaction: "",
    question: "",
    rationaleTags: ["needs_follow_up"],
    score: 0,
    confidence: 50,
    concerns: ["follow_up"]
  };

  return {
    ...base,
    ...payload,
    sentiment: normalizeSentiment(payload?.sentiment, base.sentiment),
    shortReaction: String(payload?.shortReaction ?? base.shortReaction).trim(),
    question: String(payload?.question ?? base.question).trim(),
    rationaleTags: normalizeRationaleTags(payload?.rationaleTags, base.rationaleTags),
    confidence: Math.max(0, Math.min(100, Math.round(Number(payload?.confidence ?? base.confidence)))),
    concerns: normalizeStringArray(payload?.concerns, base.concerns)
  };
}

function createOpenAiClient(config) {
  return new OpenAI({
    apiKey: config.openAiApiKey
  });
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function buildJudgeDraftPrompt({ judge, context, memoryView }) {
  const persona = createJudgePersona(judge);

  return [
    "Return one JSON object with these fields only:",
    "judgeId, judgeName, sentiment, shortReaction, question, rationaleTags, score, confidence, concerns",
    'sentiment must be one of "skeptical", "interested", or "impressed".',
    "rationaleTags must be an array of short snake_case strings.",
    "concerns must be an array of short phrases.",
    "Do not include markdown or explanation outside JSON.",
    "",
    "Persona:",
    persona.instruction,
    "",
    "Deterministic round context:",
    formatJson({
      pitch: context.pitch,
      evaluation: context.evaluation,
      score: getJudgeScore(context.scorecard, judge.id),
      transcript: context.transcript,
      rationaleTags: context.sharedTags
    }),
    "",
    "Judge-local memory:",
    formatJson({
      stablePreferences: memoryView.persona ?? persona.stablePreferences,
      episodic: memoryView.episodic
    }),
    "",
    "Requirements:",
    "- Keep the reaction under 55 words.",
    "- Ask exactly one follow-up question.",
    "- Reference deterministic context, but do not change scores, offers, or outcomes.",
    "- Judge independently and do not invent panel discussion."
  ].join("\n");
}

function buildJudgeRevisionPrompt({ judge, draft, peerDrafts, turn }) {
  return [
    "Return one JSON object with the same fields as the previous draft.",
    "Revise only if the panel discussion would realistically shift tone or wording.",
    "Do not expose internal reasoning or chain-of-thought.",
    "Do not modify deterministic truth, score authority, or game outcomes.",
    "",
    `Discussion turn: ${turn}`,
    `Judge: ${judge.name}`,
    "",
    "Current draft:",
    formatJson(draft),
    "",
    "Peer drafts:",
    formatJson(
      peerDrafts.map((peerDraft) => ({
        judgeId: peerDraft.judgeId,
        judgeName: peerDraft.judgeName,
        sentiment: peerDraft.sentiment,
        question: peerDraft.question,
        concerns: peerDraft.concerns
      }))
    ),
    "",
    "Requirements:",
    "- Keep the same schema.",
    "- Preserve judge individuality.",
    "- Only soften or sharpen sentiment if peer perspectives justify it."
  ].join("\n");
}

async function requestOpenAiJson({ client, model, instructions, input }) {
  const response = await client.responses.create({
    model,
    instructions,
    input
  });

  return extractJsonObject(response.output_text);
}

function createOpenAiProvider(config) {
  const client = createOpenAiClient(config);

  return {
    name: "openai",
    async generateJudgeDraft({ judge, context, memoryStore, request }) {
      const persona = createJudgePersona(judge);
      const namespaces = request.memoryNamespaces[judge.id];
      const episodic = memoryStore.listEpisodes(namespaces.episodic);
      const memoryView = {
        persona: memoryStore.getPersona(namespaces.persona),
        episodic
      };

      if (!memoryView.persona) {
        memoryStore.setPersona(namespaces.persona, persona.stablePreferences);
        memoryView.persona = persona.stablePreferences;
      }

      const tools = createJudgeToolRegistry({ judge, context, memoryView });
      const roundSnapshot = await tools.read_round_snapshot.invoke({});
      const memoryResult = await tools.recall_judge_memory.invoke({});
      const probeResult = await tools.judge_probe.invoke({});
      const modelOutput = await requestOpenAiJson({
        client,
        model: config.openAiModel,
        instructions: "You are generating one judge draft for a Shark Tank style panel. Respond with JSON only.",
        input: buildJudgeDraftPrompt({
          judge,
          context: {
            ...context,
            transcript: context.transcript,
            quote: roundSnapshot.quote,
            probeResult,
          memoryResult
        },
        memoryView
      })
      });
      const fallbackDraft = createFallbackJudgeDraft({ judge, context });

      return judgeDraftSchema.parse({
        ...normalizeJudgeDraftPayload(modelOutput, fallbackDraft),
        judgeId: fallbackDraft.judgeId,
        judgeName: fallbackDraft.judgeName,
        score: fallbackDraft.score
      });
    },
    async reviseJudgeDraft({ judge, draft, peerDrafts, turn }) {
      const modelOutput = await requestOpenAiJson({
        client,
        model: config.openAiModel,
        instructions:
          "You are revising a single judge draft after bounded panel discussion. Return JSON only and keep the same schema.",
        input: buildJudgeRevisionPrompt({
          judge,
          draft,
          peerDrafts,
          turn
        })
      });

      return judgeDraftSchema.parse({
        ...normalizeJudgeDraftPayload(modelOutput, draft),
        judgeId: draft.judgeId,
        judgeName: draft.judgeName,
        score: draft.score
      });
    }
  };
}

export function createJudgeProvider(config) {
  if (config.provider === "openai") {
    return createOpenAiProvider(config);
  }

  return createHeuristicProvider();
}
