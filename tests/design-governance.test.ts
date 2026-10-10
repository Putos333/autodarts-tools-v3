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

  it("Cyan-UI-Token: eigene Farbrolle mit exakten Werten, getrennt von Spieler-, Gegner-, Status- und Gold-Farben", () => {
    assert.equal(tokenValue("--cc-cyan"), "#22d3ee");
    assert.equal(tokenValue("--cc-cyan-soft"), "rgba(34, 211, 238, 0.14)");
    assert.equal(tokenValue("--cc-cyan-line"), "rgba(34, 211, 238, 0.45)");
    assert.equal(tokenValue("--cc-glow-cyan"), "0 0 26px rgba(34, 211, 238, 0.16)");
    for (const anchor of [ "--cc-accent", "--cc-blue", "--cc-ok", "--cc-gold" ]) {
      assert.notEqual(tokenValue("--cc-cyan"), tokenValue(anchor), `--cc-cyan darf nicht ${anchor} entsprechen`);
    }
  });

  it("Cyan-Varianten (soft, line, glow) leiten sich vom Basis-Hex ab", () => {
    const hex = tokenValue("--cc-cyan") ?? "";
    const channels = [ 1, 3, 5 ].map(offset => parseInt(hex.slice(offset, offset + 2), 16)).join(", ");
    for (const variant of [ "--cc-cyan-soft", "--cc-cyan-line", "--cc-glow-cyan" ]) {
      assert.ok((tokenValue(variant) ?? "").includes(`rgba(${channels},`), `${variant} weicht vom Basis-Cyan ab`);
    }
  });
});

// ── 4: Ratchets (dürfen nur sinken) ─────────────────────────────────────────

/**
 * Bestandsstand bei UI-1 (gemessen). Die Werte dürfen NUR sinken: Wer Hardcodes migriert, senkt die
 * Zahl hier mit. Steigt ein Wert, gehört die neue Farbe/Größe stattdessen als Token ins Token-File.
 */
