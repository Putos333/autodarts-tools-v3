<template>
  <div class="cc-grid" data-testid="cc-board">
    <!-- (A) HEADER -->
    <div class="cc-col-12">
      <CcCard
        title="BOARD & AUTOSCORING"
        subtitle="Diagnose und Status — kein Ersatz für Autodarts' eigene Kalibrierung/Erkennung"
        icon="icon-[pixelarticons--bullseye]"
        accent="gold"
      >
        <template #status>
          <CcStatusPill :label="connectionLabel" :tone="connectionTone" class="is-sm" />
          <CcStatusPill v-if="hasBoardSignal" :label="boardStatusLabel" :tone="boardTone" class="is-sm" />
        </template>

        <p class="cc-note" style="font-size: 13px;">
          Dieser Bereich zeigt ausschließlich, was die Erweiterung tatsächlich vom Board/der
          WebSocket-Verbindung empfängt. Kamera-Erkennung, Kalibrierung und Autoscoring bleiben
          vollständig bei Autodarts selbst — hier wird nichts nachgebaut, nur gespiegelt.
        </p>
      </CcCard>
    </div>

    <!-- (B) VERBINDUNG -->
    <div class="cc-col-6">
      <CcCard title="Verbindung" subtitle="WebSocket-Status der Extension" icon="icon-[pixelarticons--wifi]" accent="muted">
        <div class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
          <CcStatTile label="Status" :value="connectionLabel" :accent="connectionTileAccent" />
          <CcStatTile label="Letztes Signal" :value="lastSignalAgo" />
          <CcStatTile label="Offene Sockets" :value="openSockets" />
        </div>
        <p class="cc-note" style="margin-top: 10px; font-size: 12px;">
          {{ connectionHint }}
        </p>
      </CcCard>
    </div>

    <!-- (C) BOARD -->
    <div class="cc-col-6">
      <CcCard title="Board" subtitle="Letztes bekanntes Board-Ereignis" icon="icon-[pixelarticons--bullseye]" accent="muted">
        <div v-if="hasBoardSignal" class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
          <CcStatTile label="Status" :value="boardStatusLabel" :accent="boardTileAccent" />
          <CcStatTile label="Letztes Ereignis" :value="boardEvent || null" />
          <CcStatTile label="Würfe (Session)" :value="boardThrows" />
        </div>
        <CcEmptyState
          v-else
          icon="icon-[pixelarticons--bullseye]"
          title="Noch kein Board-Signal empfangen"
          text="Sobald Autodarts ein Board-Ereignis sendet, erscheint der Status hier."
        />
      </CcCard>
    </div>

    <!-- (D) HINWEIS + LINK ZU KLASSISCHEN EINSTELLUNGEN -->
    <div class="cc-col-12">
      <CcCard title="Weitere Board-Funktionen" icon="icon-[pixelarticons--sliders]" accent="muted">
        <p class="cc-note" style="font-size: 13px; margin-bottom: 12px;">
          Externe Boards verwalten, Board-Themes und Kalibrierung sind bereits über die
          klassischen Einstellungen erreichbar — sie werden hier noch nicht dupliziert, um den
          funktionierenden Stand nicht zu gefährden.
        </p>
        <div class="cc-btn-row">
          <button @click="() => openClassicSettings()" class="cc-btn is-accent" type="button" data-testid="cc-board-open-classic">
            <span class="icon-[pixelarticons--external-link]" />
            <span>Klassische Einstellungen öffnen</span>
          </button>
        </div>
      </CcCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import CcCard from "../CcCard.vue";
import CcStatTile from "../CcStatTile.vue";
import CcStatusPill from "../CcStatusPill.vue";
import CcEmptyState from "../CcEmptyState.vue";
import { openClassicSettings } from "../open-autodarts";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

const {
  connectionLabel,
  connectionTone,
  connectionHint,
  lastSignalAgo,
  openSockets,
  hasBoardSignal,
  boardStatusLabel,
  boardTone,
  boardEvent,
  boardThrows,
} = useControlCenterStatus();

/** CcStatTile kennt nur "plain"/"accent"/"gold" — TTone (ok/warn/bad/idle/accent/gold) wird gemappt. */
function toneToTileAccent(tone: string): "plain" | "accent" | "gold" {
  if (tone === "gold") return "gold";
  if (tone === "ok" || tone === "accent") return "accent";
  return "plain";
}

const connectionTileAccent = computed(() => toneToTileAccent(connectionTone.value));
const boardTileAccent = computed(() => toneToTileAccent(boardTone.value));
</script>
