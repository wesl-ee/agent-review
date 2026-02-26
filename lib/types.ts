export type DiffLine = {
  kind: 'add' | 'remove' | 'context';
  prefix: '+' | '-' | ' ';
  content: string;
  oldLine: number | null;
  newLine: number | null;
};

export type DiffHunk = {
  header: string;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
};

export type DiffFile = {
  oldPath: string;
  newPath: string;
  displayPath: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  isBinary: boolean;
  isEmpty: boolean;
  hunks: DiffHunk[];
};

export type ReviewMeta = {
  id: string;
  createdAt: string;
  cwd: string;
  diffCommand: string;
  state: 'open' | 'closed';
  closedAt: string | null;
};

export type ReviewComment = {
  kind: 'line' | 'file' | 'review';
  id: string;
  file: string | null;
  hunkHeader: string | null;
  side: 'new' | null;
  line: { old: number | null; new: number | null } | null;
  body: string;
  createdAt: string;
  status: 'open' | 'resolved';
  resolvedAt?: string;
  resolutionNote?: string;
};

export type CommentsFile = {
  reviewId: string;
  viewedFiles: string[];
  comments: ReviewComment[];
};

export type StatusPatchEntry = {
  status: 'open' | 'resolved';
  resolvedAt?: string;
  note?: string;
};

export type StatusFile = {
  reviewId: string;
  updatedAt: string;
  statuses: Record<string, StatusPatchEntry>;
};

export type ReviewPayload = {
  meta: ReviewMeta;
  diff: DiffFile[];
  comments: ReviewComment[];
  viewedFiles: string[];
};

export type DraftComment = Omit<ReviewComment, 'id' | 'createdAt' | 'status'>;
