/**
 * dartboard-geometry.ts – Reine Board-Geometrie/Koordinaten-Transformation
 * für die grafische Live-Dartscheibe (CC Live Board, Implementierung Phase 1).
 *
 * Die Radien (mm), die ViewBox-Größe und die Koordinaten-Transformation sind
 * 1:1 aus der bereits bestehenden, produktiv genutzten Board-SVG-Geometrie in
 * components/Settings/PrecisionMap.vue übernommen (dort lokal in <script
 * setup> definiert als `R`/`VIEWBOX`/`SCALE`/`toCanvas()`). Diese Datei
 * dupliziert keine zweite, abweichende Board-Mathematik — die Werte sind
 * identisch zur Quelle. PrecisionMap.vue selbst bleibt unverändert.
 *
 * Die Segment-Reihenfolge (`BOARD_SEGMENT_ORDER`) ist die international
 * standardisierte Dartscheiben-Nummerierung (beginnend bei 20 oben, im
 * Uhrzeigersinn) — eine öffentlich bekannte, feste Eigenschaft jeder
 * Standard-Dartscheibe, keine Autodarts-spezifische oder erfundene Angabe.
 */

/** Radien der Board-Zonen in mm, gemessen vom Mittelpunkt. */
export interface IBoardRadiiMm {
  db: number;
  bull: number;
  tripleIn: number;
  tripleOut: number;
  doubleIn: number;
  doubleOut: number;
}

/** Identisch zu `R` in components/Settings/PrecisionMap.vue. */
export const BOARD_RADII_MM: IBoardRadiiMm = {
  db: 6.35,
  bull: 15.9,
  tripleIn: 99,
  tripleOut: 107,
  doubleIn: 162,
  doubleOut: 170,
};

/** Identisch zu `VIEWBOX` in PrecisionMap.vue. */
export const BOARD_VIEWBOX = 400;

/** Identisch zu `SCALE` in PrecisionMap.vue (20mm Rand um den Doppelring). */
export const BOARD_SCALE = BOARD_VIEWBOX / (2 * BOARD_RADII_MM.doubleOut + 20);

export interface ICanvasPoint {
  cx: number;
  cy: number;
}

/**
 * Wandelt eine Autodarts-Board-Koordinate (mm, Ursprung = Mittelpunkt) in
 * eine SVG-ViewBox-Koordinate um. Identische Formel wie `toCanvas()` in
 * PrecisionMap.vue: `y` wird NICHT gespiegelt — ein negatives `y` (oberer
 * Bereich, z.B. T20, vgl. `T20_CENTER` in utils/heatmap-storage.ts) ergibt
 * einen kleineren `cy`-Wert, was in SVGs Y-nach-unten-System ebenfalls
 * "oben" bedeutet.
 */
export function boardCoordsToCanvas(
  x: number,
  y: number,
  viewBox: number = BOARD_VIEWBOX,
  scale: number = BOARD_SCALE,
): ICanvasPoint {
  return {
    cx: viewBox / 2 + x * scale,
    cy: viewBox / 2 + y * scale,
  };
}

/**
 * Standard-Nummernkranz im Uhrzeigersinn, beginnend bei 20 oben (12 Uhr).
 * Index 0 = "20" (oben), Index 5 = 90° im Uhrzeigersinn, usw.
 */
export const BOARD_SEGMENT_ORDER: readonly number[] = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];

const SEGMENT_ANGLE_STEP = Math.PI / 10; // 360° / 20 Segmente = 18°
const SEGMENT_HALF_STEP = Math.PI / 20; // 9° — halbe Segmentbreite

/**
 * Mittelwinkel (Radiant, SVG-Konvention) des Segments an `index` (0..19).
 * Index 0 liegt bei -90° (oben) — dieselbe Ausrichtung wie die
 * Sektor-Trennlinien in PrecisionMap.vue
 * (`(i-1) * Math.PI/10 - Math.PI/2 - Math.PI/20`).
 */
export function segmentCenterAngleRad(index: number): number {
  return index * SEGMENT_ANGLE_STEP - Math.PI / 2;
}

