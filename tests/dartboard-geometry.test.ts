/**
 * Tests für die Board-Geometrie/Koordinaten-Transformation der grafischen
 * Live-Dartscheibe (CC Live Board, Implementierung Phase 1).
 *
 * Läuft ohne zusätzliche Abhängigkeit über den Node-eigenen Test-Runner und
 * den bereits vorhandenen tsx-Loader (devDependency), genau wie
 * tests/live-throw.test.ts:
 *
 *   node --import tsx --test "tests/*.test.ts"
 *
 * utils/dartboard-geometry.ts ist bewusst import- und seiteneffektfrei.
 */

import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  BOARD_RADII_MM,
  BOARD_VIEWBOX,
  BOARD_SCALE,
  BOARD_SEGMENT_ORDER,
  boardCoordsToCanvas,
  segmentCenterAngleRad,
  segmentBoundaryAnglesRad,
  pointOnCircle,
  describeAnnularSector,
  liveDartToCanvasPoint,
  parseSegmentLabel,
  segmentFallbackToCanvasPoint,
  resolveLiveDartPoint,
  type ICcLiveBoardDart,
} from "../utils/dartboard-geometry";

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Board-Konstanten", () => {
  it("Radien entsprechen den Standard-Board-Maßen (mm), identisch zur PrecisionMap-Quelle", () => {
    assert.deepEqual(BOARD_RADII_MM, {
      db: 6.35,
      bull: 15.9,
      tripleIn: 99,
      tripleOut: 107,
      doubleIn: 162,
      doubleOut: 170,
    });
  });

  it("VIEWBOX/SCALE sind identisch zur PrecisionMap-Formel (400 / (2*doubleOut + 20mm Rand))", () => {
    assert.equal(BOARD_VIEWBOX, 400);
    assert.equal(BOARD_SCALE, 400 / (2 * 170 + 20));
  });

  it("BOARD_SEGMENT_ORDER ist der reale Standard-Nummernkranz (20 oben, im Uhrzeigersinn)", () => {
    assert.deepEqual(BOARD_SEGMENT_ORDER, [
      20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
    ]);
    assert.equal(BOARD_SEGMENT_ORDER.length, 20, "20 Segmente");
    assert.equal(BOARD_SEGMENT_ORDER.reduce((a, b) => a + b, 0), 210, "Summe 1..20 = 210");
  });
});

describe("boardCoordsToCanvas — Koordinaten-Transformation", () => {
  it("Mittelpunkt (0,0) → Mitte der ViewBox", () => {
    const p = boardCoordsToCanvas(0, 0);
    assert.equal(p.cx, BOARD_VIEWBOX / 2);
    assert.equal(p.cy, BOARD_VIEWBOX / 2);
  });

  it("repräsentative Koordinate: T20-Zentrum (0,-104mm, aus utils/heatmap-storage.ts T20_CENTER) liegt oberhalb der Mitte", () => {
    const p = boardCoordsToCanvas(0, -104);
    assert.equal(p.cx, BOARD_VIEWBOX / 2, "x=0 bleibt horizontal zentriert");
    assert.ok(p.cy < BOARD_VIEWBOX / 2, "negatives y muss oberhalb der Mitte liegen (kleineres cy)");
  });

  it("Randwert: doubleOut-Radius (170mm) auf der x-Achse ergibt den erwarteten Canvas-Versatz", () => {
    const p = boardCoordsToCanvas(170, 0);
    assert.equal(p.cx, BOARD_VIEWBOX / 2 + 170 * BOARD_SCALE);
    assert.equal(p.cy, BOARD_VIEWBOX / 2);
  });

  it("Randwert: negative Koordinate (-170, 0) spiegelt sich korrekt", () => {
    const p = boardCoordsToCanvas(-170, 0);
    assert.equal(p.cx, BOARD_VIEWBOX / 2 - 170 * BOARD_SCALE);
  });

  it("optionale viewBox/scale-Parameter überschreiben die Defaults", () => {
    const p = boardCoordsToCanvas(10, 10, 200, 2);
    assert.equal(p.cx, 100 + 20);
    assert.equal(p.cy, 100 + 20);
  });
});

