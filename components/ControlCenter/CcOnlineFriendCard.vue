<template>
  <div
    :class="[ 'cc-online-card', selected && 'is-selected' ]"
    :data-testid="`cc-online-card-${friend.id}`"
  >
    <div class="cc-online-card-top" @click="$emit('open-detail', friend)">
      <CcPlayerBadge :name="badgeName" :variant="friend.online === true ? 'red' : 'plain'" size="md" />
      <div style="min-width: 0;">
        <div v-if="friend.name" class="cc-online-card-name">{{ friend.name }}</div>
        <div v-else class="cc-online-card-name is-unresolved" :title="friend.id">Name nicht auflösbar</div>
        <div class="cc-online-card-tags">
          <span v-if="friend.online === true" class="cc-tag is-online">Online</span>
          <span v-else-if="friend.online === false" class="cc-tag">Offline</span>
          <span v-else class="cc-tag" title="Autodarts hat keinen Online-Status geliefert">Status unbekannt</span>
          <span v-if="friend.inMatch === true" class="cc-tag is-accent">Im Match</span>
        </div>
      </div>
    </div>

    <div v-if="friend.stats" class="cc-online-card-stats">
      <div><span class="k">Average</span><span class="v">{{ friend.stats.average.toFixed(1) }}</span></div>
      <div><span class="k">S : N</span><span class="v">{{ friend.stats.wins }}:{{ friend.stats.losses }}</span></div>
    </div>
    <div v-else class="cc-online-card-stats" style="color: var(--cc-text-faint); font-size: 11px;">
      Keine Statistik von Autodarts geliefert
    </div>

    <div v-if="lastPlayedAt" class="cc-online-card-together" data-testid="cc-online-card-together">
      Zuletzt gemeinsam gespielt: {{ formatAgo(lastPlayedAt) }}
    </div>

    <button
      class="cc-btn is-primary"
      type="button"
      :disabled="!canAct || !friend.id"
      :title="buttonTitle"
      :data-testid="`cc-online-card-challenge-${friend.id}`"
      @click="$emit('select', friend)"
    >
      <span class="icon-[pixelarticons--bullseye]" />
      <span>Herausfordern</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import CcPlayerBadge from "./CcPlayerBadge.vue";
import type { IFriendResolved } from "@/utils/friends-api";

const props = defineProps<{
  friend: IFriendResolved;
  canAct: boolean;
  selected: boolean;
  /** ISO-Datum des letzten gemeinsamen Matches, per userId ermittelt — `null`, wenn nicht ableitbar. */
  lastPlayedAt: string | null;
}>();

defineEmits<{
  (e: "select", friend: IFriendResolved): void;
  (e: "open-detail", friend: IFriendResolved): void;
}>();

const badgeName = computed(() => props.friend.name ?? "?");

const buttonTitle = computed(() => {
  if (!props.friend.id) return "Für diesen Eintrag hat Autodarts keine Kennung geliefert";
  if (!props.canAct) return "Nur möglich, solange die Freundesliste geladen ist";
  return "Öffnet den Herausforderungs-Screen für diesen Freund";
});

function formatAgo(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch {
    return iso;
  }
}
</script>
