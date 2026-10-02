#!/usr/bin/env node
// AUTODARTS ELITE test gatekeeper (G2) - minimal and fail-closed.
//   node scripts/gate.mjs classify
//   node scripts/gate.mjs status [<package-id>]
//   node scripts/gate.mjs run <package-id> [--force]
//   node scripts/gate.mjs close <package-id>
// Git is used read-only through an allowlist (no add/commit/tag/push/checkout/reset/clean/stash).
// The only things written are the gatekeeper state under <git-dir>/autodarts-gate/ and the (ignored)
// build output of the gate commands themselves. Exit: 0 ok, 1 gate FAIL, 2 usage/config, 3 BLOCKED, 4 UNKNOWN.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), '..');
const CONFIG_PATH = path.join(path.dirname(SCRIPT), 'gate.config.json');
const EXIT = { OK: 0, FAIL: 1, USAGE: 2, BLOCKED: 3, UNKNOWN: 4 };
const PKG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const VALID_PKG = ['OPEN', 'BLOCKED', 'READY_TO_CLOSE', 'CLOSED'];

class GateError extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const sha256 = (d) => createHash('sha256').update(d).digest('hex');
const now = () => new Date().toISOString();
const abs = (p) => path.join(ROOT, p);
const say = (s = '') => console.log(s);
const canon = (o) => JSON.stringify(o, (_, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));

