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
            Einstellungen – Größere Legs & Sets
          </h3>
          <div class="space-y-3 text-white/70">
            <p>Konfiguriere die Anzeige-Größe von Legs und Sets im Match.</p>

            <div class="mt-4 space-y-4">
              <div class="grid grid-cols-[auto_1fr] items-center gap-4">
                <p>Schriftgröße:</p>
                <AppInput
                  v-model="sizeValue"
                  type="text"
                  placeholder="Wert eingeben (z.B. 1.5)"
                  class="w-full"
                />
              </div>
              <p class="text-sm text-white/50">
                Dieser Wert wird als Multiplikator für die Standard-Schriftgröße verwendet.
                Beispiel: Ein Wert von 1.5 vergrößert Legs und Sets um 50 % gegenüber dem Standard.
              </p>
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
            Größere Legs/Sets
            <span class="icon-[material-symbols--settings-alert-outline-rounded] ml-2 size-5" />
          </h3>
          <p class="w-2/3 text-white/70">
            Vergrößert die Legs- und Sets-Anzeige im Match für bessere Lesbarkeit.
          </p>
        </div>
        <div class="flex">
          <div @click="$emit('toggle', 'larger-legs-sets')" class="absolute inset-y-0 left-12 right-0 cursor-pointer" />
          <AppToggle
            @update:model-value="toggleFeature"
            v-model="config.largerLegsSets.enabled"
          />
        </div>
      </div>
      <div class="gradient-mask-left absolute inset-y-0 right-0 w-2/3">
        <img :src="imageUrl" alt="Larger Legs & Sets" class="size-full object-cover">
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import AppToggle from "../AppToggle.vue";
import AppInput from "../AppInput.vue";
import { AutodartsToolsConfig, type IConfig } from "@/utils/storage";

const emit = defineEmits([ "toggle", "settingChange" ]);
const config = ref<IConfig>();
const sizeValue = ref("");
const imageUrl = browser.runtime.getURL("/images/larger-legs-sets.svg");

onMounted(async () => {
  config.value = await AutodartsToolsConfig.getValue();
  // Initialize the size value from config
  if (config.value?.largerLegsSets?.value) {
    sizeValue.value = config.value.largerLegsSets.value.toString();
  }
});

// Update config when size value changes
watch(sizeValue, (newValue) => {
  if (config.value) {
    // Convert string to number
    const numValue = Number.parseFloat(newValue) || 1; // Default to 1 if parsing fails
    config.value.largerLegsSets.value = numValue;
  }
});

watch(config, async (_, oldValue) => {
  if (!oldValue) return;

  await AutodartsToolsConfig.setValue(toRaw(config.value!));
  emit("settingChange");
  console.log("Larger Legs & Sets setting changed");
}, { deep: true });

async function toggleFeature() {
  if (!config.value) return;

  // Toggle the feature
  const wasEnabled = config.value.largerLegsSets.enabled;
  config.value.largerLegsSets.enabled = !wasEnabled;

  // If we're enabling the feature, open settings
  if (!wasEnabled) {
    await nextTick();
    emit("toggle", "larger-legs-sets");
  }
}
</script>
