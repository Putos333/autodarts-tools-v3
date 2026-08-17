<template>
  <div class="cc-grid" data-testid="cc-sound">
    <!-- (A) HEADER -->
    <div class="cc-col-12">
      <CcCard
        title="CALLER & SOUNDS"
        subtitle="Status und schnelle Umschalter — volle Konfiguration in den Einstellungen"
        icon="icon-[pixelarticons--volume-3]"
        accent="gold"
      >
        <p class="cc-note" style="font-size: 13px;">
          Diese Ansicht schreibt nur den bestehenden „aktiviert"-Schalter jedes Bereichs — dieselbe
          Einstellung, die auch die klassischen Einstellungen verwenden. Es gibt keine zweite
          Audio-Engine; Voice-Packs, Trigger und Lautstärken bleiben ausschließlich dort
          konfigurierbar.
        </p>
      </CcCard>
    </div>

    <div v-if="!configLoaded" class="cc-col-12">
      <CcCard title="Lädt…" icon="icon-[pixelarticons--volume-3]" accent="muted">
        <CcEmptyState icon="icon-[pixelarticons--volume-3]" title="Konfiguration wird geladen…" />
      </CcCard>
    </div>

    <template v-else>
      <!-- (B) CALLER -->
      <div class="cc-col-4">
        <CcCard title="Caller" icon="icon-[pixelarticons--volume-3]" accent="muted">
          <template #status>
            <CcStatusPill :label="config.caller.enabled ? 'Aktiv' : 'Deaktiviert'" :tone="config.caller.enabled ? 'ok' : 'idle'" class="is-sm" />
          </template>
          <div class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));">
            <CcStatTile label="Sounds" :value="config.caller.sounds.length" />
            <CcStatTile label="Nativer Caller" :value="config.caller.muteNativeAutodarts === false ? 'Nicht stumm' : 'Stumm'" />
          </div>
          <div class="cc-btn-row" style="margin-top: 12px;">
            <button @click="toggleCaller" class="cc-btn" type="button" data-testid="cc-sound-toggle-caller">
              <span :class="config.caller.enabled ? 'icon-[pixelarticons--close]' : 'icon-[pixelarticons--check]'" />
              <span>{{ config.caller.enabled ? 'Deaktivieren' : 'Aktivieren' }}</span>
            </button>
          </div>
        </CcCard>
      </div>

      <!-- (C) SOUND FX -->
      <div class="cc-col-4">
        <CcCard title="Sound FX" icon="icon-[pixelarticons--sound]" accent="muted">
          <template #status>
            <CcStatusPill :label="config.soundFx.enabled ? 'Aktiv' : 'Deaktiviert'" :tone="config.soundFx.enabled ? 'ok' : 'idle'" class="is-sm" />
          </template>
          <div class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));">
            <CcStatTile label="Sounds" :value="config.soundFx.sounds.length" />
          </div>
          <div class="cc-btn-row" style="margin-top: 12px;">
            <button @click="toggleSoundFx" class="cc-btn" type="button" data-testid="cc-sound-toggle-soundfx">
              <span :class="config.soundFx.enabled ? 'icon-[pixelarticons--close]' : 'icon-[pixelarticons--check]'" />
              <span>{{ config.soundFx.enabled ? 'Deaktivieren' : 'Aktivieren' }}</span>
            </button>
          </div>
        </CcCard>
      </div>

      <!-- (D) CROWD -->
      <div class="cc-col-4">
        <CcCard title="Crowd & Atmosphäre" icon="icon-[pixelarticons--users]" accent="muted">
          <template #status>
            <CcStatusPill :label="config.crowd.enabled ? 'Aktiv' : 'Deaktiviert'" :tone="config.crowd.enabled ? 'ok' : 'idle'" class="is-sm" />
          </template>
          <div class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));">
            <CcStatTile label="Ambient" :value="config.crowd.ambientEnabled ? 'An' : 'Aus'" />
            <CcStatTile label="Reaktionen" :value="config.crowd.reactions.length" />
          </div>
          <div class="cc-btn-row" style="margin-top: 12px;">
            <button @click="toggleCrowd" class="cc-btn" type="button" data-testid="cc-sound-toggle-crowd">
              <span :class="config.crowd.enabled ? 'icon-[pixelarticons--close]' : 'icon-[pixelarticons--check]'" />
              <span>{{ config.crowd.enabled ? 'Deaktivieren' : 'Aktivieren' }}</span>
            </button>
          </div>
        </CcCard>
      </div>

      <!-- (E) LINK -->
      <div class="cc-col-12">
        <CcCard title="Volle Konfiguration" icon="icon-[pixelarticons--sliders]" accent="muted">
          <div class="cc-btn-row">
            <button @click="() => openClassicSettings()" class="cc-btn is-accent" type="button" data-testid="cc-sound-open-classic">
              <span class="icon-[pixelarticons--external-link]" />
              <span>Klassische Einstellungen öffnen (Caller, Sound-FX, Crowd, Walk-On, Soundboard)</span>
            </button>
          </div>
        </CcCard>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

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

/** Schreibt nur das bestehende `enabled`-Feld eines Bereichs — dieselbe Funktion wie die Settings-UI. */
async function toggleSection<K extends "caller" | "soundFx" | "crowd">(key: K): Promise<void> {
  const current = await AutodartsToolsConfig.getValue();
  const next: IConfig = { ...current, [key]: { ...current[key], enabled: !current[key].enabled } };
  await updateConfigIfChanged(current, next, key);
}

function toggleCaller(): void { void toggleSection("caller"); }
function toggleSoundFx(): void { void toggleSection("soundFx"); }
function toggleCrowd(): void { void toggleSection("crowd"); }

onMounted(async () => {
  await loadConfig();
  unwatch = AutodartsToolsConfig.watch(() => {
    void loadConfig();
  });
});

onBeforeUnmount(() => {
  unwatch?.();
  unwatch = undefined;
});
</script>
