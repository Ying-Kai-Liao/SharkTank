import OpenAI from "openai";

import { createJudgePersona } from "./judges.js";

function formatDimension(dimension) {
  return dimension.replaceAll("_", " ");
}

function buildDebriefNarrativePrompt({ judge, sentiment, concerns, rationaleTags, episodicMemory, peerOpinions, evaluation, madeOffer, offerSummary }) {
  const persona = createJudgePersona(judge);
  const concernsList = (concerns || []).join(", ") || "none specified";
  const tagsList = (rationaleTags || []).map((tag) => tag.replaceAll("_", " ")).join(", ") || "none";
  const memoryNotes = (episodicMemory || [])
    .filter((entry) => entry.concern || entry.question)
    .map((entry) => `- concern: ${entry.concern || "n/a"}, question: ${entry.question || "n/a"}`)
    .join("\n") || "No prior memory entries.";
  const peerNotes = (peerOpinions || [])
    .map((peer) => `- ${peer.judgeName}: ${peer.sentiment}, pushing on ${peer.concerns?.[0] || "general concerns"}`)
    .join("\n") || "No peer consultation occurred.";

  const dimensions = Object.entries(evaluation || {})
    .map(([key, value]) => `${formatDimension(key)}: ${value}`)
    .join(", ");

  const offerNote = madeOffer ? `Made an offer: ${offerSummary}.` : "Did not make an offer.";

  return [
    "You are writing a post-round debrief as a specific judge from a Shark Tank style pitch game.",
    "Write in FIRST PERSON as this judge. Be direct, specific, and in-character.",
    "",
    "Return one JSON object with exactly these fields:",
    '- journeyNarrative: 2-3 sentences describing your thinking journey through this pitch. Reference specific things from the pitch. First person.',
    '- keyMoment: One short phrase describing the turning point or most notable moment.',
    '- improvementHint: One actionable coaching tip in first person, telling the founder what to do differently next time. Be specific, not generic.',
    "",
    "Do not include markdown or explanation outside JSON.",
    "",
    `Judge: ${judge.name} (${judge.title})`,
    `Persona: ${persona.instruction}`,
    `Final sentiment: ${sentiment}`,
    `Concerns: ${concernsList}`,
    `Rationale tags: ${tagsList}`,
    `Evaluation scores: ${dimensions}`,
    `${offerNote}`,
    "",
    "Episodic memory from earlier turns:",
    memoryNotes,
    "",
    "Peer judge opinions:",
    peerNotes,
    "",
    "Requirements:",
    "- Stay fully in character.",
    "- Reference at least one specific signal from the pitch evaluation or concerns.",
    "- The improvement hint must describe a concrete action (e.g. 'mention unit economics in the first 15 seconds') not abstract advice (e.g. 'be more clear').",
    "- Keep journeyNarrative under 60 words."
  ].join("\n");
}

function extractJsonObject(text) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Debrief narrative response did not contain a JSON object.");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

function validateNarrativeOutput(output) {
  if (!output || typeof output !== "object") {
    return null;
  }

  const journeyNarrative = String(output.journeyNarrative ?? "").trim();
  const keyMoment = String(output.keyMoment ?? "").trim();
  const improvementHint = String(output.improvementHint ?? "").trim();

  if (!journeyNarrative || !keyMoment || !improvementHint) {
    return null;
  }

  return { journeyNarrative, keyMoment, improvementHint };
}

export async function generateDebriefNarrative(judgeContext, options = {}) {
  const { judge, sentiment, concerns, rationaleTags, episodicMemory, peerOpinions, evaluation, madeOffer, offerSummary } = judgeContext;
  const prompt = buildDebriefNarrativePrompt(judgeContext);

  if (options.provider === "openai" && options.openAiApiKey) {
    const client = new OpenAI({ apiKey: options.openAiApiKey });
    const model = options.openAiModel || "gpt-4.1-mini";

    const response = await client.responses.create({
      model,
      instructions: "You are generating a post-round debrief narrative for a single judge. Respond with JSON only.",
      input: prompt
    });

    const parsed = extractJsonObject(response.output_text);
    return validateNarrativeOutput(parsed);
  }

  // Heuristic fallback: generate a formulaic but useful narrative
  const primaryConcern = (concerns || [])[0] || "the overall pitch";
  const sentimentVerb = sentiment === "impressed" ? "was won over by" : sentiment === "interested" ? "saw potential in" : "remained unconvinced by";
  const topTag = (rationaleTags || [])[0]?.replaceAll("_", " ") || "the pitch signals";

  return {
    journeyNarrative: `I ${sentimentVerb} ${topTag}. ${judge.focus} My main concern was ${primaryConcern}.`,
    keyMoment: primaryConcern,
    improvementHint: `Next time, address ${primaryConcern} within the first 30 seconds of your pitch. I need to hear it early to stay engaged.`
  };
}

export async function generateDebrief(request, options = {}) {
  const { judges, judgeResponses, evaluation, offers } = request;
  const offerByJudge = Object.fromEntries((offers || []).map((offer) => [offer.judgeId, offer]));

  const narrativePromises = (judgeResponses || []).map(async (response) => {
    const judge = (judges || []).find((j) => j.id === response.judgeId);
    if (!judge) {
      return { judgeId: response.judgeId, narrative: null };
    }

    const offer = offerByJudge[response.judgeId];
    const judgeContext = {
      judge,
      sentiment: response.sentiment,
      concerns: response.concerns || [],
      rationaleTags: response.rationaleTags || [],
      episodicMemory: request.episodicMemory?.[response.judgeId] || [],
      peerOpinions: request.peerOpinions?.[response.judgeId] || [],
      evaluation,
      madeOffer: Boolean(offer),
      offerSummary: offer ? `$${offer.amount?.toLocaleString()} for ${offer.equity}%` : null
    };

    try {
      const narrative = await generateDebriefNarrative(judgeContext, options);
      return { judgeId: response.judgeId, narrative };
    } catch {
      return { judgeId: response.judgeId, narrative: null };
    }
  });

  const results = await Promise.all(narrativePromises);
  return Object.fromEntries(results.map((result) => [result.judgeId, result.narrative]));
}