describe("Segment-Winkel", () => {
  it("Segment 0 (\"20\") liegt bei -90° (oben)", () => {
    assert.equal(segmentCenterAngleRad(0), -Math.PI / 2);
  });

  it("Segmentbreite ist 18° (Math.PI/10), symmetrisch um den Mittelwinkel", () => {
    const [ start, end ] = segmentBoundaryAnglesRad(0);
    const center = segmentCenterAngleRad(0);
    assert.ok(Math.abs((end - start) - Math.PI / 10) < 1e-9, "Segmentbreite muss 18° sein");
    assert.ok(Math.abs(center - start - Math.PI / 20) < 1e-9);
    assert.ok(Math.abs(end - center - Math.PI / 20) < 1e-9);
  });

  it("20 Segmente ergeben lückenlos 360°", () => {
    const [ firstStart ] = segmentBoundaryAnglesRad(0);
    const [ lastStart, lastEnd ] = segmentBoundaryAnglesRad(19);
    assert.ok(Math.abs((lastEnd - firstStart) - 2 * Math.PI) < 1e-9);
    void lastStart;
  });
});

describe("pointOnCircle / describeAnnularSector — reine Kreisgeometrie", () => {
  it("pointOnCircle bei Winkel 0 liegt auf der positiven x-Achse", () => {
    const p = pointOnCircle(0, 0, 10, 0);
    assert.ok(Math.abs(p.x - 10) < 1e-9);
    assert.ok(Math.abs(p.y - 0) < 1e-9);
  });

  it("pointOnCircle bei Winkel 90° (Math.PI/2) liegt auf der positiven y-Achse (SVG: unten)", () => {
    const p = pointOnCircle(0, 0, 10, Math.PI / 2);
    assert.ok(Math.abs(p.x - 0) < 1e-9);
    assert.ok(Math.abs(p.y - 10) < 1e-9);
  });

  it("describeAnnularSector liefert einen validen SVG-Pfad mit 2 Bogensegmenten", () => {
    const d = describeAnnularSector(0, 0, 5, 10, 0, Math.PI / 2);
    assert.match(d, /^M /);
    assert.equal((d.match(/A /g) ?? []).length, 2, "genau 2 Arc-Kommandos (Außen-/Innenbogen)");
    assert.match(d, /Z$/);
  });

  it("describeAnnularSector: Eckpunkte des Viertelsektors stimmen numerisch", () => {
    const d = describeAnnularSector(0, 0, 0, 10, 0, Math.PI / 2);
    // Zahlen aus dem "A rOuter rOuter 0 0 1 <endX> <endY>"-Kommando extrahieren,
    // statt per Regex auf eine bestimmte Fließkomma-Schreibweise zu prüfen
    // (cos(π/2) ergibt z.B. "6.123233995736766e-16" statt exakt "0").
    const arcMatch = d.match(/A 10 10 0 0 1 (-?[\d.e-]+) (-?[\d.e-]+)/);
    assert.ok(arcMatch, "Außenbogen-Kommando muss vorhanden sein");
    const [ , endX, endY ] = arcMatch!;
    assert.ok(Math.abs(Number(endX) - 0) < 1e-9, "Außenbogen-Ende x nahe 0");
    assert.ok(Math.abs(Number(endY) - 10) < 1e-9, "Außenbogen-Ende y nahe 10");
    assert.match(d, /^M 10 0 /, "Außenbogen-Start bei (10,0)");
  });
});

