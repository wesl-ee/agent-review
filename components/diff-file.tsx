'use client';

import { useEffect, useState } from 'react';
import CommentThread from '@/components/comment-thread';
import DiffHunk from '@/components/diff-hunk';
import InlineCommentForm from '@/components/inline-comment-form';
import type { DiffFile as DiffFileType, DraftComment, ReviewComment } from '@/lib/types';

type Props = {
  file: DiffFileType;
  anchorId?: string;
  openEditorKey: string | null;
  commentsByAnchor: Map<string, ReviewComment[]>;
  fileComments: ReviewComment[];
  viewed: boolean;
  collapsed: boolean;
  closed: boolean;
  onToggleViewed: (file: string) => void;
  onToggleCollapsed: (file: string) => void;
  onOpenEditor: (key: string) => void;
  onCloseEditor: () => void;
  onAddDraft: (comment: DraftComment) => void;
};

export default function DiffFile({
  file,
  anchorId,
  openEditorKey,
  commentsByAnchor,
  fileComments,
  viewed,
  collapsed,
  closed,
  onToggleViewed,
  onToggleCollapsed,
  onOpenEditor,
  onCloseEditor,
  onAddDraft,
}: Props) {
  const [showFileCommentEditor, setShowFileCommentEditor] = useState(false);
  useEffect(() => {
    if (closed) setShowFileCommentEditor(false);
  }, [closed]);

  return (
    <section className="file-card" id={anchorId}>
      <div className="file-header">
        <button
          type="button"
          className="file-path-btn"
          onClick={() => {
            if (file.isBinary) return;
            onToggleCollapsed(file.displayPath);
          }}
          disabled={file.isBinary}
        >
          <span className="file-path">{file.displayPath}</span>
          <span className="file-collapse-state">{file.isBinary ? 'binary' : (collapsed ? 'collapsed' : 'expanded')}</span>
        </button>
        <div className="file-header-actions">
          <button type="button" className={`btn btn-quiet ${viewed ? 'is-viewed' : ''}`} onClick={() => onToggleViewed(file.displayPath)}>
            {viewed ? 'Viewed' : 'Mark viewed'}
          </button>
          <button type="button" className="btn btn-quiet" disabled={closed} onClick={() => setShowFileCommentEditor((v) => !v)}>
            {showFileCommentEditor ? 'Cancel file comment' : 'Comment on file'}
          </button>
          <div className="file-status">{file.status}</div>
        </div>
      </div>
      {showFileCommentEditor ? (
        <InlineCommentForm
          placeholder={`comment on ${file.displayPath}`}
          submitLabel="Add file comment"
          onCancel={() => setShowFileCommentEditor(false)}
          onSave={(body) => {
            onAddDraft({
              kind: 'file',
              file: file.displayPath,
              hunkHeader: null,
              side: null,
              line: null,
              body,
            });
            setShowFileCommentEditor(false);
          }}
        />
      ) : null}
      {fileComments.length ? <CommentThread comments={fileComments} /> : null}
      {file.isBinary ? <div className="file-note">This file is binary and cannot be expanded.</div> : null}
      {file.isEmpty ? <div className="file-note">This file is empty</div> : null}
      {collapsed || file.isBinary ? null : (
        <>
          {file.hunks.map((hunk) => (
            <DiffHunk
              key={`${file.displayPath}:${hunk.header}`}
              file={file.displayPath}
              hunk={hunk}
              submitted={closed}
              openEditorKey={openEditorKey}
              commentsByAnchor={commentsByAnchor}
              onOpenEditor={onOpenEditor}
              onCloseEditor={onCloseEditor}
              onAddDraft={onAddDraft}
            />
          ))}
        </>
      )}
    </section>
  );
}
