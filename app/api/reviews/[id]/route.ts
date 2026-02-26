import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { loadReview } from '@/lib/review-store';
import { reviewIdSchema } from '@/lib/review-schema';

function statusFor(err: unknown) {
  if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return 404;
  if (err instanceof ZodError) return 400;
  return 500;
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const validId = reviewIdSchema.parse(id);
    const payload = await loadReview(validId);
    return NextResponse.json(payload);
  } catch (err) {
    const status = statusFor(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'failed to load review' },
      { status },
    );
  }
}