// ---------- glob / config ----------
function globRe(g) {
  let r = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') { if (g[i + 2] === '/') { r += '(?:.*/)?'; i += 2; } else { r += '.*'; i += 1; } } else r += '[^/]*';
    } else if (c === '?') r += '[^/]'; else r += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${r}$`);
}
const compileGlobs = (l) => l.map(globRe);
const matchAny = (res, p) => res.some((re) => re.test(p));

export function loadConfig() {
  let raw; let c;
  try { raw = fs.readFileSync(CONFIG_PATH); } catch { throw new GateError(EXIT.USAGE, `cannot read ${CONFIG_PATH}`); }
  try { c = JSON.parse(raw); } catch { throw new GateError(EXIT.USAGE, 'gate.config.json is not valid JSON'); }
  validateConfig(c);
  try {
    c._sha = sha256(raw);
    c._impl = sha256(fs.readFileSync(SCRIPT));
    c._art = c.allowedOperatorArtifacts.map((a) => new RegExp(a.regex));
    c._rules = c.classRules.map((r) => ({ cls: r.class, dynamic: r.dynamic, res: r.globs ? compileGlobs(r.globs) : [] }));
    c._pathGates = c.pathGates.map((g) => ({ re: globRe(g.glob), add: g.add }));
    c._sets = Object.fromEntries(Object.entries(c.inputSets).map(([k, v]) => [k, { inc: compileGlobs(v.include), exc: compileGlobs(v.exclude) }]));
  } catch (e) { throw new GateError(EXIT.USAGE, `invalid gate.config.json: ${e.message}`); }
  return c;
}

function validateConfig(c) {
  const bad = (m) => { throw new GateError(EXIT.USAGE, `invalid gate.config.json: ${m}`); };
  const isStrArr = (a) => Array.isArray(a) && a.every((x) => typeof x === 'string');
  const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);
  if (!isObj(c)) bad('not an object');
  if (c.configVersion !== 1 || c.gateSchemaVersion !== 1) bad('unsupported config version');
  for (const k of ['allowedOperatorArtifacts', 'classRules', 'pathGates']) if (!Array.isArray(c[k])) bad(`${k} must be an array`);
  for (const k of ['matrix', 'inputSets', 'gates', 'protectedCore', 'nodePolicy']) if (!isObj(c[k])) bad(`${k} must be an object`);
  if (!isStrArr(c.gateOrder) || !isStrArr(c.runtimeArtifactDirs) || !isStrArr(c.forbiddenTrackedDirs)) bad('gateOrder/runtimeArtifactDirs/forbiddenTrackedDirs must be string arrays');
  if (!Number.isInteger(c.logRetention) || c.logRetention < 1) bad('logRetention must be a positive integer');
  const pc = c.protectedCore;
  if (!isStrArr(pc.files) || !pc.files.length || !isStrArr(pc.tests) || !isStrArr(pc.scanExtensions) || !isStrArr(pc.scanExcludePrefixes) || !Number.isInteger(pc.minSymbolLength) || typeof pc.lifecycleTest !== 'string') bad('protectedCore shape');
  if (typeof c.nodePolicy.source !== 'string') bad('nodePolicy.source');
  for (const a of c.allowedOperatorArtifacts) if (!isObj(a) || typeof a.regex !== 'string' || a.status !== '??') bad('allowedOperatorArtifacts entry (only status "??" is supported)');
  for (const r of c.classRules) if (!isObj(r) || typeof r.class !== 'string' || !(r.dynamic === 'lifecycle' || isStrArr(r.globs))) bad('classRules entry');
  for (const g of c.pathGates) if (!isObj(g) || typeof g.glob !== 'string' || !isStrArr(g.add)) bad('pathGates entry');
  for (const [n, s] of Object.entries(c.inputSets)) if (!isObj(s) || !isStrArr(s.include) || !isStrArr(s.exclude)) bad(`inputSet ${n}`);
  for (const [n, g] of Object.entries(c.gates)) {
    if (!isObj(g) || !isStrArr(g.command) || !g.command.length || !Number.isInteger(g.version) || !['light', 'code'].includes(g.kind) || typeof g.cache !== 'boolean') bad(`gate ${n}`);
    if (g.kind === 'code' && !c.inputSets[g.inputSet]) bad(`gate ${n}: unknown inputSet`);
  }
  const known = (g, where) => { if (!c.gates[g]) bad(`${where} references unknown gate ${g}`); if (!c.gateOrder.includes(g)) bad(`${where} references gate ${g} that is missing from gateOrder (it would never run)`); };
  c.gateOrder.forEach((g) => known(g, 'gateOrder'));
  for (const [cls, list] of Object.entries(c.matrix)) { if (!isStrArr(list)) bad(`matrix ${cls}`); list.forEach((g) => known(g, `matrix ${cls}`)); }
  c.pathGates.forEach((g) => g.add.forEach((x) => known(x, 'pathGates')));
}

// ---------- git (read-only allowlist) ----------
const GIT_OK = new Set(['rev-parse', 'status', 'ls-files', 'hash-object', 'diff', 'merge-base']);
export function git(args, { input, allowFail = false } = {}) {
  if (!GIT_OK.has(args[0])) throw new GateError(EXIT.USAGE, `git ${args[0]} is not permitted by the gatekeeper`);
  if (args.some((a) => a === '-w' || a.startsWith('--write') || a.startsWith('--output'))) throw new GateError(EXIT.USAGE, 'write option not permitted');
  const r = spawnSync('git', args, { cwd: ROOT, input, encoding: 'utf8', maxBuffer: 1 << 29, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' } });
  if (r.error) throw new GateError(EXIT.UNKNOWN, `git failed: ${r.error.message}`);
  if (r.status !== 0 && !allowFail) throw new GateError(EXIT.UNKNOWN, `git ${args.join(' ')} failed: ${r.stderr.trim()}`);
  return allowFail ? r : r.stdout;
}
const gz = (args) => git(args).split('\0').filter(Boolean);

// ---------- tool guards ----------
let yarnMemo;
const yarnVersion = () => {
  if (yarnMemo === undefined) { const r = spawnSync('yarn', ['--version'], { cwd: ROOT, encoding: 'utf8' }); yarnMemo = r.status === 0 ? r.stdout.trim() : null; }
  return yarnMemo;
};
const toolVersions = () => ({ node: process.version, yarn: yarnVersion() });
const ver = (s) => { const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(s || '').trim()); return m ? m.slice(1).map(Number) : null; };

export function codeToolGuard(cfg) {
  const out = { blocked: false, lines: [] };
  const nv = abs(cfg.nodePolicy.source);
  if (!fs.existsSync(nv)) { out.blocked = true; out.lines.push(`${cfg.nodePolicy.source} missing - BLOCKED`); } else {
    const expS = fs.readFileSync(nv, 'utf8').trim(); const exp = ver(expS); const act = ver(process.version);
    if (!exp) { out.blocked = true; out.lines.push(`${cfg.nodePolicy.source} unparsable (${expS}) - BLOCKED`); } else if (exp[0] !== act[0]) {
      out.blocked = true; out.lines.push(`EXPECTED NODE ${expS}`, `ACTUAL NODE ${process.version}`, 'BLOCKED (node major mismatch)');
    } else if (exp[1] !== act[1] || exp[2] !== act[2]) out.lines.push(`WARN: expected node ${expS}, actual ${process.version}`);
  }
  let pm = null;
  try { pm = /^yarn@(\d+\.\d+\.\d+)/.exec(JSON.parse(fs.readFileSync(abs('package.json'), 'utf8')).packageManager || ''); } catch { /* no package.json */ }
  const yv = yarnVersion();
  if (yv === null) { out.blocked = true; out.lines.push('yarn not found - BLOCKED'); } else if (pm) {
    const a = ver(yv); const e = ver(pm[1]);
    if (a[0] !== e[0]) { out.blocked = true; out.lines.push(`EXPECTED YARN ${pm[1]}`, `ACTUAL YARN ${yv}`, 'BLOCKED (yarn major mismatch)'); } else if (yv !== pm[1]) out.lines.push(`WARN: expected yarn ${pm[1]}, actual ${yv}`);
  }
  return out;
}

// ---------- protected core: tiers ----------
const EXTS = ['', '.ts', '.vue', '.js', '.mjs'];
function resolveImport(from, spec, fileSet) {
  let base;
  if (spec.startsWith('@/')) base = spec.slice(2);
  else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null;
  for (const e of EXTS) if (fileSet.has(base + e)) return base + e;
  if (base.endsWith('.js') && fileSet.has(`${base.slice(0, -3)}.ts`)) return `${base.slice(0, -3)}.ts`;
  for (const e of ['.ts', '.vue', '.js', '.mjs']) if (fileSet.has(`${base}/index${e}`)) return `${base}/index${e}`;
  return null;
}
const IMPORT_RE = /(?:import|export)\s[^'";]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g;
const isTest = (p) => p.startsWith('tests/');

export function computeTiers(cfg, files) {
  const pc = cfg.protectedCore; const tier0 = new Set([...pc.files, ...pc.tests]); const core = new Set(pc.files);
  const fileSet = new Set(files);
  const regular = (p) => { try { return fs.lstatSync(abs(p)).isFile(); } catch { return false; } };
  const readText = (p) => { try { return fs.readFileSync(abs(p), 'utf8'); } catch (e) { throw new GateError(EXIT.UNKNOWN, `cannot read ${p} for the importer scan: ${e.message}`); } };
  const scan = files.filter((p) => pc.scanExtensions.some((e) => p.endsWith(e)) && !pc.scanExcludePrefixes.some((x) => p.startsWith(x)) && regular(p));
  const text = new Map(scan.map((p) => [p, readText(p)]));
  const code = (p) => (p.endsWith('.vue') ? [...text.get(p).matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n') : text.get(p));
  const rev = new Map(); const direct = new Set();
  for (const p of scan) {
    for (const m of code(p).matchAll(IMPORT_RE)) {
      const r = resolveImport(p, m[1] || m[2] || m[3] || m[4], fileSet);
      if (!r) continue;
      if (!rev.has(r)) rev.set(r, new Set());
      rev.get(r).add(p);
      if (core.has(r) && !core.has(p)) direct.add(p);
    }
  }
  const names = new Set();
  for (const c of core) {
    if (!text.has(c)) continue;
    const t = text.get(c);
    for (const m of t.matchAll(/export\s+(?:declare\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|enum|interface|type)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    for (const m of t.matchAll(/export\s*\{([^}]*)\}/g)) for (const part of m[1].split(',')) { const n = part.trim().split(/\s+as\s+/).pop().trim(); if (n) names.add(n); }
  }
  const sym = [...names].filter((n) => n.length >= pc.minSymbolLength).map((n) => n.replace(/[$]/g, '\\$&'));
  const symRe = sym.length ? new RegExp(`\\b(?:${sym.join('|')})\\b`) : null;
  const bySymbol = new Set();
  if (symRe) for (const p of scan) if (!core.has(p) && !direct.has(p) && symRe.test(text.get(p))) bySymbol.add(p);
  const tier1 = new Set([...direct, ...bySymbol].filter((p) => !tier0.has(p)));
  const seen = new Set([...core, ...tier1]); const stack = [...seen];
  while (stack.length) for (const p of rev.get(stack.pop()) || []) if (!seen.has(p)) { seen.add(p); stack.push(p); }
  const tier2 = new Set([...seen].filter((p) => !core.has(p) && !tier1.has(p) && !tier0.has(p)));
  const t1 = [...tier1];
  return {
    tier0, tier2, tier1NonTest: new Set(t1.filter((p) => !isTest(p))), tier1Tests: new Set(t1.filter(isTest)),
    stats: { core: core.size, tier0: tier0.size, tier1: tier1.size, static: direct.size, bySymbol: bySymbol.size, tier2: tier2.size, scanned: scan.length },
  };
}

function lifecycleSet(cfg, fileSet) {
  const out = new Set(); const f = abs(cfg.protectedCore.lifecycleTest);
  if (!fs.existsSync(f)) return out;
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/['"`]([A-Za-z0-9_.@\-/]+\.(?:ts|vue|js|mjs))['"`]/g)) if (m[1].includes('/') && fileSet.has(m[1])) out.add(m[1]);
  return out;
}

