#!/usr/bin/env node
// Protected-core commit/push guard (PKG-7 / D2). Second protection layer next to .claude/settings.json (permissions.ask).
//   node scripts/core-guard.mjs commit-msg <message-file>      (git commit-msg hook)
//   node scripts/core-guard.mjs pre-push <remote> [<url>]      (git pre-push hook, ref lines on stdin)
//   node scripts/core-guard.mjs range <rev-list args...>       (manual audit of a commit range)
// Options: --config <path>   (default: gate.config.json next to this script; tests only)
// A commit that changes one of the protected core files needs the trailer
//   Protected-Core-Approved: <concrete reason>
// The trailer only DOCUMENTS an approval the user gave beforehand; it is not an approval itself.
// Commits made from inside a Claude Code session (CLAUDECODE set) are refused, agents must never self-approve.
// The protected file list is read from scripts/gate.config.json (protectedCore.files), the single source of truth.
// Exit: 0 ok, 1 violation, 2 usage/config error. Git is used read-only.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(import.meta.url);
const DEFAULT_CONFIG = path.join(path.dirname(SCRIPT), 'gate.config.json');
export const TRAILER = 'Protected-Core-Approved';
const ZERO_SHA = /^0+$/;
const MIN_REASON_CHARS = 20;
const MIN_SPECIFIC_WORDS = 2;
// Words that carry no reason on their own; a reason needs at least MIN_SPECIFIC_WORDS words outside this set.
const GENERIC_WORDS = new Set([
  'yes', 'ok', 'okay', 'approved', 'approve', 'approval', 'true', 'y', 'n', '1', 'done', 'fine', 'lgtm', 'noted',
  'needed', 'necessary', 'required', 'because', 'reason', 'test', 'todo', 'tbd', 'na', 'none', 'user', 'by', 'the',
  'a', 'an', 'is', 'was', 'for', 'of', 'to', 'and', 'it', 'this', 'change', 'core', 'protected', 'explicit',
  'ja', 'freigegeben', 'genehmigt', 'notwendig', 'freigabe', 'von', 'durch', 'der', 'die', 'das',
]);

class GuardError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export function loadCoreFiles(configPath = DEFAULT_CONFIG) {
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { throw new GuardError(2, `cannot read config ${configPath}: ${e.message}`); }
  const files = cfg?.protectedCore?.files;
  if (!Array.isArray(files) || !files.length || files.some((f) => typeof f !== 'string' || !f)) {
    throw new GuardError(2, `config ${configPath} has no valid protectedCore.files list`);
  }
  return files;
}

/** Last `Protected-Core-Approved:` line of a commit message (comment lines ignored), or null. */
export function parseTrailer(message) {
  const lines = String(message).split(/\r?\n/).filter((l) => !l.startsWith('#'));
  let reason = null;
  for (const line of lines) {
    const m = line.match(new RegExp(`^${TRAILER}:[ \\t]*(.*)$`));
    if (m) reason = m[1].trim();
  }
  return reason;
}

/** Format check only: a human still decides whether the reason is concrete. */
export function validateReason(reason) {
  if (reason === null) return { ok: false, why: `missing trailer "${TRAILER}: <reason>"` };
  if (!reason) return { ok: false, why: 'reason is empty' };
  if (reason.length < MIN_REASON_CHARS) return { ok: false, why: `reason too short (min ${MIN_REASON_CHARS} characters)` };
  const words = reason.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const specific = words.filter((w) => !GENERIC_WORDS.has(w));
  if (specific.length < MIN_SPECIFIC_WORDS) return { ok: false, why: 'reason is a generic placeholder; describe why the protected core change is necessary' };
  return { ok: true, why: '' };
}

