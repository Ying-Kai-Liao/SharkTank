import { createLiveJudgeReactionService } from "@sharktank/ai-service/live-reactions";

const liveReactionService = createLiveJudgeReactionService();

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await liveReactionService.run(body);

    return Response.json(result);
  } catch {
    return Response.json({
      emitted: false,
      reason: "reaction_service_unavailable"
    });
  }
}