export function classifyPath(cfg, p, tiers, lifecycle) {
  if (cfg.runtimeArtifactDirs.some((d) => p.startsWith(d))) return { cls: 'UNKNOWN', flags: ['runtime-artifact'] };
  const flags = []; let cls;
  if (tiers.tier0.has(p)) { cls = 'SCORING_RELATED'; flags.push('protected'); } else if (tiers.tier1NonTest.has(p)) { cls = 'SCORING_RELATED'; flags.push('approval'); } else if (tiers.tier1Tests.has(p)) { cls = 'SCORING_RELATED'; flags.push('review'); } else {
    for (const r of cfg._rules) if (r.dynamic === 'lifecycle' ? lifecycle.has(p) : matchAny(r.res, p)) { cls = r.cls; break; }
    if (tiers.tier2.has(p)) flags.push('review');
  }
  return { cls: cls || 'UNKNOWN', flags };
}

// ---------- worktree / change evaluation ----------
const SHA_RE = /^[0-9a-f]{40}$/;
export function evaluate(cfg, baseline) {
  if (!SHA_RE.test(baseline)) throw new GateError(EXIT.UNKNOWN, 'baseline is not a 40-character commit id');
  const tracked = gz(['ls-files', '-z']);
  const untrackedAll = gz(['ls-files', '-z', '-o', '--exclude-standard']);
  const st = gz(['status', '--porcelain=v1', '-z', '-uall', '--no-renames']).map((e) => ({ xy: e.slice(0, 2), path: e.slice(3) }));
  const isArt = (p) => cfg._art.some((re) => re.test(p));
  const blockers = [];
  const block = (code, msg, exit = EXIT.BLOCKED) => blockers.push({ code, msg, exit });
  for (const p of [...tracked, ...untrackedAll]) if (/[\r\n]/.test(p)) block('UNSUPPORTED_PATH', JSON.stringify(p));
  for (const p of tracked) if (cfg.forbiddenTrackedDirs.some((d) => p.startsWith(d))) block('FORBIDDEN_TRACKED', p);
  // assume-unchanged (lowercase tag) and skip-worktree (S) hide worktree changes from `git diff`: they would bypass every guard
  for (const e of gz(['ls-files', '-v', '-z'])) if (/^[a-zS] /.test(e)) block('HIDDEN_INDEX_FLAG', `${e.slice(2)} (assume-unchanged/skip-worktree hides changes from git diff)`);
  for (const s of st) {
    const [x, y] = s.xy;
    if (isArt(s.path) && s.xy !== '??') block('OPERATOR_ARTIFACT_NOT_UNTRACKED', `${s.xy} ${s.path}`);
    if (x === 'U' || y === 'U' || s.xy === 'AA' || s.xy === 'DD') block('UNMERGED', `${s.xy} ${s.path}`);
    else if (!' ?!'.includes(x) && y !== ' ') block('PARTIALLY_STAGED', `${s.xy} ${s.path}`);
  }
  const allowed = new Set(untrackedAll.filter(isArt));
  const untracked = untrackedAll.filter((p) => !allowed.has(p));
  const files = [...tracked, ...untracked];
  const staged = new Set(st.filter((s) => !' ?!'.includes(s.xy[0])).map((s) => s.path));
  const diff = git(['diff', '--name-status', '-z', '--no-renames', baseline]).split('\0').filter(Boolean);
  const changes = [];
  for (let i = 0; i + 1 < diff.length; i += 2) changes.push({ status: diff[i], path: diff[i + 1] });
  for (const p of untracked) changes.push({ status: '??', path: p });
  const tiers = computeTiers(cfg, files);
  const lifecycle = lifecycleSet(cfg, new Set(files));
  for (const c of changes) { Object.assign(c, classifyPath(cfg, c.path, tiers, lifecycle)); c.staged = staged.has(c.path); }
  for (const c of changes) {
    let link = false;
    try { link = fs.lstatSync(abs(c.path)).isSymbolicLink(); } catch { /* deleted */ }
    if (link) block('SYMLINK_IN_CHANGESET', `${c.path} (symlinks are not supported by the importer scan and the fingerprint)`);
  }
  const flagged = (f) => changes.filter((c) => c.flags.includes(f)).map((c) => c.path);
  const report = (f, code, msg) => { const l = flagged(f); if (l.length) block(code, `${msg}: ${l.join(', ')}`); };
  report('protected', 'PROTECTED_CORE_CHANGED', 'protected scoring core changed - explicit human approval required');
  report('approval', 'APPROVAL_REQUIRED', 'direct user of the protected core changed - explicit human approval required');
  report('runtime-artifact', 'RUNTIME_ARTIFACT_CHANGED', 'runtime artifact changed');
  const unknown = changes.filter((c) => c.cls === 'UNKNOWN' && !c.flags.includes('runtime-artifact')).map((c) => c.path);
  if (unknown.length) block('UNKNOWN_CLASS', `unclassifiable paths: ${unknown.join(', ')}`, EXIT.UNKNOWN);
  const classes = new Set(changes.map((c) => c.cls));
  let pkgClass = 'MIXED';
  if (!classes.size) pkgClass = 'NONE'; else if (classes.has('UNKNOWN')) pkgClass = 'UNKNOWN'; else if (classes.size === 1) [pkgClass] = [...classes];
  const req = new Set();
  if (pkgClass !== 'UNKNOWN') {
    for (const c of classes) for (const g of cfg.matrix[c] || []) req.add(g);
    for (const pg of cfg._pathGates) if (changes.some((c) => pg.re.test(c.path))) for (const g of pg.add) req.add(g);
  }
  return {
    baseline, changes, pkgClass, files, blockers, stats: tiers.stats,
    flags: new Set(changes.flatMap((c) => c.flags)), gates: cfg.gateOrder.filter((g) => req.has(g)),
  };
}
const blockExit = (snap) => (!snap.blockers.length ? EXIT.OK : snap.blockers.some((b) => b.exit === EXIT.UNKNOWN) ? EXIT.UNKNOWN : EXIT.BLOCKED);

