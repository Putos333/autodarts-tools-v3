<template>
  <div class="cc-grid" data-testid="cc-settings">
    <!-- (A) HEADER -->
    <div class="cc-col-12">
      <CcCard
        title="EINSTELLUNGEN"
        subtitle="Version, Diagnose und Datenschutz — Sprache, Export/Import und Setup-Assistent bleiben in den klassischen Einstellungen"
        icon="icon-[pixelarticons--sliders]"
        accent="gold"
      >
        <p class="cc-note" style="font-size: 13px;">
          Export/Import bestehen bereits im Erweiterungs-Popup und werden hier bewusst nicht
          verdoppelt — ein zweiter Export-Pfad hätte in der Vergangenheit schon einmal zu
          unterschiedlichen Formaten geführt. Alles, was hier steht, ist reine Anzeige.
        </p>
      </CcCard>
    </div>

    <!-- (B) VERSION -->
    <div class="cc-col-4">
      <CcCard title="Version" icon="icon-[pixelarticons--info-box]" accent="muted">
        <div class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));">
          <CcStatTile label="Erweiterung" :value="extensionVersion" />
          <CcStatTile label="Konfig-Schema" :value="configLoaded ? config.version : null" />
        </div>
      </CcCard>
    </div>

    <!-- (C) DATEN / DIAGNOSE -->
    <div class="cc-col-4">
      <CcCard title="Gespeicherte Daten" icon="icon-[pixelarticons--server]" accent="muted">
        <div v-if="diagnosticsLoaded" class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));">
          <CcStatTile label="Match-Verlauf" :value="cmrCount" hint="Canonical Match Results" />
          <CcStatTile label="Trainings-Sessions" :value="trainingHistoryCount" />
        </div>
        <CcEmptyState v-else icon="icon-[pixelarticons--server]" title="Lädt…" />
      </CcCard>
    </div>

    <!-- (D) DATENSCHUTZ -->
    <div class="cc-col-4">
      <CcCard title="Datenschutz" icon="icon-[pixelarticons--lock]" accent="muted">
        <ul class="cc-list" style="list-style: none; padding: 0; margin: 0;">
          <li class="cc-list-row"><span class="icon-[pixelarticons--check]" /><span>Match-/Trainings-Verlauf bleibt lokal im Browser</span></li>
          <li class="cc-list-row"><span class="icon-[pixelarticons--check]" /><span>API-Keys (TTS/KI) werden verschlüsselt gespeichert (AES-GCM)</span></li>
          <li class="cc-list-row"><span class="icon-[pixelarticons--info-box]" /><span>Liga nutzt bei Aktivierung einen externen, anonymen Speicher (Share-Code)</span></li>
        </ul>
      </CcCard>
    </div>

    <!-- (E) LINK -->
    <div class="cc-col-12">
      <CcCard title="Weitere Einstellungen" icon="icon-[pixelarticons--external-link]" accent="muted">
        <p class="cc-note" style="font-size: 13px; margin-bottom: 12px;">
          Sprache, Export/Import, Setup-Assistent und erweiterte Optionen sind vollständig in den
          klassischen Einstellungen verfügbar.
        </p>
        <div class="cc-btn-row">
          <button @click="() => openClassicSettings()" class="cc-btn is-accent" type="button" data-testid="cc-settings-open-classic">
            <span class="icon-[pixelarticons--external-link]" />
            <span>Klassische Einstellungen öffnen</span>
          </button>
        </div>
      </CcCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

import CcCard from "../CcCard.vue";
import CcStatTile from "../CcStatTile.vue";
import CcEmptyState from "../CcEmptyState.vue";
import { openClassicSettings } from "../open-autodarts";
import { AutodartsToolsConfig, AutodartsToolsTrainingHistory, defaultConfig, type IConfig } from "@/utils/storage";
import { getCanonicalMatchResults } from "@/utils/canonical-match-result-storage";

import packageConfig from "../../../package.json";

/** Version kommt aus package.json — keine zweite, driftende Quelle (wie in ControlCenter.vue). */
const extensionVersion = packageConfig.version;

const configLoaded = ref(false);
const config = ref<IConfig>(defaultConfig);
let unwatchConfig: (() => void) | undefined;

async function loadConfig(): Promise<void> {
  config.value = await AutodartsToolsConfig.getValue();
  configLoaded.value = true;
}

const diagnosticsLoaded = ref(false);
const cmrCount = ref<number | null>(null);
const trainingHistoryCount = ref<number | null>(null);

async function loadDiagnostics(): Promise<void> {
  try {
    const [ results, history ] = await Promise.all([
      getCanonicalMatchResults(),
      AutodartsToolsTrainingHistory.getValue(),
    ]);
    cmrCount.value = results.length;
    trainingHistoryCount.value = history.length;
  } catch (error) {
    console.error("[CcSettings] loadDiagnostics failed", error);
  } finally {
    diagnosticsLoaded.value = true;
  }
}

onMounted(async () => {
  await Promise.all([ loadConfig(), loadDiagnostics() ]);
  unwatchConfig = AutodartsToolsConfig.watch(() => {
    void loadConfig();
  });
});

onBeforeUnmount(() => {
  unwatchConfig?.();
  unwatchConfig = undefined;
});
</script>
