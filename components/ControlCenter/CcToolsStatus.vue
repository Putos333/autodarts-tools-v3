<template>
  <CcCard
    title="Tools-Status"
    subtitle="Aktivierte Autodarts-Tools-Funktionen"
    icon="icon-[pixelarticons--sliders]"
    data-testid="cc-card-tools-status"
  >
    <div class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
      <CcStatusPill
        v-for="feature in features"
        :key="feature.key"
        :label="feature.label"
        :tone="feature.enabled ? 'ok' : 'idle'"
        :meta="feature.enabled ? 'AN' : 'AUS'"
        :data-testid="`cc-tools-status-${feature.key}`"
      />
    </div>

    <template #footer>
      Werte kommen unverändert aus den Erweiterungs-Einstellungen. Umschalten bleibt bewusst
      in der klassischen Ansicht, damit es nur eine Quelle für Änderungen gibt.
      <div class="cc-btn-row" style="margin-top: 8px;">
        <button @click="() => openClassicSettings()" class="cc-btn is-accent" type="button" data-testid="cc-tools-status-open-classic">
          <span class="icon-[pixelarticons--external-link]" />
          <span>Einstellungen öffnen</span>
        </button>
      </div>
    </template>
  </CcCard>
</template>

<script setup lang="ts">
/**
 * Tools-Status — reine Anzeige der bereits existierenden Feature-Toggles aus
 * `AutodartsToolsConfig` (derselben Quelle wie die Popup-Ansicht). Bewusst
 * read-only: Umschalten bleibt im Popup/den klassischen Einstellungen, damit
 * es — wie schon bei `CcSettings.vue` entschieden — nur einen Schreibpfad für
 * die Konfiguration gibt und keine zwei UIs gegeneinander laufen können.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import CcCard from "./CcCard.vue";
import CcStatusPill from "./CcStatusPill.vue";
import { openClassicSettings } from "./open-autodarts";
import { AutodartsToolsConfig, type IConfig } from "@/utils/storage";

const config = ref<IConfig | null>(null);
let unwatchConfig: (() => void) | undefined;

async function loadConfig(): Promise<void> {
  try {
    config.value = await AutodartsToolsConfig.getValue();
  } catch (error) {
    console.error("[CcToolsStatus] loadConfig failed", error);
  }
}

interface IFeatureStatus {
  key: string;
  label: string;
  enabled: boolean;
}

const features = computed<IFeatureStatus[]>(() => {
  const cfg = config.value;
  return [
    { key: "caller", label: "Caller", enabled: !!cfg?.caller?.enabled },
    { key: "crowd", label: "Crowd", enabled: !!cfg?.crowd?.enabled },
    { key: "animations", label: "Animationen", enabled: !!cfg?.animations?.enabled },
    { key: "wled", label: "WLED", enabled: !!cfg?.wledFx?.enabled },
    { key: "screenshot", label: "Screenshots", enabled: !!cfg?.screenshot?.enabled },
    { key: "career", label: "Karriere", enabled: !!cfg?.career?.enabled },
  ];
});

onMounted(async () => {
  await loadConfig();
  unwatchConfig = AutodartsToolsConfig.watch(() => void loadConfig());
});

onBeforeUnmount(() => {
  unwatchConfig?.();
  unwatchConfig = undefined;
});
</script>