// ---------- fingerprints / records ----------
function hashFiles(paths) {
  const out = new Map(); const ex = []; const mode = new Map();
  for (const p of paths) {
    let s;
    try { s = fs.lstatSync(abs(p)); } catch { out.set(p, 'DELETED'); continue; }
    if (s.isSymbolicLink()) out.set(p, `L:${fs.readlinkSync(abs(p))}`); else if (s.isFile()) { ex.push(p); mode.set(p, s.mode & 0o111 ? 'x' : '-'); } else out.set(p, 'NOTFILE');
  }
  if (ex.length) {
    // --no-filters: hash the raw bytes (attribute/eol filters must not hide a content change)
    const lines = git(['hash-object', '--no-filters', '--stdin-paths'], { input: `${ex.join('\n')}\n` }).trim().split('\n');
    if (lines.length !== ex.length) throw new GateError(EXIT.UNKNOWN, 'hash-object output mismatch');
    ex.forEach((p, i) => out.set(p, `${lines[i]}:${mode.get(p)}`));
  }
  return out;
}
export function fingerprint(cfg, name, snap, tools) {
  const gate = cfg.gates[name]; const h = createHash('sha256');
  const put = (s) => h.update(`${s}\n`);
  ['gate-fp/1', cfg.gateSchemaVersion, name, gate.version, gate.command.join('\0'), `node=${tools.node}`, `yarn=${tools.yarn}`, `cfg=${cfg._sha}`, `impl=${cfg._impl}`].forEach(put);
  let paths;
  if (gate.kind === 'light') paths = snap.changes.map((c) => c.path);
  else {
    const set = cfg._sets[gate.inputSet]; paths = snap.files.filter((p) => matchAny(set.inc, p) && !matchAny(set.exc, p));
    // installed dependency state (yarn classic integrity file) - a different node_modules with the same lockfile must not reuse a PASS
    const integ = abs('node_modules/.yarn-integrity');
    put(`integrity=${fs.existsSync(integ) ? sha256(fs.readFileSync(integ)) : 'none'}`);
  }
  paths = [...new Set(paths)].sort();
  const hashes = hashFiles(paths);
  for (const p of paths) put(`${p}\0${hashes.get(p)}`);
  return h.digest('hex');
}
const seal = (rec) => { const { recordSha256: _omit, ...rest } = rec; return { ...rest, recordSha256: sha256(canon(rest)) }; };
function recordValid(rec, gate, fp, tools) {
  try {
    if (!rec || !['PASS', 'SKIPPED'].includes(rec.status) || rec.recordSha256 !== seal(rec).recordSha256) return false;
    if (rec.exitCode !== 0 || rec.gateVersion !== gate.version || rec.command !== gate.command.join(' ')) return false;
    if (rec.inputFingerprint !== fp || canon(rec.toolVersions) !== canon(tools)) return false;
    return !!rec.logPath && fs.existsSync(rec.logPath) && sha256(fs.readFileSync(rec.logPath)) === rec.resultLogSha256;
  } catch { return false; }
}

