<template>
  <div class="cc-player" :data-testid="`cc-friend-${friend.id}`">
    <CcPlayerBadge
      :name="badgeName"
      :variant="friend.online === true ? 'red' : 'plain'"
      size="md"
    />

    <div class="cc-player-main">
      <!-- Kein Ersatzname: fehlt er, wird das benannt und die Kennung gezeigt -->
      <div v-if="friend.name" class="cc-player-name">{{ friend.name }}</div>
      <div v-else class="cc-player-name is-unresolved" :title="friend.id">
        Name nicht auflösbar
      </div>

      <div class="cc-player-tags">
        <!-- Grün ausschließlich für echten Online-Zustand -->
        <span v-if="friend.online === true" class="cc-tag is-online">Online</span>
        <span v-else-if="friend.online === false" class="cc-tag">Offline</span>
        <span v-else class="cc-tag" title="Autodarts hat keinen Online-Status geliefert">
          Status unbekannt
        </span>
        <span v-if="friend.inMatch === true" class="cc-tag is-accent">Im Match</span>
        <span v-if="!friend.name && shortId" class="cc-tag" :title="friend.id">ID {{ shortId }}</span>
      </div>
    </div>

    <!-- Statistik nur, wenn Autodarts sie mitgeliefert hat -->
    <div v-if="friend.stats" class="cc-player-stats">
      <div class="cc-stat">
        <div class="cc-stat-label">Average</div>
        <div class="cc-stat-value">{{ friend.stats.average.toFixed(2) }}</div>
      </div>
      <div class="cc-stat">
        <div class="cc-stat-label">S / N</div>
        <div class="cc-stat-value">{{ friend.stats.wins }}:{{ friend.stats.losses }}</div>
      </div>
    </div>

    <button
      @click="$emit('challenge', friend)"
      :class="[ 'cc-btn', pending ? 'is-accent' : '' ]"
      :disabled="!canAct || busy || !friend.id"
      :title="buttonTitle"
      type="button"
      :data-testid="`cc-friend-challenge-${friend.id}`"
    >
      <span v-if="busy" class="icon-[pixelarticons--loader] animate-spin" />
      <span v-else-if="pending" class="icon-[pixelarticons--check]" />
      <span v-else class="icon-[pixelarticons--mail]" />
      <span>{{ busy ? "Sende …" : pending ? "Wirklich?" : "Herausfordern" }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import CcPlayerBadge from "./CcPlayerBadge.vue";
import type { IFriendResolved } from "@/utils/friends-api";

const props = defineProps<{
  friend: IFriendResolved;
  busy: boolean;
  /** Erster Klick erfolgt — der nächste sendet wirklich. */
  pending: boolean;
  canAct: boolean;
}>();

defineEmits<{ (e: "challenge", friend: IFriendResolved): void }>();

/** Ohne Namen kein erfundenes Initial — dann ein neutrales Fragezeichen. */
const badgeName = computed(() => props.friend.name ?? "?");

const shortId = computed(() => (props.friend.id ? props.friend.id.slice(0, 8) : null));

const buttonTitle = computed(() => {
  if (!props.friend.id) return "Für diesen Eintrag hat Autodarts keine Kennung geliefert";
  if (!props.canAct) return "Nur möglich, solange die Freundesliste geladen ist";
  if (props.pending) return "Nochmal klicken: erstellt eine private Lobby und sendet die Einladung";
  return "Erstellt eine private Lobby und lädt diesen Freund ein";
});
</script>
