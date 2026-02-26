import crypto from 'node:crypto';

export function makeReviewId(now = new Date()) {
  const iso = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${iso}-${crypto.randomBytes(4).toString('hex')}`;
}

export function makeCommentId() {
  return `cmt_${crypto.randomBytes(8).toString('hex')}`;
}
