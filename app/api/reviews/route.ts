import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createReviewSnapshot } from '@/lib/review-store';
import { createReviewRequestSchema } from '@/lib/review-schema';
import type { ReviewMeta } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const body = createReviewRequestSchema.parse(await req.json());
    const now = new Date().toISOString();
    const meta: ReviewMeta = {
      id: body.id,
      createdAt: now,
      cwd: body.cwd,
      diffCommand: body.diffCommand,
      state: 'open',
      closedAt: null,
    };
    await createReviewSnapshot({ id: body.id, diffPatch: body.diffPatch, meta });
    return NextResponse.json({ id: body.id, created: true });
  } catch (err) {
    const status =
      (err as NodeJS.ErrnoException)?.code === 'EEXIST' ? 409 :
      err instanceof ZodError ? 400 : 500;
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'failed to create review' },
      { status },
    );
  }
}
