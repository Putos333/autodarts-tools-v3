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
            Einstellungen – Dart-Aufprall-Sound
          </h3>
          <div class="space-y-4 text-white/70">
            <p>Spielt bei jedem geworfenen Dart einen synthetisierten Aufprall-Sound ab.</p>

            <!-- Klang-Variante -->
            <div class="flex items-center gap-4">
              <span class="w-32 text-sm">Klang-Variante:</span>
              <div class="flex gap-2">
                <button
                  v-for="v in variants"
                  :key="v.value"
                  @click="config.dartImpact.variant = v.value"
                  :class="config.dartImpact.variant === v.value
                    ? 'bg-pink-600 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'"
                  class="rounded px-3 py-1 text-sm transition-colors"
                >
                  {{ v.label }}
                </button>
              </div>
            </div>

            <!-- Varianten-Beschreibung -->
            <div class="rounded bg-white/5 p-3 text-xs text-white/50">
              <p v-if="config.dartImpact.variant === 'thud'">
                <strong class="text-white/80">Thud:</strong> Dumpfer, tiefer Aufprall — klassischer Dart-Sound.
              </p>
              <p v-else-if="config.dartImpact.variant === 'click'">
                <strong class="text-white/80">Click:</strong> Knackiger, harter Klick — präziser Dartboard-Treffer.
              </p>
              <p v-else>
                <strong class="text-white/80">Zufällig:</strong> Variiert automatisch je nach getroffenen Segment
                (Doppel → Click, Triple → Thud2, Bull → Thud2, Single → zufällig).
              </p>
            </div>

            <!-- Lautstärke -->
            <div class="flex items-center gap-4">
              <span class="w-32 text-sm">Lautstärke:</span>
              <div class="flex flex-1 items-center gap-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  v-model.number="config.dartImpact.volume"
                  class="flex-1 accent-pink-500"
                />
                <span class="w-10 text-right text-sm">{{ config.dartImpact.volume }}%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Aktivieren/Deaktivieren -->
        <div class="mt-4 flex items-center gap-3">
          <AppToggle
            @update:model-value="val => config!.dartImpact.enabled = val"
            v-model="config.dartImpact.enabled"
          />
          <span class="text-sm text-white/60">
            {{ config.dartImpact.enabled ? 'Aktiviert' : 'Deaktiviert' }}
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
            Dart-Aufprall-Sound
          </h3>
          <p class="w-2/3 text-white/70">
            Spielt bei jedem geworfenen Dart einen synthetisierten Aufprall-Sound ab. Drei Klang-Varianten wählbar.
          </p>
        </div>
        <div class="flex">
          <div @click="$emit('toggle', 'dart-impact')" class="absolute inset-y-0 left-12 right-0 cursor-pointer" />
          <AppToggle
            @update:model-value="toggleFeature"
            v-model="config.dartImpact.enabled"
          />
        </div>
      </div>
      <div class="gradient-mask-left absolute inset-y-0 right-0 w-2/3">
        <img :src="imageUrl" alt="Dart-Aufprall-Sound" class="size-full object-cover">
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
useStorage("adt:active-settings", "dart-impact");

const config = ref<IConfig>();
const imageUrl = browser.runtime.getURL("/images/dart-impact.png");

const variants = [
  { value: "thud" as const,   label: "Thud" },
  { value: "click" as const,  label: "Click" },
  { value: "random" as const, label: "Zufällig" },
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
  const wasEnabled = config.value.dartImpact.enabled;
  config.value.dartImpact.enabled = !wasEnabled;
  if (!wasEnabled) {
    await nextTick();
    emit("toggle", "dart-impact");
  }
}
</script>
