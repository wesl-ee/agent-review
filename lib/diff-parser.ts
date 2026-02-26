import { lookup } from 'mime-types';
import type { DiffFile, DiffHunk, DiffLine } from './types';

const hunkRe = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/;

function stripAB(p: string) {
  return p.replace(/^[ab]\//, '');
}

function parseFileStatus(lines: string[], i: number) {
  let status: DiffFile['status'] = 'modified';
  for (let j = i + 1; j < Math.min(lines.length, i + 12); j += 1) {
    const line = lines[j];
    if (line.startsWith('new file mode ')) return 'added';
    if (line.startsWith('deleted file mode ')) return 'deleted';
    if (line.startsWith('rename from ') || line.startsWith('rename to ')) status = 'renamed';
    if (line.startsWith('diff --git ')) break;
  }
  return status;
}

function parsePathFromDiffGit(line: string) {
  const m = /^diff --git a\/(.+) b\/(.+)$/.exec(line);
  if (!m) return null;
  return { oldPath: m[1], newPath: m[2] };
}

function isBinaryPath(p: string) {
  const mime = lookup(p);
  return typeof mime === 'string' && (mime.startsWith('image/') || mime.startsWith('video/'));
}

export function parseUnifiedDiff(patch: string): DiffFile[] {
  const lines = patch.split('\n');
  const files: DiffFile[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.startsWith('diff --git ')) {
      i += 1;
      continue;
    }

    const parsed = parsePathFromDiffGit(line);
    if (!parsed) {
      i += 1;
      continue;
    }

    const status = parseFileStatus(lines, i);
    let oldPath = parsed.oldPath;
    let newPath = parsed.newPath;
    const hunks: DiffHunk[] = [];
    i += 1;

    while (i < lines.length && !lines[i].startsWith('diff --git ')) {
      const cur = lines[i];
      if (cur.startsWith('--- ')) {
        oldPath = cur.slice(4).trim() === '/dev/null' ? '/dev/null' : stripAB(cur.slice(4).trim());
        i += 1;
        continue;
      }
      if (cur.startsWith('+++ ')) {
        newPath = cur.slice(4).trim() === '/dev/null' ? '/dev/null' : stripAB(cur.slice(4).trim());
        i += 1;
        continue;
      }
      const hm = hunkRe.exec(cur);
      if (!hm) {
        i += 1;
        continue;
      }

      const oldStart = Number(hm[1]);
      const oldCount = hm[2] ? Number(hm[2]) : 1;
      const newStart = Number(hm[3]);
      const newCount = hm[4] ? Number(hm[4]) : 1;
      const hunkLines: DiffLine[] = [];
      let oldN = oldStart;
      let newN = newStart;
      const header = cur;
      i += 1;

      while (i < lines.length && !lines[i].startsWith('diff --git ') && !lines[i].startsWith('@@ ')) {
        const raw = lines[i];
        if (raw === '\\ No newline at end of file') {
          i += 1;
          continue;
        }
        const prefix = raw[0] as '+' | '-' | ' ' | undefined;
        const content = raw.length > 0 ? raw.slice(1) : '';
        if (prefix === '+') {
          hunkLines.push({ kind: 'add', prefix: '+', content, oldLine: null, newLine: newN++ });
        } else if (prefix === '-') {
          hunkLines.push({ kind: 'remove', prefix: '-', content, oldLine: oldN++, newLine: null });
        } else if (prefix === ' ') {
          hunkLines.push({ kind: 'context', prefix: ' ', content, oldLine: oldN++, newLine: newN++ });
        } else {
          break;
        }
        i += 1;
      }

      hunks.push({ header, oldStart, oldCount, newStart, newCount, lines: hunkLines });
      continue;
    }

    let displayPath = newPath !== '/dev/null' ? newPath : oldPath;
    displayPath = stripAB(displayPath);
    const normalizedOld = oldPath === '/dev/null' ? '/dev/null' : stripAB(oldPath);
    const normalizedNew = newPath === '/dev/null' ? '/dev/null' : stripAB(newPath);

    const isBinary = hunks.length === 0 && isBinaryPath(displayPath);
    files.push({
      oldPath: normalizedOld,
      newPath: normalizedNew,
      displayPath,
      status,
      isBinary,
      isEmpty: status === 'added' && hunks.length === 0 && !isBinary,
      hunks,
    });
  }

  return files;
}
