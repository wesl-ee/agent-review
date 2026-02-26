'use client';

import { useEffect, useState } from 'react';
import CommentThread from '@/components/comment-thread';
import type { DraftComment, ReviewComment } from '@/lib/types';

type Props = {
  storageKey: string;
  comments: ReviewComment[];
  closed: boolean;
  onAddDraft: (comment: DraftComment) => void;
};

export default function OverallReviewPanel({ storageKey, comments, closed, onAddDraft }: Props) {
  const [body, setBody] = useState('');

  useEffect(() => {
    try {
      setBody(localStorage.getItem(storageKey) ?? '');
    } catch {
      setBody('');
    }
  }, [storageKey]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        if (body.trim()) localStorage.setItem(storageKey, body);
        else localStorage.removeItem(storageKey);
      } catch {
        // ignore local storage failures
      }
    }, 150);
    return () => window.clearTimeout(handle);
  }, [body, storageKey]);

  return (
    <section className="panel-block">
      <div className="panel-block-header">overall review comment</div>
      <div className="panel-block-body">
        <textarea
          className="top-comment-box"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={closed}
          placeholder="comment on the whole diff"
        />
        <div className="top-comment-actions">
          <button
            type="button"
            className="btn"
            disabled={closed || !body.trim()}
            onClick={() => {
              const next = body.trim();
              if (!next) return;
              onAddDraft({
                kind: 'review',
                file: null,
                hunkHeader: null,
                side: null,
                line: null,
                body: next,
              });
              setBody('');
            }}
          >
            Add comment
          </button>
        </div>
        <CommentThread comments={comments} emptyLabel="no comments" />
      </div>
    </section>
  );
}
