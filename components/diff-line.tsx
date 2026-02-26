'use client';

import CommentThread from '@/components/comment-thread';
import InlineCommentForm from '@/components/inline-comment-form';
import type { DiffLine as DiffLineType, DraftComment, ReviewComment } from '@/lib/types';

type Anchor = {
  file: string;
  hunkHeader: string;
  line: number | null;
};

type Props = {
  line: DiffLineType;
  file: string;
  hunkHeader: string;
  submitted: boolean;
  isEditorOpen: boolean;
  comments: ReviewComment[];
  onOpenEditor: () => void;
  onCloseEditor: () => void;
  onAddDraft: (comment: DraftComment) => void;
};

function fmtLine(n: number | null) {
  return n == null ? '' : String(n);
}

function commentAnchorKey({ file, hunkHeader, line }: Anchor) {
  return `${file}|${hunkHeader}|${line ?? ''}`;
}

export function makeAnchorKeyForLine(file: string, hunkHeader: string, line: DiffLineType) {
  return commentAnchorKey({ file, hunkHeader, line: line.newLine });
}

export default function DiffLine({
  line,
  file,
  hunkHeader,
  submitted,
  isEditorOpen,
  comments,
  onOpenEditor,
  onCloseEditor,
  onAddDraft,
}: Props) {
  const canCommentNow = !submitted && line.newLine != null;

  return (
    <>
      <div className={`diff-row ${line.kind}`}>
        <div className="diff-cell diff-num">{fmtLine(line.oldLine)}</div>
        <div className="diff-cell diff-num">{fmtLine(line.newLine)}</div>
        <div className="diff-cell">
          <button
            type="button"
            className="gutter-plus"
            disabled={!canCommentNow}
            aria-label="add comment"
            onClick={onOpenEditor}
          >
            +
          </button>
        </div>
        <div className="diff-cell">{line.prefix}{line.content}</div>
      </div>

      {isEditorOpen ? (
        <InlineCommentForm
          onCancel={onCloseEditor}
          onSave={(body) => {
            if (line.newLine == null) return;
            onAddDraft({
              kind: 'line',
              file,
              hunkHeader,
              side: 'new',
              line: { old: line.oldLine, new: line.newLine },
              body,
            });
            onCloseEditor();
          }}
        />
      ) : null}

      {comments.length ? (
        <CommentThread comments={comments} />
      ) : null}
    </>
  );
}
