<template>
  <div class="cc-grid" data-testid="cc-lighting">
    <!-- (A) HEADER -->
    <div class="cc-col-12">
      <CcCard
        title="WLED / BELEUCHTUNG"
        subtitle="Status und schnelle Umschalter — volle Konfiguration in den Einstellungen"
        icon="icon-[pixelarticons--lightbulb]"
        accent="gold"
      >
        <p class="cc-note" style="font-size: 13px;">
          WLED reagiert nur auf Match-Ereignisse (MATCH EVENT → WLED) — nie umgekehrt. Ein
          WLED-Fehler kann diese Ansicht oder das Match nicht beeinflussen. Es gibt keinen
          Live-Erreichbarkeits-Check der Geräte-Adressen; das wird hier bewusst nicht vorgetäuscht.
        </p>
      </CcCard>
    </div>

    <div v-if="!configLoaded" class="cc-col-12">
      <CcCard title="Lädt…" icon="icon-[pixelarticons--lightbulb]" accent="muted">
        <CcEmptyState icon="icon-[pixelarticons--lightbulb]" title="Konfiguration wird geladen…" />
      </CcCard>
    </div>

    <template v-else>
      <!-- (B) STATUS -->
      <div class="cc-col-4">
        <CcCard title="WLED-Status" icon="icon-[pixelarticons--lightbulb]" accent="muted">
          <template #status>
            <CcStatusPill :label="config.wledFx.enabled ? 'Aktiv' : 'Deaktiviert'" :tone="config.wledFx.enabled ? 'ok' : 'idle'" class="is-sm" />
          </template>
          <div class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));">
            <CcStatTile label="Effekte" :value="config.wledFx.effects.length" />
            <CcStatTile label="Aktive Effekte" :value="activeEffectCount" accent="accent" />
            <CcStatTile label="Board-IDs" :value="config.wledFx.boardIds.length" />
          </div>
          <div class="cc-btn-row" style="margin-top: 12px;">
            <button @click="toggleWled" class="cc-btn" type="button" data-testid="cc-lighting-toggle">
              <span :class="config.wledFx.enabled ? 'icon-[pixelarticons--close]' : 'icon-[pixelarticons--check]'" />
              <span>{{ config.wledFx.enabled ? 'Deaktivieren' : 'Aktivieren' }}</span>
            </button>
          </div>
        </CcCard>
      </div>

      <!-- (C) EFFEKTE -->
      <div class="cc-col-8">
        <CcCard title="Konfigurierte Effekte" icon="icon-[pixelarticons--sliders]" accent="muted">
          <div v-if="config.wledFx.effects.length > 0" class="cc-list">
            <div v-for="effect in config.wledFx.effects" :key="effect.name" class="cc-list-row">
              <span :class="['icon-[pixelarticons--circle]', effect.enabled ? 'cc-dot-ok' : 'cc-dot-idle']" />
              <span>{{ effect.name || '(ohne Namen)' }}</span>
              <span class="cc-note" style="font-size: 11px; margin-left: auto;">{{ effect.url || '–' }}</span>
            </div>
          </div>
          <CcEmptyState
            v-else
            icon="icon-[pixelarticons--lightbulb]"
            title="Noch keine WLED-Effekte konfiguriert"
            text="Effekte, Geräte-Adressen und Trigger werden in den klassischen Einstellungen angelegt."
          />
        </CcCard>
      </div>

      <!-- (D) LINK -->
      <div class="cc-col-12">
        <CcCard title="Volle Konfiguration" icon="icon-[pixelarticons--sliders]" accent="muted">
          <div class="cc-btn-row">
            <button @click="() => openClassicSettings()" class="cc-btn is-accent" type="button" data-testid="cc-lighting-open-classic">
              <span class="icon-[pixelarticons--external-link]" />
              <span>Klassische Einstellungen öffnen (WLED)</span>
            </button>
          </div>
        </CcCard>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import CcCard from "../CcCard.vue";
import CcStatTile from "../CcStatTile.vue";
import CcStatusPill from "../CcStatusPill.vue";
import CcEmptyState from "../CcEmptyState.vue";
import { openClassicSettings } from "../open-autodarts";
import { AutodartsToolsConfig, defaultConfig, updateConfigIfChanged, type IConfig } from "@/utils/storage";

const configLoaded = ref(false);
const config = ref<IConfig>(defaultConfig);
let unwatch: (() => void) | undefined;

async function loadConfig(): Promise<void> {
  config.value = await AutodartsToolsConfig.getValue();
  configLoaded.value = true;
}

const activeEffectCount = computed(() => config.value.wledFx.effects.filter(e => e.enabled).length);

async function toggleWled(): Promise<void> {
  const current = await AutodartsToolsConfig.getValue();
  const next: IConfig = { ...current, wledFx: { ...current.wledFx, enabled: !current.wledFx.enabled } };
  await updateConfigIfChanged(current, next, "wledFx");
}

let disposed = false;

onMounted(async () => {
  await loadConfig();
  if (disposed) return;
  unwatch = AutodartsToolsConfig.watch(() => {
    void loadConfig();
  });
});

onBeforeUnmount(() => {
  disposed = true;
  unwatch?.();
  unwatch = undefined;
});
</script>

<style scoped>
.cc-dot-ok { color: #22c55e; }
.cc-dot-idle { color: var(--cc-text-faint); }
</style>
