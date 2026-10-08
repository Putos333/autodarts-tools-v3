/**
 * Unit tests für die reinen Funktionen von scripts/preview.mjs (Preview-System Phase 1).
 * Der Browser-/Build-Teil wird nicht hier, sondern durch einen echten Lauf (`yarn preview`) geprüft.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dateStamp, diffVerdict, formatPercent, parseArgs, parseCount, pickPreviousDir, previewDirName, renderSummary, shotName, VIEWPORTS,
} from "../scripts/preview.mjs";

describe("preview.mjs – reine Funktionen", () => {
  it("parseArgs: Standard und Optionen; unbekannte/unvollständige Optionen werfen", () => {
    assert.deepEqual(parseArgs([]), { build: true, fastBuild: false, withTests: false, e2e: false, compare: null, out: null });
    assert.equal(parseArgs([ "--no-build" ]).build, false);
    assert.equal(parseArgs([ "--fast-build" ]).fastBuild, true);
    const o = parseArgs([ "--e2e", "--compare", "docs/preview/x" ]);
    assert.equal(o.e2e, true); assert.equal(o.withTests, true); assert.equal(o.compare, "docs/preview/x");
    assert.throws(() => parseArgs([ "--nope" ]), /unbekannte Option/);
    assert.throws(() => parseArgs([ "--compare" ]), /Pfad/);
    assert.throws(() => parseArgs([ "--out", "--no-build" ]), /Pfad/);
  });

  it("previewDirName: Datum-SHA, dirty-Suffix, nie ein vorhandener Name", () => {
    const d = new Date(2026, 9, 8);
    assert.equal(dateStamp(d), "20261008");
    assert.equal(previewDirName(d, "92863f7a", false), "20261008-92863f7a");
    assert.equal(previewDirName(d, "92863f7a", true), "20261008-92863f7a-dirty");
    assert.equal(previewDirName(d, "92863f7a", false, [ "20261008-92863f7a" ]), "20261008-92863f7a-2");
    assert.equal(previewDirName(d, "92863f7a", false, [ "20261008-92863f7a", "20261008-92863f7a-2" ]), "20261008-92863f7a-3");
  });

  it("shotName und Viewports", () => {
    assert.deepEqual(VIEWPORTS.map((v) => v.name), [ "desktop", "mobile" ]);
    assert.equal(shotName("dashboard", VIEWPORTS[1]), "dashboard-mobile-390x844.png");
  });

  it("pickPreviousDir: jüngster anderer Lauf nach generatedAt, ohne den aktuellen", () => {
    const e = [
      { name: "a", generatedAt: "2026-10-01T00:00:00Z" },
      { name: "b", generatedAt: "2026-10-05T00:00:00Z" },
      { name: "cur", generatedAt: "2026-10-08T00:00:00Z" },
      { name: "kaputt" },
    ];
    assert.equal(pickPreviousDir(e, "cur").name, "b");
    assert.equal(pickPreviousDir([ { name: "cur", generatedAt: "x" } ], "cur"), null);
    assert.equal(pickPreviousDir([], "cur"), null);
  });

  it("parseCount: node:test, vitest, playwright; sonst null", () => {
    assert.deepEqual(parseCount("ℹ tests 677\nℹ pass 677\nℹ fail 0\n"), { pass: 677, fail: 0 });
    assert.deepEqual(parseCount("ℹ pass 5\nℹ fail 2\n"), { pass: 5, fail: 2 });
    assert.deepEqual(parseCount(" Test Files  20 passed (20)\n      Tests  185 passed (185)"), { pass: 185, fail: 0 });
    assert.deepEqual(parseCount("      Tests  3 failed | 8 passed (11)"), { pass: 8, fail: 3 });
    assert.deepEqual(parseCount("  83 passed (4.1m)"), { pass: 83, fail: 0 });
    assert.equal(parseCount("nichts Erkennbares"), null);
  });

  it("formatPercent und diffVerdict", () => {
    assert.equal(formatPercent(0), "0 %");
    assert.equal(formatPercent(0.0000001), "<0,01 %");
    assert.equal(formatPercent(0.1234), "12,34 %");
    assert.equal(diffVerdict(null), "NEU (kein Vergleichsbild)");
    assert.equal(diffVerdict({ sizeMismatch: true, size: "1x2", prevSize: "1x1" }), "GRÖSSE GEÄNDERT (1x1 → 1x2)");
    assert.equal(diffVerdict({ sizeMismatch: false, diffPixels: 0, ratio: 0 }), "UNVERÄNDERT");
    assert.equal(diffVerdict({ sizeMismatch: false, diffPixels: 5, ratio: 0.5 }), "GEÄNDERT (50,00 %)");
  });

  it("renderSummary: enthält SHA, Kennzeichnung, Status, Bilder, Vorher/Nachher und Risiken", () => {
    const base = {
      dirName: "20261008-92863f7a", sha: "92863f7a", branch: "main", dirty: false, baseSha: "92863f7a", generatedAt: "2026-10-08T00:00:00Z",
      checks: [ { name: "Chrome-Build", status: "PASS", detail: "Exit 0" }, { name: "Unit", status: "NOT RUN", detail: "nur mit --with-tests" } ],
      shots: [ { section: "dashboard", viewport: "desktop 1280x720", title: "DASHBOARD", file: "dashboard-desktop-1280x720.png", diff: null } ],
      previous: null, commitsSince: [], statSince: "", risks: "- Risiko A",
    };
    const first = renderSummary(base);
    for (const needle of [ "92863f7a", "**ECHT:**", "Keine Simulationen", "| Chrome-Build | PASS |", "NOT RUN", "screens/dashboard-desktop-1280x720.png", "Ausgangsstand", "- Risiko A" ]) {
      assert.ok(first.includes(needle), `fehlt: ${needle}`);
    }
    const second = renderSummary({
      ...base, dirty: true, risks: null,
      previous: { name: "alt", sha: "1111111" }, commitsSince: [ "abc fix" ],
      shots: [ { ...base.shots[0], diff: { sizeMismatch: false, diffPixels: 3, ratio: 0.01, diffFile: "diff-x.png" } } ],
    });
    for (const needle of [ "uncommittete Änderungen", "`alt`", "- abc fix", "GEÄNDERT (1,00 %)", "diff/diff-x.png", "UNKNOWN" ]) {
      assert.ok(second.includes(needle), `fehlt: ${needle}`);
    }
  });
});
