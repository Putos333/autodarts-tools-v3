<template>
  <div class="cc-grid">
    <CcCard
      class="cc-col-8"
      :title="section.label"
      :subtitle="section.hint"
      :icon="section.icon"
      accent="muted"
    >
      <template #status>
        <CcStatusPill label="In Vorbereitung" tone="gold" />
      </template>

      <p class="cc-note" style="margin-bottom: 16px;">
        Dieser Bereich ist bereits angelegt, führt in MVP 1 aber noch keine eigenen
        Bedienelemente. Die zugehörigen Funktionen sind vollständig vorhanden und über die
        klassische Einstellungsansicht erreichbar — sie werden hier schrittweise eingehängt,
        damit der aktuelle, funktionierende Stand unangetastet bleibt.
      </p>

      <div class="cc-list">
        <div v-for="item in items" :key="item" class="cc-list-row">
          <span class="cc-list-bullet">▸</span>
          <span>{{ item }}</span>
        </div>
      </div>

      <template #footer>
        <div class="cc-btn-row">
          <button @click="openClassicSettings()" class="cc-btn is-accent" type="button" data-testid="cc-preview-classic">
            <span class="icon-[pixelarticons--external-link]" />
            <span>Klassische Einstellungen öffnen</span>
          </button>
          <button @click="goToDashboard" class="cc-btn" type="button" data-testid="cc-preview-back">
            <span class="icon-[pixelarticons--arrow-left]" />
            <span>Zum Dashboard</span>
          </button>
        </div>
      </template>
    </CcCard>

    <CcCard
      class="cc-col-4"
      title="Status"
      subtitle="Gilt für alle Bereiche"
      icon="icon-[pixelarticons--info-box]"
      accent="muted"
    >
      <div class="cc-tiles">
        <CcStatTile label="Verbindung" :value="connectionLabel" />
        <CcStatTile label="Letztes Signal" :value="lastSignalAgo" />
      </div>
      <p class="cc-note" style="margin-top: 14px;">
        {{ connectionHint }}
      </p>
    </CcCard>
  </div>
</template>

<script setup lang="ts">
import CcCard from "./CcCard.vue";
import CcStatTile from "./CcStatTile.vue";
import CcStatusPill from "./CcStatusPill.vue";
import { openClassicSettings } from "./open-autodarts";
import type { ICcSection } from "./sections";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

defineProps<{
  section: ICcSection;
  /** Was in diesem Bereich später zusammengeführt wird. */
  items: string[];
}>();

const { connectionLabel, connectionHint, lastSignalAgo } = useControlCenterStatus();

/** Der Hash ist die einzige Navigationsquelle (siehe ControlCenter.vue). */
function goToDashboard(): void {
  window.location.hash = "dashboard";
}
</script>
