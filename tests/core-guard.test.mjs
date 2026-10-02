// PKG-7 / D2 – Tests für scripts/core-guard.mjs (Trailer-Guard für Commits und Push) und für die D1-Konfiguration.
// Alle Git-Tests laufen in Wegwerf-Repos unter os.tmpdir(); das Projekt-Repo wird nicht angefasst.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadCoreFiles, parseTrailer, validateReason } from '../scripts/core-guard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'core-guard.mjs');
const HOOKS = path.join(ROOT, 'scripts', 'githooks');
const CORE = [
  'utils/canonical-match-result.ts',
  'utils/canonical-match-result-storage.ts',
  'utils/event-dedupe.ts',
  'utils/websocket-helpers.ts',
];
const GOOD = 'Protected-Core-Approved: Dedupe-Regel fuer Reconnect-Snapshots, vom Nutzer am 2026-10-03 freigegeben';

function cleanEnv(extra = {}) {
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null', ...extra };
  for (const k of Object.keys(env)) if (k === 'CLAUDECODE' || k.startsWith('CLAUDE_CODE_')) delete env[k];
  return { ...env, ...extra };
}

function sh(cmd, args, cwd, { env = cleanEnv(), input } = {}) {
  return spawnSync(cmd, args, { cwd, env, input, encoding: 'utf8' });
}

const g = (cwd, args, opts) => sh('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], cwd, opts);

function makeRepo({ hooks = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'core-guard-'));
  g(dir, ['init', '-q', '-b', 'main']);
  if (hooks) g(dir, ['config', 'core.hooksPath', HOOKS]);
  fs.mkdirSync(path.join(dir, 'utils'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'README.md'), 'x\n');
  g(dir, ['add', '.']);
  assert.equal(g(dir, ['commit', '-q', '--no-verify', '-m', 'init']).status, 0);
  return dir;
}

function write(dir, rel, text) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), text);
  g(dir, ['add', rel]);
}

function msgFile(dir, text) {
  const f = path.join(dir, '.git', 'MSG_TEST');
  fs.writeFileSync(f, text);
  return f;
}

const guard = (dir, args, opts) => sh('node', [SCRIPT, ...args], dir, opts);

// ── Konfiguration / D1 ─────────────────────────────────────────────────────────

test('core list is exactly the 4 verified protected files and comes from gate.config.json', () => {
  assert.deepEqual(loadCoreFiles(), CORE);
});

