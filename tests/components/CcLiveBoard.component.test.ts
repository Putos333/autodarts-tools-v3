/**
 * Phase 4 — Component Test Foundation: CcLiveBoard.vue.
 *
 * Mountet die ECHTE Vue-Komponente (nicht nachgebaut) via @vue/test-utils +
 * happy-dom (Vitest, isoliert von node:test — siehe vitest.config.ts).
 *
 * Erwartete Marker-Positionen werden ausschließlich über die bereits
 * bestehenden, produktiven Geometrie-Funktionen aus
 * utils/dartboard-geometry.ts berechnet (boardCoordsToCanvas,
 * segmentFallbackToCanvasPoint) — keine zweite, eigene Test-Geometrie.
 */

import { describe, expect, it } from "vitest";
import { mount, type DOMWrapper, type VueWrapper } from "@vue/test-utils";

import CcLiveBoard from "../../components/ControlCenter/CcLiveBoard.vue";
import {
  BOARD_VIEWBOX,
  boardCoordsToCanvas,
  segmentFallbackToCanvasPoint,
  type ICcLiveBoardDart,
} from "../../utils/dartboard-geometry";

const T20_COORDS = { x: 0, y: -103 };
const D16_COORDS = { x: -40, y: 128 };
const BULL_COORDS = { x: 1, y: -1 };

function markerCircles(wrapper: VueWrapper): DOMWrapper<Element>[] {
  return wrapper.findAll("circle.cc-lb-dart");
}

function attr(el: { attributes: (name: string) => string | undefined }, name: string) {
  return el.attributes(name);
}

