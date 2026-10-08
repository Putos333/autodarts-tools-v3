#!/usr/bin/env node
// S0 - schnelles Feedback: führt nach einer Dateiänderung nur die Tests aus, die diese Datei erreichen können.
//   node scripts/test-related.mjs                    geänderte Dateien aus `git status`
//   node scripts/test-related.mjs <datei...>         explizite Dateien
//   node scripts/test-related.mjs --list <datei...>  ausgewählte Tests nur auflisten, nichts ausführen
//   node scripts/test-related.mjs --hook             Claude-Code-PostToolUse-JSON von stdin lesen
// S0 ersetzt weder das Gate (S1) noch die CI (S2). "Kein Test gefunden" heißt NICHT "sicher".
// Erkannt werden: statische Imports (relativ, @/, ~/, src/, dynamic import(), require()), Pfadnennungen in Tests
// (Quelltext-Verträge), Composable-Auto-Imports (exportierter Name wird verwendet) und Vue-Template-Tags.
// NICHT erkannt: Laufzeitkopplungen (Storage-Keys, Events, WebSocket-Nachrichten, CSS-Klassen) und eigenständige CSS-Dateien.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(SCRIPT), '..');

export const CODE_EXTS = ['.ts', '.vue', '.js', '.mjs'];
export const SCAN_DIRS = ['utils', 'components', 'composables', 'entrypoints', 'src', 'socket', 'scripts', 'tests'];
export const SKIP_DIRS = new Set(['node_modules', '.output', '.wxt', 'graphify-out', 'e2e']);
/** Tooling-Tests (Gatekeeper, Core-Guard, S0-Selektor); `yarn test:tooling` muss exakt diese Dateien ausführen. */
export const TOOLING_TESTS = ['tests/gate.test.mjs', 'tests/core-guard.test.mjs', 'tests/test-related.test.mjs'];
export const NO_MATCH_HINT = (files) => `test-related: kein Test erreicht ${files.join(', ')} — Abdeckung prüfen; Gate läuft vor dem Commit trotzdem voll.`;

const posix = (p) => p.split(path.sep).join('/');
const extOf = (p) => path.posix.extname(p);

/** @returns {'tooling'|'component'|'node'|null} */
export function classifyTest(rel) {
  if (!rel.startsWith('tests/')) return null;
  if (TOOLING_TESTS.includes(rel)) return 'tooling';
  if (/^tests\/components\/.+\.test\.ts$/.test(rel)) return 'component';
  if (/^tests\/[^/]+\.test\.(?:ts|mjs)$/.test(rel)) return 'node';
  return null;
}

function walk(root, dir, out) {
  let entries;
  try { entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(root, rel, out);
    else if (e.isFile() && CODE_EXTS.includes(extOf(e.name))) out.push(rel);
  }
}

export function scanFiles(root) {
  const out = [];
  for (const d of SCAN_DIRS) walk(root, d, out);
  return out.sort();
}