const BASELINE = {
  hardcodedColorsStyleCss: 150,
  hardcodedColorsCcComponents: 21,
  textBelow12pxCc: 85,
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
 * Bekannte Verstöße gegen 4,5:1 für normalen Text. Seit UI-2D nur noch --cc-accent (3,7:1 auf --cc-bg-elev):
 * als Fläche, Rahmen, Icon und für große Texte (≥ 24px, 3:1 genügt) zulässig; kleiner Akzent-Text nutzt
 * --cc-accent-text (siehe "Akzent als Textfarbe" unten). Untergrenze 3:1. Besteht ein Token später 4,5:1,
 * muss er hier entfernt werden.
 */
const KNOWN_CONTRAST_EXCEPTIONS = [ "--cc-accent" ];
const TEXT_TOKENS = [
  "--cc-text", "--cc-text-dim", "--cc-text-faint", "--cc-accent", "--cc-accent-text", "--cc-gold",
  "--cc-blue", "--cc-ok", "--cc-warn", "--cc-bad", "--cc-cyan",
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

// ── 6: Kontrast auf realen Flächen (UI-2D) ──────────────────────────────────

type TRgb = [ number, number, number ];

function hexToRgb(hex: string): TRgb {
  return [ 1, 3, 5 ].map(offset => parseInt(hex.slice(offset, offset + 2), 16)) as TRgb;
}

function rgbLuminance(rgb: TRgb): number {
  const [ r, g, b ] = rgb.map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function rgbContrast(foreground: TRgb, background: TRgb): number {
  const [ a, b ] = [ rgbLuminance(foreground), rgbLuminance(background) ].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/** Legt eine halbtransparente Token-Fläche (rgba) über einen opaken Untergrund. */
function overlay(base: TRgb, rgbaToken: string): TRgb {
  const match = /rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\s*\)/.exec(tokenValue(rgbaToken) ?? "");
  assert.ok(match, `${rgbaToken} ist kein rgba()-Token`);
  const alpha = Number(match[4]);
  return [ 1, 2, 3 ].map(index => Math.round(base[index - 1] * (1 - alpha) + Number(match[index]) * alpha)) as TRgb;
}

/**
 * Die Standardflächen, auf denen normaler Text liegt: Seite, erhöhte Fläche, Karte (surface), Hover und die
 * Akzent-Tönung. Stark getönte Flächen (gold-/ok-/warn-soft, surface-strong) gehören bewusst NICHT dazu —
 * dort liegt Text in --cc-text bzw. --cc-text-dim (siehe Test "kein faint-Text auf getönter Fläche").
 */
function standardSurfaces(): Array<{ name: string; rgb: TRgb }> {
  const bg = hexToRgb(tokenValue("--cc-bg") ?? "");
  const elev = hexToRgb(tokenValue("--cc-bg-elev") ?? "");
  return [
    { name: "--cc-bg", rgb: bg },
    { name: "--cc-bg-elev", rgb: elev },
    { name: "--cc-surface auf --cc-bg-elev", rgb: overlay(elev, "--cc-surface") },
    { name: "--cc-surface-hover auf --cc-bg-elev", rgb: overlay(elev, "--cc-surface-hover") },
    { name: "--cc-accent-soft auf --cc-bg-elev", rgb: overlay(elev, "--cc-accent-soft") },
  ];
}

describe("design tokens: Kontrast auf Standardflächen (UI-2D)", () => {
  for (const token of [ "--cc-text-faint", "--cc-accent-text" ]) {
    it(`${token} erreicht 4,5:1 auf allen Standardflächen`, () => {
      const foreground = hexToRgb(tokenValue(token) ?? "");
      for (const surface of standardSurfaces()) {
        const ratio = rgbContrast(foreground, surface.rgb);
        assert.ok(ratio >= 4.5, `${token} auf ${surface.name}: ${ratio.toFixed(2)}:1 unter 4,5:1`);
      }
    });
  }

  it("--cc-cyan erreicht 4,5:1 auf allen Standardflächen und auf der --cc-cyan-soft-Fläche; dunkle Schrift auf Cyan ebenso", () => {
    const cyan = hexToRgb(tokenValue("--cc-cyan") ?? "");
    for (const surface of standardSurfaces()) {
      const ratio = rgbContrast(cyan, surface.rgb);
      assert.ok(ratio >= 4.5, `--cc-cyan auf ${surface.name}: ${ratio.toFixed(2)}:1 unter 4,5:1`);
    }
    const bg = hexToRgb(tokenValue("--cc-bg") ?? "");
    const elev = hexToRgb(tokenValue("--cc-bg-elev") ?? "");
    const softBases: Array<{ name: string; rgb: TRgb }> = [
      { name: "--cc-bg", rgb: bg },
      { name: "--cc-bg-elev", rgb: elev },
      { name: "--cc-surface auf --cc-bg-elev", rgb: overlay(elev, "--cc-surface") },
    ];
    for (const base of softBases) {
      const ratio = rgbContrast(cyan, overlay(base.rgb, "--cc-cyan-soft"));
      assert.ok(ratio >= 4.5, `--cc-cyan auf --cc-cyan-soft über ${base.name}: ${ratio.toFixed(2)}:1 unter 4,5:1`);
    }
    const darkOnCyan = rgbContrast(bg, cyan);
    assert.ok(darkOnCyan >= 4.5, `--cc-bg als Schrift auf --cc-cyan-Fläche: ${darkOnCyan.toFixed(2)}:1 unter 4,5:1`);
  });

  it("--cc-focus-color erreicht 3:1 (WCAG 1.4.11) auch auf der stark getönten surface-strong", () => {
    const foreground = hexToRgb(tokenValue("--cc-focus-color") ?? "");
    const strong = overlay(hexToRgb(tokenValue("--cc-bg-elev") ?? ""), "--cc-surface-strong");
    for (const surface of [ ...standardSurfaces(), { name: "--cc-surface-strong", rgb: strong } ]) {
      assert.ok(rgbContrast(foreground, surface.rgb) >= 3, `Fokusfarbe auf ${surface.name} unter 3:1`);
    }
  });

  it("--cc-accent und --cc-gold sind unverändert (kein globaler Farb-Drift)", () => {
    assert.equal(tokenValue("--cc-accent"), "#e8002d");
    assert.equal(tokenValue("--cc-gold"), "#f5c842");
  });
});

// ── 7: CSS-Regeln auswerten (Fokus, Akzent als Text, getönte Flächen) ───────

interface ICssRule { file: string; selector: string; body: string }

function cssRules(text: string, file: string): ICssRule[] {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: ICssRule[] = [];
  for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ file, selector: match[1].trim().replace(/\s+/g, " "), body: match[2] });
  }
  return rules;
}