/** Start-/End-Winkel (Radiant) des Segments an `index`. */
export function segmentBoundaryAnglesRad(index: number): [number, number] {
  const center = segmentCenterAngleRad(index);
  return [ center - SEGMENT_HALF_STEP, center + SEGMENT_HALF_STEP ];
}

/** Punkt auf einem Kreis um (`cx`,`cy`) mit Radius `r` bei Winkel `angleRad`. */
export function pointOnCircle(cx: number, cy: number, r: number, angleRad: number): { x: number; y: number } {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

/**
 * SVG-Pfad ("d"-Attribut) für einen Kreisring-Sektor (Donut-Wedge) zwischen
 * `rInner`/`rOuter` und `angleStartRad`/`angleEndRad`. Reine Geometrie, kein
 * Board-Wissen — Grundlage für Single-/Triple-/Double-Zonen.
 */
export function describeAnnularSector(
  cx: number,
  cy: number,
  rInner: number,
  rOuter: number,
  angleStartRad: number,
  angleEndRad: number,
): string {
  const outerStart = pointOnCircle(cx, cy, rOuter, angleStartRad);
  const outerEnd = pointOnCircle(cx, cy, rOuter, angleEndRad);
  const innerEnd = pointOnCircle(cx, cy, rInner, angleEndRad);
  const innerStart = pointOnCircle(cx, cy, rInner, angleStartRad);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${rOuter} ${rOuter} 0 0 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${rInner} ${rInner} 0 0 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

/**
 * Ein Dart-Slot für die Live-Board-Darstellung — identisch zu `ICcLiveDart`
 * aus utils/live-throw.ts (dort um `coords` erweitert, Implementierung
 * Phase 2). Eigener Alias statt direktem Re-Export, damit Verbraucher
 * dieser Geometrie-Datei nicht zwingend von der Vue-losen live-throw.ts
 * abhängen müssen — die Form bleibt aber exakt dieselbe, keine zweite,
 * abweichende Definition.
 */
export type ICcLiveBoardDart = ICcLiveDartShape;

interface ICcLiveDartShape {
  hit: boolean;
  label: string | null;
  coords?: { x: number; y: number } | null;
}

/**
 * Liefert die Canvas-Position eines Dart-Markers aus einer ECHTEN,
 * gemeldeten Board-Koordinate — oder `null`, wenn der Dart nicht getroffen
 * hat oder keine Koordinate vorliegt. Kein Fallback (siehe
 * `resolveLiveDartPoint` für coords+Segment-Fallback kombiniert).
 */
export function liveDartToCanvasPoint(dart: ICcLiveBoardDart | null | undefined): ICanvasPoint | null {
  if (!dart || !dart.hit || !dart.coords) return null;
  return boardCoordsToCanvas(dart.coords.x, dart.coords.y);
}

/**
 * Segment-Fallback (Implementierung Phase 2): wenn keine echte Koordinate
 * gemeldet wurde, aber `segment.name` bekannt ist, wird der Dart
 * deterministisch innerhalb der ZONE dieses Segments platziert (Mitte des
 * jeweiligen Radius-Rings, Mittelwinkel des Segments). Keine hartcodierten
 * Pixelpositionen, keine Zufälligkeit — nur die bereits bestehende
 * Board-Geometrie (`BOARD_RADII_MM`, `BOARD_SEGMENT_ORDER`,
 * `segmentCenterAngleRad`).
 */
type IBoardZone = "bullseye" | "outerBull" | "innerSingle" | "triple" | "outerSingle" | "double";

export interface IParsedSegment {
  zone: IBoardZone;
  /** `null` für die beiden Bull-Zonen, sonst 1..20. */
  number: number | null;
}

/**
 * Parst `segment.name` (verbatim von Autodarts, vgl. Kommentar in
 * utils/live-throw.ts) in Zone + Nummer. Reale, bereits im Projekt belegte
 * Formate (siehe entrypoints/match.content/precision-tracker.ts
 * `formatSegment()`): "Bull"/"Bullseye" (50), "25"/"Outer Bull" (25),
 * "T{n}"/"D{n}"/"S{n}" bzw. bloßes "{n}" für Single.
 *
 * Liefert `null`, wenn das Label nicht sicher interpretierbar ist — dann
 * gibt es KEINEN Marker, statt eine geratene Position zu erfinden.
 */
export function parseSegmentLabel(label: string | null | undefined): IParsedSegment | null {
  if (!label) return null;
  const raw = label.trim();

  if (raw === "Bull" || raw === "Bullseye" || raw === "50" || raw === "DB") {
    return { zone: "bullseye", number: null };
  }
  if (raw === "25" || raw === "Outer Bull") {
    return { zone: "outerBull", number: null };
  }

  const match = /^([TDS]?)(\d{1,2})$/.exec(raw);
  if (!match) return null;
  const [ , prefix, numStr ] = match;
  const number = Number(numStr);
  if (!BOARD_SEGMENT_ORDER.includes(number)) return null;

  if (prefix === "T") return { zone: "triple", number };
  if (prefix === "D") return { zone: "double", number };
  // "S{n}" oder bloßes "{n}": Single ist im Label nicht zwischen innerem und
  // äußerem Single-Ring unterscheidbar. Deterministisch die äußere
  // Single-Zone (zwischen Triple- und Doppelring) — das größere, klassische
  // "Single"-Feld direkt am Nummernkranz.
  return { zone: "outerSingle", number };
}

function zoneRadiiMm(zone: Exclude<IBoardZone, "bullseye" | "outerBull">): [number, number] {
  switch (zone) {
    case "innerSingle": return [ BOARD_RADII_MM.bull, BOARD_RADII_MM.tripleIn ];
    case "triple": return [ BOARD_RADII_MM.tripleIn, BOARD_RADII_MM.tripleOut ];
    case "outerSingle": return [ BOARD_RADII_MM.tripleOut, BOARD_RADII_MM.doubleIn ];
    case "double": return [ BOARD_RADII_MM.doubleIn, BOARD_RADII_MM.doubleOut ];
  }
}

/**
 * Deterministische Fallback-Canvas-Position für ein Segment-Label, oder
 * `null` wenn das Label fehlt/nicht interpretierbar ist.
 */
export function segmentFallbackToCanvasPoint(label: string | null | undefined): ICanvasPoint | null {
  const parsed = parseSegmentLabel(label);
  if (!parsed) return null;

  if (parsed.zone === "bullseye") {
    return boardCoordsToCanvas(0, 0);
  }
  if (parsed.zone === "outerBull") {
    const radiusMm = (BOARD_RADII_MM.db + BOARD_RADII_MM.bull) / 2;
    const mm = pointOnCircle(0, 0, radiusMm, -Math.PI / 2);
    return boardCoordsToCanvas(mm.x, mm.y);
  }

  const index = BOARD_SEGMENT_ORDER.indexOf(parsed.number!);
  if (index === -1) return null; // defensiv, durch parseSegmentLabel bereits ausgeschlossen

  const [ rInner, rOuter ] = zoneRadiiMm(parsed.zone);
  const radiusMm = (rInner + rOuter) / 2;
  const angle = segmentCenterAngleRad(index);
  const mm = pointOnCircle(0, 0, radiusMm, angle);
  return boardCoordsToCanvas(mm.x, mm.y);
}

/**
 * Kombinierte Live-Dart-Position: echte Koordinate hat IMMER Vorrang.
 * Nur wenn keine Koordinate gemeldet wurde, aber der Dart getroffen hat und
 * ein interpretierbares Segment vorliegt, greift der Segment-Fallback.
 * Weder Treffer noch Koordinate noch interpretierbares Segment → `null`
 * (kein Marker, keine erfundene Position).
 */
export function resolveLiveDartPoint(dart: ICcLiveBoardDart | null | undefined): ICanvasPoint | null {
  const fromCoords = liveDartToCanvasPoint(dart);
  if (fromCoords) return fromCoords;
  if (!dart || !dart.hit) return null;
  return segmentFallbackToCanvasPoint(dart.label);
}
