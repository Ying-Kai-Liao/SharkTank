import { JUDGE_PROFILES } from "@sharktank/game-engine";

const JUDGE_TO_STAGE = {
  rhea: "cat",
  marco: "dog",
  tori: "shark"
};

function buildOfferDialoguePrompt(judge, offer, evaluation, transcript) {
  const pitchExcerpt = transcript
    .filter((entry) => entry.speaker === "Founder")
    .map((entry) => entry.text)
    .join(" ")
    .slice(0, 300);

  const dimensions = Object.entries(evaluation || {})
    .map(([key, value]) => `${key.replace("_", " ")}: ${value}/100`)
    .join(", ");

  if (offer) {
    return [
      `You are ${judge.name}, ${judge.title}, in a Shark Tank style pitch game.`,
      `Your focus: ${judge.focus}`,
      `The founder pitched: "${pitchExcerpt}"`,
      `Evaluation scores: ${dimensions}`,
      `You decided to offer $${offer.amount.toLocaleString()} for ${offer.equity}% equity.`,
      "",
      "Write 2-3 sentences IN CHARACTER explaining why you're making this offer.",
      "Reference specific aspects of the pitch. Be direct and concise.",
      "Mention the offer amount and equity in your dialogue.",
      "Return ONLY the dialogue text, no quotes or attribution."
    ].join("\n");
  }

  return [
    `You are ${judge.name}, ${judge.title}, in a Shark Tank style pitch game.`,
    `Your focus: ${judge.focus}`,
    `The founder pitched: "${pitchExcerpt}"`,
    `Evaluation scores: ${dimensions}`,
    "You decided NOT to make an offer.",
    "",
    "Write 1-2 sentences IN CHARACTER explaining why you're passing.",
    "Be specific about what was missing. Be direct and concise.",
    "Return ONLY the dialogue text, no quotes or attribution."
  ].join("\n");
}

function generateHeuristicDialogue(judge, offer) {
  if (offer) {
    return `I see enough here to move forward. I'm offering $${offer.amount.toLocaleString()} for ${offer.equity}% equity. ${judge.focus} — that's what convinced me.`;
  }

  return `I'm going to pass on this one. ${judge.focus} — I didn't see enough evidence to get comfortable.`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { evaluation, offers, judgeResponses, transcript } = body;

    if (!evaluation || !offers) {
      return Response.json({ error: "evaluation and offers are required." }, { status: 400 });
    }

    const offersByJudgeId = Object.fromEntries(
      (offers || []).map((offer) => [offer.judgeId, offer])
    );

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const useAI = Boolean(apiKey);

    const dialogueEntries = [];

    if (useAI) {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey });

      const results = await Promise.allSettled(
        JUDGE_PROFILES.map(async (judge) => {
          const offer = offersByJudgeId[judge.id] || null;
          const prompt = buildOfferDialoguePrompt(judge, offer, evaluation, transcript || []);

          const response = await client.responses.create({
            model,
            instructions: "You are a judge in a pitch game. Respond only with in-character dialogue.",
            input: prompt
          });

          const text = response.output_text?.trim();
          return {
            judgeId: judge.id,
            stageId: JUDGE_TO_STAGE[judge.id],
            text: text || generateHeuristicDialogue(judge, offer)
          };
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          dialogueEntries.push(result.value);
        }
      }
    }

    // Fill in any missing judges with heuristic dialogue
    for (const judge of JUDGE_PROFILES) {
      if (!dialogueEntries.find((entry) => entry.judgeId === judge.id)) {
        const offer = offersByJudgeId[judge.id] || null;
        dialogueEntries.push({
          judgeId: judge.id,
          stageId: JUDGE_TO_STAGE[judge.id],
          text: generateHeuristicDialogue(judge, offer)
        });
      }
    }

    return Response.json({ dialogue: dialogueEntries });
  } catch (error) {
    // Return heuristic fallback on any error
    const body = await request.clone().json().catch(() => ({}));
    const offersByJudgeId = Object.fromEntries(
      (body.offers || []).map((offer) => [offer.judgeId, offer])
    );

    const fallback = JUDGE_PROFILES.map((judge) => ({
      judgeId: judge.id,
      stageId: JUDGE_TO_STAGE[judge.id],
      text: generateHeuristicDialogue(judge, offersByJudgeId[judge.id] || null)
    }));

    return Response.json({ dialogue: fallback });
  }
}
