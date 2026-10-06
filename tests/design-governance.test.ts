/**
 * Design-Governance-Tests (AUTODARTS ELITE UI MASTER 1.0, UI-1).
 *
 * Schützen das Design-System vor Drift, ohne kosmetische Details festzunageln:
 *   1. Token-SSOT: `--cc-*` wird nur in assets/design-tokens.css definiert und dort vor style.css geladen.
 *   2. Jedes benutzte `var(--cc-*)` ist definiert.
 *   3. Designsprache-Anker (Rot = lokaler Spieler, Blau = Gegner, Gold, Schriften) sind festgenagelt;
 *      eine Änderung ist eine bewusste Design-Entscheidung und muss hier mitgezogen werden.
 *   4. Ratchets (dürfen nur sinken): Hardcode-Farben, Text unter 12px, Breakpoint-Werte.
 *   5. Kontrast der Text-/Status-Tokens (WCAG 2.x), bekannte Ausnahmen explizit benannt.
 *
 * Regeln und Begründung: docs/UI_GOVERNANCE.md.
 * Läuft über den Node-Test-Runner (wie tests/*.test.ts): node --import tsx --test "tests/*.test.ts"
 */

import { strict as assert } from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ROOT = process.cwd();
const TOKENS_PATH = "assets/design-tokens.css";
const STYLE_PATH = "entrypoints/controlcenter/style.css";

const read = (relativePath: string): string => readFileSync(join(ROOT, relativePath), "utf8");

function listFiles(relativeDir: string, extensions: string[]): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(ROOT, relativeDir), { withFileTypes: true })) {
    const relative = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listFiles(relative, extensions));
    else if (extensions.some(ext => entry.name.endsWith(ext))) out.push(relative);
  }
  return out;
}

const tokens = read(TOKENS_PATH);
const styleCss = read(STYLE_PATH);
const ccVueFiles = listFiles("components/ControlCenter", [ ".vue" ]);
const allUiFiles = [
  ...listFiles("components", [ ".vue" ]),
  ...listFiles("entrypoints", [ ".vue", ".css" ]),
  ...listFiles("assets", [ ".css" ]),
];

/** Wert eines Tokens aus dem Token-File (erste Definition). */
function tokenValue(name: string): string | undefined {
  const match = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(tokens);
  return match?.[1].trim();
}

// ── 1/2: SSOT und Definition ────────────────────────────────────────────────