/** Regeln aus style.css und aus den <style>-Blöcken der Control-Center-Komponenten. */
const allCcRules: ICssRule[] = [
  ...cssRules(styleCss, STYLE_PATH),
  ...ccVueFiles.flatMap(file =>
    Array.from(read(file).matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g), block => cssRules(block[1], file)).flat()),
];

describe("design drift: eine einzige Fokus-Sprache (UI-2D)", () => {
  const focusRules = allCcRules.filter(rule => rule.selector.includes(":focus"));

  it("--cc-focus-color ist nicht Gold (Gold ist Branding/Semantik, nicht Fokusfarbe)", () => {
    const value = tokenValue("--cc-focus-color") ?? "";
    assert.ok(!/gold|#f5c842/i.test(value), `--cc-focus-color darf nicht Gold sein: ${value}`);
    assert.notEqual(value.toLowerCase(), (tokenValue("--cc-gold") ?? "").toLowerCase());
  });

  it("keine Fokusregel und keine Outline verwendet Gold", () => {
    const offenders = allCcRules
      .filter(rule => (rule.selector.includes(":focus") || /outline\s*:/.test(rule.body)) && /--cc-gold|#f5c842/i.test(rule.body))
      .map(rule => rule.selector);
    assert.deepEqual(offenders, [], `Gold im Fokus: ${offenders.join(" | ")}`);
  });

  it("kein box-shadow-Fokusring (konkurrierende zweite Fokus-Sprache)", () => {
    const offenders = focusRules.filter(rule => /box-shadow/.test(rule.body)).map(rule => rule.selector);
    assert.deepEqual(offenders, [], `box-shadow in Fokusregeln: ${offenders.join(" | ")}`);
  });

  it("jede Fokus-Outline nutzt die Fokus-Tokens (kein hartcodiertes Maß/Farbe)", () => {
    const offenders = focusRules
      .filter(rule => /outline\s*:/.test(rule.body) && !/outline\s*:\s*(none|0)\b/.test(rule.body))
      .filter(rule => !/var\(--cc-focus-width\)/.test(rule.body) || !/var\(--cc-focus-color\)/.test(rule.body))
      .map(rule => rule.selector);
    assert.deepEqual(offenders, [], `Fokus-Outline ohne Token: ${offenders.join(" | ")}`);
  });

  /** Einzige zulässige Ausnahmen: programmatische Fokus-Ziele (tabindex=-1) — main und Überschrift. */
  const OUTLINE_NONE_ALLOWED = [ ".cc-content:focus, .cc-topbar-heading:focus" ];

  it("outline:none nur an den programmatischen Fokus-Zielen", () => {
    const offenders = allCcRules
      .filter(rule => /outline\s*:\s*(none|0)\b/.test(rule.body))
      .map(rule => rule.selector)
      .filter(selector => !OUTLINE_NONE_ALLOWED.includes(selector));
    assert.deepEqual(offenders, [], `outline:none ohne Ausnahme: ${offenders.join(" | ")}`);
  });

  it("die Basisregel deckt alle interaktiven Elemente in :where() ab", () => {
    const base = allCcRules.find(rule => rule.selector.startsWith(":where(") && rule.selector.endsWith(":focus-visible"));
    assert.ok(base, "Basisregel :where(...):focus-visible fehlt in style.css");
    for (const element of [ "a[href]", "button", "input", "select", "textarea", "summary", "[tabindex]" ]) {
      assert.ok(base.selector.includes(element), `Basisregel deckt ${element} nicht ab`);
    }
    assert.match(base.body, /outline:\s*var\(--cc-focus-width\) solid var\(--cc-focus-color\)/);
    assert.match(base.body, /outline-offset:\s*var\(--cc-focus-offset\)/);
  });

  it("Scroll-Padding gegen den sticky Header: drei Stufen auf den dokumentierten Breakpoints", () => {
    assert.match(styleCss, /html \{ scroll-padding-top: 12rem; \}/);
    assert.match(styleCss, /@media \(max-width: 1280px\) \{ html \{ scroll-padding-top: 17rem; \} \}/);
    assert.match(styleCss, /@media \(max-width: 640px\) \{ html \{ scroll-padding-top: 0; \} \}/);
  });
});

describe("design drift: Akzent als Textfarbe und getönte Flächen (UI-2D)", () => {
  /**
   * Selektoren, die --cc-accent weiterhin als Farbe nutzen dürfen — jeweils KEIN kleiner Text:
   * Icons und dekorative Zeichen (3:1), große Zahlen/Texte ≥ 24px (3:1) und das Branding (herobar-accent).
   */
  const ACCENT_COLOR_ALLOWED = [
    ".cc-nav-item.is-active .cc-nav-icon",
    ".cc-bottom-nav-item.is-active .cc-bottom-nav-icon",
    ".cc-topbar-crumb-sep",
    ".cc-hero-side.is-left .cc-hero-remaining",
    ".cc-herobar-accent",
    ".cc-activity-rem.is-red",
    ".cc-sb-score.is-red",
    ".cc-tile.is-accent .cc-tile-value",
    ".cc-list-row > .cc-list-bullet",
  ];

  it("--cc-accent als color nur an benannten Nicht-Text-/Groß-/Branding-Stellen", () => {
    const offenders = allCcRules
      .filter(rule => /(^|[;\s])color\s*:\s*var\(--cc-accent\)/.test(rule.body))
      .map(rule => rule.selector)
      .filter(selector => !ACCENT_COLOR_ALLOWED.includes(selector));
    assert.deepEqual(offenders, [], `kleiner Akzent-Text sollte --cc-accent-text nutzen: ${offenders.join(" | ")}`);
  });

  /** Einzige Ausnahme: ein Icon (kein Text, 3:1 genügt; faint auf surface-strong ≈ 4,2:1). */
  const FAINT_TINTED_ALLOWED = [ ".cc-momentum.is-flat .cc-momentum-icon" ];

  it("kein faint-Text auf einer eigenen getönten Fläche (dort --cc-text-dim)", () => {
    const tinted = /background(-color)?\s*:\s*(rgba\(|var\(--cc-(accent|gold|blue|ok|warn|bad|idle)-soft\)|var\(--cc-surface-strong\))/;
    const offenders = allCcRules
      .filter(rule => /(^|[;\s])color\s*:\s*var\(--cc-text-faint/.test(rule.body) && tinted.test(rule.body))
      .filter(rule => !FAINT_TINTED_ALLOWED.includes(rule.selector))
      .map(rule => `${rule.file}: ${rule.selector}`);
    assert.deepEqual(offenders, [], `faint auf getönter Fläche: ${offenders.join(" | ")}`);
  });
});

// ── 8: Button- und Touch-Target-System (UI-2E) ──────────────────────────────

describe("design drift: Button- und Touch-Target-System (UI-2E)", () => {
  const ruleFor = (selector: string): ICssRule | undefined =>
    allCcRules.find(rule => rule.file === STYLE_PATH && rule.selector === selector);

  it("Mindest-Zielgröße wird zentral über --cc-hit-min erzwungen (.cc-btn, .cc-herobar-cta, .cc-fd-close)", () => {
    for (const selector of [ ".cc-btn", ".cc-herobar-cta", ".cc-fd-close" ]) {
      const rule = ruleFor(selector);
      assert.ok(rule, `${selector} fehlt in style.css`);
      assert.match(rule.body, /min-height\s*:\s*var\(--cc-hit-min\)/, `${selector} braucht min-height: var(--cc-hit-min)`);
    }
  });

  it("keine .cc-btn-Regel setzt eine feste Höhe unter der Mindest-Zielgröße", () => {
    const hitMin = Number.parseInt(tokenValue("--cc-hit-min") ?? "", 10);
    assert.ok(hitMin >= 44);
    const offenders = allCcRules
      .filter(rule => /\.cc-btn(?![\w-])|\.cc-herobar-cta(?![\w-])|\.cc-fd-close(?![\w-])/.test(rule.selector))
      .flatMap(rule => Array.from(
        rule.body.matchAll(/(?<![\w-])((?:min-|max-)?height)\s*:\s*(\d+(?:\.\d+)?)px/g),
        match => ({ rule, property: match[1], value: Number(match[2]) })))
      .filter(entry => entry.value < hitMin)
      .map(entry => `${entry.rule.file}: ${entry.rule.selector} { ${entry.property}: ${entry.value}px }`);
    assert.deepEqual(offenders, [], `Höhe unter ${hitMin}px an Buttons: ${offenders.join(" | ")}`);
  });

  it("Hover-Lift gilt nur für bedienbare Buttons, Active nimmt ihn zurück", () => {
    const lift = allCcRules.filter(rule => /\.cc-btn[^,]*:hover/.test(rule.selector) && /translateY/.test(rule.body));
    assert.ok(lift.length > 0, "Hover-Regel für .cc-btn fehlt");
    for (const rule of lift) assert.match(rule.selector, /:not\(:disabled\)/, `Hover auch bei disabled: ${rule.selector}`);
    const active = ruleFor(".cc-btn:where(:not(:disabled)):active");
    assert.ok(active, ".cc-btn braucht eine :active-Regel für bedienbare Buttons");
    assert.match(active.body, /transform\s*:\s*none/);
  });

  it("disabled-Buttons bleiben ohne Hover-Bewegung und als gesperrt erkennbar", () => {
    const disabled = ruleFor(".cc-btn:disabled");
    assert.ok(disabled, ".cc-btn:disabled fehlt");
    assert.match(disabled.body, /cursor\s*:\s*not-allowed/);
    assert.match(disabled.body, /opacity\s*:/);
    assert.match(disabled.body, /transform\s*:\s*none/);
  });
});

// ── 9: Retry-Aktion im Fehlerhinweis (UI-2E K2-A) ───────────────────────────

describe("design drift: Retry-Aktion (UI-2E K2-A)", () => {
  it(".cc-retry ist zentral definiert, erreicht die Mindest-Zielgröße und nutzt nur Tokens", () => {
    const rule = allCcRules.find(r => r.file === STYLE_PATH && r.selector === ".cc-retry");
    assert.ok(rule, ".cc-retry fehlt in style.css");
    assert.match(rule.body, /min-height\s*:\s*var\(--cc-hit-min\)/);
    assert.match(rule.body, /color\s*:\s*var\(--cc-gold\)/);
    assert.doesNotMatch(rule.body, /#[0-9a-f]{3,8}\b|rgba?\(/i, ".cc-retry darf keine Farb-Literale enthalten");
  });

  it("keine Retry-Aktion als <a href=\"#\"> oder mit Inline-Gold-Style in CcTraining (aktiv gerenderte K2-A-Stelle)", () => {
    // Bewusst nur CcTraining: CcDashboardSummary wird in der Produktion nicht gerendert und ist nicht Teil von K2-A
    // (verwaister Code, separates Aufräum-Follow-up).
    const source = read("components/ControlCenter/views/CcTraining.vue");
    assert.doesNotMatch(source, /<a\b[^>]*href="#"[^>]*@click/);
    assert.doesNotMatch(source, /<a\b[^>]*style="[^"]*var\(--cc-gold\)[^"]*"[^>]*>\s*Erneut versuchen/);
  });

  it("die „Erneut versuchen“-Aktion in CcTraining ist ein <button type=\"button\" class=\"cc-retry\">", () => {
    const file = "components/ControlCenter/views/CcTraining.vue";
    const source = read(file);
    // `(?:[^>]|=>)*`: ein Pfeil `=>` im @click-Handler beendet das Tag nicht.
    const actions = source.match(/<(?:a|button)\b(?:[^>]|=>)*>\s*Erneut versuchen\s*<\/(?:a|button)>/g) ?? [];
    assert.ok(actions.length > 0, `${file}: keine Retry-Aktion gefunden`);
    for (const action of actions) {
      assert.match(action, /^<button\b/, `${file}: Retry muss ein <button> sein: ${action}`);
      assert.match(action, /type="button"/);
      assert.match(action, /class="cc-retry"/);
      assert.doesNotMatch(action, /style=/, `${file}: kein Inline-Style am Retry`);
    }
  });
});
