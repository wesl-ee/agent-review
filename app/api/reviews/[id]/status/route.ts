import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { patchStatuses, readStatusFile } from '@/lib/review-store';
import { reviewIdSchema, statusUpdateRequestSchema } from '@/lib/review-schema';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const validId = reviewIdSchema.parse(id);
    const payload = await readStatusFile(validId);
    return NextResponse.json(payload);
  } catch (err) {
    const status = (err as NodeJS.ErrnoException)?.code === 'ENOENT' ? 404 : err instanceof ZodError ? 400 : 500;
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed to read status' }, { status });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const validId = reviewIdSchema.parse(id);
    const body = statusUpdateRequestSchema.parse(await req.json());
    await patchStatuses(validId, body.updates);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const code = (err as Error & { code?: string; invalidIds?: string[] }).code;
    const status =
      code === 'UNKNOWN_COMMENT_IDS' ? 400 :
      (err as NodeJS.ErrnoException)?.code === 'ENOENT' ? 404 :
      err instanceof ZodError ? 400 : 500;
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'failed to patch statuses',
        invalidIds: (err as Error & { invalidIds?: string[] }).invalidIds,
      },
      { status },
    );
  }
}