// ---------- state / audit / logs (inside the git dir: never tracked, never in git status) ----------
let stateMemo; let gitRootsMemo;
const gitRoots = () => gitRootsMemo || (gitRootsMemo = ['--absolute-git-dir', '--git-common-dir'].map((o) => fs.realpathSync(path.resolve(ROOT, git(['rev-parse', o]).trim()))));
const insideGit = (p) => { const r = fs.realpathSync(p); return gitRoots().some((g) => r === g || r.startsWith(`${g}${path.sep}`)); };
function stateRoot() {
  if (stateMemo) return stateMemo;
  const target = path.resolve(ROOT, git(['rev-parse', '--git-path', 'autodarts-gate']).trim());
  let link = false;
  try { link = fs.lstatSync(target).isSymbolicLink(); } catch { /* not created yet */ }
  if (link || !insideGit(path.dirname(target)) || (fs.existsSync(target) && !insideGit(target))) throw new GateError(EXIT.UNKNOWN, `state path ${target} is a symlink or not inside the git directory`);
  stateMemo = target;
  return target;
}
const ensureDirs = (pkg) => {
  const r = stateRoot();
  for (const d of [path.join(r, 'state'), path.join(r, 'logs'), path.join(r, 'logs', pkg)]) {
    let l = null;
    try { l = fs.lstatSync(d); } catch { /* does not exist yet */ }
    if (l && (l.isSymbolicLink() || !l.isDirectory())) throw new GateError(EXIT.UNKNOWN, `${d} is a symlink or not a directory`);
    fs.mkdirSync(d, { recursive: true });
    if (!insideGit(d)) throw new GateError(EXIT.UNKNOWN, `${d} resolves outside the git directory`);
  }
  return r;
};
const stateFile = (pkg) => path.join(stateRoot(), 'state', `${pkg}.json`);
function loadState(pkg) {
  const f = stateFile(pkg);
  if (!fs.existsSync(f)) return null;
  let s;
  try { s = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { throw new GateError(EXIT.UNKNOWN, `state file is corrupt: ${f}`); }
  if (!s || s.schemaVersion !== 1 || s.packageId !== pkg || !VALID_PKG.includes(s.packageStatus) || typeof s.gates !== 'object' || !s.gates || Array.isArray(s.gates)
    || !SHA_RE.test(String(s.baselineHead)) || typeof s.branch !== 'string' || !s.branch) throw new GateError(EXIT.UNKNOWN, `state file has an unexpected shape: ${f}`);
  return s;
}
function saveState(pkg, s) {
  const f = stateFile(pkg); const tmp = `${f}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(s, null, 2)}\n`); fs.renameSync(tmp, f);
}
const audit = (o) => {
  const f = path.join(stateRoot(), 'audit.jsonl');
  let link = false;
  try { link = fs.lstatSync(f).isSymbolicLink(); } catch { /* not created yet */ }
  if (link) throw new GateError(EXIT.UNKNOWN, 'audit.jsonl is a symlink');
  fs.appendFileSync(f, `${JSON.stringify(o)}\n`);
};

function internalGate(name, snap) {
  const lines = []; let ok = true;
  const files = snap.changes.filter((c) => c.status !== 'D').map((c) => c.path);
  if (name === 'syntax') {
    for (const f of files) {
      let r = null;
      if (f.endsWith('.json')) { try { JSON.parse(fs.readFileSync(abs(f), 'utf8')); } catch (e) { r = e.message; } } else if (f.endsWith('.sh')) { const p = spawnSync('bash', ['-n', abs(f)], { encoding: 'utf8' }); if (p.status !== 0) r = p.stderr; } else if (/\.(m|c)?js$/.test(f)) { const p = spawnSync(process.execPath, ['--check', abs(f)], { encoding: 'utf8' }); if (p.status !== 0) r = p.stderr; } else continue;
      lines.push(`${r === null ? 'ok  ' : 'FAIL'} ${f}${r === null ? '' : `: ${r.trim()}`}`); if (r !== null) ok = false;
    }
  } else {
    let scripts = {};
    try { scripts = JSON.parse(fs.readFileSync(abs('package.json'), 'utf8')).scripts || {}; } catch { /* none */ }
    const builtin = new Set(['install', 'add', 'remove', 'upgrade', 'cache', 'config', 'global', 'info', 'link', 'list', 'pack', 'publish', 'run', 'version', 'why', 'audit', 'check', 'init', 'import', 'licenses', 'outdated', 'unlink', 'exec']);
    for (const f of files.filter((x) => /^\.github\/workflows\/.+\.ya?ml$/.test(x))) {
      const t = fs.readFileSync(abs(f), 'utf8'); let bad = false;
      if (t.includes('\t')) { lines.push(`FAIL ${f}: contains tab characters`); bad = true; }
      for (const line of t.split('\n').filter((l) => !l.trim().startsWith('#'))) {
        for (const m of line.matchAll(/\byarn\s+([A-Za-z][\w:.-]*)/g)) {
          if (!builtin.has(m[1]) && !scripts[m[1]] && !fs.existsSync(abs(`node_modules/.bin/${m[1]}`))) { lines.push(`FAIL ${f}: "yarn ${m[1]}" is not a package script or known binary`); bad = true; }
        }
      }
      if (!bad) lines.push(`ok   ${f}`); else ok = false;
    }
  }
  return { exitCode: ok ? 0 : 1, text: lines.join('\n') || '(nothing to check)' };
}

