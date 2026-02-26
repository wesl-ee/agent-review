import os from 'node:os';
import path from 'node:path';
import { reviewIdSchema } from './review-schema';

export function reviewsRoot() {
  return process.env.AGENT_REVIEW_ROOT || path.join(os.homedir(), '.agent-reviews');
}

export function reviewDir(id: string) {
  const valid = reviewIdSchema.parse(id);
  return path.join(reviewsRoot(), valid);
}

export function reviewFile(id: string, file: 'meta.json' | 'diff.patch' | 'comments.json' | 'status.json') {
  return path.join(reviewDir(id), file);
}
