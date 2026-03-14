import reactionMatrix from "../../data/mock-judge-reactions.json";

const FALLBACK_REACTIONS = {
  cat: "neutral",
  dog: "neutral",
  shark: "neutral"
};

function sanitizeReaction(value) {
  if (value === "positive" || value === "negative" || value === "neutral") {
    return value;
  }

  return "neutral";
}

function normalizeReactions(reactions = {}) {
  return {
    cat: sanitizeReaction(reactions.cat),
    dog: sanitizeReaction(reactions.dog),
    shark: sanitizeReaction(reactions.shark)
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const index = Number.isInteger(body?.groupIndex) ? body.groupIndex : 0;
    const groups = reactionMatrix?.groups || [];

    if (!groups.length) {
      return Response.json({
        sourceGroupId: "fallback",
        reactions: FALLBACK_REACTIONS
      });
    }

    const safeIndex = ((index % groups.length) + groups.length) % groups.length;
    const selected = groups[safeIndex];

    return Response.json({
      sourceGroupId: selected.id,
      reactions: {
        ...FALLBACK_REACTIONS,
        ...normalizeReactions(selected.reactions || {})
      }
    });
  } catch {
    return Response.json(
      {
        sourceGroupId: "fallback",
        reactions: FALLBACK_REACTIONS
      },
      { status: 200 }
    );
  }
}
