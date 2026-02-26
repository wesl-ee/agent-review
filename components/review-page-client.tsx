'use client';

import { useEffect, useMemo, useState } from 'react';
import DiffFile from '@/components/diff-file';
import OverallReviewPanel from '@/components/overall-review-panel';
import ReviewHeader from '@/components/review-header';
import type { DraftComment, ReviewComment, ReviewPayload } from '@/lib/types';

type Props = {
  reviewId: string;
};

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; payload: ReviewPayload };

type PersistedDraftState = {
  drafts: DraftComment[];
  viewedFiles: string[];
  collapsedFiles: Record<string, boolean>;
};

function anchorKey(comment: Pick<ReviewComment, 'file' | 'hunkHeader' | 'line'>) {
  return `${comment.file ?? ''}|${comment.hunkHeader ?? ''}|${comment.line?.new ?? ''}`;
}

function setEquals(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  for (const item of b) if (!sa.has(item)) return false;
  return true;
}

function localDraftKey(reviewId: string) {
  return `agent-review:drafts:${reviewId}`;
}

function localOverallCommentKey(reviewId: string) {
  return `agent-review:overall-comment:${reviewId}`;
}

function shouldCollapseByDefault(file: ReviewPayload['diff'][number]) {
  if (file.isBinary) return true;
  const base = file.displayPath.split('/').pop() ?? file.displayPath;
  return (
    base === 'package-lock.json' ||
    base === 'Cargo.lock' ||
    base === 'pnpm-lock.yaml' ||
    base === 'yarn.lock' ||
    base === 'bun.lockb'
  );
}

