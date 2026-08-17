<template>
  <CcCard
    title="Board & Autoscoring"
    subtitle="Zustand des Boards laut Autoscoring-Meldungen"
    icon="icon-[pixelarticons--bullseye]"
    data-testid="cc-card-board"
  >
    <template #status>
      <!-- Ampel: rot / gelb / grün, genau ein Licht aktiv -->
      <div class="cc-lamp" :title="boardStatusLabel" data-testid="cc-board-lamp">
        <span :class="[ 'cc-lamp-dot', 'is-red', lamp === 'red' && 'is-on' ]" />
        <span :class="[ 'cc-lamp-dot', 'is-amber', lamp === 'amber' && 'is-on' ]" />
        <span :class="[ 'cc-lamp-dot', 'is-green', lamp === 'green' && 'is-on' ]" />
        <span class="cc-lamp-text">{{ boardStatusLabel }}</span>
      </div>
    </template>

    <template v-if="hasBoardSignal">
      <div class="cc-tiles">
        <CcStatTile
          label="Autoscoring"
          :value="autoscoringLabel"
          :accent="lamp === 'green' ? 'accent' : 'plain'"
          :hint="autoscoringHint"
        />
        <CcStatTile
          label="Würfe"
          :value="boardThrows"
          hint="in der aktuellen Aufnahme"
        />
        <CcStatTile
          label="Board"
          :value="boardData.connected ? 'Verbunden' : 'Getrennt'"
        />
      </div>

      <div class="cc-kv" style="margin-top: 14px;">
        <span class="cc-kv-key">Letztes Ereignis</span>
        <span class="cc-kv-val">{{ boardEvent ?? "–" }}</span>
        <span class="cc-kv-key">Roher Zustand</span>
        <span class="cc-kv-val">{{ boardData.status || "–" }}</span>
      </div>
    </template>

    <CcEmptyState
      v-else
      icon="icon-[pixelarticons--device-tablet]"
      title="Kein Board-Status bekannt"
      text="Die Erweiterung hat noch keine Autoscoring-Meldung empfangen. Sobald ein Board in einem Autodarts-Tab läuft, erscheinen hier Zustand, Ereignis und Wurfzähler."
    >
      <template #action>
        <button @click="openAutodarts()" class="cc-btn is-primary" type="button" data-testid="cc-board-open">
          <span class="icon-[pixelarticons--external-link]" />
          <span>Autodarts öffnen</span>
        </button>
      </template>
    </CcEmptyState>

    <template #footer>
      <span v-if="liveness === 'live'">Live-Daten · letztes Signal {{ lastSignalAgo }}</span>
      <span v-else-if="liveness === 'stale'">Letzter bekannter Stand · Signal {{ lastSignalAgo }}</span>
      <span v-else>Quelle: <code>local:board-data</code> — wird von Autodarts-Tabs gefüllt.</span>
    </template>
  </CcCard>
</template>

<script setup lang="ts">
import { computed } from "vue";

import CcCard from "./CcCard.vue";
import CcStatTile from "./CcStatTile.vue";
import CcEmptyState from "./CcEmptyState.vue";
import { openAutodarts } from "./open-autodarts";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

const {
  boardData,
  hasBoardSignal,
  boardStatusLabel,
  boardTone,
  boardEvent,
  boardThrows,
  liveness,
  lastSignalAgo,
} = useControlCenterStatus();

/** Der Ton aus dem Composable wird auf drei Ampellichter reduziert. */
const lamp = computed<"red" | "amber" | "green" | "off">(() => {
  if (!hasBoardSignal.value) return "off";
  switch (boardTone.value) {
    case "ok": return "green";
    case "warn": return "amber";
    case "bad": return "red";
    default: return "off";
  }
});

/**
 * Autoscoring gilt als aktiv, wenn das Board verbunden ist UND wir ein frisches
 * Signal haben. Alles andere ist ausdrücklich unbekannt statt "inaktiv".
 */
const autoscoringLabel = computed(() => {
  if (!hasBoardSignal.value) return null;
  if (liveness.value !== "live") return "Unbekannt";
  return boardData.value.connected ? "Aktiv" : "Inaktiv";
});

const autoscoringHint = computed(() => {
  if (liveness.value !== "live") return "keine aktuellen Daten";
  return boardData.value.connected ? "Board meldet Würfe" : "Board meldet sich nicht";
});
</script>
