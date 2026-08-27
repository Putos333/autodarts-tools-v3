<template>
  <!--
    Wird ausschließlich gerendert, wenn echte Matchdaten vorliegen.
    Ohne Match: kein Widget, kein Platzhalter, kein erfundener Gegner.
  -->
  <template v-if="hasMatch && matchTitle">
    <div class="cc-live-widget" :data-testid="`cc-live-widget${idSuffix}`">
      <div class="cc-live-widget-head">
        <span v-if="isLive" class="cc-live-dot" />
        <span>{{ headline }}</span>
      </div>

      <!-- Bei zwei Spielern "A vs B", bei einem ehrlich nur der Name -->
      <div class="cc-live-widget-title" :title="matchTitle">{{ matchTitle }}</div>
      <div v-if="isSinglePlayer" class="cc-live-widget-note">Einzelspieler</div>

      <div class="cc-live-widget-row">
        <span class="cc-live-widget-variant">{{ variantLabel }}</span>
        <span v-if="heroScoreLine" class="cc-live-widget-score">{{ heroScoreLine.text }}</span>
      </div>

      <div v-if="scoreCaption || progressLabel" class="cc-live-widget-note">
        <span v-if="scoreCaption">{{ scoreCaption }}</span>
        <span v-if="scoreCaption && progressLabel"> · </span>
        <span v-if="progressLabel">{{ progressLabel }}</span>
      </div>

      <button
        @click="openMatch(openableMatchId, autodartsOrigin)"
        v-if="openableMatchId"
        class="cc-live-widget-btn"
        type="button"
        title="Öffnet dieses Match auf Autodarts"
        :data-testid="`cc-live-widget-open${idSuffix}`"
      >
        Match öffnen
      </button>
      <button
        @click="openLobby(openableLobbyId, autodartsOrigin)"
        v-else-if="openableLobbyId"
        class="cc-live-widget-btn"
        type="button"
        title="Öffnet die zugehörige Lobby auf Autodarts"
        :data-testid="`cc-live-widget-open-lobby${idSuffix}`"
      >
        Lobby öffnen
      </button>
      <button
        @click="goToMatchSection"
        v-else
        class="cc-live-widget-btn"
        type="button"
        title="Zum Match-Bereich im Control Center"
        :data-testid="`cc-live-widget-open-section${idSuffix}`"
      >
        Match-Bereich
      </button>
    </div>

    <!-- Icon-Rail-Variante: nur Live-Punkt und Spielstand -->
    <div class="cc-live-rail" :title="railTitle">
      <span v-if="isLive" class="cc-live-dot" style="margin: 0 auto;" />
      <span v-else class="icon-[pixelarticons--gamepad]" style="color: var(--cc-accent);" />
      <div v-if="heroScoreLine" class="cc-live-rail-score">{{ heroScoreLine.text }}</div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { openLobby, openMatch } from "./open-autodarts";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

/**
 * Issue #13, #8: CcSidebar.vue mountet diese Komponente seit der mobilen
 * Bottom-Nav zweimal (Sidebar + Bottom-Nav, nur eine davon per CSS sichtbar).
 * Ohne `idSuffix` hätten beide DOM-Instanzen dieselben `data-testid`s —
 * ein `getByTestId`-Zugriff könnte die verdeckte statt die sichtbare Instanz
 * treffen. Default "" hält bestehende Testid-Erwartungen unverändert.
 */
const { idSuffix = "" } = defineProps<{ idSuffix?: string }>();

const {
  hasMatch,
  openableMatchId,
  openableLobbyId,
  autodartsOrigin,
  matchFinished,
  matchTitle,
  matchVariant,
  matchSettings,
  matchProgress,
  heroScoreLine,
  players,
  liveness,
} = useControlCenterStatus();

const isLive = computed(() => hasMatch.value && !matchFinished.value && liveness.value === "live");
const isSinglePlayer = computed(() => players.value.length === 1);

const headline = computed(() => {
  if (matchFinished.value) return "Letztes Match";
  return isLive.value ? "Live Match" : "Match";
});

/** Matchtyp: bei X01 der Startwert (z.B. 501), sonst die Variante. */
const variantLabel = computed(() => {
  const baseScore = matchSettings.value?.baseScore;
  if (baseScore !== null && baseScore !== undefined) return String(baseScore);
  return matchVariant.value ?? "–";
});

/** Macht klar, ob der Stand Legs oder Sets zeigt. */
const scoreCaption = computed(() => {
  if (!heroScoreLine.value) return null;
  const variant = matchVariant.value;
  const label = heroScoreLine.value.label;
  return variant && variant !== variantLabel.value ? `${variant} · ${label}` : label;
});

const progressLabel = computed(() => {
  const progress = matchProgress.value;
  if (!progress) return null;
  const parts: string[] = [];
  if (progress.set !== null) parts.push(`Set ${progress.set}`);
  if (progress.leg !== null) parts.push(`Leg ${progress.leg}`);
  return parts.length > 0 ? parts.join(" · ") : null;
});

function goToMatchSection(): void {
  window.location.hash = "match";
}

const railTitle = computed(() =>
  `${matchTitle.value ?? ""}${heroScoreLine.value ? ` · ${heroScoreLine.value.text}` : ""}`,
);
</script>