function executeGate(cfg, name, snap, fp, tools, pkg) {
  const gate = cfg.gates[name]; const t0 = Date.now(); const startedAt = now(); const [c0, ...a] = gate.command;
  let exitCode; let text;
  if (c0.startsWith('internal:')) ({ exitCode, text } = internalGate(name, snap));
  else if (c0 === 'git') { const r = git(a, { allowFail: true }); exitCode = r.status; text = r.stdout + r.stderr; } else {
    const r = spawnSync(c0, a, { cwd: ROOT, env: process.env, encoding: 'buffer', maxBuffer: 1 << 29 });
    if (r.error) { exitCode = 127; text = String(r.error.message); } else { exitCode = r.status ?? 128; text = `${r.stdout}\n--- stderr ---\n${r.stderr}`; }
  }
  const finishedAt = now(); const logPath = path.join(stateRoot(), 'logs', pkg, `${startedAt.replace(/[:.]/g, '-')}-${name}.log`);
  fs.writeFileSync(logPath, `# ${gate.command.join(' ')}\n# exit ${exitCode}\n${text}\n`);
  return seal({
    name, status: exitCode === 0 ? 'PASS' : 'FAIL', gateVersion: gate.version, command: gate.command.join(' '), inputFingerprint: fp, toolVersions: tools,
    startedAt, finishedAt, durationMs: Date.now() - t0, exitCode, resultLogSha256: sha256(fs.readFileSync(logPath)), logPath, reusedFrom: null,
  });
}
function pruneLogs(cfg, pkg, state) {
  const dir = path.join(stateRoot(), 'logs', pkg); const used = new Set(Object.values(state.gates).map((g) => g.logPath));
  for (const name of Object.keys(cfg.gates)) {
    const mine = fs.readdirSync(dir).filter((f) => f.endsWith(`-${name}.log`)).sort();
    for (const f of mine.slice(0, Math.max(0, mine.length - cfg.logRetention))) if (!used.has(path.join(dir, f))) fs.unlinkSync(path.join(dir, f));
  }
}

// ---------- output ----------
function printSnapshot(snap, cfg) {
  say(`BASELINE: ${snap.baseline}`);
  say(`CHANGESET: ${snap.changes.length} file(s)`);
  snap.changes.slice(0, 60).forEach((c) => say(`  ${c.status.padEnd(2)} ${c.path}  [${c.cls}${c.flags.length ? `; ${c.flags.join(',')}` : ''}]${c.staged ? ' (staged)' : ''}`));
  if (snap.changes.length > 60) say(`  ... ${snap.changes.length - 60} more`);
  say(`CLASS: ${snap.pkgClass}`);
  say(`FLAGS: ${[...snap.flags].join(', ') || 'none'}${snap.flags.has('review') || snap.flags.has('approval') || snap.flags.has('protected') ? '  -> human review required' : ''}`);
  say(`REQUIRED GATES: ${snap.gates.join(', ') || 'none'}`);
  const s = snap.stats;
  say(`PROTECTED CORE: core=${s.core} (+${s.tier0 - s.core} tests), tier1=${s.tier1} (static=${s.static}, by-symbol=${s.bySymbol}), tier2=${s.tier2}, scanned=${s.scanned}`);
  if (snap.gates.some((g) => cfg.gates[g].kind === 'code')) { const g = codeToolGuard(cfg); g.lines.forEach((l) => say(`TOOLS: ${l}`)); if (!g.lines.length) say('TOOLS: ok'); }
}
const printBlockers = (snap) => { snap.blockers.forEach((b) => say(`BLOCKED [${b.code}] ${b.msg}`)); };

// ---------- commands ----------
function cmdClassify(cfg) {
  const snap = evaluate(cfg, git(['rev-parse', 'HEAD']).trim());
  printSnapshot(snap, cfg); printBlockers(snap);
  const code = blockExit(snap);
  const toolsBlocked = code === EXIT.OK && snap.gates.some((g) => cfg.gates[g].kind === 'code') && codeToolGuard(cfg).blocked;
  say(`RESULT: ${code === EXIT.OK ? (toolsBlocked ? 'OK for classification, but run would BLOCK the code gates (tool guard)' : 'OK') : code === EXIT.UNKNOWN ? 'UNKNOWN (fail-closed)' : 'BLOCKED'}`);
  return code;
}