describe("CcLiveBoard.vue", () => {
  it("mountet ohne Fehler mit Default-Props (kein darts-Prop übergeben)", () => {
    expect(() => mount(CcLiveBoard)).not.toThrow();
    const wrapper = mount(CcLiveBoard);
    expect(wrapper.find('[data-testid="cc-live-board"]').exists()).toBe(true);
  });

  it("rendert die Basis-Board-Elemente (Bull, Bullseye, 20 Triple-/Double-Segmente) unabhängig von den Darts", () => {
    const wrapper = mount(CcLiveBoard, { props: { darts: [] } });
    expect(wrapper.find('[data-testid="cc-live-board-bull"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cc-live-board-bullseye"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="cc-live-board-triple"]')).toHaveLength(20);
    expect(wrapper.findAll('[data-testid="cc-live-board-double"]')).toHaveLength(20);
  });

  it("leerer Dart-Zustand: keine Marker sichtbar", () => {
    const wrapper = mount(CcLiveBoard, { props: { darts: [] } });
    expect(markerCircles(wrapper)).toHaveLength(0);
  });

  it("1 Dart (mit echten coords) → genau 1 sichtbarer Marker", () => {
    const darts: ICcLiveBoardDart[] = [ { hit: true, label: "T20", coords: T20_COORDS } ];
    const wrapper = mount(CcLiveBoard, { props: { darts } });
    expect(markerCircles(wrapper)).toHaveLength(1);
    expect(wrapper.find('[data-testid="cc-live-board-dart-1"]').exists()).toBe(true);
  });

  it("2 Darts → genau 2 sichtbare Marker", () => {
    const darts: ICcLiveBoardDart[] = [
      { hit: true, label: "T20", coords: T20_COORDS },
      { hit: true, label: "D16", coords: D16_COORDS },
    ];
    const wrapper = mount(CcLiveBoard, { props: { darts } });
    expect(markerCircles(wrapper)).toHaveLength(2);
  });

  it("3 Darts → genau 3 sichtbare Marker", () => {
    const darts: ICcLiveBoardDart[] = [
      { hit: true, label: "T20", coords: T20_COORDS },
      { hit: true, label: "D16", coords: D16_COORDS },
      { hit: true, label: "Bull", coords: BULL_COORDS },
    ];
    const wrapper = mount(CcLiveBoard, { props: { darts } });
    expect(markerCircles(wrapper)).toHaveLength(3);
  });

  it("niemals mehr als 3 sichtbare Marker, auch bei >3 übergebenen Darts", () => {
    const darts: ICcLiveBoardDart[] = [
      { hit: true, label: "T20", coords: T20_COORDS },
      { hit: true, label: "D16", coords: D16_COORDS },
      { hit: true, label: "Bull", coords: BULL_COORDS },
      { hit: true, label: "25", coords: undefined },
      { hit: true, label: "5", coords: undefined },
    ];
    const wrapper = mount(CcLiveBoard, { props: { darts } });
    expect(markerCircles(wrapper)).toHaveLength(3);
  });

  it("coords-basierter Marker liegt exakt an der über boardCoordsToCanvas berechneten Position (echte Geometrie-Funktion)", () => {
    const darts: ICcLiveBoardDart[] = [ { hit: true, label: "T20", coords: T20_COORDS } ];
    const wrapper = mount(CcLiveBoard, { props: { darts } });
    const el = wrapper.get('[data-testid="cc-live-board-dart-1"]');
    const expected = boardCoordsToCanvas(T20_COORDS.x, T20_COORDS.y);
    expect(Number(attr(el, "cx"))).toBeCloseTo(expected.cx, 5);
    expect(Number(attr(el, "cy"))).toBeCloseTo(expected.cy, 5);
  });

  it("Segment-Fallback ohne coords: Marker liegt an der über segmentFallbackToCanvasPoint berechneten Position", () => {
    const darts: ICcLiveBoardDart[] = [ { hit: true, label: "T20", coords: undefined } ];
    const wrapper = mount(CcLiveBoard, { props: { darts } });
    const el = wrapper.get('[data-testid="cc-live-board-dart-1"]');
    const expected = segmentFallbackToCanvasPoint("T20")!;
    expect(Number(attr(el, "cx"))).toBeCloseTo(expected.cx, 5);
    expect(Number(attr(el, "cy"))).toBeCloseTo(expected.cy, 5);
  });

  it("coords: null verhält sich wie fehlende coords → Segment-Fallback greift, kein Crash", () => {
    const darts: ICcLiveBoardDart[] = [ { hit: true, label: "D16", coords: null } ];
    expect(() => mount(CcLiveBoard, { props: { darts } })).not.toThrow();
    const wrapper = mount(CcLiveBoard, { props: { darts } });
    expect(markerCircles(wrapper)).toHaveLength(1);
    const expected = segmentFallbackToCanvasPoint("D16")!;
    const el = wrapper.get('[data-testid="cc-live-board-dart-1"]');
    expect(Number(attr(el, "cx"))).toBeCloseTo(expected.cx, 5);
  });

  it.each([
    [ "Bull/50", "Bull" ],
    [ "25", "25" ],
    [ "Single", "20" ],
    [ "Double", "D20" ],
    [ "Triple", "T20" ],
  ])("%s-Segment ohne coords ergibt genau den Fallback-Punkt aus segmentFallbackToCanvasPoint", (_label, segment) => {
    const darts: ICcLiveBoardDart[] = [ { hit: true, label: segment, coords: undefined } ];
    const wrapper = mount(CcLiveBoard, { props: { darts } });
    const el = wrapper.get('[data-testid="cc-live-board-dart-1"]');
    const expected = segmentFallbackToCanvasPoint(segment)!;
    expect(Number(attr(el, "cx"))).toBeCloseTo(expected.cx, 5);
    expect(Number(attr(el, "cy"))).toBeCloseTo(expected.cy, 5);
  });

  it("Turn-Wechsel (Prop-Update auf leeres darts-Array) entfernt alle Marker", async () => {
    const darts: ICcLiveBoardDart[] = [
      { hit: true, label: "T20", coords: T20_COORDS },
      { hit: true, label: "D16", coords: D16_COORDS },
      { hit: true, label: "Bull", coords: BULL_COORDS },
    ];
    const wrapper = mount(CcLiveBoard, { props: { darts } });
    expect(markerCircles(wrapper)).toHaveLength(3);

    await wrapper.setProps({ darts: [] });
    expect(markerCircles(wrapper)).toHaveLength(0);
  });

  it("Marker-Reaktivität: Prop-Update von 0 → 1 → 2 → 3 Darts aktualisiert die Anzahl sichtbarer Marker live", async () => {
    const wrapper = mount(CcLiveBoard, { props: { darts: [] } });
    expect(markerCircles(wrapper)).toHaveLength(0);

    await wrapper.setProps({ darts: [ { hit: true, label: "T20", coords: T20_COORDS } ] });
    expect(markerCircles(wrapper)).toHaveLength(1);

    await wrapper.setProps({
      darts: [
        { hit: true, label: "T20", coords: T20_COORDS },
        { hit: true, label: "D16", coords: D16_COORDS },
      ],
    });
    expect(markerCircles(wrapper)).toHaveLength(2);

    await wrapper.setProps({
      darts: [
        { hit: true, label: "T20", coords: T20_COORDS },
        { hit: true, label: "D16", coords: D16_COORDS },
        { hit: true, label: "Bull", coords: BULL_COORDS },
      ],
    });
    expect(markerCircles(wrapper)).toHaveLength(3);
  });

  it("keine NaN/undefined Positionswerte bei irgendeinem sichtbaren Marker", () => {
    const darts: ICcLiveBoardDart[] = [
      { hit: true, label: "T20", coords: T20_COORDS },
      { hit: true, label: "D16", coords: undefined },
      { hit: true, label: "25", coords: null },
    ];
    const wrapper = mount(CcLiveBoard, { props: { darts } });
    for (const el of markerCircles(wrapper)) {
      const cx = attr(el, "cx");
      const cy = attr(el, "cy");
      expect(cx).not.toBeUndefined();
      expect(cy).not.toBeUndefined();
      expect(Number.isFinite(Number(cx))).toBe(true);
      expect(Number.isFinite(Number(cy))).toBe(true);
    }
  });

  it("keine Exception bei optional fehlenden/kaputten Daten (hit:false, label:null, leeres Objekt-ähnliches Dart)", () => {
    const darts = [
      { hit: false, label: null, coords: undefined },
      { hit: true, label: null, coords: undefined },
      { hit: true, label: "MISS", coords: undefined },
    ] as ICcLiveBoardDart[];
    expect(() => mount(CcLiveBoard, { props: { darts } })).not.toThrow();
    const wrapper = mount(CcLiveBoard, { props: { darts } });
    // Kein Treffer, kein Label, kein interpretierbares Segment → keine geratenen Marker.
    expect(markerCircles(wrapper)).toHaveLength(0);
  });

  it("Board bleibt quadratisch/skalierbar (viewBox 0 0 BOARD_VIEWBOX BOARD_VIEWBOX)", () => {
    const wrapper = mount(CcLiveBoard, { props: { darts: [] } });
    const svg = wrapper.get("svg.cc-live-board-svg");
    expect(svg.attributes("viewBox")).toBe(`0 0 ${BOARD_VIEWBOX} ${BOARD_VIEWBOX}`);
  });
});
