'use client';

import DiffLine, { makeAnchorKeyForLine } from '@/components/diff-line';
import type { DiffHunk as DiffHunkType, DraftComment, ReviewComment } from '@/lib/types';

type Props = {
  file: string;
  hunk: DiffHunkType;
  submitted: boolean;
  openEditorKey: string | null;
  commentsByAnchor: Map<string, ReviewComment[]>;
  onOpenEditor: (key: string) => void;
  onCloseEditor: () => void;
  onAddDraft: (comment: DraftComment) => void;
};

export default function DiffHunk({
  file,
  hunk,
  submitted,
  openEditorKey,
  commentsByAnchor,
  onOpenEditor,
  onCloseEditor,
  onAddDraft,
}: Props) {
  return (
    <div className="hunk">
      <div className="hunk-header">{hunk.header}</div>
      <div className="hunk-scroll">
        {hunk.lines.map((line, idx) => {
          const key = makeAnchorKeyForLine(file, hunk.header, line);
          const comments = (commentsByAnchor.get(key) ?? []).filter((c) => c.kind === 'line');
          return (
            <DiffLine
              key={`${hunk.header}:${idx}:${line.oldLine ?? 'x'}:${line.newLine ?? 'x'}`}
              line={line}
              file={file}
              hunkHeader={hunk.header}
              submitted={submitted}
              isEditorOpen={openEditorKey === key}
              comments={comments}
              onOpenEditor={() => onOpenEditor(key)}
              onCloseEditor={onCloseEditor}
              onAddDraft={onAddDraft}
            />
          );
        })}
      </div>
    </div>
  );
}
