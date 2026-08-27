<template>
  <template v-if="!$attrs['data-feature-index']">
    <!-- Einstellungen Panel -->
    <div
      v-if="config"
      class="adt-container min-h-56"
    >
      <div class="relative z-10 flex h-full flex-col justify-between">
        <div>
          <h3 class="mb-1 font-bold uppercase">
            Einstellungen – Soundboard
          </h3>
          <div class="space-y-4 text-white/70">
            <p>Manuelles Soundboard für das Match. Spiele Crowd-Sounds per Knopfdruck ab.</p>

            <!-- Position -->
            <div class="flex items-center gap-4">
              <span class="w-32 text-sm">Position:</span>
              <div class="flex gap-2">
                <button
                  @click="config.soundboard.position = 'bottom'"
                  :class="config.soundboard.position === 'bottom'
                    ? 'bg-pink-600 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'"
                  class="rounded px-3 py-1 text-sm transition-colors"
                >
                  Unten
                </button>
                <button
                  @click="config.soundboard.position = 'top'"
                  :class="config.soundboard.position === 'top'
                    ? 'bg-pink-600 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'"
                  class="rounded px-3 py-1 text-sm transition-colors"
                >
                  Oben
                </button>
              </div>
            </div>

            <!-- Lautstärke -->
            <div class="flex items-center gap-4">
              <span class="w-32 text-sm">Lautstärke:</span>
              <div class="flex flex-1 items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  v-model.number="config.soundboard.volume"
                  class="flex-1 accent-pink-500"
                />
                <span class="w-10 text-right text-sm">{{ config.soundboard.volume }}%</span>
              </div>
            </div>

            <!-- Vorschau der Buttons -->
            <div class="mt-2">
              <p class="mb-2 text-xs text-white/50">Verfügbare Sounds im Match:</p>
              <div class="flex flex-wrap gap-2">
                <span v-for="sound in soundButtons" :key="sound.label"
                  class="rounded bg-white/10 px-2 py-1 text-xs text-white/70">
                  {{ sound.icon }} {{ sound.label }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Aktivieren/Deaktivieren -->
        <div class="mt-4 flex items-center gap-3">
          <AppToggle
            @update:model-value="val => config!.soundboard.enabled = val"
            v-model="config.soundboard.enabled"
          />
          <span class="text-sm text-white/60">
            {{ config.soundboard.enabled ? 'Aktiviert' : 'Deaktiviert' }}
          </span>
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
            Soundboard
          </h3>
          <p class="w-2/3 text-white/70">
            Manuelles Soundboard für das Match. Spiele Crowd-Sounds wie Applaus, Buh-Rufe oder Olé per Knopfdruck ab.
          </p>
        </div>
        <div class="flex">
          <div @click="$emit('toggle', 'soundboard')" class="absolute inset-y-0 left-12 right-0 cursor-pointer" />
          <AppToggle
            @update:model-value="toggleFeature"
            v-model="config.soundboard.enabled"
          />
        </div>
      </div>
      <div class="gradient-mask-left absolute inset-y-0 right-0 w-2/3">
        <img :src="imageUrl" alt="Soundboard" class="size-full object-cover">
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, toRaw, watch } from "vue";
import { useStorage } from "@vueuse/core";
import AppToggle from "../AppToggle.vue";
import { AutodartsToolsConfig, type IConfig } from "@/utils/storage";

const emit = defineEmits([ "toggle", "settingChange" ]);
useStorage("adt:active-settings", "soundboard");

const config = ref<IConfig>();
const imageUrl = browser.runtime.getURL("/images/soundboard.svg");

const soundButtons = [
  { icon: "👏", label: "Applaus" },
  { icon: "😤", label: "Boooo!" },
  { icon: "🎉", label: "Olé Olé!" },
  { icon: "😤", label: "Pfeifen" },
  { icon: "🥁", label: "Trommel" },
  { icon: "🔇", label: "Stille" },
];

onMounted(async () => {
  config.value = await AutodartsToolsConfig.getValue();
});

watch(config, async (_, oldValue) => {
  if (!oldValue) return;
  await AutodartsToolsConfig.setValue(toRaw(config.value!));
  emit("settingChange");
}, { deep: true });

async function toggleFeature() {
  if (!config.value) return;
  const wasEnabled = config.value.soundboard.enabled;
  config.value.soundboard.enabled = !wasEnabled;
  if (!wasEnabled) {
    await nextTick();
    emit("toggle", "soundboard");
  }
}
</script>