test('D1: .claude/settings.json asks for exactly the 4 core files via Edit(...) rules and disables bypass mode', () => {
  const s = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude/settings.json'), 'utf8'));
  assert.deepEqual([...s.permissions.ask].sort(), CORE.map((f) => `Edit(${f})`).sort());
  assert.equal(s.permissions.disableBypassPermissionsMode, 'disable');
  // Claude Code only consults Edit(path) rules, Write(...) path rules would be dead config
  assert.ok(!s.permissions.ask.some((r) => /^(Write|NotebookEdit|MultiEdit)\(/.test(r)));
  assert.ok(!(s.permissions.deny || []).some((r) => CORE.some((f) => r.includes(f))), 'no blanket deny on core paths');
});

// ── Trailer-Parser und Grundvalidierung ────────────────────────────────────────

test('parseTrailer reads the last trailer, ignores comment lines and requires the exact key', () => {
  assert.equal(parseTrailer(`fix\n\n${GOOD}\n`), 'Dedupe-Regel fuer Reconnect-Snapshots, vom Nutzer am 2026-10-03 freigegeben');
  assert.equal(parseTrailer('fix\n\n# Protected-Core-Approved: im Kommentar\n'), null);
  assert.equal(parseTrailer('fix\n\nprotected-core-approved: falsche Schreibweise\n'), null);
  assert.equal(parseTrailer('fix\n\nProtected-Core-Approved: erster Grund ist lang genug\nProtected-Core-Approved: zweiter konkreter Grund\n'), 'zweiter konkreter Grund');
  assert.equal(parseTrailer('fix\n\nProtected-Core-Approved:\n'), '');
});

test('validateReason accepts a concrete reason', () => {
  assert.equal(validateReason('Dedupe-Regel fuer Reconnect-Snapshots, vom Nutzer freigegeben').ok, true);
});

test('validateReason rejects missing, empty, short and generic reasons', () => {
  assert.equal(validateReason(null).ok, false, 'missing');
  assert.equal(validateReason('').ok, false, 'empty');
  for (const r of ['yes', 'ok', 'approved', 'true', 'y', '1', 'approved by user', 'ja', 'freigegeben', 'fix', 'fix stuff', 'needed', 'LGTM', 'TODO', 'tbd', 'n/a', 'none',
    'yes, approved by the user', 'ok ok ok ok ok ok ok ok', 'freigegeben, genehmigt, notwendig', 'the change is required and necessary', 'protected core change approved']) {
    assert.equal(validateReason(r).ok, false, `must reject: ${r}`);
  }
});

// ── commit-msg (direkter Aufruf) ───────────────────────────────────────────────

test('commit-msg: non-core commit needs no trailer (positive)', () => {
  const dir = makeRepo();
  write(dir, 'src/a.ts', 'a');
  assert.equal(guard(dir, ['commit-msg', msgFile(dir, 'feat: a\n')]).status, 0);
});

test('commit-msg: core file staged without trailer is refused (negative)', () => {
  const dir = makeRepo();
  write(dir, 'utils/event-dedupe.ts', 'x');
  const r = guard(dir, ['commit-msg', msgFile(dir, 'fix: dedupe\n')]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /utils\/event-dedupe\.ts/);
  assert.match(r.stderr, /missing trailer/);
});

test('commit-msg: every one of the 4 core files triggers the guard (negative)', () => {
  for (const f of CORE) {
    const dir = makeRepo();
    write(dir, f, 'x');
    assert.equal(guard(dir, ['commit-msg', msgFile(dir, 'fix\n')]).status, 1, f);
  }
});

test('commit-msg: valid trailer allows the core change (positive)', () => {
  const dir = makeRepo();
  write(dir, 'utils/websocket-helpers.ts', 'x');
  assert.equal(guard(dir, ['commit-msg', msgFile(dir, `fix: ws\n\n${GOOD}\n`)]).status, 0);
});

test('commit-msg: empty, generic and commented-out trailers are refused (negative)', () => {
  const dir = makeRepo();
  write(dir, 'utils/event-dedupe.ts', 'x');
  for (const body of ['Protected-Core-Approved:', 'Protected-Core-Approved: yes', 'Protected-Core-Approved: approved by user',
    'Protected-Core-Approved: ok', 'Protected-Core-Approved: true', '# Protected-Core-Approved: Dedupe-Regel fuer Reconnect-Snapshots freigegeben']) {
    assert.equal(guard(dir, ['commit-msg', msgFile(dir, `fix\n\n${body}\n`)]).status, 1, body);
  }
});

test('commit-msg: deletion and rename of a core file are detected (negative)', () => {
  const dir = makeRepo();
  write(dir, 'utils/event-dedupe.ts', 'x');
  assert.equal(g(dir, ['commit', '-q', '--no-verify', '-m', 'seed']).status, 0);
  g(dir, ['mv', 'utils/event-dedupe.ts', 'utils/renamed.ts']);
  assert.equal(guard(dir, ['commit-msg', msgFile(dir, 'mv\n')]).status, 1, 'rename');
  g(dir, ['reset', '-q', '--hard']);
  g(dir, ['rm', '-q', 'utils/event-dedupe.ts']);
  assert.equal(guard(dir, ['commit-msg', msgFile(dir, 'rm\n')]).status, 1, 'delete');
});

test('commit-msg: a commit from a Claude Code session is refused even with a valid trailer (agents never self-approve)', () => {
  const dir = makeRepo();
  write(dir, 'utils/event-dedupe.ts', 'x');
  const f = msgFile(dir, `fix\n\n${GOOD}\n`);
  const agent = guard(dir, ['commit-msg', f], { env: cleanEnv({ CLAUDECODE: '1' }) });
  assert.equal(agent.status, 1);
  assert.match(agent.stderr, /Claude Code session/);
  assert.equal(guard(dir, ['commit-msg', f]).status, 0, 'same commit from a normal terminal passes');
});

test('commit-msg: a non-core commit from a Claude Code session is not affected (positive)', () => {
  const dir = makeRepo();
  write(dir, 'src/a.ts', 'a');
  assert.equal(guard(dir, ['commit-msg', msgFile(dir, 'feat\n')], { env: cleanEnv({ CLAUDECODE: '1' }) }).status, 0);
});

test('config errors and usage errors exit 2 (fail closed)', () => {
  const dir = makeRepo();
  assert.equal(guard(dir, ['commit-msg', 'x', '--config', path.join(dir, 'missing.json')]).status, 2);
  fs.writeFileSync(path.join(dir, 'bad.json'), '{"protectedCore":{"files":[]}}');
  assert.equal(guard(dir, ['commit-msg', 'x', '--config', path.join(dir, 'bad.json')]).status, 2);
  assert.equal(guard(dir, ['bogus']).status, 2);
});

// ── echte Git-Hooks (commit-msg und pre-push) in Wegwerf-Repos ────────────────

test('integration commit-msg hook: git commit is blocked without trailer and succeeds with it', () => {
  const dir = makeRepo({ hooks: true });
  write(dir, 'utils/event-dedupe.ts', 'x');
  const blocked = g(dir, ['commit', '-q', '-m', 'fix: dedupe']);
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /core-guard/);
  assert.equal(g(dir, ['log', '--oneline']).stdout.trim().split('\n').length, 1, 'no commit was created');
  const ok = g(dir, ['commit', '-q', '-m', 'fix: dedupe', '-m', GOOD]);
  assert.equal(ok.status, 0, ok.stderr);
});

