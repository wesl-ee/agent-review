import CommentBadge from '@/components/comment-badge';
import type { ReviewComment } from '@/lib/types';

type Props = {
  comments: ReviewComment[];
  emptyLabel?: string;
};

export default function CommentThread({ comments, emptyLabel }: Props) {
  if (!comments.length) {
    return emptyLabel ? <div className="comment-thread-empty">{emptyLabel}</div> : null;
  }

  const openComments = comments.filter((c) => c.status !== 'resolved');
  const resolvedComments = comments.filter((c) => c.status === 'resolved');
  const visibleComments = openComments;

  return (
    <div className="comment-thread">
      {visibleComments.map((comment) => (
        <div className="comment-item" key={comment.id}>
          <div className="comment-meta">
            <span>{new Date(comment.createdAt).toLocaleString()}</span>
            <CommentBadge status={comment.status} />
          </div>
          <div className="comment-body">
            {comment.body}
            {comment.resolutionNote ? <div className="comment-note">{comment.resolutionNote}</div> : null}
          </div>
        </div>
      ))}
      {!openComments.length && resolvedComments.length ? (
        <details className="resolved-comments">
          <summary>resolved comments ({resolvedComments.length})</summary>
          <div className="resolved-comments-list">
            {resolvedComments.map((comment) => (
              <div className="comment-item" key={comment.id}>
                <div className="comment-meta">
                  <span>{new Date(comment.createdAt).toLocaleString()}</span>
                  <CommentBadge status={comment.status} />
                </div>
                <div className="comment-body">
                  {comment.body}
                  {comment.resolutionNote ? <div className="comment-note">{comment.resolutionNote}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {resolvedComments.length && openComments.length ? (
        <details className="resolved-comments">
          <summary>resolved comments ({resolvedComments.length})</summary>
          <div className="resolved-comments-list">
            {resolvedComments.map((comment) => (
              <div className="comment-item" key={comment.id}>
                <div className="comment-meta">
                  <span>{new Date(comment.createdAt).toLocaleString()}</span>
                  <CommentBadge status={comment.status} />
                </div>
                <div className="comment-body">
                  {comment.body}
                  {comment.resolutionNote ? <div className="comment-note">{comment.resolutionNote}</div> : null}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}
