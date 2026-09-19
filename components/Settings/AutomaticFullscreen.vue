<template>
  <template v-if="!$attrs['data-feature-index']">
    <!-- Settings Panel -->
    <div
      v-if="config"
      class="adt-container min-h-56"
    >
      <div class="relative z-10 flex h-full flex-col justify-between">
        <div>
          <h3 class="mb-1 font-bold uppercase">
            Einstellungen – Automatischer Vollbildmodus
          </h3>
          <div class="space-y-3 text-white/70">
            <p>Konfiguriere, wie der Vollbildmodus während des Matches aktiviert wird.</p>

            <div class="mt-4 space-y-4">
              <!-- No additional settings needed for this feature -->
              <p>Diese Funktion aktiviert den Vollbildmodus während des Matches automatisch – für ein noch immersiveres Erlebnis.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>

  <template v-else>
    <!-- Feature Card -->
    <div
      v-if="config"
      class="adt-container h-56 transition-transform hover:-translate-y-0.5"
    >
      <div class="relative z-10 flex h-full flex-col justify-between">
        <div>
          <h3 class="mb-1 font-bold uppercase">
            Automatischer Vollbildmodus
          </h3>

          <p class="w-2/3 text-white/70">
            Aktiviert den Vollbildmodus während des Matches automatisch – für ein immersives Spielerlebnis.
          </p>
        </div>
        <div class="flex">
          <div @click="$emit('toggle', 'automatic-fullscreen')" class="absolute inset-y-0 left-12 right-0 cursor-pointer" />
          <AppToggle
            @update:model-value="toggleFeature"
            v-model="config.automaticFullscreen.enabled"
          />
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import AppToggle from "../AppToggle.vue";
import { AutodartsToolsConfig, type IConfig, defaultConfig } from "@/utils/storage";

const emit = defineEmits([ "toggle", "settingChange" ]);
const config = ref<IConfig>();

async function toggleFeature() {
  if (!config.value) return;

  // Toggle the feature
  const wasEnabled = config.value.automaticFullscreen.enabled;
  config.value.automaticFullscreen.enabled = !wasEnabled;

  // If we're enabling the feature, open settings
  if (!wasEnabled) {
    await nextTick();
    emit("toggle", "automatic-fullscreen");
  }
}

onMounted(async () => {
  config.value = await AutodartsToolsConfig.getValue();
  if (!config.value?.automaticFullscreen) config.value.automaticFullscreen = defaultConfig.automaticFullscreen;
});

watch(config, async (_, oldValue) => {
  if (!oldValue) return;

  await AutodartsToolsConfig.setValue(toRaw(config.value!));
  emit("settingChange");
  console.log("Automatic Fullscreen setting changed");
}, { deep: true });
</script>
