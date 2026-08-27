<template>
  <div class="cc-system-strip" data-testid="cc-system-strip">
    <span class="cc-sys-item" data-testid="cc-sys-board">
      Board <b>{{ boardData.connected ? "verbunden" : hasBoardSignal ? "getrennt" : "unbekannt" }}</b>
    </span>
    <span v-if="autoscoringLabel" class="cc-sys-item" data-testid="cc-sys-autoscoring">
      Autoscoring <b>{{ autoscoringLabel }}</b>
    </span>
    <span class="cc-sys-item" data-testid="cc-sys-wled">
      WLED <b>{{ wledEnabled === null ? "unbekannt" : wledEnabled ? "aktiviert" : "deaktiviert" }}</b>
      <span v-if="wledEnabled && wledEffectCount !== null" class="cc-flag">{{ wledEffectCount }} Effekte konfiguriert</span>
    </span>
    <span class="cc-sys-item" data-testid="cc-sys-caller">
      Caller <b>{{ callerEnabled === null ? "unbekannt" : callerEnabled ? "aktiviert" : "deaktiviert" }}</b>
      <span class="cc-flag">Einstellung, kein Live-Status</span>
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * Quiet Infrastruktur-Zeile. Board/Autoscoring kommen unverändert aus dem
 * geteilten Composable (dieselbe Ableitung wie CcBoardCard.vue). WLED/Caller
 * lesen `AutodartsToolsConfig` direkt — Konfigurationsstand, kein Live-
 * Erreichbarkeits-Check (den gibt es nicht, siehe Datenaudit).
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import { useControlCenterStatus } from "@/composables/useControlCenterStatus";
import { AutodartsToolsConfig, defaultConfig, type IConfig } from "@/utils/storage";

const { hasBoardSignal, boardData, liveness } = useControlCenterStatus();

const autoscoringLabel = computed(() => {
  if (!hasBoardSignal.value) return null;
  if (liveness.value !== "live") return "unbekannt";
  return boardData.value.connected ? "aktiv" : "inaktiv";
});

const config = ref<IConfig | null>(null);
let unwatchConfig: (() => void) | undefined;

async function loadConfig(): Promise<void> {
  try {
    config.value = await AutodartsToolsConfig.getValue();
  } catch (error) {
    console.error("[CcSystemStatusFooter] loadConfig failed", error);
  }
}

let disposed = false;

onMounted(async () => {
  await loadConfig();
  if (disposed) return;
  unwatchConfig = AutodartsToolsConfig.watch(() => void loadConfig());
});
onBeforeUnmount(() => {
  disposed = true;
  unwatchConfig?.();
  unwatchConfig = undefined;
});

const wledEnabled = computed(() => config.value?.wledFx?.enabled ?? null);
const wledEffectCount = computed(() => {
  const effects = config.value?.wledFx?.effects ?? defaultConfig.wledFx.effects;
  return Array.isArray(effects) ? effects.filter(e => e.enabled).length : null;
});
const callerEnabled = computed(() => config.value?.caller?.enabled ?? null);
</script>
