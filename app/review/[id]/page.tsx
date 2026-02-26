import ReviewPageClient from '@/components/review-page-client';

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewPageClient reviewId={id} />;
}