describe("liveDartToCanvasPoint — Marker-Position", () => {
  function dart(overrides: Partial<ICcLiveBoardDart> = {}): ICcLiveBoardDart {
    return { hit: true, label: "T20", coords: { x: 0, y: -104 }, ...overrides };
  }

  it("undefined → null", () => {
    assert.equal(liveDartToCanvasPoint(undefined), null);
  });

  it("null → null", () => {
    assert.equal(liveDartToCanvasPoint(null), null);
  });

  it("hit=false → null, auch wenn coords vorhanden sind", () => {
    assert.equal(liveDartToCanvasPoint(dart({ hit: false })), null);
  });

  it("hit=true, aber coords fehlen → null (Phase 1: kein Segment-Fallback)", () => {
    assert.equal(liveDartToCanvasPoint(dart({ coords: undefined })), null);
    assert.equal(liveDartToCanvasPoint(dart({ coords: null })), null);
  });

  it("hit=true mit coords → exakt dieselbe Position wie boardCoordsToCanvas", () => {
    const p = liveDartToCanvasPoint(dart());
    const expected = boardCoordsToCanvas(0, -104);
    assert.deepEqual(p, expected);
  });

  it("0 Marker: alle 3 Slots ohne Treffer → keine Positionen", () => {
    const darts: ICcLiveBoardDart[] = [
      { hit: false, label: null },
      { hit: false, label: null },
      { hit: false, label: null },
    ];
    const points = [ 0, 1, 2 ].map(i => liveDartToCanvasPoint(darts[i]));
    assert.deepEqual(points, [ null, null, null ]);
  });

  it("1 Marker: nur der zweite Dart hat coords → genau eine Position", () => {
    const darts: ICcLiveBoardDart[] = [
      { hit: true, label: "S1", coords: undefined },
      { hit: true, label: "T20", coords: { x: 0, y: -104 } },
      { hit: false, label: null },
    ];
    const points = [ 0, 1, 2 ].map(i => liveDartToCanvasPoint(darts[i]));
    assert.equal(points[0], null);
    assert.notEqual(points[1], null);
    assert.equal(points[2], null);
  });

  it("3 Marker: alle drei Darts mit coords → drei unterscheidbare Positionen", () => {
    const darts: ICcLiveBoardDart[] = [
      { hit: true, label: "T20", coords: { x: 0, y: -104 } },
      { hit: true, label: "S20", coords: { x: 5, y: -90 } },
      { hit: true, label: "D20", coords: { x: -3, y: -150 } },
    ];
    const points = [ 0, 1, 2 ].map(i => liveDartToCanvasPoint(darts[i]));
    assert.ok(points.every(p => p !== null));
    const unique = new Set(points.map(p => `${p!.cx},${p!.cy}`));
    assert.equal(unique.size, 3, "alle drei Positionen müssen unterschiedlich sein");
  });
});

describe("parseSegmentLabel — Segment-Fallback (Implementierung Phase 2)", () => {
  it("Triple: \"T20\" → Zone triple, Nummer 20", () => {
    assert.deepEqual(parseSegmentLabel("T20"), { zone: "triple", number: 20 });
  });

  it("Double: \"D20\" → Zone double, Nummer 20", () => {
    assert.deepEqual(parseSegmentLabel("D20"), { zone: "double", number: 20 });
  });

  it("Single: \"S20\" und bloßes \"20\" → Zone outerSingle, Nummer 20 (nicht unterscheidbar von innerem Single)", () => {
    assert.deepEqual(parseSegmentLabel("S20"), { zone: "outerSingle", number: 20 });
    assert.deepEqual(parseSegmentLabel("20"), { zone: "outerSingle", number: 20 });
  });

  it("Outer Bull: \"25\" und \"Outer Bull\" → Zone outerBull", () => {
    assert.deepEqual(parseSegmentLabel("25"), { zone: "outerBull", number: null });
    assert.deepEqual(parseSegmentLabel("Outer Bull"), { zone: "outerBull", number: null });
  });

  it("Bullseye: \"50\", \"Bull\", \"Bullseye\", \"DB\" → Zone bullseye", () => {
    assert.deepEqual(parseSegmentLabel("50"), { zone: "bullseye", number: null });
    assert.deepEqual(parseSegmentLabel("Bull"), { zone: "bullseye", number: null });
    assert.deepEqual(parseSegmentLabel("Bullseye"), { zone: "bullseye", number: null });
    assert.deepEqual(parseSegmentLabel("DB"), { zone: "bullseye", number: null });
  });

  it("fehlendes/leeres Label → null (kein Marker statt Rateergebnis)", () => {
    assert.equal(parseSegmentLabel(null), null);
    assert.equal(parseSegmentLabel(undefined), null);
    assert.equal(parseSegmentLabel(""), null);
  });

  it("nicht interpretierbares Label (z.B. \"MISS\", \"D25\" — es gibt kein D25) → null", () => {
    assert.equal(parseSegmentLabel("MISS"), null);
    assert.equal(parseSegmentLabel("D25"), null);
    assert.equal(parseSegmentLabel("T21"), null);
  });
});

