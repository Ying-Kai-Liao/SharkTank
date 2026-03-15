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

export const peerConsultationResponseSchema = z.object({
  judgeId: z.string().min(1),
  judgeName: z.string().min(1),
  sentiment: z.enum(["skeptical", "interested", "impressed"]),
  question: z.string().min(1),
  concerns: z.array(z.string().min(1)).default([]),
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1)
});

export const peerConsultationSchema = z.object({
  judgeId: z.string().min(1),
  judgeName: z.string().min(1),
  turn: z.number().int().min(1),
  queryUsed: z.boolean(),
  question: z.string(),
  targetJudgeIds: z.array(z.string().min(1)).default([]),
  requestedFields: z.array(z.string().min(1)).default([]),
  responses: z.array(peerConsultationResponseSchema).default([]),
  denied: z.boolean().default(false),
  truncated: z.boolean().default(false),
  reason: z.string().min(1)
});

export const peerQueryLogEntrySchema = z.object({
  turn: z.number().int().min(1),
  judgeId: z.string().min(1),
  judgeName: z.string().min(1),
  queryUsed: z.boolean(),
  question: z.string(),
  targetJudgeIds: z.array(z.string().min(1)).default([]),
  responseCount: z.number().int().min(0),
  reason: z.string().min(1)
});

export const judgeTurnIntentSchema = z.object({
  judgeId: z.string().min(1),
  judgeName: z.string().min(1),
  intent: z.enum(["ask", "wait", "offer", "revise", "support", "drop_out"]),
  status: z.enum(["evaluating", "waiting", "active", "offering", "supportive", "out"]),
  dialogue: z.string().optional(),
  question: z.string().optional(),
  rationaleTags: z.array(z.string().min(1)).default([]),
  score: z.number().int().min(0).max(100),
  confidence: z.number().int().min(0).max(100),
  concerns: z.array(z.string().min(1)).default([])
});

export const memoryObservationSchema = z.object({
  judgeId: z.string().min(1),
  sentiment: z.enum(["skeptical", "interested", "impressed"]),
  concern: z.string().min(1),
  question: z.string().min(1),
  rationaleTags: z.array(z.string().min(1)).min(1)
});
