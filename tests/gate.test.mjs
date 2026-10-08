// Regression tests for scripts/gate.mjs (test gatekeeper). Every test runs in its own throwaway git repository under
// os.tmpdir() with an isolated git environment; the real project is only read (gate.mjs / gate.config.json are copied).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-test-'));
const HOME = path.join(BASE, 'home'); fs.mkdirSync(HOME);
const GATE_CODE_GATES = ['compile', 'test', 'tooling', 'components', 'build-firefox', 'build-chrome'];
after(() => fs.rmSync(BASE, { recursive: true, force: true }));

const baseEnv = { ...process.env, HOME, XDG_CONFIG_HOME: HOME, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const sh = (cwd, cmd, args, env = {}) => spawnSync(cmd, args, { cwd, env: { ...baseEnv, ...env }, encoding: 'utf8' });
const git = (cwd, ...a) => {
  const r = sh(cwd, 'git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...a]);
  assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
const put = (d, f, c) => { fs.mkdirSync(path.dirname(path.join(d, f)), { recursive: true }); fs.writeFileSync(path.join(d, f), c); };
const out = (r) => `${r.stdout}${r.stderr}`;
let seq = 0;

/** Create a committed temp repo that contains a copy of the gatekeeper. Gate commands of the code gates only count executions. */
function mkRepo({ nvmrc = `v${process.versions.node}`, tweak } = {}) {
  const dir = path.join(BASE, `r${++seq}`); fs.mkdirSync(dir); git(dir, 'init', '-q', '-b', 'main');
  const count = path.join(BASE, `r${seq}.count`);
  put(dir, 'package.json', '{"name":"t","version":"1.0.0"}\n'); put(dir, '.nvmrc', `${nvmrc}\n`);
  put(dir, 'utils/core.ts', 'export function coreFunctionName(x: number) { return x; }\nexport const CORE_CONSTANT_VALUE = 1;\n');
  put(dir, 'utils/user.ts', "import { coreFunctionName } from './core';\nexport const u = coreFunctionName(1);\n");
  put(dir, 'entrypoints/auto.ts', 'export const a = coreFunctionName(2);\n');
  put(dir, 'entrypoints/popup/index.html', '<html></html>\n');
  put(dir, 'components/Comp.vue', '<script setup lang="ts">\nimport { u } from "../utils/user";\nconsole.log(u);\n</script>\n<template><div/></template>\n');
  put(dir, 'utils/other.ts', 'export const other = 1;\n'); put(dir, 'utils/b.ts', 'export const b = 1;\n'); put(dir, 'README.md', '# t\n'); put(dir, 'tests/core.test.ts', '// t\n');
  fs.mkdirSync(path.join(dir, 'runtime-artifacts')); fs.writeFileSync(path.join(dir, 'runtime-artifacts/a.xpi'), Buffer.from([0, 1, 2, 3, 250, 251]));
  const cfg = JSON.parse(fs.readFileSync(path.join(PROJECT, 'scripts/gate.config.json'), 'utf8'));
  cfg.protectedCore.files = ['utils/core.ts']; cfg.protectedCore.tests = [];
  for (const n of GATE_CODE_GATES) {
    const fail = `GATE_FAIL_${n.toUpperCase().replace('-', '_')}`;
    cfg.gates[n].command = ['node', '-e', `require('fs').appendFileSync(process.env.GATE_COUNT_FILE,'${n}\\n');process.exit(process.env.${fail}?1:0)`];
  }
  if (tweak) tweak(cfg);
  put(dir, 'scripts/gate.config.json', `${JSON.stringify(cfg, null, 2)}\n`);
  fs.copyFileSync(path.join(PROJECT, 'scripts/gate.mjs'), path.join(dir, 'scripts/gate.mjs'));
  git(dir, 'add', '-A'); git(dir, 'commit', '-qm', 'base');
  const g = (args, env) => sh(dir, process.execPath, ['scripts/gate.mjs', ...args], { GATE_COUNT_FILE: count, ...env });
  const counts = () => { const m = {}; if (fs.existsSync(count)) for (const l of fs.readFileSync(count, 'utf8').split('\n').filter(Boolean)) m[l] = (m[l] || 0) + 1; return m; };
  return { dir, g, counts, ran: () => fs.existsSync(count), edit: (f, c) => put(dir, f, c) };
}
const state = (r, pkg) => path.join(r.dir, '.git/autodarts-gate/state', `${pkg}.json`);
const touchApp = (r, n = 2) => r.edit('utils/other.ts', `export const other = ${n};\n`);

test('A clean/allowed state is not blocked', () => {
  const r = mkRepo();
  const c = r.g(['classify']); assert.equal(c.status, 0, out(c)); assert.match(c.stdout, /CLASS: NONE/);
  assert.equal(r.g(['status']).status, 0);
  const run = r.g(['run', 'pkgA']); assert.equal(run.status, 0, out(run)); assert.equal(r.ran(), false);
});

test('B tracked change is detected and classified', () => {
  const r = mkRepo(); touchApp(r);
  const c = r.g(['classify']); assert.equal(c.status, 0, out(c));
  assert.match(c.stdout, /^\s+M\s+utils\/other\.ts\s+\[GENERAL_APP\]$/m); assert.doesNotMatch(c.stdout, /\(staged\)/);
});

test('C staged change is detected; partially staged blocks', () => {
  const r = mkRepo(); touchApp(r, 3); git(r.dir, 'add', 'utils/other.ts');
  const c = r.g(['classify']); assert.equal(c.status, 0, out(c)); assert.match(c.stdout, /utils\/other\.ts.*\(staged\)/);
  touchApp(r, 4);
  const p = r.g(['classify']); assert.equal(p.status, 3); assert.match(p.stdout, /PARTIALLY_STAGED/);
});

test('D unknown untracked file is fail-closed (exit 4, no gate runs)', () => {
  const r = mkRepo(); r.edit('mystery.dat', 'x');
  const c = r.g(['classify']); assert.equal(c.status, 4); assert.match(c.stdout, /UNKNOWN_CLASS.*mystery\.dat/);
  assert.equal(r.g(['run', 'pkgD']).status, 4); assert.equal(r.ran(), false);
});

test('E allowed operator artifact is ignored; staged variant and other names are not', () => {
  const bak = '.claude/settings.local.json.bak-20260930T234259';
  const r = mkRepo(); r.edit(bak, '{}');
  const c = r.g(['classify']); assert.equal(c.status, 0, out(c)); assert.match(c.stdout, /CLASS: NONE/); assert.ok(!c.stdout.includes('settings.local.json.bak'));
  git(r.dir, 'add', bak);
  const s = r.g(['classify']); assert.equal(s.status, 3); assert.match(s.stdout, /OPERATOR_ARTIFACT_NOT_UNTRACKED/);
  const r2 = mkRepo(); r2.edit('.claude/settings.local.json.bak-EVIL', '{}');
  assert.match(r2.g(['classify']).stdout, /settings\.local\.json\.bak-EVIL\s+\[CLAUDE_CONFIG\]/);
});

test('F runtime artifact change is BLOCKED (modified and new file)', () => {
  const r = mkRepo(); fs.appendFileSync(path.join(r.dir, 'runtime-artifacts/a.xpi'), Buffer.from([9]));
  const c = r.g(['classify']); assert.equal(c.status, 3); assert.match(c.stdout, /RUNTIME_ARTIFACT_CHANGED/);
  const r2 = mkRepo(); r2.edit('runtime-artifacts/b.zip', 'zip');
  const n = r2.g(['classify']); assert.equal(n.status, 3); assert.match(n.stdout, /RUNTIME_ARTIFACT_CHANGED/);
});

test('G protected core (tier 0) change is BLOCKED and starts no gate', () => {
  const r = mkRepo(); r.edit('utils/core.ts', 'export function coreFunctionName(x: number) { return x + 1; }\nexport const CORE_CONSTANT_VALUE = 1;\n');
  const c = r.g(['classify']); assert.equal(c.status, 3); assert.match(c.stdout, /PROTECTED_CORE_CHANGED/);
  assert.equal(r.g(['run', 'pkgG']).status, 3); assert.equal(r.ran(), false);
});

test('H protected core direct users (tier 1: import and by-symbol) are BLOCKED; tier 2 only gets a review flag', () => {
  const a = mkRepo(); a.edit('utils/user.ts', "import { coreFunctionName } from './core';\nexport const u = coreFunctionName(5);\n");
  const sa = a.g(['classify']); assert.equal(sa.status, 3); assert.match(sa.stdout, /APPROVAL_REQUIRED/);
  const b = mkRepo(); b.edit('entrypoints/auto.ts', 'export const a = coreFunctionName(9);\n');
  const sb = b.g(['classify']); assert.equal(sb.status, 3); assert.match(sb.stdout, /APPROVAL_REQUIRED/);
  const c = mkRepo(); c.edit('components/Comp.vue', '<script setup lang="ts">\nimport { u } from "../utils/user";\nconsole.log(u, 1);\n</script>\n<template><div/></template>\n');
  const t2 = c.g(['classify']); assert.equal(t2.status, 0, out(t2)); assert.match(t2.stdout, /Comp\.vue\s+\[UI_COMPONENT; review\]/);
});

test('I unchanged input + earlier PASS => cached PASS (SKIPPED), no process started', () => {
  const r = mkRepo(); touchApp(r);
  const r1 = r.g(['run', 'pkgI']); assert.equal(r1.status, 0, out(r1));
  const c1 = r.counts(); assert.equal(c1.test, 1); assert.equal(c1['build-firefox'], 1);
  const r2 = r.g(['run', 'pkgI']); assert.equal(r2.status, 0, out(r2));
  assert.equal((r2.stdout.match(/SKIPPED \(cached PASS\)/g) || []).length, 4); assert.deepEqual(r.counts(), c1);
});

test('J changed fingerprint => INVALIDATED and re-run (only cacheable gates; html is an input)', () => {
  const r = mkRepo(); touchApp(r); assert.equal(r.g(['run', 'pkgJ']).status, 0);
  touchApp(r, 3);
  const s = r.g(['status', 'pkgJ']);
  for (const n of ['compile', 'test', 'components', 'build-firefox']) assert.match(s.stdout, new RegExp(`${n}\\s+INVALIDATED`));
  assert.match(s.stdout, /diffcheck\s+PASS \(runs every time\)/); assert.doesNotMatch(s.stdout, /diffcheck\s+INVALIDATED/);
  const r2 = r.g(['run', 'pkgJ']); assert.equal(r2.status, 0, out(r2)); assert.equal(r.counts().test, 2);
  const events = fs.readFileSync(path.join(r.dir, '.git/autodarts-gate/audit.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const inv = new Set(events.filter((e) => e.event === 'INVALIDATED').map((e) => e.gate));
  assert.deepEqual([...inv].sort(), ['build-firefox', 'compile', 'components', 'test']);
  r.edit('entrypoints/popup/index.html', '<html><body/></html>\n'); const r3 = r.g(['run', 'pkgJ']); assert.equal(r3.status, 0, out(r3));
  assert.equal(r.counts()['build-firefox'], 3);
  r.edit('tests/core.test.ts', '// t2\n'); const r4 = r.g(['run', 'pkgJ']); assert.equal(r4.status, 0, out(r4));
  assert.equal(r.counts()['build-firefox'], 3, 'a test-only change must not invalidate the build gate'); assert.equal(r.counts().test, 4);
});

test('K node major mismatch blocks code gates but not light gates', () => {
  const r = mkRepo({ nvmrc: 'v99.0.0' }); touchApp(r);
  const run = r.g(['run', 'pkgK']); const o = out(run);
  assert.equal(run.status, 3); assert.match(o, /EXPECTED NODE v99\.0\.0/); assert.match(o, /ACTUAL NODE v\d+/); assert.match(o, /BLOCKED/); assert.equal(r.ran(), false);
  const d = mkRepo({ nvmrc: 'v99.0.0' }); d.edit('README.md', '# t2\n'); assert.equal(d.g(['run', 'pkgK2']).status, 0);
});

test('L corrupted, foreign or tampered state is fail-closed', () => {
  const r = mkRepo(); touchApp(r); assert.equal(r.g(['run', 'pkgL']).status, 0);
  const f = state(r, 'pkgL'); const good = fs.readFileSync(f, 'utf8');
  fs.writeFileSync(f, '{broken'); assert.equal(r.g(['status', 'pkgL']).status, 4); assert.equal(r.g(['run', 'pkgL']).status, 4);
  fs.writeFileSync(f, JSON.stringify({ ...JSON.parse(good), packageId: 'other' })); assert.equal(r.g(['status', 'pkgL']).status, 4);
  fs.writeFileSync(f, JSON.stringify({ ...JSON.parse(good), baselineHead: '--output=pwned' })); const t = r.g(['run', 'pkgL']);
  assert.equal(t.status, 4); assert.ok(!fs.existsSync(path.join(r.dir, 'pwned')));
});

test('M malformed config is fail-closed (exit 2)', () => {
  const a = mkRepo(); fs.writeFileSync(path.join(a.dir, 'scripts/gate.config.json'), '{'); assert.equal(a.g(['classify']).status, 2);
  const b = mkRepo({ tweak: (c) => { c.gateOrder = c.gateOrder.filter((n) => n !== 'compile'); } }); assert.equal(b.g(['classify']).status, 2);
  const c = mkRepo({ tweak: (cfg) => { cfg.allowedOperatorArtifacts[0].regex = '('; } }); assert.equal(c.g(['classify']).status, 2);
  const d = mkRepo({ tweak: (cfg) => { cfg.gates.test.command = 'yarn test'; } }); assert.equal(d.g(['classify']).status, 2);
});

test('N missing tool or command is fail-closed', () => {
  const r = mkRepo(); touchApp(r);
  const bin = path.join(BASE, 'bin'); fs.mkdirSync(bin, { recursive: true });
  const gitPath = sh(BASE, 'sh', ['-c', 'command -v git']).stdout.trim();
  for (const [n, t] of [['node', process.execPath], ['git', gitPath]]) if (!fs.existsSync(path.join(bin, n))) fs.symlinkSync(t, path.join(bin, n));
  const noYarn = r.g(['run', 'pkgN1'], { PATH: bin }); assert.equal(noYarn.status, 3, out(noYarn)); assert.match(out(noYarn), /yarn not found/); assert.equal(r.ran(), false);
  const m = mkRepo({ tweak: (c) => { c.gates.test.command = ['definitely-not-a-real-binary-xyz']; } }); touchApp(m);
  const miss = m.g(['run', 'pkgN2']); assert.equal(miss.status, 1, out(miss)); assert.match(out(miss), /GATE_FAIL:test/);
  assert.notEqual(JSON.parse(fs.readFileSync(state(m, 'pkgN2'), 'utf8')).packageStatus, 'READY_TO_CLOSE');
});

test('O a PASS is bound to its package: no reuse across packages or copied state files', () => {
  const r = mkRepo(); touchApp(r);
  assert.equal(r.g(['run', 'pkgX']).status, 0); assert.equal(r.counts().test, 1);
  const y = r.g(['run', 'pkgY']); assert.equal(y.status, 0, out(y)); assert.equal(r.counts().test, 2); assert.doesNotMatch(y.stdout, /SKIPPED/);
  fs.copyFileSync(state(r, 'pkgX'), state(r, 'pkgZ')); assert.equal(r.g(['status', 'pkgZ']).status, 4);
});

test('P git allowlist: no mutating git subcommand is accepted', async () => {
  const r = mkRepo(); const head = git(r.dir, 'rev-parse', 'HEAD');
  const mod = await import(`${pathToFileURL(path.join(r.dir, 'scripts/gate.mjs')).href}?t=${Date.now()}`);
  const accepted = ['commit', 'add', 'push', 'tag', 'checkout', 'reset', 'clean', 'stash', 'fetch', 'pull', 'rebase', 'update-ref', 'branch'].filter((s) => { try { mod.git([s, '-m', 'x']); return true; } catch { return false; } });
  assert.deepEqual(accepted, []); assert.throws(() => mod.git(['hash-object', '-w', 'README.md']));
  assert.equal(git(r.dir, 'rev-parse', 'HEAD'), head);
});

test('Q close contract: only READY_TO_CLOSE with fresh gates; no git state is changed', () => {
  const r = mkRepo(); touchApp(r); const head = git(r.dir, 'rev-parse', 'HEAD'); const refs = git(r.dir, 'for-each-ref');
  assert.notEqual(r.g(['close', 'pkgQ']).status, 0);
  assert.equal(r.g(['run', 'pkgQ']).status, 0); touchApp(r, 9); assert.equal(r.g(['close', 'pkgQ']).status, 3);
  touchApp(r); assert.equal(r.g(['run', 'pkgQ']).status, 0); assert.equal(r.g(['close', 'pkgQ']).status, 0);
  assert.equal(JSON.parse(fs.readFileSync(state(r, 'pkgQ'), 'utf8')).packageStatus, 'CLOSED');
  assert.equal(git(r.dir, 'rev-parse', 'HEAD'), head); assert.equal(git(r.dir, 'for-each-ref'), refs); assert.doesNotMatch(git(r.dir, 'status', '--porcelain', '-uall'), /autodarts-gate/);
  assert.equal(r.g(['run', 'pkgQ']).status, 3);
});

test('R failure policy: fail-fast, then only the affected gates re-run', () => {
  const r = mkRepo(); touchApp(r);
  const f = r.g(['run', 'pkgR'], { GATE_FAIL_TEST: '1' }); assert.equal(f.status, 1); assert.match(out(f), /GATE_FAIL:test/); assert.equal(r.counts()['build-firefox'], undefined);
  const ok = r.g(['run', 'pkgR']); assert.equal(ok.status, 0, out(ok));
  assert.equal(r.counts().compile, 1); assert.equal(r.counts().test, 2); assert.match(ok.stdout, /compile\s+SKIPPED/);
});

test('S fingerprint covers raw bytes (an eol-filter must not hide a content change)', () => {
  const r = mkRepo(); r.edit('.gitattributes', '*.ts text eol=lf\n'); git(r.dir, 'add', '-A'); git(r.dir, 'commit', '-qm', 'attrs');
  touchApp(r); assert.equal(r.g(['run', 'pkgS']).status, 0); assert.equal(r.counts().compile, 1);
  fs.writeFileSync(path.join(r.dir, 'utils/b.ts'), 'export const b = 1;\r\n');
  assert.equal(git(r.dir, 'diff', '--name-only', '--', 'utils/b.ts').trim(), '', 'git itself sees no change');
  assert.equal(r.g(['run', 'pkgS']).status, 0); assert.equal(r.counts().compile, 2);
});

test('T symlinks in the change set are blocked', (t) => {
  const r = mkRepo();
  try { fs.symlinkSync('other.ts', path.join(r.dir, 'utils/link.ts')); } catch { t.skip('symlinks not supported here'); return; }
  const c = r.g(['classify']); assert.equal(c.status, 3); assert.match(c.stdout, /SYMLINK_IN_CHANGESET/);
});

test('U package ids cannot traverse or hide (".", "..", leading dot, slash, leading dash)', () => {
  const r = mkRepo(); touchApp(r);
  for (const bad of ['..', '.', '.hidden', 'a/b', '-x']) { const x = r.g(['run', bad]); assert.equal(x.status, 2, `${bad}: ${out(x)}`); }
  assert.equal(r.g(['status', '..']).status, 2); assert.equal(fs.existsSync(path.join(r.dir, '.git/autodarts-gate')), false);
});

test('V state paths that resolve outside the git directory are refused before anything is written', (t) => {
  const outside = path.join(BASE, `outside${++seq}`); fs.mkdirSync(outside);
  const a = mkRepo(); touchApp(a);
  try { fs.symlinkSync(outside, path.join(a.dir, '.git/autodarts-gate')); } catch { t.skip('symlinks not supported here'); return; }
  const ra = a.g(['run', 'pkgV']); assert.equal(ra.status, 4, out(ra)); assert.deepEqual(fs.readdirSync(outside), []);
  const b = mkRepo(); touchApp(b); assert.equal(b.g(['run', 'pkgV']).status, 0);
  const logs = path.join(b.dir, '.git/autodarts-gate/logs'); fs.rmSync(logs, { recursive: true }); fs.symlinkSync(outside, logs);
  const rb = b.g(['run', 'pkgV2']); assert.equal(rb.status, 4, out(rb)); assert.deepEqual(fs.readdirSync(outside), []);
});

test('W index flags that hide changes from git diff (assume-unchanged / skip-worktree) are BLOCKED', () => {
  const a = mkRepo(); git(a.dir, 'update-index', '--assume-unchanged', 'utils/core.ts'); a.edit('utils/core.ts', 'export const hidden = 1;\n');
  assert.equal(git(a.dir, 'status', '--porcelain').trim(), '', 'git itself shows nothing');
  const ca = a.g(['classify']); assert.equal(ca.status, 3); assert.match(ca.stdout, /HIDDEN_INDEX_FLAG.*utils\/core\.ts/);
  const b = mkRepo(); git(b.dir, 'update-index', '--skip-worktree', 'utils/other.ts'); touchApp(b);
  const cb = b.g(['classify']); assert.equal(cb.status, 3); assert.match(cb.stdout, /HIDDEN_INDEX_FLAG.*utils\/other\.ts/);
});

test('X changing the gatekeeper itself requires the tooling tests', () => {
  const r = mkRepo(); fs.appendFileSync(path.join(r.dir, 'scripts/gate.mjs'), '\n// touched\n');
  const c = r.g(['classify']); assert.equal(c.status, 0, out(c)); assert.match(c.stdout, /REQUIRED GATES: diffcheck, syntax, tooling$/m);
});

test('X2 every tooling input (gate, core-guard, git hooks, S0 selector and the tooling tests) requires the tooling gate, not just syntax', () => {
  for (const f of ['scripts/gate.config.json', 'scripts/core-guard.mjs', 'scripts/githooks/pre-push', 'scripts/test-related.mjs']) {
    const r = mkRepo(); r.edit(f, f.endsWith('.json') ? fs.readFileSync(path.join(r.dir, f), 'utf8') : '// tooling\n');
    if (f.endsWith('.json')) fs.appendFileSync(path.join(r.dir, f), '\n');
    const c = r.g(['classify']); assert.equal(c.status, 0, `${f}: ${out(c)}`); assert.match(c.stdout, /REQUIRED GATES: diffcheck, syntax, tooling$/m, f);
  }
  for (const f of ['tests/gate.test.mjs', 'tests/core-guard.test.mjs', 'tests/test-related.test.mjs']) {
    const r = mkRepo(); r.edit(f, '// tooling test\n');
    const c = r.g(['classify']); assert.equal(c.status, 0, `${f}: ${out(c)}`); assert.match(c.stdout, /REQUIRED GATES: diffcheck, compile, test, tooling$/m, f);
  }
  const p = mkRepo(); p.edit('scripts/preview.mjs', '// not a gate input\n');
  const pc = p.g(['classify']); assert.equal(pc.status, 0, out(pc)); assert.doesNotMatch(pc.stdout, /REQUIRED GATES:.*tooling/);
  const b = mkRepo(); b.edit('package.json', '{"name":"t","version":"1.0.1"}\n');
  const bc = b.g(['classify']); assert.equal(bc.status, 0, out(bc)); assert.match(bc.stdout, /REQUIRED GATES:.*\btooling\b/);
});

test('Y --force never bypasses a guard', () => {
  const r = mkRepo(); r.edit('utils/core.ts', 'export const x = 1;\n');
  const f = r.g(['run', 'pkgY', '--force']); assert.equal(f.status, 3, out(f)); assert.equal(r.ran(), false);
});

test('Z the module can be imported from stdin without crashing or running the CLI', () => {
  const r = mkRepo(); const url = pathToFileURL(path.join(r.dir, 'scripts/gate.mjs')).href;
  const x = spawnSync(process.execPath, ['--input-type=module', '-'], { cwd: r.dir, env: baseEnv, encoding: 'utf8', input: `const m = await import(${JSON.stringify(url)}); console.log(typeof m.main);\n` });
  assert.equal(x.status, 0, x.stderr); assert.match(x.stdout, /function/);
});
