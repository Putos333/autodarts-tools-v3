#!/usr/bin/env node
// AUTODARTS ELITE local preview system (Phase 1) - rein lokal, keine zusätzlichen Abhängigkeiten.
//   node scripts/preview.mjs [--no-build | --fast-build] [--with-tests] [--e2e] [--compare <dir>] [--out <dir>]
//   yarn preview
// Baut (außer --no-build) die Chrome-Extension, öffnet die gebaute Extension in Playwright-Chromium,
// nimmt Desktop- und Mobil-Screenshots aller Control-Center-Bereiche auf und schreibt sie nach
// docs/preview/<YYYYMMDD>-<sha>[-dirty][-n]/ (git-ignoriert) zusammen mit SUMMARY.md und summary.json.
// Vergleich: pixelweise gegen den vorherigen Lauf (nur lesend, nichts wird überschrieben); der Pixelvergleich
// läuft im Browser (Canvas), es wird keine zusätzliche Bibliothek benötigt.
// Sicherheit: kein produktiver Netzzugriff (der einzige externe Aufruf der Seite wird auf 404 gestubbt),
// keine Daten werden injiziert, kein Quellcode wird verändert. Die Screenshots zeigen den leeren Standardzustand.
// Exit: 0 ok, 1 Fehler (Build/Aufnahme), 2 Aufruf.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(SCRIPT), "..");
const PREVIEW_ROOT = path.join(ROOT, "docs", "preview");
const EXTENSION_PATH = path.join(ROOT, ".output", "chrome-mv3");

export const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 720 },
  { name: "mobile", width: 390, height: 844 },
];
/** Ein Pixel gilt als verändert, wenn ein Farbkanal um mehr als diesen Wert abweicht (0-255). */
export const PIXEL_THRESHOLD = 16;

// ── reine Funktionen (getestet in tests/preview-script.test.mjs) ─────────────

export function parseArgs(argv) {
  const opts = { build: true, fastBuild: false, withTests: false, e2e: false, compare: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--no-build") opts.build = false;
    else if (a === "--fast-build") opts.fastBuild = true; // wxt direkt (wie CI), ohne preflight (compile + test)
    else if (a === "--with-tests") opts.withTests = true;
    else if (a === "--e2e") { opts.withTests = true; opts.e2e = true; }
    else if (a === "--compare" || a === "--out") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) throw new Error(`${a} braucht einen Pfad`);
      opts[a.slice(2)] = v;
    } else throw new Error(`unbekannte Option: ${a}`);
  }
  return opts;
}

const pad = (n) => String(n).padStart(2, "0");
export function dateStamp(d) { return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; }

