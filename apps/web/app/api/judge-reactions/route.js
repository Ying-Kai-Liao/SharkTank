import { orchestrateJudgePanel, createJudgeOrchestrationService } from "../../../../ai-service/src/service.js";
import { JUDGE_PROFILES } from "../../../../../packages/game-engine/src/judges.js";

const service = createJudgeOrchestrationService();

function pickReactionFromMessage(message) {
  const lower = (message || "").toLowerCase();
  if (/customer|traction|revenue|growth|retention|market|paid|signed/.test(lower)) return "positive";
  if (/problem|hard|struggle|fail|can't|cannot|unsure|don't know/.test(lower)) return "negative";
  return "neutral";
}

export async function POST(request) {
  try {
    const body = await request.json();
    const mode = body?.mode || "initial";

    if (body?.groupIndex !== undefined || mode === "reactions") {
      const reaction = pickReactionFromMessage(body?.playerMessage);
      return Response.json({
        reactions: {
          cat: reaction,
          dog: reaction === "positive" ? "neutral" : reaction,
          shark: reaction
        }
      });
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

      const result = await service.replan(input);

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
