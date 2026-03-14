import { tool } from "@langchain/core/tools";
import { z } from "zod";

function getPrimaryDimension(judge) {
  return Object.entries(judge.weights).sort((left, right) => right[1] - left[1])[0][0];
}

function getTranscriptQuote(transcript) {
  const founderEntry = [...transcript].reverse().find((entry) => entry.speaker === "Founder");
  return founderEntry?.text ?? transcript.at(-1)?.text ?? "";
}

function createBaseTools({ context, memoryView }) {
  return {
    read_round_snapshot: tool(
      async () => ({
        evaluation: context.evaluation,
        transcriptCount: context.transcript.length,
        quote: getTranscriptQuote(context.transcript)
      }),
      {
        name: "read_round_snapshot",
        description: "Read the current deterministic round snapshot without mutating it.",
        schema: z.object({})
      }
    ),
    recall_judge_memory: tool(
      async () => ({
        lastConcern: memoryView.episodic.at(-1)?.concern ?? "",
        lastQuestion: memoryView.episodic.at(-1)?.question ?? ""
      }),
      {
        name: "recall_judge_memory",
        description: "Read judge-local episodic memory for flavor continuity.",
        schema: z.object({})
      }
    )
  };
}

function createJudgeSpecificTool(judge, context) {
  const primaryDimension = getPrimaryDimension(judge);

  if (judge.id === "rhea") {
    return tool(
      async () => ({
        emphasis: "unit economics",
        note:
          context.evaluation.business_viability >= 70
            ? "Margins and monetization look believable enough to press for scale details."
            : "The business model still needs sharper proof before this sounds investable.",
        dimension: primaryDimension
      }),
      {
        name: "rhea_margin_probe",
        description: "Surface the margin and revenue angle Rhea cares about.",
        schema: z.object({})
      }
    );
  }

  if (judge.id === "marco") {
    return tool(
      async () => ({
        emphasis: "defensibility",
        note:
          context.evaluation.originality >= 70
            ? "There is enough novelty to ask how it stays protected."
            : "The concept needs a clearer moat before it sounds durable.",
        dimension: primaryDimension
      }),
      {
        name: "marco_moat_probe",
        description: "Surface the competitive moat angle Marco cares about.",
        schema: z.object({})
      }
    );
  }

  return tool(
    async () => ({
      emphasis: "execution credibility",
      note:
        context.evaluation.confidence >= 70
          ? "The founder sounds decisive enough to test execution claims."
          : "The delivery still needs proof that the team can execute under pressure.",
      dimension: primaryDimension
    }),
    {
      name: "tori_execution_probe",
      description: "Surface the execution and founder-read angle Tori cares about.",
      schema: z.object({})
    }
  );
}

export function createJudgePersona(judge) {
  const dominantDimension = getPrimaryDimension(judge).replaceAll("_", " ");

  return {
    judgeId: judge.id,
    instruction: `${judge.name} is ${judge.title}. Focus on ${judge.focus} and anchor every reaction in ${dominantDimension}.`,
    stablePreferences: Object.freeze({
      focus: judge.focus,
      dominantDimension
    })
  };
}

export function createJudgeToolRegistry({ judge, context, memoryView }) {
  const baseTools = createBaseTools({ context, memoryView });

  return Object.freeze({
    ...baseTools,
    judge_probe: createJudgeSpecificTool(judge, context)
  });
}