const IMPORT_RE = /(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveImport(from, spec, fileSet) {
  let base;
  if (spec.startsWith('@/') || spec.startsWith('~/')) base = spec.slice(2);
  else if (spec.startsWith('src/')) base = spec;
  else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null;
  for (const e of ['', ...CODE_EXTS]) if (fileSet.has(base + e)) return base + e;
  if (base.endsWith('.js') && fileSet.has(`${base.slice(0, -3)}.ts`)) return `${base.slice(0, -3)}.ts`;
  for (const e of CODE_EXTS) if (fileSet.has(`${base}/index${e}`)) return `${base}/index${e}`;
  return null;
}

const scriptOf = (rel, text) => (rel.endsWith('.vue') ? [...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n') : text);
const templateOf = (text) => [...text.matchAll(/<template[^>]*>([\s\S]*)<\/template>/g)].map((m) => m[1]).join('\n');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const pascal = (s) => s.replace(/(?:^|[-_.])(\w)/g, (_, c) => c.toUpperCase());
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();

/** Rückwärtskanten: Datei -> Menge der Dateien, die von ihr abhängen (Import, Auto-Import, Template-Tag). */
export function buildGraph(root) {
  const files = scanFiles(root);
  const fileSet = new Set(files);
  const text = new Map();
  for (const f of files) { try { text.set(f, fs.readFileSync(path.join(root, f), 'utf8')); } catch { text.set(f, ''); } }
  const rev = new Map();
  const link = (dep, user) => { if (dep === user) return; if (!rev.has(dep)) rev.set(dep, new Set()); rev.get(dep).add(user); };

  // A. statische Imports
  for (const f of files) {
    for (const m of scriptOf(f, text.get(f)).matchAll(IMPORT_RE)) {
      const r = resolveImport(f, m[1] || m[2] || m[3] || m[4], fileSet);
      if (r) link(r, f);
    }
  }
  // C1. Composable-Auto-Imports: exportierter Name wird in einer anderen gescannten Datei verwendet
  for (const f of files.filter((p) => p.startsWith('composables/'))) {
    const names = new Set();
    for (const m of text.get(f).matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    if (!names.size) continue;
    const re = new RegExp(`(?<![\\w$.])(?:${[...names].map((n) => escapeRe(n)).join('|')})(?![\\w$])`);
    for (const other of files) if (other !== f && re.test(text.get(other))) link(f, other);
  }
  // C2. Vue-Komponenten im Template: <PascalCase ...> oder <kebab-case ...>
  const vue = files.filter((p) => p.endsWith('.vue'));
  for (const f of vue) {
    const base = path.posix.basename(f, '.vue');
    if (base === 'index') continue;
    const tag = new RegExp(`<(?:${escapeRe(pascal(base))}|${escapeRe(kebab(base))})(?=[\\s/>])`);
    for (const other of vue) if (other !== f && tag.test(templateOf(text.get(other)))) link(f, other);
  }
  return { files, text, rev };
}

/** B. Pfadnennung in Tests (Quelltext-Vertragstests): mit oder ohne Endung, ohne Teilwort-Treffer. */
function mentions(content, rel) {
  const noExt = rel.slice(0, rel.length - extOf(rel).length);
  return new RegExp(`(?<![\\w-])(?:${escapeRe(rel)}|${escapeRe(noExt)})(?![\\w-])`).test(content);
}

/**
 * @param {string} root Repository-Wurzel
 * @param {string[]} changed Repo-relative Pfade (POSIX)
 * @returns {{tests: string[], byKind: Record<string,string[]>}}
 */
export function selectTests(root, changed) {
  const { files, text, rev } = buildGraph(root);
  const tests = files.filter((f) => classifyTest(f));
  const reached = new Set(changed);
  const stack = [...changed];
  while (stack.length) for (const u of rev.get(stack.pop()) || []) if (!reached.has(u)) { reached.add(u); stack.push(u); }
  const selected = new Set(tests.filter((t) => reached.has(t)));
  for (const t of tests) if (!selected.has(t) && changed.some((c) => mentions(text.get(t), c))) selected.add(t);
  const list = [...selected].sort();
  const byKind = { node: [], tooling: [], component: [] };
  for (const t of list) byKind[classifyTest(t)].push(t);
  return { tests: list, byKind };
}

/** Nur existierende, unterstützte Dateien innerhalb des Repositorys; Rückgabe repo-relativ. */
export function normalizeChanged(root, inputs, cwd = process.cwd()) {
  const out = new Set();
  for (const p of inputs) {
    if (typeof p !== 'string' || !p) continue;
    const rel = posix(path.relative(root, path.resolve(cwd, p)));
    if (!rel || rel.startsWith('..') || path.posix.isAbsolute(rel)) continue;
    if (!CODE_EXTS.includes(extOf(rel))) continue;
    try { if (!fs.statSync(path.join(root, rel)).isFile()) continue; } catch { continue; }
    out.add(rel);
  }
  return [...out].sort();
}

/** `git status --porcelain --untracked-files=all`; bei Umbenennungen zählt die Zielseite. */
export function gitChanged(root) {
  const r = spawnSync('git', ['status', '--porcelain', '--untracked-files=all', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 });
  if (r.status !== 0) return [];
  const parts = r.stdout.split('\0').filter(Boolean);
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const xy = parts[i].slice(0, 2);
    out.push(parts[i].slice(3));
    if (xy[0] === 'R' || xy[0] === 'C') i += 1; // nächster Eintrag ist die Quelle der Umbenennung
  }
  return out;
}

/** Hook-Payload: leer, kaputt oder ohne Pfad ergibt null (vorhersagbarer No-op). */
export function parseHookPayload(raw) {
  try {
    const payload = JSON.parse(raw);
    const p = payload?.tool_input?.file_path ?? payload?.tool_input?.path;
    return typeof p === 'string' && p ? p : null;
  } catch { return null; }
}

function commandsFor(root, byKind) {
  // NODE_TEST_CONTEXT stammt von einem äußeren `node --test`-Lauf und würde den inneren Lauf zum stummen Kindprozess machen.
  const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' };
  delete env.NODE_TEST_CONTEXT;
  const cmds = [];
  if (byKind.node.length) cmds.push({ label: 'node', cmd: process.execPath, args: ['--import', 'tsx', '--test', '--test-reporter=spec', ...byKind.node], env });
  if (byKind.tooling.length) cmds.push({ label: 'tooling', cmd: process.execPath, args: ['--test', '--test-reporter=spec', ...byKind.tooling], env });
  if (byKind.component.length) cmds.push({ label: 'component', cmd: path.join(root, 'node_modules/.bin/vitest'), args: ['run', ...byKind.component], env });
  return cmds;
}

export function main(argv, { root = process.env.TEST_RELATED_ROOT || REPO_ROOT, stdin = () => fs.readFileSync(0, 'utf8') } = {}) {
  const list = argv.includes('--list');
  const hook = argv.includes('--hook');
  const explicit = argv.filter((a) => !a.startsWith('--'));
  let changed;
  if (hook) {
    let raw = '';
    try { raw = stdin(); } catch { /* kein stdin */ }
    const p = parseHookPayload(raw);
    changed = p ? normalizeChanged(root, [p]) : [];
    if (!changed.length) return 0;
  } else if (explicit.length) changed = normalizeChanged(root, explicit);
  else changed = normalizeChanged(root, gitChanged(root), root);
  if (!changed.length) { console.log('test-related: keine unterstützten geänderten Dateien (.ts/.vue/.js/.mjs).'); return 0; }

  const { tests, byKind } = selectTests(root, changed);
  if (!tests.length) { console.log(NO_MATCH_HINT(changed)); return 0; }
  if (list) { console.log(tests.join('\n')); return 0; }

  console.log(`test-related: ${tests.length} Test(s) für ${changed.join(', ')}`);
  for (const c of commandsFor(root, byKind)) {
    const r = spawnSync(c.cmd, c.args, { cwd: root, env: c.env, encoding: 'utf8', maxBuffer: 1 << 28 });
    if (r.status !== 0) {
      const body = `${r.stdout || ''}${r.stderr || ''}`.trim().split('\n').slice(-60).join('\n');
      const msg = `test-related: FEHLGESCHLAGEN (${c.label}) nach Änderung an ${changed.join(', ')}\n${body}\n`;
      if (hook) process.stderr.write(msg); else console.error(msg);
      return hook ? 2 : 1;
    }
  }
  console.log('test-related: bestanden (S0 ist nur Feedback; vor dem Commit läuft das Gate).');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