describe("segmentFallbackToCanvasPoint — deterministische Fallback-Position", () => {
  it("T20 liegt oben (kleineres cy als Mitte) und horizontal nahe der Mitte", () => {
    const p = segmentFallbackToCanvasPoint("T20");
    assert.ok(p, "T20 muss eine Position liefern");
    assert.ok(p!.cy < BOARD_VIEWBOX / 2, "T20 liegt oben");
    assert.ok(Math.abs(p!.cx - BOARD_VIEWBOX / 2) < 1, "T20 liegt (fast) exakt zentriert auf der 12-Uhr-Achse");
  });

  it("D20 liegt ebenfalls oben, aber weiter außen (kleineres cy) als T20", () => {
    const t20 = segmentFallbackToCanvasPoint("T20")!;
    const d20 = segmentFallbackToCanvasPoint("D20")!;
    assert.ok(d20.cy < t20.cy, "Doppelring liegt weiter außen (oben) als der Triplering");
  });

  it("Single 20 (\"20\") liegt zwischen Triple- und Doppelring (radial zwischen T20 und D20)", () => {
    const t20 = segmentFallbackToCanvasPoint("T20")!;
    const single20 = segmentFallbackToCanvasPoint("20")!;
    const d20 = segmentFallbackToCanvasPoint("D20")!;
    assert.ok(single20.cy < t20.cy, "Single liegt weiter außen als Triple");
    assert.ok(single20.cy > d20.cy, "Single liegt weiter innen als Double");
  });

  it("25 (Outer Bull) und 50 (Bullseye) liegen beide nahe der Mitte, 50 näher als 25", () => {
    const outerBull = segmentFallbackToCanvasPoint("25")!;
    const bullseye = segmentFallbackToCanvasPoint("50")!;
    const center = BOARD_VIEWBOX / 2;
    assert.deepEqual(bullseye, { cx: center, cy: center }, "Bullseye = exakte Mitte");
    assert.ok(Math.abs(outerBull.cx - center) < 20 && Math.abs(outerBull.cy - center) < 20, "Outer Bull nahe der Mitte");
    assert.notDeepEqual(outerBull, bullseye, "25 und 50 sind unterscheidbare Positionen");
  });

  it("kein/unbekanntes Segment → null", () => {
    assert.equal(segmentFallbackToCanvasPoint(null), null);
    assert.equal(segmentFallbackToCanvasPoint("MISS"), null);
  });

  it("Determinismus: gleiches Label liefert wiederholt exakt dieselbe Position", () => {
    const a = segmentFallbackToCanvasPoint("T19");
    const b = segmentFallbackToCanvasPoint("T19");
    assert.deepEqual(a, b);
  });
});

describe("resolveLiveDartPoint — Priorität coords vor Segment-Fallback", () => {
  it("coords vorhanden → coords haben Vorrang vor dem Segment-Fallback", () => {
    const dart: ICcLiveBoardDart = { hit: true, label: "T20", coords: { x: 50, y: 50 } };
    const resolved = resolveLiveDartPoint(dart);
    const viaCoords = liveDartToCanvasPoint(dart);
    const viaFallback = segmentFallbackToCanvasPoint(dart.label);
    assert.deepEqual(resolved, viaCoords);
    assert.notDeepEqual(resolved, viaFallback, "Fallback-Position (T20-Mitte) darf hier NICHT verwendet werden");
  });

  it("coords fehlen, aber gültiges Segment → Segment-Fallback greift", () => {
    const dart: ICcLiveBoardDart = { hit: true, label: "D16", coords: null };
    const resolved = resolveLiveDartPoint(dart);
    assert.deepEqual(resolved, segmentFallbackToCanvasPoint("D16"));
    assert.notEqual(resolved, null);
  });

  it("coords fehlen UND Segment fehlt/unbekannt → null (kein erfundener Marker)", () => {
    assert.equal(resolveLiveDartPoint({ hit: true, label: null, coords: null }), null);
    assert.equal(resolveLiveDartPoint({ hit: true, label: "MISS", coords: undefined }), null);
  });

  it("hit=false → immer null, unabhängig von coords/label", () => {
    assert.equal(resolveLiveDartPoint({ hit: false, label: "T20", coords: { x: 0, y: -104 } }), null);
  });

  it("0/1/2/3 Marker über resolveLiveDartPoint, gemischt aus coords und Fallback", () => {
    const zero: ICcLiveBoardDart[] = [
      { hit: false, label: null, coords: null },
      { hit: false, label: null, coords: null },
      { hit: false, label: null, coords: null },
    ];
    assert.deepEqual([ 0, 1, 2 ].map(i => resolveLiveDartPoint(zero[i])), [ null, null, null ]);

    const one: ICcLiveBoardDart[] = [
      { hit: true, label: "T20", coords: null }, // Fallback
      { hit: false, label: null, coords: null },
      { hit: false, label: null, coords: null },
    ];
    const onePoints = [ 0, 1, 2 ].map(i => resolveLiveDartPoint(one[i]));
    assert.equal(onePoints.filter(p => p !== null).length, 1);

    const two: ICcLiveBoardDart[] = [
      { hit: true, label: "T20", coords: { x: 0, y: -104 } }, // echte coords
      { hit: true, label: "S1", coords: null }, // Fallback
      { hit: false, label: null, coords: null },
    ];
    const twoPoints = [ 0, 1, 2 ].map(i => resolveLiveDartPoint(two[i]));
    assert.equal(twoPoints.filter(p => p !== null).length, 2);

    const three: ICcLiveBoardDart[] = [
      { hit: true, label: "T20", coords: { x: 0, y: -104 } },
      { hit: true, label: "S20", coords: null },
      { hit: true, label: "D20", coords: null },
    ];
    const threePoints = [ 0, 1, 2 ].map(i => resolveLiveDartPoint(three[i]));
    assert.ok(threePoints.every(p => p !== null), "maximal 3 Marker, hier alle 3 belegt");
    const unique = new Set(threePoints.map(p => `${p!.cx},${p!.cy}`));
    assert.equal(unique.size, 3, "alle drei Fallback-/Echt-Positionen unterscheidbar");
  });
});

