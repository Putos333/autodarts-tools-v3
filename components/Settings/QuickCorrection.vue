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
            Einstellungen – Schnelle Korrektur
          </h3>
          <div class="space-y-3 text-white/70">
            <p>Konfiguriere, wie die Schnellkorrektur während des Matches dargestellt wird.</p>

            <div class="mt-4 space-y-4">
              <p>Diese Funktion erlaubt dir, Dart-Würfe während des Matches schnell zu korrigieren.</p>
              <p class="text-yellow-400">
                <strong>Hinweis:</strong> Diese Funktion arbeitet aufgrund von Sicherheitsbeschränkungen nicht in Safari.
              </p>

              <div class="mt-6">
                <h4 class="mb-2 font-semibold">
                  Fenstergröße
                </h4>
                <div class="max-w-sm">
                  <AppSlider
                    v-model="scale"
                    :min="0.5"
                    :max="2"
                    :step="0.1"
                    :show-labels="true"
                    :format-label="formatScaleLabel"
                  />
                </div>
                <p class="mt-1 text-sm text-white/60">
                  Passe die Größe des Korrektur-Fensters an.
                </p>
              </div>
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
          <h3 class="mb-1 flex items-center font-bold uppercase">
            Schnelle Korrektur
            <span class="icon-[material-symbols--settings-alert-outline-rounded] ml-2 size-5" />
          </h3>
          <p class="w-2/3 text-white/70">
            Fügt eine Schnellkorrektur für Dart-Würfe hinzu, mit der du falsch erkannte Darts direkt korrigieren kannst.
          </p>
          <p class="mt-1 w-2/3 text-sm text-yellow-400">
            Aktuell nicht mit Safari-Browsern kompatibel.
          </p>
        </div>
        <div class="flex">
          <div @click="$emit('toggle', 'quick-correction')" class="absolute inset-y-0 left-12 right-0 cursor-pointer" />
          <AppToggle
            @update:model-value="toggleFeature"
            v-model="config.quickCorrection.enabled"
          />
        </div>
      </div>
      <div class="gradient-mask-left absolute inset-y-0 right-0 w-2/3">
        <img :src="imageUrl" alt="Quick Correction" class="size-full object-cover opacity-70">
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import AppToggle from "../AppToggle.vue";
import AppSlider from "../AppSlider.vue";

import { AutodartsToolsConfig, type IConfig } from "@/utils/storage";

const emit = defineEmits([ "toggle", "settingChange" ]);
const config = ref<IConfig>();
const imageUrl = browser.runtime.getURL("/images/quick-correction.png");

// Computed property for scale
const scale = computed({
  get: () => {
    if (!config.value?.quickCorrection?.scale) return 1;
    return config.value.quickCorrection.scale;
  },
  set: (value: number) => {
    if (config.value?.quickCorrection) {
      config.value.quickCorrection.scale = value;
    }
  },
});

// Format the scale as a percentage
function formatScaleLabel(value: number): string {
  const percentage = Math.round(value * 100);
  return `${percentage}%`;
}

onMounted(async () => {
  config.value = await AutodartsToolsConfig.getValue();

  // Initialize quickCorrection if it doesn't exist
  if (config.value && !config.value.quickCorrection) {
    config.value.quickCorrection = {
      enabled: false,
      scale: 1,
    };
  }
});

watch(config, async (_, oldValue) => {
  if (!oldValue) return;

  await AutodartsToolsConfig.setValue(toRaw(config.value!));
  emit("settingChange");
  console.log("Quick Correction setting changed");
}, { deep: true });

async function toggleFeature() {
  if (!config.value) return;

  // Toggle the feature
  const wasEnabled = config.value.quickCorrection.enabled;
  config.value.quickCorrection.enabled = !wasEnabled;

  // If we're enabling the feature, open settings
  if (!wasEnabled) {
    await nextTick();
    emit("toggle", "quick-correction");
  }
}
</script>
