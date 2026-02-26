import type { ReviewMeta } from '@/lib/types';

type Props = {
  meta: ReviewMeta;
  submitting: boolean;
  draftCount: number;
  canSubmit: boolean;
  onSubmit: () => void;
};

export default function ReviewHeader({
  meta,
  submitting,
  draftCount,
  canSubmit,
  onSubmit,
}: Props) {
  const closed = meta.state === 'closed';
  const statusLabel = closed
    ? `closed${meta.closedAt ? ` • ${new Date(meta.closedAt).toLocaleString()}` : ''}`
    : `draft${draftCount ? ` • ${draftCount} comment${draftCount === 1 ? '' : 's'}` : ''}`;

  const buttonLabel = submitting
    ? 'Submitting...'
    : closed
      ? 'Review Closed'
      : 'Submit review';

  return (
    <header className="review-header">
      <div>
        <div className="review-title">{meta.id}</div>
        <div className="review-subtle">{meta.cwd}</div>
      </div>
      <div className="header-actions">
        <div className="review-status">
          {statusLabel}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={submitting || !canSubmit || closed}
          onClick={onSubmit}
        >
          {buttonLabel}
        </button>
      </div>
    </header>
  );
}
