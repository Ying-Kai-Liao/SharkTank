import { orchestrateJudgePanel, createJudgeOrchestrationService } from "@sharktank/ai-service";
import { JUDGE_PROFILES } from "@sharktank/game-engine";

const JUDGE_TO_STAGE = {
  rhea: "cat",
  marco: "dog",
  tori: "shark"
};

function pickReactionSentiment(playerMessage, judgeIndex) {
  const lower = (playerMessage || "").toLowerCase();
  const positiveSignals = ["growth", "revenue", "profit", "scale", "traction", "customers", "market", "evidence", "data", "proven"];
  const negativeSignals = ["maybe", "hope", "not sure", "don't know", "unsure", "difficult", "struggling"];

  const hasPositive = positiveSignals.some((word) => lower.includes(word));
  const hasNegative = negativeSignals.some((word) => lower.includes(word));

  if (hasPositive && !hasNegative) {
    return "positive";
  }

  if (hasNegative && !hasPositive) {
    return "negative";
  }

  return judgeIndex % 2 === 0 ? "positive" : "negative";
}

let service = null;

function getService() {
  if (!service) {
    service = createJudgeOrchestrationService();
  }

  return service;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const mode = body?.mode || "reaction";

    if (mode === "reaction" && body.playerMessage !== undefined) {
      const reactions = {};

      JUDGE_PROFILES.forEach((judge, index) => {
        const stageId = JUDGE_TO_STAGE[judge.id];

        if (stageId) {
          reactions[stageId] = pickReactionSentiment(body.playerMessage, index);
        }
      });

      return Response.json({ reactions });
    }

    if (mode === "initial") {
      const input = {
        roundId: body.roundId || "local-round",
        sessionId: body.sessionId || "local-session",
        founderId: body.founderId || "local-founder",
        pitch: body.pitch || "",
        evaluation: body.evaluation || null,
        judges: body.judges || JUDGE_PROFILES,
        transcript: body.transcript || []
      };

      const bundle = await orchestrateJudgePanel(input);

      return Response.json({ bundle });
    }

    if (mode === "replan") {
      const input = {
        roundId: body.roundId || "local-round",
        sessionId: body.sessionId || "local-session",
        founderId: body.founderId || "local-founder",
        pitch: body.pitch || "",
        evaluation: body.evaluation || null,
        judges: body.judges || JUDGE_PROFILES,
        transcript: body.transcript || [],
        turnNumber: body.turnNumber || 0,
        founderActions: body.founderActions || []
      };

      const result = await getService().replan(input);

      return Response.json({ turnIntents: result.turnIntents });
    }

    return Response.json({ error: "Invalid mode" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: "judge_reactions_unavailable", message: error?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