function cmdStatus(cfg, pkg) {
  if (!pkg) {
    const dir = path.join(stateRoot(), 'state');
    const ids = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : [];
    say(`PACKAGES: ${ids.length}`);
    for (const id of ids) { const s = loadState(id); say(`  ${id}: ${s.packageStatus}${s.blockReason ? ` (${s.blockReason})` : ''} [${s.changeType}]`); }
    return cmdClassify(cfg);
  }
  const state = loadState(pkg);
  if (!state) throw new GateError(EXIT.UNKNOWN, `no state for package ${pkg}`);
  const snap = evaluate(cfg, state.baselineHead); const tools = toolVersions();
  say(`PACKAGE: ${pkg}  STATUS: ${state.packageStatus}${state.blockReason ? ` (${state.blockReason})` : ''}  BRANCH: ${state.branch}  CLASS(now): ${snap.pkgClass}`);
  let worst = EXIT.OK;
  for (const name of snap.gates) {
    const rec = state.gates[name]; let label = 'UNKNOWN';
    if (rec) {
      if (['FAIL', 'BLOCKED'].includes(rec.status)) label = rec.status;
      else if (!cfg.gates[name].cache) label = `${rec.status} (runs every time)`;
      else if (recordValid(rec, cfg.gates[name], fingerprint(cfg, name, snap, tools), tools)) label = `${rec.status} (valid)`;
      else label = 'INVALIDATED';
    }
    if (label === 'FAIL') worst = Math.max(worst, EXIT.FAIL);
    say(`  ${name.padEnd(22)} ${label}`);
  }
  printBlockers(snap);
  return blockExit(snap) || (state.packageStatus === 'BLOCKED' ? EXIT.BLOCKED : worst);
}

function cmdRun(cfg, pkg, force) {
  ensureDirs(pkg);
  let state = loadState(pkg);
  if (state && state.packageStatus === 'CLOSED') throw new GateError(EXIT.BLOCKED, `package ${pkg} is CLOSED; use a new package id`);
  const head = git(['rev-parse', 'HEAD']).trim(); const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (!state) state = { schemaVersion: 1, packageId: pkg, packageStatus: 'OPEN', blockReason: null, branch, baselineHead: head, currentHead: head, changeType: null, createdAt: now(), updatedAt: now(), closedAt: null, closedHead: null, approvals: [], gates: {} };
  const ev = (gate, event, extra = {}) => audit({ ts: now(), packageId: pkg, gate, event, head, ...extra });
  const finish = (code, status, reason) => { state.packageStatus = status; state.blockReason = reason || null; state.updatedAt = now(); saveState(pkg, state); if (reason) say(`PACKAGE ${status}: ${reason}`); return code; };
  if (branch === 'HEAD') return finish(EXIT.BLOCKED, 'BLOCKED', 'detached HEAD');
  if (branch !== state.branch) return finish(EXIT.BLOCKED, 'BLOCKED', `branch changed: ${state.branch} -> ${branch}`);
  if (git(['merge-base', '--is-ancestor', state.baselineHead, 'HEAD'], { allowFail: true }).status !== 0) return finish(EXIT.BLOCKED, 'BLOCKED', 'baselineHead is not an ancestor of HEAD');
  state.currentHead = head;
  let snap = evaluate(cfg, state.baselineHead);
  state.changeType = snap.pkgClass;
  printSnapshot(snap, cfg);
  if (snap.blockers.length) { printBlockers(snap); ev(null, 'BLOCKED', { reason: snap.blockers.map((b) => b.code) }); return finish(blockExit(snap), 'BLOCKED', snap.blockers.map((b) => b.code).join(',')); }
  const required = snap.gates; const tools = toolVersions(); const guard = codeToolGuard(cfg);
  for (const k of Object.keys(state.gates)) if (!required.includes(k)) { delete state.gates[k]; ev(k, 'DROPPED', { reason: 'not required for current change class' }); }
  say('GATES:');
  for (const name of required) {
    const gate = cfg.gates[name]; const prev = state.gates[name]; const cmd = gate.command.join(' ');
    if (gate.kind === 'code' && guard.blocked) {
      state.gates[name] = seal({ name, status: 'BLOCKED', gateVersion: gate.version, command: cmd, inputFingerprint: null, toolVersions: tools, startedAt: null, finishedAt: null, exitCode: null, resultLogSha256: null, logPath: null, reusedFrom: null });
      say(`  ${name.padEnd(22)} BLOCKED`); guard.lines.forEach((l) => say(`    ${l}`)); ev(name, 'BLOCKED', { reason: guard.lines });
      return finish(EXIT.BLOCKED, 'BLOCKED', `TOOL_GUARD:${name}`);
    }
    const fp = fingerprint(cfg, name, snap, tools);
    if (gate.cache && !force && recordValid(prev, gate, fp, tools)) {
      state.gates[name] = seal({ ...prev, status: 'SKIPPED', reusedFrom: prev.reusedFrom || { startedAt: prev.startedAt, finishedAt: prev.finishedAt } });
      ev(name, 'SKIPPED', { fingerprint: fp, command: cmd, exitCode: 0, resultLogSha256: prev.resultLogSha256, durationMs: 0, toolVersions: tools });
      say(`  ${name.padEnd(22)} SKIPPED (cached PASS)`); continue;
    }
    if (gate.cache && prev && ['PASS', 'SKIPPED'].includes(prev.status)) { ev(name, 'INVALIDATED', { fingerprint: prev.inputFingerprint, newFingerprint: fp }); say(`  ${name.padEnd(22)} INVALIDATED (input, tools or definition changed)`); }
    const rec = executeGate(cfg, name, snap, fp, tools, pkg);
    state.gates[name] = rec;
    ev(name, rec.status === 'PASS' ? 'EXECUTED' : 'FAIL', { fingerprint: fp, command: cmd, exitCode: rec.exitCode, resultLogSha256: rec.resultLogSha256, durationMs: rec.durationMs, toolVersions: tools });
    say(`  ${name.padEnd(22)} ${rec.status} (exit ${rec.exitCode}, ${rec.durationMs} ms)`);
    if (rec.status !== 'PASS') { say(`    log: ${rec.logPath}`); return finish(EXIT.FAIL, 'BLOCKED', `GATE_FAIL:${name}`); }
    snap = evaluate(cfg, state.baselineHead);
    if (snap.blockers.length) { printBlockers(snap); return finish(blockExit(snap), 'BLOCKED', `GUARD_AFTER_GATE:${name}`); }
  }
  snap = evaluate(cfg, state.baselineHead);
  const stale = required.filter((n) => fingerprint(cfg, n, snap, tools) !== state.gates[n].inputFingerprint);
  if (stale.length || snap.blockers.length) {
    stale.forEach((n) => { state.gates[n] = seal({ ...state.gates[n], status: 'INVALIDATED' }); ev(n, 'INVALIDATED', { reason: 'input changed during run' }); });
    printBlockers(snap); return finish(EXIT.BLOCKED, 'BLOCKED', `INPUT_CHANGED_DURING_RUN${stale.length ? `:${stale.join(',')}` : ''}`);
  }
  pruneLogs(cfg, pkg, state);
  if (!snap.changes.length) say('NOTE: no changes versus baseline');
  return finish(EXIT.OK, 'READY_TO_CLOSE', null);
}

