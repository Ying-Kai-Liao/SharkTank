export const JUDGE_PROFILES = Object.freeze([
  {
    id: "rhea",
    name: "Rhea Stone",
    title: "Numbers Shark",
    focus: "Rhea wants margin clarity, customer retention, and a believable revenue engine.",
    weights: Object.freeze({
      clarity: 0.25,
      confidence: 0.2,
      originality: 0.15,
      business_viability: 0.4
    })
  },
  {
    id: "marco",
    name: "Marco Vale",
    title: "Moat Shark",
    focus: "Marco hunts for differentiation and whether the idea survives competition.",
    weights: Object.freeze({
      clarity: 0.15,
      confidence: 0.15,
      originality: 0.45,
      business_viability: 0.25
    })
  },
  {
    id: "tori",
    name: "Tori Quinn",
    title: "Founder Shark",
    focus: "Tori listens for conviction, urgency, and whether the founder can execute under pressure.",
    weights: Object.freeze({
      clarity: 0.25,
      confidence: 0.45,
      originality: 0.15,
      business_viability: 0.15
    })
  }
]);
