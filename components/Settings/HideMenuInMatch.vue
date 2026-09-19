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
            Einstellungen – Menü im Match ausblenden
          </h3>
          <div class="space-y-3 text-white/70">
            <p>Konfiguriere, wie das Menü während des Matches angezeigt wird.</p>

            <div class="mt-4 space-y-4">
              <!-- No additional settings needed for this feature -->
              <p>Diese Funktion blendet das Menü während des Matches aus – für ein aufgeräumteres Bild und weniger versehentliche Klicks.</p>
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
            Menü im Match ausblenden
          </h3>

          <p class="w-2/3 text-white/70">
            Blendet das Menü während des Matches aus – für ein aufgeräumteres Bild und weniger versehentliche Klicks.
          </p>
        </div>
        <div class="flex">
          <div @click="$emit('toggle', 'hide-menu-in-match')" class="absolute inset-y-0 left-12 right-0 cursor-pointer" />
          <AppToggle
            @update:model-value="toggleFeature"
            v-model="config.hideMenuInMatch.enabled"
          />
        </div>
      </div>
      <div class="gradient-mask-left absolute inset-y-0 right-0 w-2/3">
        <img :src="imageUrl" alt="Hide Menu in Match" class="size-full object-cover">
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import AppToggle from "../AppToggle.vue";
import { AutodartsToolsConfig, type IConfig } from "@/utils/storage";

const emit = defineEmits([ "toggle", "settingChange" ]);
const config = ref<IConfig>();
const imageUrl = browser.runtime.getURL("/images/hide-menu-in-match.svg");

async function toggleFeature() {
  if (!config.value) return;

  // Toggle the feature
  const wasEnabled = config.value.hideMenuInMatch.enabled;
  config.value.hideMenuInMatch.enabled = !wasEnabled;

  // If we're enabling the feature, open settings
  if (!wasEnabled) {
    await nextTick();
    emit("toggle", "hide-menu-in-match");
  }
}

onMounted(async () => {
  config.value = await AutodartsToolsConfig.getValue();
});

watch(config, async (_, oldValue) => {
  if (!oldValue) return;

  await AutodartsToolsConfig.setValue(toRaw(config.value!));
  emit("settingChange");
  console.log("Hide Menu in Match setting changed");
}, { deep: true });
</script>