describe("design tokens: Single Source of Truth", () => {
  it("--cc-* wird ausschließlich in assets/design-tokens.css definiert", () => {
    const definition = /^\s*--cc-[a-z0-9-]+\s*:/m;
    const offenders = allUiFiles.filter(file => file !== TOKENS_PATH && definition.test(read(file)));
    assert.deepEqual(offenders, [], `--cc-* außerhalb der Token-SSOT definiert: ${offenders.join(", ")}`);
  });

  it("main.ts lädt die Tokens vor style.css", () => {
    const main = read("entrypoints/controlcenter/main.ts");
    const tokensAt = main.indexOf("design-tokens.css");
    const styleAt = main.indexOf("./style.css");
    assert.ok(tokensAt >= 0, "design-tokens.css wird nicht importiert");
    assert.ok(tokensAt < styleAt, "design-tokens.css muss vor ./style.css importiert werden");
  });

  it("jedes benutzte var(--cc-*) ist im Token-File definiert", () => {
    const defined = new Set(Array.from(tokens.matchAll(/(--cc-[a-z0-9-]+)\s*:/g), m => m[1]));
    const missing = new Set<string>();
    for (const file of allUiFiles) {
      for (const match of read(file).matchAll(/var\((--cc-[a-z0-9-]+)/g)) {
        if (!defined.has(match[1])) missing.add(`${match[1]} (${file})`);
      }
    }
    assert.deepEqual([ ...missing ], [], "Nicht definierte Tokens verwendet");
  });

  it("alle Token-Gruppen sind vorhanden", () => {
    const required = [
      "--cc-bg", "--cc-bg-elev", "--cc-surface", "--cc-border", "--cc-text", "--cc-text-dim",
      "--cc-accent", "--cc-blue", "--cc-gold", "--cc-ok", "--cc-warn", "--cc-bad", "--cc-idle",
      "--cc-font-display", "--cc-font-body", "--cc-fs-xs", "--cc-fw-bold",
      "--cc-space-1", "--cc-space-5", "--cc-radius", "--cc-radius-sm", "--cc-radius-pill",
      "--cc-border-width", "--cc-shadow-card", "--cc-elev-card",
      "--cc-dur-fast", "--cc-dur-base", "--cc-ease-standard",
      "--cc-z-topbar", "--cc-z-panel", "--cc-focus-width", "--cc-hit-min",
    ];
    const missing = required.filter(name => tokenValue(name) === undefined);
    assert.deepEqual(missing, [], "Pflicht-Tokens fehlen");
  });
});

// ── 3: Designsprache-Anker ──────────────────────────────────────────────────

describe("design tokens: AUTODARTS-ELITE-Designsprache", () => {
  it("Spieler-Akzente und Gold sind unverändert (Rot = lokal, Blau = Gegner)", () => {
    assert.equal(tokenValue("--cc-accent"), "#e8002d");
    assert.equal(tokenValue("--cc-blue"), "#3b82f6");
    assert.equal(tokenValue("--cc-gold"), "#f5c842");
    assert.equal(tokenValue("--cc-ok"), "#10b981");
  });

  it("near-black Basis und Dark-Schema", () => {
    assert.equal(tokenValue("--cc-bg"), "#060b12");
    assert.match(tokens, /color-scheme:\s*dark/);
  });

  it("Display-Schrift Barlow Condensed, Body-Schrift Open Sans", () => {
    assert.match(tokenValue("--cc-font-display") ?? "", /^"Barlow Condensed"/);
    assert.match(tokenValue("--cc-font-body") ?? "", /^"Open Sans"/);
  });

  it("Mindest-Zielgröße ist 44px", () => {
    assert.equal(tokenValue("--cc-hit-min"), "44px");
  });
});

// ── 4: Ratchets (dürfen nur sinken) ─────────────────────────────────────────

/**
 * Bestandsstand bei UI-1 (gemessen). Die Werte dürfen NUR sinken: Wer Hardcodes migriert, senkt die
 * Zahl hier mit. Steigt ein Wert, gehört die neue Farbe/Größe stattdessen als Token ins Token-File.
 */
const BASELINE = {
  hardcodedColorsStyleCss: 152,
  hardcodedColorsCcComponents: 21,
  textBelow12pxCc: 86,
};

/** Dokumentierte Breakpoints (docs/UI_GOVERNANCE.md) und Legacy-Werte des Bestands. */
const DOCUMENTED_BREAKPOINTS = [ 640, 1280, 1800 ];
const LEGACY_BREAKPOINTS = [ 480, 720, 780, 860, 980, 1080, 1440 ];

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgba?\(/g;

describe("design drift: Ratchets", () => {
  it("Hardcode-Farben in style.css steigen nicht", () => {
    const count = styleCss.match(COLOR_LITERAL)?.length ?? 0;
    assert.ok(count <= BASELINE.hardcodedColorsStyleCss,
      `style.css: ${count} Farb-Literale (Limit ${BASELINE.hardcodedColorsStyleCss}). Neue Farben als Token anlegen.`);
  });

  it("Hardcode-Farben in Control-Center-Komponenten steigen nicht", () => {
    const count = ccVueFiles.reduce((sum, file) => sum + (read(file).match(COLOR_LITERAL)?.length ?? 0), 0);
    assert.ok(count <= BASELINE.hardcodedColorsCcComponents,
      `components/ControlCenter: ${count} Farb-Literale (Limit ${BASELINE.hardcodedColorsCcComponents}). Token nutzen.`);
  });

  it("Text unter 12px nimmt nicht zu (neuer Text: mindestens --cc-fs-xs)", () => {
    const sizes = [ styleCss, ...ccVueFiles.map(read) ].flatMap(text =>
      Array.from(text.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g), m => Number(m[1])));
    const count = sizes.filter(size => size < 12).length;
    assert.ok(count <= BASELINE.textBelow12pxCc,
      `${count} Schriftgrößen unter 12px (Limit ${BASELINE.textBelow12pxCc}).`);
  });

  it("nur dokumentierte oder bereits vorhandene Breakpoints", () => {
    const allowed = new Set([ ...DOCUMENTED_BREAKPOINTS, ...LEGACY_BREAKPOINTS ]);
    const used = new Set<number>();
    for (const text of [ styleCss, ...listFiles("components", [ ".vue" ]).map(read) ]) {
      for (const match of text.matchAll(/@media\s*\(\s*(?:max|min)-width:\s*(\d+)px\s*\)/g)) used.add(Number(match[1]));
    }
    const unknown = [ ...used ].filter(width => !allowed.has(width));
    assert.deepEqual(unknown, [], `Neue Breakpoints ohne Dokumentation: ${unknown.join(", ")}`);
  });
});

// ── 5: Kontrast ─────────────────────────────────────────────────────────────

function luminance(hex: string): number {
  const channel = (offset: number): number => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(foreground: string, background: string): number {
  const [ a, b ] = [ luminance(foreground), luminance(background) ].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/**
 * Bekannte Verstöße gegen 4,5:1 für normalen Text (gemessen bei UI-1). Sie sind benannt statt
 * verschwiegen; die Behebung ist eine sichtbare Design-Änderung (UI-2, mit Visual-Baseline).
 * Untergrenze 3:1 (große Texte/UI-Elemente). Besteht ein Token später 4,5:1, muss er hier entfernt werden.
 */
const KNOWN_CONTRAST_EXCEPTIONS = [ "--cc-text-faint", "--cc-accent" ];
const TEXT_TOKENS = [
  "--cc-text", "--cc-text-dim", "--cc-text-faint", "--cc-accent", "--cc-gold",
  "--cc-blue", "--cc-ok", "--cc-warn", "--cc-bad",
];

describe("design tokens: Kontrast (WCAG 2.x)", () => {
  const backgrounds = [ "--cc-bg", "--cc-bg-elev" ].map(name => ({ name, hex: tokenValue(name) ?? "" }));

  for (const token of TEXT_TOKENS) {
    it(`${token} auf --cc-bg und --cc-bg-elev`, () => {
      const hex = tokenValue(token) ?? "";
      assert.match(hex, /^#[0-9a-f]{6}$/i, `${token} ist kein opakes Hex-Token`);
      const ratios = backgrounds.map(bg => contrast(hex, bg.hex));
      const minimum = Math.min(...ratios);
      if (KNOWN_CONTRAST_EXCEPTIONS.includes(token)) {
        assert.ok(minimum >= 3, `${token}: ${minimum.toFixed(2)}:1 liegt unter der Untergrenze 3:1`);
        assert.ok(minimum < 4.5, `${token} besteht jetzt 4,5:1 (${minimum.toFixed(2)}:1) — aus KNOWN_CONTRAST_EXCEPTIONS entfernen`);
      } else {
        assert.ok(minimum >= 4.5, `${token}: ${minimum.toFixed(2)}:1 unter 4,5:1`);
      }
    });
  }
});
