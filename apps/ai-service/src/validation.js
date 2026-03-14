import { z } from "zod";

export const judgeDraftSchema = z.object({
  judgeId: z.string().min(1),
  judgeName: z.string().min(1),
  sentiment: z.enum(["skeptical", "interested", "impressed"]),
  shortReaction: z.string().min(1),
  question: z.string().min(1),
  rationaleTags: z.array(z.string().min(1)).min(1),
  score: z.number().int().min(0).max(100),
  confidence: z.number().int().min(0).max(100),
  concerns: z.array(z.string().min(1)).default([])
});

export const discussionDecisionSchema = z.object({
  shouldDiscuss: z.boolean(),
  reason: z.string().min(1),
  disagreementScore: z.number().int().min(0)
});

export const discussionEntrySchema = z.object({
  turn: z.number().int().min(1),
  speaker: z.string().min(1),
  summary: z.string().min(1)
});

export const memoryObservationSchema = z.object({
  judgeId: z.string().min(1),
  sentiment: z.enum(["skeptical", "interested", "impressed"]),
  concern: z.string().min(1),
  question: z.string().min(1),
  rationaleTags: z.array(z.string().min(1)).min(1)
});
