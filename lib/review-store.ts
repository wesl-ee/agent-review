import fs from 'node:fs/promises';
import path from 'node:path';
import { parseUnifiedDiff } from './diff-parser';
import { makeCommentId } from './ids';
import { reviewDir, reviewFile, reviewsRoot } from './paths';
import { commentsFileSchema, reviewMetaSchema, statusFileSchema } from './review-schema';
import type { CommentsFile, DraftComment, ReviewMeta, ReviewPayload, StatusFile, StatusPatchEntry } from './types';

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function writeJsonAtomic(filePath: string, value: unknown) {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  await fs.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, filePath);
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function maybeReadJson<T>(filePath: string): Promise<T | null> {
  try {
    return await readJson<T>(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function createReviewSnapshot(input: { id: string; diffPatch: string; meta: ReviewMeta }) {
  const root = reviewsRoot();
  const dir = reviewDir(input.id);
  const tmpDir = path.join(root, `.${input.id}.${process.pid}.${Date.now()}.tmp`);
  await ensureDir(root);
  await fs.mkdir(tmpDir, { recursive: false });
  const emptyComments: CommentsFile = {
    reviewId: input.id,
    viewedFiles: [],
    comments: [],
  };
  try {
    await fs.writeFile(path.join(tmpDir, 'diff.patch'), input.diffPatch, 'utf8');
    await writeJsonAtomic(path.join(tmpDir, 'meta.json'), input.meta);
    await writeJsonAtomic(path.join(tmpDir, 'comments.json'), emptyComments);
    await fs.rename(tmpDir, dir);
  } catch (err) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    throw err;
  }
  return { dir };
}

function mergeStatuses(comments: CommentsFile['comments'], statusFile: StatusFile | null) {
  if (!statusFile) return comments;
  return comments.map((comment) => {
    const patch = statusFile.statuses[comment.id];
    if (!patch) return comment;
    return { ...comment, status: patch.status, resolvedAt: patch.resolvedAt, resolutionNote: patch.note };
  });
}

export async function loadReview(id: string): Promise<ReviewPayload> {
  const [metaRaw, commentsRaw, statusRaw, diffPatch] = await Promise.all([
    readJson<unknown>(reviewFile(id, 'meta.json')),
    readJson<unknown>(reviewFile(id, 'comments.json')),
    maybeReadJson<unknown>(reviewFile(id, 'status.json')),
    fs.readFile(reviewFile(id, 'diff.patch'), 'utf8'),
  ]);

  const meta = reviewMetaSchema.parse(metaRaw);
  const commentsFile = commentsFileSchema.parse(commentsRaw);
  const statusFile = statusRaw ? statusFileSchema.parse(statusRaw) : null;

  return {
    meta,
    diff: parseUnifiedDiff(diffPatch),
    comments: mergeStatuses(commentsFile.comments, statusFile),
    viewedFiles: commentsFile.viewedFiles,
  };
}

export async function readCommentsFile(id: string) {
  const raw = await readJson<unknown>(reviewFile(id, 'comments.json'));
  return commentsFileSchema.parse(raw);
}

export async function readStatusFile(id: string) {
  const raw = await readJson<unknown>(reviewFile(id, 'status.json'));
  return statusFileSchema.parse(raw);
}

export async function submitComments(id: string, draftComments: DraftComment[], viewedFiles?: string[]) {
  const payload = await loadReview(id);
  if (payload.meta.state === 'closed') {
    const err = new Error('review is closed');
    (err as Error & { code?: string }).code = 'REVIEW_CLOSED';
    throw err;
  }
  if (!draftComments.length) {
    const err = new Error('at least one comment is required');
    (err as Error & { code?: string }).code = 'NO_COMMENTS';
    throw err;
  }

  const commentsPath = reviewFile(id, 'comments.json');
  const metaPath = reviewFile(id, 'meta.json');
  const currentComments = await readCommentsFile(id);

  const lineAnchors = new Set<string>();
  for (const file of payload.diff) {
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.newLine != null) lineAnchors.add(`${file.displayPath}|${hunk.header}|${line.newLine}`);
      }
    }
  }

  for (const c of draftComments) {
    if (c.kind !== 'line') continue;
    const key = `${c.file}|${c.hunkHeader}|${c.line?.new ?? ''}`;
    if (!lineAnchors.has(key)) {
      const err = new Error(`invalid comment anchor: ${key}`);
      (err as Error & { code?: string }).code = 'BAD_ANCHOR';
      throw err;
    }
  }

  const now = new Date().toISOString();
  const normalizedViewed = Array.from(new Set((viewedFiles ?? currentComments.viewedFiles).filter(Boolean))).sort();
  const next: CommentsFile = {
    reviewId: id,
    viewedFiles: normalizedViewed,
    comments: [
      ...currentComments.comments,
      ...draftComments.map((c) => ({
        ...c,
        id: makeCommentId(),
        createdAt: now,
        status: 'open' as const,
      })),
    ],
  };

  const currentMeta = reviewMetaSchema.parse(await readJson<unknown>(metaPath));
  await writeJsonAtomic(commentsPath, next);
  await writeJsonAtomic(metaPath, { ...currentMeta, state: 'closed', closedAt: now });
  return { closedAt: now };
}

export async function patchStatuses(id: string, updates: Record<string, StatusPatchEntry>) {
  const comments = await readCommentsFile(id);
  const known = new Set(comments.comments.map((c) => c.id));
  const invalid = Object.keys(updates).filter((k) => !known.has(k));
  if (invalid.length) {
    const err = new Error(`unknown comment ids: ${invalid.join(', ')}`);
    (err as Error & { code?: string; invalidIds?: string[] }).code = 'UNKNOWN_COMMENT_IDS';
    (err as Error & { invalidIds?: string[] }).invalidIds = invalid;
    throw err;
  }

  const statusPath = reviewFile(id, 'status.json');
  const existingRaw = await maybeReadJson<unknown>(statusPath);
  const existing = existingRaw
    ? statusFileSchema.parse(existingRaw)
    : { reviewId: id, updatedAt: new Date().toISOString(), statuses: {} };

  const merged: StatusFile = {
    reviewId: id,
    updatedAt: new Date().toISOString(),
    statuses: { ...existing.statuses },
  };

  for (const [commentId, patch] of Object.entries(updates)) {
    merged.statuses[commentId] = {
      ...existing.statuses[commentId],
      ...patch,
      ...(patch.status === 'resolved' && !patch.resolvedAt ? { resolvedAt: new Date().toISOString() } : {}),
    };
  }

  await writeJsonAtomic(statusPath, merged);
  return { ok: true };
}
