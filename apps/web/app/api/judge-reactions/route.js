import { orchestrateJudgePanel, createJudgeOrchestrationService } from "../../../../ai-service/src/service.js";
import { JUDGE_PROFILES } from "../../../../../packages/game-engine/src/judges.js";

const service = createJudgeOrchestrationService();

export async function POST(request) {
  try {
    const body = await request.json();
    const mode = body?.mode || "initial";

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
