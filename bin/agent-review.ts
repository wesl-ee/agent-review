#!/usr/bin/env node
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileP = promisify(execFile);
const CONTAINER_PORT = 3421;
const hostPort = Number(process.env.AGENT_REVIEW_PORT || '3421');
const containerName = process.env.AGENT_REVIEW_CONTAINER || 'agent-review-app';
const thisFile = fileURLToPath(import.meta.url);
const pkgJsonPath = path.resolve(path.dirname(thisFile), '../../package.json');
const pkgVersion = existsSync(pkgJsonPath)
  ? (JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as { version?: string }).version
  : undefined;
const image =
  process.env.AGENT_REVIEW_IMAGE || `ghcr.io/wesl-ee/agent-review:${pkgVersion || 'latest'}`;
const dataDir = process.env.AGENT_REVIEW_DATA || path.join(os.homedir(), '.agent-reviews');
const apiBase = (process.env.AGENT_REVIEW_API_BASE || `http://127.0.0.1:${hostPort}`).replace(/\/+$/, '');

function usage() {
  console.error(`usage:
  agent-review trigger [--cwd <path>] [--review-id <id>] [--base <ref>] [--staged]
  agent-review comments <review-id>
  agent-review status <review-id>
  agent-review resolve <review-id> <comment-id> [comment-id...]`);
}

function makeReviewId() {
  const iso = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${iso}-${crypto.randomBytes(4).toString('hex')}`;
}

async function run(cmd: string, args: string[], opts?: { cwd?: string }) {
  try {
    return await execFileP(cmd, args, {
      cwd: opts?.cwd,
      maxBuffer: 50 * 1024 * 1024,
      env: process.env,
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    const msg = [e.stderr?.trim(), e.stdout?.trim(), e.message].filter(Boolean).join('\n');
    throw new Error(msg);
  }
}

async function checkHealth() {
  const res = await fetch(`${apiBase}/api/health`, { cache: 'no-store' });
  return res.ok;
}

async function ensureLocalServer() {
  if (process.env.AGENT_REVIEW_API_BASE) {
    if (!(await checkHealth().catch(() => false))) {
      throw new Error(`server not reachable at ${apiBase}`);
    }
    return;
  }

  if (await checkHealth().catch(() => false)) return;

  await fs.mkdir(dataDir, { recursive: true });
  const running = await run('docker', ['inspect', '-f', '{{.State.Running}}', containerName])
    .then(({ stdout }) => stdout.trim() === 'true')
    .catch(() => false);

  if (!running) {
    const exists = await run('docker', ['inspect', containerName]).then(() => true).catch(() => false);
    if (exists) {
      await run('docker', ['start', containerName]);
    } else {
      await run('docker', ['pull', image]);
      await run('docker', [
        'run',
        '-d',
        '--name',
        containerName,
        '--restart',
        'unless-stopped',
        '-e',
        'AGENT_REVIEW_ROOT=/data/reviews',
        '-p',
        `127.0.0.1:${hostPort}:${CONTAINER_PORT}`,
        '-v',
        `${dataDir}:/data/reviews`,
        image,
      ]);
    }
  }

  const timeoutMs = 30_000;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkHealth().catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`server not reachable at ${apiBase}`);
}

async function getJson(p: string) {
  const res = await fetch(`${apiBase}${p}`, { cache: 'no-store' });
  if (res.status === 404) return { status: 404 as const, body: null };
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

async function postJson(p: string, body: unknown) {
  const res = await fetch(`${apiBase}${p}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

function parseTriggerArgs(argv: string[]) {
  const args = { cwd: process.cwd(), base: 'HEAD', staged: false, reviewId: '' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--cwd') args.cwd = path.resolve(argv[++i] || '');
    else if (a === '--base') args.base = argv[++i] || 'HEAD';
    else if (a === '--staged') args.staged = true;
    else if (a === '--review-id') args.reviewId = argv[++i] || '';
    else if (a === '--no-open') continue;
    else if (a === '--help' || a === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`unknown arg: ${a}`);
    }
  }
  return args;
}

