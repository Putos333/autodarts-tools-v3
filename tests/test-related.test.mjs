// Tooling-Tests für scripts/test-related.mjs (S0-Selektor). Jeder Test arbeitet in einem eigenen Wegwerf-Verzeichnis unter
// os.tmpdir() (TEST_RELATED_ROOT); das echte Projekt wird nur gelesen (package.json, Testliste).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { fileURLToPath } from 'node:url';

import { classifyTest, NO_MATCH_HINT, parseHookPayload, selectTests, TOOLING_TESTS } from '../scripts/test-related.mjs';

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(PROJECT, 'scripts/test-related.mjs');
const BASE = fs.mkdtempSync(path.join(os.tmpdir(), 'test-related-'));
after(() => fs.rmSync(BASE, { recursive: true, force: true }));

let seq = 0;
function mkRoot(files) {
  const dir = path.join(BASE, `r${++seq}`);
  for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true }); fs.writeFileSync(path.join(dir, f), c); }
  return dir;
}
const cli = (dir, args, input = '') => spawnSync(process.execPath, [SCRIPT, ...args], {
  cwd: dir, encoding: 'utf8', input, env: { ...process.env, TEST_RELATED_ROOT: dir },
});
const sel = (dir, ...changed) => selectTests(dir, changed).tests;

test('direct and transitive imports select the tests that reach the changed file', () => {
  const dir = mkRoot({
    'utils/leaf.ts': 'export const leaf = 1;\n',
    'utils/mid.ts': "import { leaf } from './leaf';\nexport const mid = leaf;\n",
    'utils/top.ts': "import { mid } from '@/utils/mid';\nexport const top = mid;\n",
    'tests/direct.test.ts': "import { leaf } from '../utils/leaf';\n",
    'tests/chain.test.ts': "import { top } from '~/utils/top';\n",
    'tests/dynamic.test.ts': "const m = await import('../utils/mid');\n",
  });
  assert.deepEqual(sel(dir, 'utils/leaf.ts'), ['tests/chain.test.ts', 'tests/direct.test.ts', 'tests/dynamic.test.ts']);
  assert.deepEqual(sel(dir, 'utils/top.ts'), ['tests/chain.test.ts']);
});

test('an unrelated source file selects no unrelated test', () => {
  const dir = mkRoot({
    'utils/used.ts': 'export const used = 1;\n',
    'utils/lonely.ts': 'export const lonely = 1;\n',
    'tests/used.test.ts': "import { used } from '../utils/used';\n",
  });
  assert.deepEqual(sel(dir, 'utils/lonely.ts'), []);
});

test('a source-text contract test is selected by path mention, but not by a longer name', () => {
  const dir = mkRoot({
    'components/Panel.vue': '<template><div/></template>\n',
    'components/Panel-old.vue': '<template><div/></template>\n',
    'tests/lifecycle-contracts.test.mjs': "const p = 'components/Panel.vue';\n",
    'tests/other.test.mjs': "const p = 'components/Panel-old.vue';\n",
  });
  assert.deepEqual(sel(dir, 'components/Panel.vue'), ['tests/lifecycle-contracts.test.mjs']);
  assert.deepEqual(sel(dir, 'components/Panel-old.vue'), ['tests/other.test.mjs']);
});

test('Vue template tags (PascalCase and kebab-case) and composable auto-imports are followed', () => {
  const dir = mkRoot({
    'components/ChildCard.vue': '<template><div/></template>\n',
    'components/Parent.vue': '<template><ChildCard /></template>\n',
    'components/Sibling.vue': '<template><child-card></child-card></template>\n',
    'components/Unrelated.vue': '<template><div>ChildCard</div></template>\n',
    'composables/useThing.ts': 'export function useThing() { return 1; }\n',
    'components/UsesThing.vue': '<script setup lang="ts">\nconst t = useThing();\n</script>\n<template><div/></template>\n',
    'tests/parent.test.ts': "import P from '../components/Parent.vue';\n",
    'tests/sibling.test.ts': "import S from '../components/Sibling.vue';\n",
    'tests/unrelated.test.ts': "import U from '../components/Unrelated.vue';\n",
    'tests/uses.test.ts': "import U from '../components/UsesThing.vue';\n",
  });
  assert.deepEqual(sel(dir, 'components/ChildCard.vue'), ['tests/parent.test.ts', 'tests/sibling.test.ts']);
  assert.deepEqual(sel(dir, 'composables/useThing.ts'), ['tests/uses.test.ts']);
});

test('--list prints the selection and executes nothing; without --list the tests run', () => {
  const dir = mkRoot({
    'scripts/thing.mjs': 'export const x = 1;\n',
    'tests/gate.test.mjs': "import fs from 'node:fs';\nimport test from 'node:test';\nimport '../scripts/thing.mjs';\ntest('ran', () => { fs.writeFileSync(new URL('../marker', import.meta.url), 'ran'); });\n",
  });
  const listed = cli(dir, ['--list', 'scripts/thing.mjs']);
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(listed.stdout.trim(), 'tests/gate.test.mjs');
  assert.equal(fs.existsSync(path.join(dir, 'marker')), false, '--list must not execute tests');
  const run = cli(dir, ['scripts/thing.mjs']);
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal(fs.existsSync(path.join(dir, 'marker')), true);
});