/** `<datum>-<sha>[-dirty]`; bei bereits vorhandenem Namen wird `-2`, `-3` ... angehängt (nie überschreiben). */
export function previewDirName(date, sha, dirty, existing = []) {
  const base = `${dateStamp(date)}-${sha}${dirty ? "-dirty" : ""}`;
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function shotName(section, vp) { return `${section}-${vp.name}-${vp.width}x${vp.height}.png`; }

/** Vorheriger Lauf = jüngster (nach generatedAt) Eintrag außer dem aktuellen. */
export function pickPreviousDir(entries, currentName) {
  const others = entries.filter((e) => e.name !== currentName && e.generatedAt);
  others.sort((a, b) => (a.generatedAt < b.generatedAt ? 1 : -1));
  return others[0] ?? null;
}

/** Zählt bestandene/fehlgeschlagene Tests aus node:test- oder vitest-Ausgabe; null, wenn nichts erkennbar. */
export function parseCount(output) {
  const nodePass = /^ℹ pass (\d+)/m.exec(output);
  if (nodePass) return { pass: Number(nodePass[1]), fail: Number(/^ℹ fail (\d+)/m.exec(output)?.[1] ?? 0) };
  const v = /Tests\s+(?:(\d+) failed \| )?(\d+) passed/.exec(output);
  if (v) return { pass: Number(v[2]), fail: Number(v[1] ?? 0) };
  const pw = /(\d+) passed/.exec(output);
  if (pw) return { pass: Number(pw[1]), fail: Number(/(\d+) failed/.exec(output)?.[1] ?? 0) };
  return null;
}

export function formatPercent(ratio) {
  if (ratio === 0) return "0 %";
  const p = ratio * 100;
  return `${p < 0.01 ? "<0,01" : p.toFixed(2).replace(".", ",")} %`;
}

export function diffVerdict(r) {
  if (!r) return "NEU (kein Vergleichsbild)";
  if (r.sizeMismatch) return `GRÖSSE GEÄNDERT (${r.prevSize} → ${r.size})`;
  return r.diffPixels === 0 ? "UNVERÄNDERT" : `GEÄNDERT (${formatPercent(r.ratio)})`;
}

export function renderSummary(d) {
  const L = [];
  L.push(`# Preview ${d.dirName}`, "");
  L.push(`- Commit: \`${d.sha}\` (${d.branch})${d.dirty ? " – **Arbeitsverzeichnis hat uncommittete Änderungen an getrackten Dateien**" : ""}`);
  L.push(`- Erzeugt: ${d.generatedAt}`);
  L.push(`- Basis \`origin/main\`: ${d.baseSha ?? "unbekannt"}`, "");
  L.push("## Kennzeichnung", "");
  L.push("- **ECHT:** Alle Bilder unter `screens/` sind echte Screenshots der gebauten Extension (`.output/chrome-mv3`) in Playwright-Chromium.");
  L.push("- **Zustand:** leerer Standardzustand, keine Daten injiziert; der einzige externe Aufruf der Seite (`…/api/marathon/health`) ist auf 404 gestubbt, deshalb „KI-Backend nicht erreichbar“. Kein Live-Test, kein produktives Netzwerk.");
  L.push("- **Keine Simulationen, keine Mockups** in diesem Ordner.");
  L.push("- Mobil-Aufnahmen sind Fullpage-Bilder; die fixierte untere Navigation erscheint dabei mittig im Bild (Aufnahmeeffekt, kein Layoutfehler).", "");
  L.push("## Build- und Teststatus", "");
  L.push("| Prüfung | Status | Details |", "|---|---|---|");
  for (const c of d.checks) L.push(`| ${c.name} | ${c.status} | ${c.detail} |`);
  L.push("", "## Screenshots (ECHT)", "");
  L.push("| Bereich | Ansicht | Überschrift | Datei |", "|---|---|---|---|");
  for (const s of d.shots) L.push(`| ${s.section} | ${s.viewport} | ${s.title} | [${s.file}](screens/${s.file}) |`);
  L.push("", "## Vorher/Nachher", "");
  if (!d.previous) {
    L.push("Kein vorheriger Preview-Lauf vorhanden – dies ist der Ausgangsstand für künftige Vergleiche.");
  } else {
    L.push(`Vergleichsstand: \`${d.previous.name}\` (Commit \`${d.previous.sha}\`).`, "");
    if (d.commitsSince.length) { L.push("Commits seit dem Vergleichsstand:", ""); d.commitsSince.forEach((c) => L.push(`- ${c}`)); L.push(""); }
    else L.push("Keine neuen Commits seit dem Vergleichsstand (oder nicht ermittelbar).", "");
    if (d.statSince) L.push("```", d.statSince, "```", "");
    L.push("| Bild | Ergebnis | Diff |", "|---|---|---|");
    for (const s of d.shots) L.push(`| ${s.file} | ${diffVerdict(s.diff)} | ${s.diff?.diffFile ? `[diff](diff/${s.diff.diffFile})` : "–"} |`);
    L.push("", `Schwelle: Kanalabweichung > ${PIXEL_THRESHOLD}/255 gilt als verändert. Vergleichsbilder werden nur gelesen, nie überschrieben.`);
  }
  L.push("", "## Offene Risiken", "");
  L.push(d.risks ? d.risks.trim() : "`docs/OPEN_RISKS.md` fehlt – keine Risikoliste verfügbar (UNKNOWN).");
  L.push("");
  return L.join("\n");
}

// ── Hilfen mit Seiteneffekten ────────────────────────────────────────────────

function run(cmd, args, opts = {}) {
  const t0 = Date.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" }, ...opts });
  return { status: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}`, seconds: Math.round((Date.now() - t0) / 100) / 10, error: r.error };
}
/** Liefert nur bei Exit 0 die Ausgabe, sonst "" (z. B. flacher CI-Checkout ohne origin/main) – nie Fehlertext. */
const git = (...args) => { const r = run("git", args); return r.status === 0 ? r.out.trim() : ""; };

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; } }

function runCheck(name, cmd, args) {
  const r = run(cmd, args);
  const c = parseCount(r.out);
  const ok = r.status === 0;
  return { name, status: ok ? "PASS" : "FAIL", detail: `${c ? `${c.pass} bestanden, ${c.fail} fehlgeschlagen; ` : ""}Exit ${r.status}, ${r.seconds} s` };
}

async function discoverSections(extId, ctx) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`chrome-extension://${extId}/controlcenter.html`);
  await page.getByRole("main").waitFor();
  const ids = await page.locator("[data-testid^=\"cc-nav-\"]").evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  await page.close();
  return [ ...new Set(ids.filter((t) => t && !t.startsWith("cc-nav-group-")).map((t) => t.slice("cc-nav-".length))) ];
}

async function compareImages(browser, prevFile, curFile) {
  const page = await browser.newPage();
  try {
    const b64 = (f) => `data:image/png;base64,${fs.readFileSync(f).toString("base64")}`;
    return await page.evaluate(async ([a, b, thr]) => {
      const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const [ia, ib] = await Promise.all([ load(a), load(b) ]);
      const size = `${ib.width}x${ib.height}`, prevSize = `${ia.width}x${ia.height}`;
      if (ia.width !== ib.width || ia.height !== ib.height) return { sizeMismatch: true, size, prevSize, diffPixels: -1, ratio: 1, diffPng: null };
      const px = (img) => { const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height); };
      const da = px(ia), db = px(ib);
      const out = new ImageData(ib.width, ib.height);
      let diff = 0;
      for (let i = 0; i < da.data.length; i += 4) {
        const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
        if (d > thr) { diff++; out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 60; out.data[i + 3] = 255; }
        else { const g = Math.round((db.data[i] + db.data[i + 1] + db.data[i + 2]) / 3 * 0.35); out.data[i] = out.data[i + 1] = out.data[i + 2] = g; out.data[i + 3] = 255; }
      }
      const c = document.createElement("canvas"); c.width = ib.width; c.height = ib.height; c.getContext("2d").putImageData(out, 0, 0);
      return { sizeMismatch: false, size, prevSize, diffPixels: diff, ratio: diff / (ib.width * ib.height), diffPng: diff ? c.toDataURL("image/png") : null };
    }, [ b64(prevFile), b64(curFile), PIXEL_THRESHOLD ]);
  } finally { await page.close(); }
}

