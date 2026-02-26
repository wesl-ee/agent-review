import { z } from 'zod';

export const reviewIdSchema = z.string().min(1).max(200).regex(/^[A-Za-z0-9._-]+$/, 'invalid review id');

export const lineRefSchema = z.object({
  old: z.number().int().positive().nullable(),
  new: z.number().int().positive().nullable(),
});

const baseCommentSchema = z.object({
  id: z.string().min(1),
  body: z.string().trim().min(1),
  createdAt: z.string().datetime(),
  status: z.enum(['open', 'resolved']),
  resolvedAt: z.string().datetime().optional(),
  resolutionNote: z.string().optional(),
});

const lineCommentSchema = baseCommentSchema.extend({
  kind: z.literal('line'),
  file: z.string().min(1),
  hunkHeader: z.string().min(1),
  side: z.literal('new'),
  line: lineRefSchema,
});

const fileCommentSchema = baseCommentSchema.extend({
  kind: z.literal('file'),
  file: z.string().min(1),
  hunkHeader: z.null(),
  side: z.null(),
  line: z.null(),
});

const reviewLevelCommentSchema = baseCommentSchema.extend({
  kind: z.literal('review'),
  file: z.null(),
  hunkHeader: z.null(),
  side: z.null(),
  line: z.null(),
});

export const reviewCommentSchema = z.discriminatedUnion('kind', [
  lineCommentSchema,
  fileCommentSchema,
  reviewLevelCommentSchema,
]);

export const draftCommentSchema = z.discriminatedUnion('kind', [
  lineCommentSchema.omit({ id: true, createdAt: true, status: true, resolvedAt: true, resolutionNote: true }),
  fileCommentSchema.omit({ id: true, createdAt: true, status: true, resolvedAt: true, resolutionNote: true }),
  reviewLevelCommentSchema.omit({ id: true, createdAt: true, status: true, resolvedAt: true, resolutionNote: true }),
]);

export const commentsFileSchema = z.object({
  reviewId: z.string().min(1),
  viewedFiles: z.array(z.string()).default([]),
  comments: z.array(reviewCommentSchema),
});

export const reviewMetaSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
  cwd: z.string().min(1),
  diffCommand: z.string().min(1),
  state: z.enum(['open', 'closed']),
  closedAt: z.string().datetime().nullable(),
});

export const statusPatchEntrySchema = z.object({
  status: z.enum(['open', 'resolved']),
  resolvedAt: z.string().datetime().optional(),
  note: z.string().optional(),
});

export const statusFileSchema = z.object({
  reviewId: z.string().min(1),
  updatedAt: z.string().datetime(),
  statuses: z.record(z.string(), statusPatchEntrySchema),
});

export const submitCommentsRequestSchema = z.object({
  comments: z.array(draftCommentSchema).min(1),
  viewedFiles: z.array(z.string()).optional(),
});

export const createReviewRequestSchema = z.object({
  id: reviewIdSchema,
  cwd: z.string().min(1),
  diffCommand: z.string().min(1),
  diffPatch: z.string().min(1),
});

export const statusUpdateRequestSchema = z.object({
  updates: z.record(z.string(), statusPatchEntrySchema),
});