test('a failing test exits 1 manually and 2 in hook mode, with the failure on stderr', () => {
  const dir = mkRoot({
    'scripts/thing.mjs': 'export const x = 1;\n',
    'tests/gate.test.mjs': "import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport '../scripts/thing.mjs';\ntest('boom', () => { assert.fail('kaputt-marker'); });\n",
  });
  const manual = cli(dir, ['scripts/thing.mjs']);
  assert.equal(manual.status, 1);
  assert.match(manual.stderr, /FEHLGESCHLAGEN/);
  const hook = cli(dir, ['--hook'], JSON.stringify({ tool_input: { file_path: path.join(dir, 'scripts/thing.mjs') } }));
  assert.equal(hook.status, 2);
  assert.match(hook.stderr, /FEHLGESCHLAGEN/);
  assert.match(hook.stderr, /kaputt-marker/);
});

test('zero matches succeeds and says honestly that coverage is unknown', () => {
  const dir = mkRoot({ 'utils/lonely.ts': 'export const lonely = 1;\n', 'tests/a.test.ts': '// nichts\n' });
  const r = cli(dir, ['utils/lonely.ts']);
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), NO_MATCH_HINT(['utils/lonely.ts']));
  assert.match(r.stdout, /Abdeckung prüfen/);
  assert.doesNotMatch(r.stdout, /bestanden|sicher/);
});

test('empty, malformed or unusable hook payloads are a silent no-op (exit 0)', () => {
  const dir = mkRoot({ 'utils/a.ts': 'export const a = 1;\n', 'entrypoints/style.css': 'a{}\n', 'tests/a.test.ts': "import '../utils/a';\n" });
  const payloads = [
    '', '{', 'null', '{}', '{"tool_input":{}}', '{"tool_input":{"file_path":42}}',
    JSON.stringify({ tool_input: { file_path: path.join(dir, 'utils/missing.ts') } }),
    JSON.stringify({ tool_input: { file_path: path.join(dir, 'entrypoints/style.css') } }),
    JSON.stringify({ tool_input: { file_path: '/etc/hostname' } }),
  ];
  for (const p of payloads) {
    const r = cli(dir, ['--hook'], p);
    assert.equal(r.status, 0, `payload ${JSON.stringify(p)}: ${r.stderr}`);
    assert.equal(r.stdout + r.stderr, '', `payload ${JSON.stringify(p)} must be silent`);
  }
  assert.equal(parseHookPayload(JSON.stringify({ tool_input: { path: 'x.ts' } })), 'x.ts');
  assert.equal(parseHookPayload('{'), null);
});

test('tests are classified, and the package.json scripts own every test file exactly once', () => {
  assert.equal(classifyTest('tests/gate.test.mjs'), 'tooling');
  assert.equal(classifyTest('tests/test-related.test.mjs'), 'tooling');
  assert.equal(classifyTest('tests/components/x.component.test.ts'), 'component');
  assert.equal(classifyTest('tests/match-flow.test.ts'), 'node');
  assert.equal(classifyTest('tests/lifecycle-contracts.test.mjs'), 'node');
  assert.equal(classifyTest('tests/support/helper.ts'), null);
  assert.equal(classifyTest('utils/a.ts'), null);

  const all = fs.readdirSync(path.join(PROJECT, 'tests')).filter((f) => /\.test\.(?:ts|mjs)$/.test(f)).map((f) => `tests/${f}`).sort();
  const scripts = JSON.parse(fs.readFileSync(path.join(PROJECT, 'package.json'), 'utf8')).scripts;
  const expand = (cmd) => cmd.split(/\s+/).map((t) => t.replace(/^"|"$/g, '')).filter((t) => t.startsWith('tests/')).flatMap((t) => {
    if (!t.includes('*')) return [t];
    const re = new RegExp(`^${t.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);
    return all.filter((f) => re.test(f));
  });
  const app = expand(scripts.test).sort();
  const tooling = expand(scripts['test:tooling']).sort();
  assert.deepEqual(tooling, [...TOOLING_TESTS].sort(), 'test:tooling must run exactly TOOLING_TESTS');
  assert.deepEqual(app.filter((f) => tooling.includes(f)), [], 'no test file may be owned by both test and test:tooling');
  assert.deepEqual([...app, ...tooling].sort(), all, 'every tests/*.test.{ts,mjs} file must be owned by test or test:tooling');
  assert.equal(scripts['test:all'], 'yarn test && yarn test:tooling');
  assert.equal(scripts['test:related'], 'node scripts/test-related.mjs');
});
