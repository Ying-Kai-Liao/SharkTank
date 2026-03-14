import matrix from "../../data/mock-round-results.json";

function pickRandom(items) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index];
}

function resolveTier(decisionType) {
  if (decisionType === "accept") {
    return Math.random() < 0.6 ? "good" : "medium";
  }

  const roll = Math.random();
  if (roll < 0.25) {
    return "good";
  }

  if (roll < 0.7) {
    return "medium";
  }

  return "bad";
}

export async function POST(request) {
  try {
    const body = await request.json();
    const decisionType = body?.decisionType === "accept" ? "accept" : "disaccept";

    const tier = resolveTier(decisionType);
    const scorePool = matrix?.scorePools?.[decisionType]?.[tier] || [0];
    const score = Number(pickRandom(scorePool) ?? 0);

    const catchphrasePool = matrix?.catchphrases?.[decisionType]?.[tier] || [
      "Result generated."
    ];
    const catchphrase = pickRandom(catchphrasePool) || "Result generated.";

    return Response.json({
      score,
      scoreTier: tier,
      decisionType,
      catchphrase
    });
  } catch {
    return Response.json(
      {
        score: 0,
        scoreTier: "bad",
        decisionType: "disaccept",
        catchphrase: "Bad score. No judge accepted the offer path this round."
      },
      { status: 200 }
    );
  }
}
