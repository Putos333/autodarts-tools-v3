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
            Einstellungen – Automatischer Leg-Wechsel
          </h3>
          <div class="space-y-3 text-white/70">
            <p>Lege fest, wie lange nach einem Take-out gewartet wird, bevor das nächste Leg automatisch startet.</p>

            <div class="mt-4 space-y-4">
              <!-- Seconds Input -->
              <div class="grid grid-cols-[5rem_auto] items-center gap-4">
                <AppInput
                  @update:model-value="config.automaticNextLeg.sec = Number($event)"
                  :model-value="String(config.automaticNextLeg.sec)"
                  placeholder="5"
                  type="number"
                  size="sm"
                  input-class="w-full"
                />
                <p>Sekunden warten, bevor das nächste Leg automatisch startet</p>
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
            Automatischer Leg-Wechsel
            <span class="icon-[material-symbols--settings-alert-outline-rounded] ml-2 size-5" />
          </h3>

          <p class="w-2/3 text-white/70">
            Startet das nächste Leg automatisch {{ config?.automaticNextLeg?.sec || '5' }} Sekunden nach dem Take-out.
          </p>
        </div>
        <div class="flex">
          <div @click="$emit('toggle', 'automatic-next-leg')" class="absolute inset-y-0 left-12 right-0 cursor-pointer" />
          <AppToggle
            @update:model-value="toggleFeature"
            v-model="config.automaticNextLeg.enabled"
          />
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import AppToggle from "../AppToggle.vue";
import AppInput from "../AppInput.vue";

import { AutodartsToolsConfig, type IConfig, defaultConfig } from "@/utils/storage";

const emit = defineEmits([ "toggle", "settingChange" ]);
const config = ref<IConfig>();

async function toggleFeature() {
  if (!config.value) return;

  // Toggle the feature
  const wasEnabled = config.value.automaticNextLeg.enabled;
  config.value.automaticNextLeg.enabled = !wasEnabled;

  // If we're enabling the feature, open settings
  if (!wasEnabled) {
    await nextTick();
    emit("toggle", "automatic-next-leg");
  }
}

onMounted(async () => {
  config.value = await AutodartsToolsConfig.getValue();
  if (!config.value?.automaticNextLeg) config.value.automaticNextLeg = defaultConfig.automaticNextLeg;
});

watch(config, async (_, oldValue) => {
  if (!oldValue) return;

  await AutodartsToolsConfig.setValue(toRaw(config.value!));
  emit("settingChange");
  console.log("Automatic Next Leg setting changed");
}, { deep: true });
</script>
