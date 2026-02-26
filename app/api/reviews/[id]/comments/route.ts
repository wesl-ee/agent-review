import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { reviewIdSchema, submitCommentsRequestSchema } from '@/lib/review-schema';
import { readCommentsFile, submitComments } from '@/lib/review-store';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const validId = reviewIdSchema.parse(id);
    const payload = await readCommentsFile(validId);
    return NextResponse.json(payload);
  } catch (err) {
    const status = (err as NodeJS.ErrnoException)?.code === 'ENOENT' ? 404 : err instanceof ZodError ? 400 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed to read comments' }, { status });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const validId = reviewIdSchema.parse(id);
    const body = submitCommentsRequestSchema.parse(await req.json());
    const result = await submitComments(validId, body.comments, body.viewedFiles);
    return NextResponse.json({ ok: true, closedAt: result.closedAt });
  } catch (err) {
    const code = (err as Error & { code?: string }).code;
    const status =
      code === 'BAD_ANCHOR' || code === 'REVIEW_CLOSED' || code === 'NO_COMMENTS' ? 400 :
      (err as NodeJS.ErrnoException)?.code === 'ENOENT' ? 404 :
      err instanceof ZodError ? 400 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed to submit comments' }, { status });
  }
}
