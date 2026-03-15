import { createJudgeOrchestrationService } from "@sharktank/ai-service";
import { buildDebriefData, JUDGE_PROFILES } from "@sharktank/game-engine";

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
    const { evaluation, judgeResponses, transcript, offers, roundId, sessionId, founderId } = body;

    if (!evaluation || !judgeResponses) {
      return Response.json({ error: "evaluation and judgeResponses are required." }, { status: 400 });
    }

    const debrief = buildDebriefData(evaluation, JUDGE_PROFILES, { offers: offers || [] });

    let narratives = {};

    try {
      narratives = await getService().generateDebrief({
        judges: JUDGE_PROFILES,
        judgeResponses,
        evaluation,
        offers: offers || [],
        transcript: transcript || [],
        episodicMemory: body.episodicMemory || {},
        peerOpinions: body.peerOpinions || {},
        roundId,
        sessionId,
        founderId
      });
    } catch {
      // AI narrative generation failed — deterministic layer still works
    }

    for (const entry of debrief.judges) {
      const narrative = narratives[entry.judgeId] || null;
      entry.narrative = narrative;
    }

    return Response.json({ debrief });
  } catch (error) {
    return Response.json({ error: error.message || "Failed to generate debrief." }, { status: 500 });
  }
}