// ── Hauptablauf ──────────────────────────────────────────────────────────────

async function main() {
  let opts;
  try { opts = parseArgs(process.argv.slice(2)); } catch (e) { console.error(`preview: ${e.message}`); process.exit(2); }

  // Die Extension lässt sich nur im Headed-Modus laden: ohne Display unter Xvfb neu starten.
  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.ADT_PREVIEW_XVFB) {
    const r = spawnSync("xvfb-run", [ "-a", process.execPath, SCRIPT, ...process.argv.slice(2) ], { stdio: "inherit", env: { ...process.env, ADT_PREVIEW_XVFB: "1" } });
    process.exit(r.status ?? 1);
  }

  const sha = git("rev-parse", "--short=8", "HEAD") || "unknown";
  const branch = git("rev-parse", "--abbrev-ref", "HEAD") || "unknown";
  const dirty = git("status", "--porcelain", "--untracked-files=no") !== "";
  const baseSha = git("rev-parse", "--short=8", "origin/main") || null;
  const generatedAt = new Date().toISOString();
  const checks = [];

  if (opts.build) {
    const b = run("yarn", opts.fastBuild ? [ "wxt", "build" ] : [ "build" ]);
    checks.push({ name: `Chrome-Build (\`yarn ${opts.fastBuild ? "wxt build" : "build"}\`)`, status: b.status === 0 ? "PASS" : "FAIL", detail: `Exit ${b.status}, ${b.seconds} s` });
    if (b.status !== 0) { console.error(b.out.split("\n").slice(-30).join("\n")); }
  } else {
    const m = path.join(EXTENSION_PATH, "manifest.json");
    checks.push({ name: "Chrome-Build", status: "NOT RUN", detail: fs.existsSync(m) ? `--no-build: vorhandener Build vom ${fs.statSync(m).mtime.toISOString()} wird verwendet (Aktualität nicht geprüft)` : "--no-build und kein Build vorhanden" });
  }
  if (!fs.existsSync(path.join(EXTENSION_PATH, "manifest.json"))) { console.error("preview: Extension-Build fehlt (.output/chrome-mv3)"); process.exit(1); }

  if (opts.withTests) {
    checks.push(runCheck("TypeScript (`yarn compile`)", "yarn", [ "compile" ]));
    checks.push(runCheck("Unit (`yarn test`)", "yarn", [ "test" ]));
    checks.push(runCheck("Lifecycle (`yarn test:lifecycle`)", "yarn", [ "test:lifecycle" ]));
    checks.push(runCheck("Komponenten (`yarn test:components`)", "yarn", [ "test:components" ]));
    if (opts.e2e) checks.push(runCheck("Playwright E2E (`yarn test:e2e`)", "yarn", [ "test:e2e" ]));
    else checks.push({ name: "Playwright E2E", status: "NOT RUN", detail: "nur mit --e2e" });
  } else {
    for (const n of [ "TypeScript", "Unit", "Lifecycle", "Komponenten", "Playwright E2E" ]) checks.push({ name: n, status: "NOT RUN", detail: "nur mit --with-tests" });
  }

  fs.mkdirSync(PREVIEW_ROOT, { recursive: true });
  const existing = fs.readdirSync(PREVIEW_ROOT, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const dirName = opts.out ? path.basename(opts.out) : previewDirName(new Date(), sha, dirty, existing);
  const outDir = opts.out ? path.resolve(opts.out) : path.join(PREVIEW_ROOT, dirName);
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) { console.error(`preview: ${outDir} ist nicht leer – wird nicht überschrieben`); process.exit(1); }
  fs.mkdirSync(path.join(outDir, "screens"), { recursive: true });

  // Vorheriger Lauf (nur lesend).
  const entries = existing.map((name) => ({ name, ...(readJson(path.join(PREVIEW_ROOT, name, "summary.json")) ?? {}) }));
  const prevEntry = opts.compare
    ? { name: path.basename(opts.compare), dir: path.resolve(opts.compare), ...(readJson(path.join(opts.compare, "summary.json")) ?? {}) }
    : (() => { const p = pickPreviousDir(entries, dirName); return p ? { ...p, dir: path.join(PREVIEW_ROOT, p.name) } : null; })();

  const { chromium } = await import("@playwright/test");
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || "/tmp"), "adt-preview-"));
  const ctx = await chromium.launchPersistentContext(tmp, {
    headless: false,
    ignoreDefaultArgs: [ "--disable-extensions" ],
    args: [ `--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}` ],
  });
  const shots = [];
  try {
    const sw = ctx.serviceWorkers()[0] ?? await ctx.waitForEvent("serviceworker", { timeout: 15_000 });
    const extId = new URL(sw.url()).host;
    // Kein produktiver Netzzugriff: der einzige externe Aufruf der Seite wird lokal beantwortet.
    await ctx.route("**/api/marathon/health", (r) => r.fulfill({ status: 404, body: "" }));
    const sections = await discoverSections(extId, ctx);
    if (!sections.length) throw new Error("keine Bereiche in der Navigation gefunden");
    for (const vp of VIEWPORTS) {
      for (const section of sections) {
        const page = await ctx.newPage();
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(`chrome-extension://${extId}/controlcenter.html#${section}`);
        await page.getByRole("main").waitFor();
        await page.getByText("KI-Backend nicht erreichbar").first().waitFor({ timeout: 10_000 });
        await page.waitForTimeout(1200);
        const file = shotName(section, vp);
        await page.screenshot({ path: path.join(outDir, "screens", file), fullPage: true, animations: "disabled", caret: "hide" });
        const title = (await page.locator("h1").first().innerText().catch(() => "?")).replace(/\s+/g, " ").trim();
        shots.push({ section, viewport: `${vp.name} ${vp.width}x${vp.height}`, title, file, diff: null });
        await page.close();
      }
    }
  } finally {
    await ctx.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // Pixelvergleich gegen den vorherigen Lauf.
  let previous = null, commitsSince = [], statSince = "";
  if (prevEntry && prevEntry.dir && fs.existsSync(path.join(prevEntry.dir, "screens"))) {
    previous = { name: prevEntry.name, sha: prevEntry.sha ?? "unbekannt" };
    if (prevEntry.sha) {
      commitsSince = git("log", "--oneline", `${prevEntry.sha}..HEAD`).split("\n").filter(Boolean);
      statSince = git("diff", "--stat", `${prevEntry.sha}..HEAD`).split("\n").slice(-12).join("\n");
    }
    const browser = await chromium.launch();
    try {
      fs.mkdirSync(path.join(outDir, "diff"), { recursive: true });
      for (const s of shots) {
        const prevFile = path.join(prevEntry.dir, "screens", s.file);
        if (!fs.existsSync(prevFile)) continue;
        const r = await compareImages(browser, prevFile, path.join(outDir, "screens", s.file));
        let diffFile = null;
        if (r.diffPng) { diffFile = `diff-${s.file}`; fs.writeFileSync(path.join(outDir, "diff", diffFile), Buffer.from(r.diffPng.split(",")[1], "base64")); }
        s.diff = { sizeMismatch: r.sizeMismatch, size: r.size, prevSize: r.prevSize, diffPixels: r.diffPixels, ratio: r.ratio, diffFile };
      }
    } finally { await browser.close(); }
  }

  const risksFile = path.join(ROOT, "docs", "OPEN_RISKS.md");
  const data = {
    dirName, sha, branch, dirty, baseSha, generatedAt, checks, shots, previous, commitsSince, statSince,
    risks: fs.existsSync(risksFile) ? fs.readFileSync(risksFile, "utf8") : null,
  };
  fs.writeFileSync(path.join(outDir, "summary.json"), JSON.stringify({ ...data, risks: undefined }, null, 2));
  fs.writeFileSync(path.join(outDir, "SUMMARY.md"), renderSummary(data));
  if (!opts.out) fs.writeFileSync(path.join(PREVIEW_ROOT, "LATEST"), `${dirName}\n`);

  console.log(`Preview: ${path.relative(ROOT, outDir)}`);
  console.log(`  ${shots.length} Screenshots, SUMMARY: ${path.relative(ROOT, path.join(outDir, "SUMMARY.md"))}`);
  for (const c of checks) console.log(`  [${c.status}] ${c.name}: ${c.detail}`);
  if (checks.some((c) => c.status === "FAIL")) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(`preview: ${e.stack ?? e}`); process.exit(1); });
}