async function runGitDiff(args: { cwd: string; base: string; staged: boolean }) {
  await run('git', ['rev-parse', '--is-inside-work-tree'], { cwd: args.cwd });
  const diffArgs = args.staged ? ['diff', '--cached'] : ['diff', args.base];
  const { stdout } = await run('git', diffArgs, { cwd: args.cwd });
  return { patch: stdout, diffCommand: `git ${diffArgs.join(' ')}` };
}

async function cmdTrigger(args: string[]) {
  const parsed = parseTriggerArgs(args);
  const { patch, diffCommand } = await runGitDiff(parsed);
  if (!patch.trim()) {
    throw new Error(parsed.staged ? 'no staged diff to review' : `no diff to review for base ${parsed.base}`);
  }

  await ensureLocalServer();
  const id = parsed.reviewId || makeReviewId();
  const result = await postJson('/api/reviews', {
    id,
    cwd: parsed.cwd,
    diffCommand,
    diffPatch: patch,
  });

  if (result.status < 200 || result.status >= 300) {
    const msg =
      result.body && typeof result.body === 'object' && 'error' in result.body
        ? String((result.body as { error: unknown }).error)
        : `status ${result.status}`;
    throw new Error(`failed to create review: ${msg}`);
  }

  process.stdout.write(`Review opened: ${apiBase}/review/${id}\n`);
  process.stdout.write(`Review ID: ${id}\n`);
  process.stdout.write(`Comments endpoint: ${apiBase}/api/reviews/${id}/comments\n`);
  process.stdout.write(`Status endpoint: ${apiBase}/api/reviews/${id}/status\n`);
  process.stdout.write('Wait for the user to submit review, then read comments via the API.\n');
}

async function cmdComments(args: string[]) {
  if (args.length !== 1) {
    usage();
    process.exit(1);
  }
  await ensureLocalServer();
  const result = await getJson(`/api/reviews/${encodeURIComponent(args[0])}/comments`);
  if (result.status >= 200 && result.status < 300) {
    process.stdout.write(`${JSON.stringify(result.body)}\n`);
    return;
  }
  process.stderr.write(`${JSON.stringify(result.body)}\n`);
  process.exit(1);
}

async function cmdStatus(args: string[]) {
  if (args.length !== 1) {
    usage();
    process.exit(1);
  }
  await ensureLocalServer();
  const result = await getJson(`/api/reviews/${encodeURIComponent(args[0])}/status`);
  if (result.status === 404) {
    process.stdout.write('NO_STATUS\n');
    return;
  }
  if (result.status >= 200 && result.status < 300) {
    process.stdout.write(`${JSON.stringify(result.body)}\n`);
    return;
  }
  process.stderr.write(`${JSON.stringify(result.body)}\n`);
  process.exit(1);
}

async function cmdResolve(args: string[]) {
  if (args.length < 2) {
    usage();
    process.exit(1);
  }
  const [reviewId, ...ids] = args;
  await ensureLocalServer();
  const updates = Object.fromEntries(ids.map((id) => [id, { status: 'resolved' as const }]));
  const result = await postJson(`/api/reviews/${encodeURIComponent(reviewId)}/status`, { updates });
  if (result.status >= 200 && result.status < 300) {
    process.stdout.write(`${JSON.stringify(result.body)}\n`);
    return;
  }
  process.stderr.write(`${JSON.stringify(result.body)}\n`);
  process.exit(1);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === '--help' || cmd === '-h') {
    usage();
    process.exit(0);
  }
  if (cmd === 'trigger') return cmdTrigger(rest);
  if (cmd === 'comments') return cmdComments(rest);
  if (cmd === 'status') return cmdStatus(rest);
  if (cmd === 'resolve') return cmdResolve(rest);
  usage();
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