test('integration commit-msg hook: ordinary commits are unaffected', () => {
  const dir = makeRepo({ hooks: true });
  write(dir, 'src/a.ts', 'a');
  assert.equal(g(dir, ['commit', '-q', '-m', 'feat: a']).status, 0);
});

function makeRemote() {
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'core-guard-bare-'));
  g(bare, ['init', '-q', '--bare', '-b', 'main']);
  return bare;
}

test('integration pre-push hook: a --no-verify core commit without trailer is stopped at push, with trailer it passes', () => {
  const dir = makeRepo({ hooks: true });
  const bare = makeRemote();
  g(dir, ['remote', 'add', 'origin', bare]);
  assert.equal(g(dir, ['push', '-q', 'origin', 'main']).status, 0, 'baseline push (no core change)');

  write(dir, 'utils/event-dedupe.ts', 'x');
  assert.equal(g(dir, ['commit', '-q', '--no-verify', '-m', 'sneaky core change']).status, 0, 'commit hook bypassed');
  const blocked = g(dir, ['push', 'origin', 'main']);
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /sneaky core change/);
  assert.match(blocked.stderr, /utils\/event-dedupe\.ts/);
  assert.equal(g(bare, ['rev-list', '--count', 'main']).stdout.trim(), '1', 'remote unchanged');

  assert.equal(g(dir, ['commit', '-q', '--amend', '--no-verify', '-m', 'core change', '-m', GOOD]).status, 0);
  const ok = g(dir, ['push', '-q', 'origin', 'main']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(g(bare, ['rev-list', '--count', 'main']).stdout.trim(), '2');
});

test('integration pre-push hook: a generic trailer on a pushed core commit is refused', () => {
  const dir = makeRepo({ hooks: true });
  const bare = makeRemote();
  g(dir, ['remote', 'add', 'origin', bare]);
  assert.equal(g(dir, ['push', '-q', 'origin', 'main']).status, 0);
  write(dir, 'utils/canonical-match-result.ts', 'x');
  assert.equal(g(dir, ['commit', '-q', '--no-verify', '-m', 'core', '-m', 'Protected-Core-Approved: yes']).status, 0);
  assert.notEqual(g(dir, ['push', 'origin', 'main']).status, 0);
});

test('integration pre-push hook: new branch is checked against remote-tracking refs, deleting a branch is not blocked', () => {
  const dir = makeRepo({ hooks: true });
  const bare = makeRemote();
  g(dir, ['remote', 'add', 'origin', bare]);
  assert.equal(g(dir, ['push', '-q', 'origin', 'main']).status, 0);
  g(dir, ['switch', '-q', '-c', 'feature']);
  write(dir, 'utils/websocket-helpers.ts', 'x');
  assert.equal(g(dir, ['commit', '-q', '--no-verify', '-m', 'core on feature']).status, 0);
  assert.notEqual(g(dir, ['push', 'origin', 'feature']).status, 0, 'new branch with unapproved core commit');
  g(dir, ['commit', '-q', '--amend', '--no-verify', '-m', 'core on feature', '-m', GOOD]);
  assert.equal(g(dir, ['push', '-q', 'origin', 'feature']).status, 0, 'approved core commit on new branch');
  assert.equal(g(dir, ['push', '-q', 'origin', '--delete', 'feature']).status, 0, 'deletion is not blocked');
});

test('range mode audits an arbitrary range', () => {
  const dir = makeRepo();
  write(dir, 'utils/event-dedupe.ts', 'x');
  g(dir, ['commit', '-q', '--no-verify', '-m', 'core']);
  assert.equal(guard(dir, ['range', 'HEAD~1..HEAD']).status, 1);
  assert.equal(guard(dir, ['range', 'HEAD~1..HEAD~1']).status, 0);
});

test('hook stubs are executable POSIX shell, fail closed without node and delegate to core-guard.mjs', () => {
  for (const name of ['commit-msg', 'pre-push']) {
    const p = path.join(HOOKS, name);
    assert.ok(fs.statSync(p).mode & 0o111, `${name} must be executable`);
    const text = fs.readFileSync(p, 'utf8');
    assert.match(text, /^#!\/bin\/sh/);
    assert.match(text, /command -v node[\s\S]*exit 1/);
    assert.match(text, /exec node "\$dir\/\.\.\/core-guard\.mjs" (commit-msg|pre-push) "\$@"/);
  }
});
