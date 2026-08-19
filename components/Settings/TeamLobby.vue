<template>
  <template v-if="!$attrs['data-feature-index']">
    <!-- Empty settings panel since this feature doesn't need settings -->
    <div class="adt-container min-h-56">
      <div class="relative z-10 flex h-full flex-col justify-between">
        <div>
          <h3 class="mb-1 font-bold uppercase">
            Team-Lobby
          </h3>
          <div class="space-y-3 text-white/70">
            <p>Diese Funktion benötigt keine weiteren Einstellungen.</p>
            <p>Wenn aktiviert, wird der erste Spieler aus der Lobby entfernt und jeder folgende Spieler zum Board hinzugefügt.</p>
            <p class="italic text-white/50">
              Diese Funktion arbeitet nur in privaten Lobbies.
            </p>
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
            Team-Lobby
          </h3>
          <p class="w-2/3 text-white/70">
            Entfernt den ersten Spieler aus der Lobby und fügt jeden weiteren Spieler direkt zum Board hinzu. Funktioniert nur in <b>privaten Lobbies</b>.
          </p>
        </div>
        <div class="flex">
          <div @click="$emit('toggle', 'team-lobby')" class="absolute inset-y-0 left-12 right-0 cursor-pointer" />
          <AppToggle
            @update:model-value="toggleFeature"
            v-model="config.teamLobby.enabled"
          />
        </div>
      </div>
      <div class="gradient-mask-left absolute inset-y-0 right-0 w-2/3">
        <img :src="imageUrl" alt="Team Lobby" class="size-full object-cover opacity-70">
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import AppToggle from "../AppToggle.vue";
import { AutodartsToolsConfig, type IConfig } from "@/utils/storage";

const emit = defineEmits([ "toggle", "settingChange" ]);
const config = ref<IConfig>();
const imageUrl = browser.runtime.getURL("/images/team-lobby.svg");

async function toggleFeature() {
  if (!config.value) return;

  // Toggle the feature
  const wasEnabled = config.value.teamLobby.enabled;
  config.value.teamLobby.enabled = !wasEnabled;

  // If we're enabling the feature, open settings
  if (!wasEnabled) {
    await nextTick();
    emit("toggle", "team-lobby");
  }
}

onMounted(async () => {
  config.value = await AutodartsToolsConfig.getValue();
});

watch(config, async (_, oldValue) => {
  if (!oldValue) return;

  await AutodartsToolsConfig.setValue(toRaw(config.value!));
  emit("settingChange");
  console.log("Team Lobby setting changed");
}, { deep: true });
</script>