describe("Regression — Wiederverwendung statt zweiter Board-Mathematik", () => {
  it("components/Settings/PrecisionMap.vue bleibt funktional unverändert (Original-Konstanten weiterhin vorhanden)", async () => {
    const text = await source("components/Settings/PrecisionMap.vue");
    assert.match(
      text,
      /const R = \{ db: 6\.35, bull: 15\.9, tripleIn: 99, tripleOut: 107, doubleIn: 162, doubleOut: 170 \};/,
      "PrecisionMap.vue darf nicht verändert worden sein",
    );
    assert.match(text, /const VIEWBOX = 400;/);
    assert.match(text, /function toCanvas\(x: number, y: number\)/);
  });

  it("components/ControlCenter/CcLiveBoard.vue ist eine reine Presentation Component (keine WebSocket-/Match-State-/API-Logik)", async () => {
    const text = await source("components/ControlCenter/CcLiveBoard.vue");
    assert.doesNotMatch(text, /useControlCenterStatus/, "keine eigene Match-State-Ermittlung");
    assert.doesNotMatch(text, /browser\.runtime\.sendMessage/, "keine API-Aufrufe");
    assert.doesNotMatch(text, /processWebSocketMessage|websocket-capture/, "keine WebSocket-Anbindung");
    assert.match(text, /from "@\/utils\/dartboard-geometry"/, "muss die geteilte Geometrie importieren, keine eigene Board-Mathematik");
    assert.doesNotMatch(text, /const R = \{ db:/, "darf die Board-Konstanten nicht erneut lokal definieren");
  });

  it("CcLiveBoard.vue liest nur Typen aus dem geschützten Kern, keine Werte/Logik", async () => {
    const text = await source("components/ControlCenter/CcLiveBoard.vue");
    assert.doesNotMatch(text, /from ["'].*(canonical-match-result|event-dedupe)["']/, "kein Import aus geschütztem Kern");
    assert.doesNotMatch(text, /from ["'].*websocket-helpers["']/, "keine direkte Kopplung an websocket-helpers in Phase 1");
  });

  it("CcLiveBoard.vue bleibt quadratisch/responsiv (aspect-ratio 1/1, keine feste Pixelgröße)", async () => {
    const cssText = await source("entrypoints/controlcenter/style.css");
    assert.match(cssText, /\.cc-live-board\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1;/s);
    assert.doesNotMatch(cssText, /\.cc-live-board\s*\{[^}]*width:\s*\d+px/s, "keine feste Breite in Pixeln");
  });

  it("CcLiveBoard.vue übernimmt keine Hersteller-Logos/Markenzeichen", async () => {
    const text = await source("components/ControlCenter/CcLiveBoard.vue");
    assert.doesNotMatch(text, /winmau/i);
    assert.doesNotMatch(text, /target|unicorn|bulls(?!eye)/i);
  });

  it("CcLiveBoard.vue unterstützt genau 3 Dart-Marker-Slots", async () => {
    const text = await source("components/ControlCenter/CcLiveBoard.vue");
    assert.match(text, /cc-live-board-dart-\$\{i \+ 1\}/);
    assert.match(text, /\[\s*0,\s*1,\s*2\s*\]\.map/);
  });
});
