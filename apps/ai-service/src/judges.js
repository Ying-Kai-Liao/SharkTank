import { tool } from "@langchain/core/tools";
import { z } from "zod";

function getPrimaryDimension(judge) {
  return Object.entries(judge.weights).sort((left, right) => right[1] - left[1])[0][0];
}

function getTranscriptQuote(transcript) {
  const founderEntry = [...transcript].reverse().find((entry) => entry.speaker === "Founder");
  return founderEntry?.text ?? transcript.at(-1)?.text ?? "";
}

function formatPeerSummary(draft) {
  const concern = draft.concerns[0] ?? "risk";
  return `${draft.judgeName} is ${draft.sentiment} and pushes on ${concern}.`;
}

function normalizeRequestedFields(values) {
  const defaults = ["summary", "sentiment", "question", "concerns", "score"];
  const allowed = new Set(defaults);
  const requested = (Array.isArray(values) ? values : defaults)
    .map((value) => String(value ?? "").trim())
    .filter((value) => allowed.has(value));

  return requested.length ? requested : defaults;
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

function createPeerAgentTool({ judge, peerAgentContext }) {
  const querySchema = z.object({
    question: z.string().min(1),
    targetJudgeIds: z.array(z.string().min(1)).default([]),
    requestedFields: z.array(z.string().min(1)).default([])
  });
  let queryCount = 0;

  return tool(
    async ({ question, targetJudgeIds = [], requestedFields = [] }) => {
      queryCount += 1;

      if (queryCount > peerAgentContext.maxQueriesPerRound) {
        return {
          queryUsed: false,
          question,
          targetJudgeIds: [],
          requestedFields: normalizeRequestedFields(requestedFields),
          responses: [],
          denied: true,
          truncated: false,
          reason: "Peer query budget exhausted for this deliberation round."
        };
      }

      const requested = normalizeRequestedFields(requestedFields);
      const preferredTargets = targetJudgeIds.length
        ? targetJudgeIds.filter((judgeId) => judgeId !== judge.id)
        : peerAgentContext.peerDrafts.map((draft) => draft.judgeId);
      const selectedPeers = peerAgentContext.peerDrafts
        .filter((draft) => preferredTargets.includes(draft.judgeId))
        .slice(0, peerAgentContext.maxPeerTargets);

      return {
        queryUsed: selectedPeers.length > 0,
        question,
        targetJudgeIds: selectedPeers.map((draft) => draft.judgeId),
        requestedFields: requested,
        responses: selectedPeers.map((draft) => ({
          judgeId: draft.judgeId,
          judgeName: draft.judgeName,
          sentiment: draft.sentiment,
          question: draft.question,
          concerns: draft.concerns,
          score: draft.score,
          summary: formatPeerSummary(draft)
        })),
        denied: false,
        truncated: preferredTargets.length > selectedPeers.length,
        reason:
          selectedPeers.length > 0
            ? "Returned bounded structured peer summaries."
            : "No eligible peer summaries matched the request."
      };
    },
    {
      name: "ask_peer_agents",
      description: "Request bounded structured summaries from selected peer judges during deliberation.",
      schema: querySchema
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

export function createJudgeToolRegistry({ judge, context, memoryView, peerAgentContext = null }) {
  const baseTools = createBaseTools({ context, memoryView });
  const registry = {
    ...baseTools,
    judge_probe: createJudgeSpecificTool(judge, context)
  };

  if (peerAgentContext) {
    registry.ask_peer_agents = createPeerAgentTool({ judge, peerAgentContext });
  }

  return Object.freeze(registry);
}
