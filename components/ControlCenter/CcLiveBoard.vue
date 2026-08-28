<template>
  <div class="cc-live-board" data-testid="cc-live-board">
    <svg
      :viewBox="`0 0 ${BOARD_VIEWBOX} ${BOARD_VIEWBOX}`"
      class="cc-live-board-svg"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Live-Dartscheibe"
    >
      <!-- Board-Rand + Grundfläche -->
      <circle :cx="CENTER" :cy="CENTER" :r="rimRadius" class="cc-lb-rim" />
      <circle :cx="CENTER" :cy="CENTER" :r="BOARD_RADII_MM.doubleOut * BOARD_SCALE" class="cc-lb-face" />

      <!-- Outer Single -->
      <path
        v-for="sector in sectors"
        :key="`os-${sector.number}`"
        :d="sector.outerSinglePath"
        :class="[ 'cc-lb-single', sector.isLight ? 'is-light' : 'is-dark' ]"
      />
      <!-- Inner Single -->
      <path
        v-for="sector in sectors"
        :key="`is-${sector.number}`"
        :d="sector.innerSinglePath"
        :class="[ 'cc-lb-single', sector.isLight ? 'is-light' : 'is-dark' ]"
      />
      <!-- Triple Ring -->
      <path
        v-for="sector in sectors"
        :key="`tr-${sector.number}`"
        :d="sector.triplePath"
        :class="[ 'cc-lb-ring', sector.isLight ? 'is-red' : 'is-green' ]"
        data-testid="cc-live-board-triple"
      />
      <!-- Double Ring -->
      <path
        v-for="sector in sectors"
        :key="`dr-${sector.number}`"
        :d="sector.doublePath"
        :class="[ 'cc-lb-ring', sector.isLight ? 'is-red' : 'is-green' ]"
        data-testid="cc-live-board-double"
      />

      <!-- Sektor-Trennlinien -->
      <g class="cc-lb-lines">
        <line
          v-for="sector in sectors"
          :key="`ln-${sector.number}`"
          :x1="lineInner(sector.index).x" :y1="lineInner(sector.index).y"
          :x2="lineOuter(sector.index).x" :y2="lineOuter(sector.index).y"
        />
      </g>

      <!-- Outer Bull + Bullseye -->
      <circle :cx="CENTER" :cy="CENTER" :r="BOARD_RADII_MM.bull * BOARD_SCALE" class="cc-lb-bull" data-testid="cc-live-board-bull" />
      <circle :cx="CENTER" :cy="CENTER" :r="BOARD_RADII_MM.db * BOARD_SCALE" class="cc-lb-bullseye" data-testid="cc-live-board-bullseye" />

      <!-- Zahlenring -->
      <text
        v-for="sector in sectors"
        :key="`num-${sector.number}`"
        :x="sector.labelPos.x" :y="sector.labelPos.y"
        class="cc-lb-number"
        text-anchor="middle"
        dominant-baseline="middle"
      >{{ sector.number }}</text>

      <!-- Live-Dart-Marker (max. 3): echte Koordinate wenn vorhanden, sonst
           deterministischer Segment-Fallback (siehe resolveLiveDartPoint) —
           beides bereits vom Dashboard bekannt (T20/D16/25/50). -->
      <template v-for="(point, i) in markerPoints" :key="`dart-${i}`">
        <Transition name="cc-lb-dart-pop">
          <circle
            v-if="point"
            :cx="point.cx" :cy="point.cy" :r="markerRadius"
            :class="[ 'cc-lb-dart', `is-dart-${i + 1}` ]"
            :data-testid="`cc-live-board-dart-${i + 1}`"
          />
        </Transition>
      </template>
    </svg>
  </div>
</template>

<script setup lang="ts">
/**
 * CcLiveBoard.vue – reine Darstellungskomponente für die grafische
 * Live-Dartscheibe (Implementierung Phase 1).
 *
 * KEINE WebSocket-Verbindung, KEINE Match-State-Logik, KEINE API-Aufrufe
 * innerhalb dieser Komponente — alle Daten kommen ausschließlich über
 * typisierte Props. Board-Geometrie/Koordinaten-Transformation kommt aus
 * utils/dartboard-geometry.ts (extrahiert aus components/Settings/
 * PrecisionMap.vue, dort unverändert).
 *
 * Noch NICHT in CcMatchHero.vue oder das Dashboard integriert — siehe
 * Implementierungsplan Phase 2.
 */
import { computed } from "vue";

import {
  BOARD_RADII_MM,
  BOARD_VIEWBOX,
  BOARD_SCALE,
  BOARD_SEGMENT_ORDER,
  segmentCenterAngleRad,
  segmentBoundaryAnglesRad,
  describeAnnularSector,
  pointOnCircle,
  resolveLiveDartPoint,
  type ICcLiveBoardDart,
} from "@/utils/dartboard-geometry";

const props = withDefaults(defineProps<{
  /** Bis zu 3 Live-Darts des aktuellen Visits, in Wurf-Reihenfolge. */
  darts?: ICcLiveBoardDart[];
}>(), {
  darts: () => [],
});

const CENTER = BOARD_VIEWBOX / 2;
const rimRadius = BOARD_RADII_MM.doubleOut * BOARD_SCALE + 10;
const markerRadius = 6;
const LABEL_OFFSET = 16;

const sectors = computed(() => BOARD_SEGMENT_ORDER.map((number, index) => {
  const [ start, end ] = segmentBoundaryAnglesRad(index);
  return {
    number,
    index,
    isLight: index % 2 === 0,
    outerSinglePath: describeAnnularSector(
      CENTER, CENTER,
      BOARD_RADII_MM.tripleOut * BOARD_SCALE, BOARD_RADII_MM.doubleIn * BOARD_SCALE,
      start, end,
    ),
    innerSinglePath: describeAnnularSector(
      CENTER, CENTER,
      BOARD_RADII_MM.bull * BOARD_SCALE, BOARD_RADII_MM.tripleIn * BOARD_SCALE,
      start, end,
    ),
    triplePath: describeAnnularSector(
      CENTER, CENTER,
      BOARD_RADII_MM.tripleIn * BOARD_SCALE, BOARD_RADII_MM.tripleOut * BOARD_SCALE,
      start, end,
    ),
    doublePath: describeAnnularSector(
      CENTER, CENTER,
      BOARD_RADII_MM.doubleIn * BOARD_SCALE, BOARD_RADII_MM.doubleOut * BOARD_SCALE,
      start, end,
    ),
    labelPos: pointOnCircle(CENTER, CENTER, BOARD_RADII_MM.doubleOut * BOARD_SCALE + LABEL_OFFSET, segmentCenterAngleRad(index)),
  };
}));

function lineInner(index: number) {
  const [ start ] = segmentBoundaryAnglesRad(index);
  return pointOnCircle(CENTER, CENTER, BOARD_RADII_MM.bull * BOARD_SCALE, start);
}

function lineOuter(index: number) {
  const [ start ] = segmentBoundaryAnglesRad(index);
  return pointOnCircle(CENTER, CENTER, BOARD_RADII_MM.doubleOut * BOARD_SCALE, start);
}

/**
 * Immer genau 3 Slots (0/1/2), unabhängig davon wie viele `darts` übergeben
 * werden. Echte Koordinate hat Vorrang, sonst Segment-Fallback, sonst kein
 * Marker (siehe resolveLiveDartPoint in utils/dartboard-geometry.ts).
 */
const markerPoints = computed(() => [ 0, 1, 2 ].map(i => resolveLiveDartPoint(props.darts[i])));
</script>
