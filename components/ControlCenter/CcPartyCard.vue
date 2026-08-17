<template>
  <CcCard
    title="Lobby / Party"
    :subtitle="subtitle"
    icon="icon-[pixelarticons--users]"
    data-testid="cc-card-party"
  >
    <template #status>
      <CcStatusPill :label="stateLabel" :tone="stateTone" :meta="lastSignalAgo" class="is-sm" />
    </template>

    <template v-if="hasLobby">
      <div class="cc-tiles" style="margin-bottom: 14px;">
        <CcStatTile label="Variante" :value="lobbyVariant" accent="accent" />
        <CcStatTile
          label="Spieler"
          :value="playerCountLabel"
          :hint="lobbyMaxPlayers !== null ? `max. ${lobbyMaxPlayers}` : null"
        />
        <CcStatTile label="Sichtbarkeit" :value="lobbyIsPrivate ? 'Privat' : 'Öffentlich'" />
      </div>

      <div class="cc-list" style="margin-bottom: 14px;">
        <div
          v-for="player in lobbyPlayers"
          :key="`${player.seat}-${player.name}`"
          class="cc-player"
          :data-testid="`cc-lobby-player-${player.seat}`"
        >
          <CcPlayerBadge
            :name="player.name"
            :is-bot="player.isBot"
            :variant="player.seat === 1 ? 'red' : player.seat === 2 ? 'blue' : 'plain'"
            size="sm"
          />
          <div class="cc-player-main">
            <div class="cc-player-name">{{ player.name }}</div>
            <div class="cc-player-tags">
              <span class="cc-tag">Platz {{ player.seat }}</span>
              <span v-if="player.isBot" class="cc-tag">Bot</span>
              <span v-if="player.isHost" class="cc-tag is-gold">Host</span>
            </div>
          </div>
        </div>
      </div>

      <div class="cc-kv">
        <template v-if="lobbyHostName">
          <span class="cc-kv-key">Host</span>
          <span class="cc-kv-val">{{ lobbyHostName }}</span>
        </template>
        <template v-if="lobbyRules">
          <span class="cc-kv-key">Regeln</span>
          <span class="cc-kv-val">{{ lobbyRules }}</span>
        </template>
        <template v-if="createdAtLabel">
          <span class="cc-kv-key">Erstellt</span>
          <span class="cc-kv-val">{{ createdAtLabel }}</span>
        </template>
        <span class="cc-kv-key">Lobby-ID</span>
        <span class="cc-kv-val" style="font-family: monospace; font-size: 12px;">{{ lobbyId }}</span>
      </div>
    </template>

    <CcEmptyState
      v-else
      icon="icon-[pixelarticons--users]"
      title="Keine Lobby bekannt"
      text="Sobald du auf Autodarts eine Lobby erstellst oder betrittst, erscheinen hier Spieler, Regeln und Host — ohne Umweg über eine API."
    >
      <template #action>
        <button @click="openAutodarts(autodartsOrigin)" class="cc-btn is-primary" type="button" data-testid="cc-party-open-autodarts">
          <span class="icon-[pixelarticons--external-link]" />
          <span>Autodarts öffnen</span>
        </button>
      </template>
    </CcEmptyState>

    <template #footer>
      <div v-if="hasLobby && lobbyId" class="cc-btn-row">
        <button @click="openLobby(lobbyId, autodartsOrigin)" class="cc-btn is-accent" type="button" data-testid="cc-party-open-lobby">
          <span class="icon-[pixelarticons--external-link]" />
          <span>Lobby öffnen</span>
        </button>
      </div>
      <span v-else>Quelle: <code>local:lobby-data</code> — gefüllt vom Lobby-Kanal von Autodarts.</span>
    </template>
  </CcCard>
</template>

<script setup lang="ts">
import { computed } from "vue";

import CcCard from "./CcCard.vue";
import CcStatTile from "./CcStatTile.vue";
import CcStatusPill from "./CcStatusPill.vue";
import CcEmptyState from "./CcEmptyState.vue";
import CcPlayerBadge from "./CcPlayerBadge.vue";
import { openAutodarts, openLobby } from "./open-autodarts";
import { useControlCenterStatus, type TTone } from "@/composables/useControlCenterStatus";

const {
  hasLobby,
  lobbyId,
  lobbyPlayers,
  lobbyHostName,
  lobbyVariant,
  lobbyMaxPlayers,
  lobbyIsPrivate,
  lobbyCreatedAt,
  lobbyRules,
  liveness,
  lastSignalAgo,
  autodartsOrigin,
} = useControlCenterStatus();

const subtitle = computed(() =>
  hasLobby.value ? "Zuletzt gemeldete Lobby von Autodarts" : "Lobby-Status aus dem Autodarts-Datenstrom",
);

const stateLabel = computed(() => {
  if (!hasLobby.value) return "Keine Lobby";
  return liveness.value === "live" ? "Aktuell" : "Letzter bekannter Stand";
});

const stateTone = computed<TTone>(() => {
  if (!hasLobby.value) return "idle";
  return liveness.value === "live" ? "ok" : "warn";
});

const playerCountLabel = computed(() => {
  const count = lobbyPlayers.value.length;
  return count > 0 ? String(count) : null;
});

const createdAtLabel = computed(() => {
  if (!lobbyCreatedAt.value) return null;
  const date = new Date(lobbyCreatedAt.value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
});
</script>
