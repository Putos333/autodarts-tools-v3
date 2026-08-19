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
            Einstellungen – Discord-Webhooks
          </h3>
          <div class="space-y-3 text-white/70">
            <p>Wechselt zwischen automatischem und manuellem Versand des Einladungslinks.</p>
            <AppRadioGroup
              v-model="config.discord.manually"
              class="grid max-w-sm grid-cols-2"
              :options="[
                { label: 'Automatisch', value: false },
                { label: 'Manuell', value: true },
              ]"
            />
            <div class="relative">
              <span class="absolute inset-y-0 left-3 flex items-center text-white/60">
                <span class="icon-[pixelarticons--link]" />
              </span>
              <AppInput
                v-model="config.discord.url"
                placeholder="Discord-Webhook-URL eingeben"
                label="Webhook-URL"
                class="pl-9"
                helper-text="Die Discord-Webhook-URL, an die Lobby-Einladungen gesendet werden"
                size="sm"
              />
            </div>

            <div v-if="config?.discord?.autoStartAfterTimer" class="mt-6 border-t border-white/20 pt-4">
              <h4 class="mb-3 font-semibold">
                Auto-Start-Timer
              </h4>
              <div class="flex items-center gap-4">
                <AppToggle
                  v-model="config.discord.autoStartAfterTimer.enabled"
                  label="Spiel nach Timer automatisch starten"
                  class="mt-6"
                />
                <div class="relative w-24">
                  <AppInput
                    v-model="minutes"
                    type="number"
                    label="Minuten"
                    :disabled="!config.discord.autoStartAfterTimer.enabled"
                    min="1"
                    max="60"
                    class="w-full"
                    size="sm"
                  />
                </div>
              </div>
              <p class="mt-2 text-sm text-white/60">
                Startet das Spiel automatisch nach der eingestellten Zeit, sobald der Discord-Webhook gesendet wurde.
              </p>
              <template v-if="config.discord.autoStartAfterTimer.enabled">
                <div class="mt-4 flex">
                  <AppToggle
                    v-model="config.discord.autoStartAfterTimer.stream"
                    label="Streaming-Modus beim Timerstart aktivieren"
                    :disabled="!config.discord.autoStartAfterTimer.enabled"
                  />
                </div>
                <p class="mt-2 text-sm text-white/60">
                  Streamt die Spielergebnisse in den Discord-Kanal.
                </p>
              </template>
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
            Discord-Webhooks
            <span class="icon-[material-symbols--settings-alert-outline-rounded] ml-2 size-5" />
          </h3>
          <p class="w-2/3 text-white/70">
            Sobald sich eine <b>private</b> Lobby öffnet, wird der Einladungslink automatisch per Webhook an deinen Discord-Server gesendet.
          </p>
        </div>
        <div class="flex">
          <div @click="$emit('toggle', 'discord-webhooks')" class="absolute inset-y-0 left-12 right-0 cursor-pointer" />
          <AppToggle
            @update:model-value="toggleFeature"
            v-model="config.discord.enabled"
          />
        </div>
      </div>
      <div class="gradient-mask-left absolute inset-y-0 right-0 w-2/3">
        <img :src="imageUrl" alt="Discord Webhooks" class="size-full object-cover opacity-70">
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { useStorage } from "@vueuse/core";

import AppRadioGroup from "../AppRadioGroup.vue";
import AppInput from "../AppInput.vue";
import AppToggle from "../AppToggle.vue";

import { AutodartsToolsConfig, type IConfig } from "@/utils/storage";

const emit = defineEmits([ "toggle", "settingChange" ]);
useStorage("adt:active-settings", "discord-webhooks");
const config = ref<IConfig>();
const imageUrl = browser.runtime.getURL("/images/discord-webhooks.svg");

// Computed property for minutes with type handling
const minutes = computed({
  get: () => config.value?.discord?.autoStartAfterTimer?.minutes?.toString() || "5",
  set: (value: string) => {
    if (config.value?.discord?.autoStartAfterTimer) {
      config.value.discord.autoStartAfterTimer.minutes = Number.parseInt(value, 10);
    }
  },
});

onMounted(async () => {
  config.value = await AutodartsToolsConfig.getValue();

  // Initialize autoStartAfterTimer if it doesn't exist
  if (config.value && !config.value.discord.autoStartAfterTimer) {
    config.value.discord.autoStartAfterTimer = {
      enabled: false,
      minutes: 5,
      stream: false,
      matchId: '',
      messageId: '',
    };
  }
});

watch(config, async (_, oldValue) => {
  if (!oldValue) return;

  await AutodartsToolsConfig.setValue(toRaw(config.value!));
  emit("settingChange");
  console.log("Discord Webhooks setting changed");
}, { deep: true });

async function toggleFeature() {
  if (!config.value) return;

  // Toggle the feature
  const wasEnabled = config.value.discord.enabled;
  config.value.discord.enabled = !wasEnabled;

  // If we're enabling the feature, open settings
  if (!wasEnabled) {
    await nextTick();
    emit("toggle", "discord-webhooks");
  }
}
</script>