function fileAnchorId(filePath: string) {
  return `file-${filePath.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;
}

function fileChangeCounts(file: ReviewPayload['diff'][number]) {
  let adds = 0;
  let removes = 0;
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.kind === 'add') adds += 1;
      if (line.kind === 'remove') removes += 1;
    }
  }
  return { adds, removes };
}

export default function ReviewPageClient({ reviewId }: Props) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [drafts, setDrafts] = useState<DraftComment[]>([]);
  const [openEditorKey, setOpenEditorKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewedFiles, setViewedFiles] = useState<string[]>([]);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    setDrafts([]);
    setOpenEditorKey(null);
    setViewedFiles([]);
    setCollapsedFiles({});

    void fetch(`/api/reviews/${encodeURIComponent(reviewId)}`, { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `request failed (${res.status})`);
        return data as ReviewPayload;
      })
      .then((payload) => {
        if (cancelled) return;
        let persisted: PersistedDraftState | null = null;
        try {
          const raw = localStorage.getItem(localDraftKey(reviewId));
          if (raw) persisted = JSON.parse(raw) as PersistedDraftState;
        } catch {
          persisted = null;
        }
        setViewedFiles(persisted?.viewedFiles ?? payload.viewedFiles);
        setCollapsedFiles(
          persisted?.collapsedFiles ??
            Object.fromEntries([
              ...payload.viewedFiles.map((f) => [f, true] as const),
              ...payload.diff.filter((f) => shouldCollapseByDefault(f)).map((f) => [f.displayPath, true] as const),
            ]),
        );
        setDrafts(payload.meta.state === 'open' ? (persisted?.drafts ?? []) : []);
        setState({ kind: 'ready', payload });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ kind: 'error', message: err instanceof Error ? err.message : 'failed to load' });
      });

    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  useEffect(() => {
    if (state.kind !== 'ready') return;
    const data: PersistedDraftState = {
      drafts,
      viewedFiles,
      collapsedFiles,
    };
    try {
      if (!drafts.length && setEquals(viewedFiles, state.payload.viewedFiles)) {
        localStorage.removeItem(localDraftKey(reviewId));
        return;
      }
      localStorage.setItem(localDraftKey(reviewId), JSON.stringify(data));
    } catch {
      // ignore local persistence failures
    }
  }, [reviewId, state, drafts, viewedFiles, collapsedFiles]);

  const commentsByAnchor = useMemo(() => {
    const map = new Map<string, ReviewComment[]>();
    if (state.kind !== 'ready') return map;
    const draftAsComments: ReviewComment[] = drafts.map((d, idx) => ({
      ...d,
      id: `draft-${idx}`,
      createdAt: new Date().toISOString(),
      status: 'open',
    }));
    for (const c of [...state.payload.comments, ...draftAsComments]) {
      if (c.kind !== 'line') continue;
      const k = anchorKey(c);
      const list = map.get(k);
      if (list) list.push(c);
      else map.set(k, [c]);
    }
    return map;
  }, [drafts, state]);

  const allVisibleComments = useMemo(() => {
    if (state.kind !== 'ready') return [] as ReviewComment[];
    const draftAsComments: ReviewComment[] = drafts.map((d, idx) => ({
      ...d,
      id: `draft-${idx}`,
      createdAt: new Date().toISOString(),
      status: 'open',
    }));
    return [...state.payload.comments, ...draftAsComments];
  }, [drafts, state]);

  const reviewComments = useMemo(
    () => allVisibleComments.filter((c) => c.kind === 'review'),
    [allVisibleComments],
  );

  const fileCommentsByFile = useMemo(() => {
    const map = new Map<string, ReviewComment[]>();
    for (const c of allVisibleComments) {
      if (c.kind !== 'file' || !c.file) continue;
      const list = map.get(c.file);
      if (list) list.push(c);
      else map.set(c.file, [c]);
    }
    return map;
  }, [allVisibleComments]);

  const hasChanges = state.kind === 'ready' && drafts.length > 0;

  async function submitReview() {
    if (state.kind !== 'ready' || state.payload.meta.state !== 'open' || submitting || !hasChanges) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ comments: drafts, viewedFiles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `submit failed (${res.status})`);
      const refreshed = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}`, { cache: 'no-store' });
      const payload = (await refreshed.json()) as ReviewPayload & { error?: string };
      if (!refreshed.ok) throw new Error(payload.error || `reload failed (${refreshed.status})`);
      setDrafts([]);
      setOpenEditorKey(null);
      try {
        localStorage.removeItem(localOverallCommentKey(reviewId));
      } catch {
        // ignore local storage failures
      }
      setViewedFiles(payload.viewedFiles);
      setCollapsedFiles((prev) => {
        const next = { ...prev };
        for (const file of payload.viewedFiles) next[file] = true;
        return next;
      });
      setState({ kind: 'ready', payload });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'failed to submit review',
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === 'loading') {
    return (
      <div className="page-wrap">
        <div className="loading">loading review…</div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="page-wrap">
        <div className="error-panel">{state.message}</div>
      </div>
    );
  }

  const { payload } = state;
  const closed = payload.meta.state === 'closed';
  const viewedSet = new Set(viewedFiles);
  const fileOverview = payload.diff.map((file) => ({
    path: file.displayPath,
    anchorId: fileAnchorId(file.displayPath),
    counts: fileChangeCounts(file),
    viewed: viewedSet.has(file.displayPath),
    collapsed:
      file.isBinary ||
      (collapsedFiles[file.displayPath] ??
        (viewedSet.has(file.displayPath) || shouldCollapseByDefault(file))),
    commentCount: (fileCommentsByFile.get(file.displayPath) ?? []).length,
  }));

  return (
    <div className="page-wrap">
      <ReviewHeader
        meta={payload.meta}
        submitting={submitting}
        draftCount={drafts.length}
        canSubmit={hasChanges}
        onSubmit={submitReview}
      />

      <div className="review-main-layout">
        <div className="review-main-primary">
          <OverallReviewPanel
            storageKey={localOverallCommentKey(reviewId)}
            comments={reviewComments}
            closed={closed}
            onAddDraft={(comment) => setDrafts((prev) => [...prev, comment])}
          />
        </div>
        <aside className="review-main-sidebar">
          <section className="panel-block">
            <div className="panel-block-header">files</div>
            <div className="panel-block-body panel-list-body">
              <div className="file-overview-list">
                {fileOverview.map((entry) => (
                  <a
                    key={entry.path}
                    className="file-overview-item"
                    href={`#${entry.anchorId}`}
                    title={entry.path}
                    onClick={() =>
                      setCollapsedFiles((prev) => ({
                        ...prev,
                        [entry.path]: false,
                      }))
                    }
                  >
                    <span className="file-overview-line">
                      <span className="file-overview-path" title={entry.path}>{entry.path}</span>
                    </span>
                    <span className="file-overview-delta">
                      <span className="delta-add">+{entry.counts.adds}</span>{' '}
                      <span className="delta-remove">-{entry.counts.removes}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </section>
        </aside>
      </div>

      {payload.diff.length === 0 ? (
        <div className="empty-state">no diff content found in this snapshot.</div>
      ) : (
        <div className="files">
          {payload.diff.map((file) => (
            <DiffFile
              key={`${file.displayPath}:${file.status}`}
              file={file}
              anchorId={fileAnchorId(file.displayPath)}
              openEditorKey={openEditorKey}
              commentsByAnchor={commentsByAnchor}
              fileComments={fileCommentsByFile.get(file.displayPath) ?? []}
              viewed={viewedSet.has(file.displayPath)}
              collapsed={
                file.isBinary ||
                (collapsedFiles[file.displayPath] ??
                  (viewedSet.has(file.displayPath) || shouldCollapseByDefault(file)))
              }
              closed={closed}
              onToggleViewed={(filePath) => {
                setViewedFiles((prev) => {
                  const has = prev.includes(filePath);
                  setCollapsedFiles((collapsedPrev) => ({
                    ...collapsedPrev,
                    [filePath]: has ? false : true,
                  }));
                  const next = has ? prev.filter((p) => p !== filePath) : [...prev, filePath];
                  return next.sort();
                });
              }}
              onToggleCollapsed={(filePath) =>
                setCollapsedFiles((prev) => {
                  const target = payload.diff.find((f) => f.displayPath === filePath);
                  if (target?.isBinary) return prev;
                  return {
                    ...prev,
                    [filePath]: !(prev[filePath] ?? viewedSet.has(filePath)),
                  };
                })
              }
              onOpenEditor={setOpenEditorKey}
              onCloseEditor={() => setOpenEditorKey(null)}
              onAddDraft={(comment) => setDrafts((prev) => [...prev, comment])}
            />
          ))}
        </div>
      )}
    </div>
  );
}