function cmdClose(cfg, pkg) {
  const state = loadState(pkg);
  if (!state) throw new GateError(EXIT.UNKNOWN, `no state for package ${pkg}`);
  if (state.packageStatus !== 'READY_TO_CLOSE') throw new GateError(EXIT.BLOCKED, `package is ${state.packageStatus}, not READY_TO_CLOSE`);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (branch !== state.branch) throw new GateError(EXIT.BLOCKED, `branch changed: ${state.branch} -> ${branch}`);
  if (git(['merge-base', '--is-ancestor', state.baselineHead, 'HEAD'], { allowFail: true }).status !== 0) throw new GateError(EXIT.BLOCKED, 'baselineHead is not an ancestor of HEAD');
  const snap = evaluate(cfg, state.baselineHead); const tools = toolVersions();
  if (snap.blockers.length) { printBlockers(snap); throw new GateError(blockExit(snap), 'guards failed'); }
  for (const name of snap.gates) {
    const rec = state.gates[name];
    const fp = fingerprint(cfg, name, snap, tools);
    const fresh = rec && ['PASS', 'SKIPPED'].includes(rec.status) && rec.recordSha256 === seal(rec).recordSha256 && rec.inputFingerprint === fp && canon(rec.toolVersions) === canon(tools)
      && rec.exitCode === 0 && !!rec.logPath && fs.existsSync(rec.logPath) && sha256(fs.readFileSync(rec.logPath)) === rec.resultLogSha256;
    if (!fresh) throw new GateError(EXIT.BLOCKED, `gate ${name} is not a valid PASS for the current input - run again`);
  }
  state.packageStatus = 'CLOSED'; state.closedAt = now(); state.closedHead = git(['rev-parse', 'HEAD']).trim(); state.updatedAt = state.closedAt; state.blockReason = null;
  saveState(pkg, state); audit({ ts: now(), packageId: pkg, gate: null, event: 'CLOSED', head: state.closedHead });
  say(`PACKAGE ${pkg} CLOSED at ${state.closedHead} (no git state was changed; commit and push stay manual)`);
  return EXIT.OK;
}

// ---------- main ----------
export function main(argv) {
  const usage = () => { throw new GateError(EXIT.USAGE, 'usage: gate.mjs classify | status [id] | run <id> [--force] | close <id>'); };
  try {
    const [cmd, ...rest] = argv; const flags = rest.filter((a) => a.startsWith('--')); const args = rest.filter((a) => !a.startsWith('--'));
    const top = git(['rev-parse', '--show-toplevel']).trim();
    if (fs.realpathSync(top) !== fs.realpathSync(ROOT)) throw new GateError(EXIT.USAGE, 'gate.mjs must live in <repo>/scripts');
    const cfg = loadConfig();
    const needId = () => { if (args.length !== 1 || !PKG_RE.test(args[0])) usage(); return args[0]; };
    switch (cmd) {
      case 'classify': if (rest.length) usage(); return cmdClassify(cfg);
      case 'status': if (args.length > 1 || flags.length || (args[0] && !PKG_RE.test(args[0]))) usage(); return cmdStatus(cfg, args[0]);
      case 'run': if (flags.some((f) => f !== '--force')) usage(); return cmdRun(cfg, needId(), flags.includes('--force'));
      case 'close': if (flags.length) usage(); return cmdClose(cfg, needId());
      default: return usage();
    }
  } catch (e) {
    if (e instanceof GateError) { console.error(`ERROR: ${e.message}`); return e.code; }
    console.error(`INTERNAL ERROR (fail-closed): ${e && e.stack ? e.stack : e}`);
    return EXIT.UNKNOWN;
  }
}

const isMain = (() => { try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === SCRIPT; } catch { return false; } })();
if (isMain) process.exitCode = main(process.argv.slice(2));