function git(args, { input, allowFail = false } = {}) {
  const r = spawnSync('git', args, { cwd: process.cwd(), input, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0 && !allowFail) throw new GuardError(2, `git ${args.join(' ')} failed: ${(r.stderr || '').trim()}`);
  return r;
}

const isAgentSession = () => Boolean(process.env.CLAUDECODE);

function touchedCore(files, core) {
  const set = new Set(core);
  return files.filter((f) => set.has(f));
}

function commitMsg(msgFile, core, out) {
  if (!msgFile) throw new GuardError(2, 'commit-msg needs the message file path');
  const staged = git(['diff', '--cached', '--name-only', '--no-renames', '-z']).stdout.split('\0').filter(Boolean);
  const touched = touchedCore(staged, core);
  if (!touched.length) return 0;
  out(`core-guard: this commit changes protected core file(s): ${touched.join(', ')}`);
  if (isAgentSession()) {
    out('core-guard: refused. Commits touching the protected core must not be made from a Claude Code session.');
    out('core-guard: after the explicit user approval, commit from your own terminal with the trailer below.');
    out(`core-guard: ${TRAILER}: <concrete reason>`);
    return 1;
  }
  let message;
  try { message = fs.readFileSync(msgFile, 'utf8'); } catch (e) { throw new GuardError(2, `cannot read message file: ${e.message}`); }
  const v = validateReason(parseTrailer(message));
  if (!v.ok) {
    out(`core-guard: refused, ${v.why}.`);
    out(`core-guard: add the trailer "${TRAILER}: <concrete reason>" (documents your prior approval).`);
    return 1;
  }
  return 0;
}

function revList(args) {
  const r = git(['rev-list', '--no-merges', ...args], { allowFail: true });
  return r.status === 0 ? r.stdout.split('\n').filter(Boolean) : null;
}

function checkCommits(shas, core, out) {
  const violations = [];
  for (const sha of shas) {
    const files = git(['diff-tree', '--no-commit-id', '--name-only', '-r', '--root', '--no-renames', '-z', sha]).stdout.split('\0').filter(Boolean);
    const touched = touchedCore(files, core);
    if (!touched.length) continue;
    const v = validateReason(parseTrailer(git(['show', '-s', '--format=%B', sha]).stdout));
    if (!v.ok) {
      const subject = git(['show', '-s', '--format=%s', sha]).stdout.trim();
      violations.push(`${sha.slice(0, 7)} ${subject} [${touched.join(', ')}] - ${v.why}`);
    }
  }
  if (violations.length) {
    out('core-guard: refused, commit(s) change the protected core without a valid approval trailer:');
    for (const v of violations) out(`  ${v}`);
    out(`core-guard: add "${TRAILER}: <concrete reason>" to those commits (documents your prior approval).`);
    return 1;
  }
  return 0;
}

function prePush(remote, stdin, core, out) {
  let code = 0;
  for (const line of stdin.split('\n').filter(Boolean)) {
    const [, localSha, , remoteSha] = line.split(/\s+/);
    if (!localSha || ZERO_SHA.test(localSha)) continue; // branch deletion
    let shas = !remoteSha || ZERO_SHA.test(remoteSha) ? null : revList([`${remoteSha}..${localSha}`]);
    if (shas === null) shas = revList([localSha, '--not', `--remotes=${remote || 'origin'}`]);
    if (shas === null) throw new GuardError(2, `cannot determine the commit range for ${localSha}`);
    code = Math.max(code, checkCommits(shas, core, out));
  }
  return code;
}

export function main(argv, stdin = () => fs.readFileSync(0, 'utf8'), out = (m) => process.stderr.write(`${m}\n`)) {
  try {
    const args = [...argv];
    let configPath = DEFAULT_CONFIG;
    const ci = args.indexOf('--config');
    if (ci >= 0) { configPath = args[ci + 1]; args.splice(ci, 2); }
    const [cmd, ...rest] = args;
    const core = loadCoreFiles(configPath);
    switch (cmd) {
      case 'commit-msg': return commitMsg(rest[0], core, out);
      case 'pre-push': return prePush(rest[0], stdin(), core, out);
      case 'range': {
        const shas = revList(rest);
        if (shas === null) throw new GuardError(2, 'invalid range');
        return checkCommits(shas, core, out);
      }
      default: throw new GuardError(2, 'usage: core-guard.mjs commit-msg <file> | pre-push <remote> [<url>] | range <rev-list args> [--config <path>]');
    }
  } catch (e) {
    if (e instanceof GuardError) { out(`core-guard: ${e.message}`); return e.code; }
    out(`core-guard: unexpected error: ${e.stack || e}`);
    return 2;
  }
}

const isMain = (() => { try { return !!process.argv[1] && fs.realpathSync(process.argv[1]) === SCRIPT; } catch { return false; } })();
if (isMain) process.exitCode = main(process.argv.slice(2));
