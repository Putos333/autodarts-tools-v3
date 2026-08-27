<template>
  <div class="cc-card" data-testid="cc-party-lobby">
    <header class="cc-card-head">
      <span class="cc-card-icon"><span class="icon-[pixelarticons--users]" /></span>
      <div class="cc-card-titles">
        <h2 class="cc-card-title">Aktive Lobby</h2>
        <p class="cc-card-sub">Zuletzt gemeldete Lobby von Autodarts</p>
      </div>
      <CcStatusPill
        :label="liveness === 'live' ? 'Aktuell' : 'Letzter bekannter Stand'"
        :tone="liveness === 'live' ? 'ok' : 'warn'"
        :meta="lastSignalAgo"
        class="is-sm"
      />
    </header>

    <div class="cc-card-body">
      <div class="cc-lineup" data-testid="cc-lineup">
        <div
          v-for="player in lobbyPlayers"
          :key="`${player.seat}-${player.name}`"
          class="cc-lineup-slot"
          :data-testid="`cc-lineup-player-${player.seat}`"
        >
          <CcPlayerBadge
            :name="player.name"
            :is-bot="player.isBot"
            :variant="player.seat === 1 ? 'red' : player.seat === 2 ? 'blue' : 'plain'"
            size="lg"
          />
          <div class="cc-lineup-name">{{ player.name }}</div>
          <div class="cc-lineup-tags">
            <span class="cc-lineup-seat">Platz {{ player.seat }}</span>
            <span v-if="player.isBot" class="cc-tag">Bot</span>
            <span v-if="player.isHost" class="cc-tag is-gold">Host</span>
          </div>
        </div>

        <div v-for="n in freeSlots" :key="`free-${n}`" class="cc-lineup-slot is-empty">
          <div class="cc-lineup-slot-icon">○</div>
          <div class="cc-lineup-slot-label">Frei</div>
        </div>
      </div>

      <div class="cc-kv" style="margin-top: 18px;">
        <template v-if="lobbyVariant">
          <span class="cc-kv-key">Variante</span><span class="cc-kv-val">{{ lobbyVariant }}</span>
        </template>
        <span class="cc-kv-key">Sichtbarkeit</span><span class="cc-kv-val">{{ lobbyIsPrivate ? "Privat" : "Öffentlich" }}</span>
        <template v-if="lobbyRules">
          <span class="cc-kv-key">Regeln</span><span class="cc-kv-val">{{ lobbyRules }}</span>
        </template>
        <template v-if="lobbyHostName">
          <span class="cc-kv-key">Host</span><span class="cc-kv-val">{{ lobbyHostName }}</span>
        </template>
        <template v-if="createdAtLabel">
          <span class="cc-kv-key">Erstellt</span><span class="cc-kv-val">{{ createdAtLabel }}</span>
        </template>
        <template v-if="lobbyMaxPlayers !== null">
          <span class="cc-kv-key">Belegt</span><span class="cc-kv-val">{{ lobbyPlayers.length }} / {{ lobbyMaxPlayers }}</span>
        </template>
      </div>
    </div>

    <footer v-if="lobbyId" class="cc-card-foot">
      <div class="cc-btn-row">
        <button class="cc-btn is-accent" type="button" data-testid="cc-party-open-lobby" @click="openLobby(lobbyId, autodartsOrigin)">
          <span class="icon-[pixelarticons--external-link]" /><span>Lobby öffnen</span>
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import CcStatusPill from "./CcStatusPill.vue";
import CcPlayerBadge from "./CcPlayerBadge.vue";
import { openLobby } from "./open-autodarts";
import type { TLiveness } from "@/composables/useControlCenterStatus";

interface ILobbyPlayer {
  seat: number;
  name: string;
  isBot: boolean;
  isHost: boolean;
  userId: string | null;
}

const props = defineProps<{
  lobbyId: string | null;
  lobbyPlayers: ILobbyPlayer[];
  lobbyHostName: string | null;
  lobbyVariant: string | null;
  lobbyMaxPlayers: number | null;
  lobbyIsPrivate: boolean;
  lobbyCreatedAt: string | null;
  lobbyRules: string | null;
  liveness: TLiveness;
  lastSignalAgo: string | null;
  autodartsOrigin: string;
}>();

const freeSlots = computed(() => {
  if (props.lobbyMaxPlayers === null) return 0;
  return Math.max(0, props.lobbyMaxPlayers - props.lobbyPlayers.length);
});

const createdAtLabel = computed(() => {
  if (!props.lobbyCreatedAt) return null;
  const date = new Date(props.lobbyCreatedAt);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
});
</script>
