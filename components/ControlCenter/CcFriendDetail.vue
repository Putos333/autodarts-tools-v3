<template>
  <div :class="[ 'cc-fd-scrim', open && 'is-open' ]" @click="$emit('close')" />
  <aside
    :class="[ 'cc-friend-detail', open && 'is-open' ]"
    data-testid="cc-friend-detail"
    role="dialog"
    aria-label="Freund-Details"
  >
    <button class="cc-fd-close" type="button" data-testid="cc-friend-detail-close" @click="$emit('close')">✕</button>

    <template v-if="friend">
      <div class="cc-fd-head">
        <CcPlayerBadge :name="friend.name ?? '?'" :variant="friend.online === true ? 'blue' : 'plain'" size="xl" />
        <div v-if="friend.name" class="cc-fd-name">{{ friend.name }}</div>
        <div v-else class="cc-fd-name" style="color: var(--cc-text-faint); font-style: italic;">Name nicht auflösbar</div>
        <span v-if="friend.online === true" class="cc-pill cc-tone-ok"><span class="cc-pill-led" />Online</span>
        <span v-else-if="friend.online === false" class="cc-pill cc-tone-idle"><span class="cc-pill-led" />Offline</span>
        <span v-else class="cc-pill cc-tone-idle"><span class="cc-pill-led" />Status unbekannt</span>
      </div>

      <div v-if="friend.stats" class="cc-fd-stats">
        <div><span class="k">Average</span><span class="v">{{ friend.stats.average.toFixed(1) }}</span></div>
        <div><span class="k">Siege : Niederlagen</span><span class="v">{{ friend.stats.wins }}:{{ friend.stats.losses }}</span></div>
      </div>
      <div v-else class="cc-fd-stats" style="font-size: 12px; color: var(--cc-text-faint);">
        Keine Statistik von Autodarts geliefert
      </div>

      <div v-if="lastPlayedAt" class="cc-note" style="margin-top: 12px;" data-testid="cc-friend-detail-together">
        Zuletzt gemeinsam gespielt: {{ formatDate(lastPlayedAt) }}
      </div>

      <div class="cc-fd-section-title">Head-to-Head</div>
      <div class="cc-fd-h2h-empty" data-testid="cc-friend-detail-h2h">
        Nicht zuverlässig verfügbar. Der zugehörige Endpoint ist ungeprüft/pending — hier wird bewusst keine Zahl erfunden.
      </div>

      <div class="cc-fd-cta">
        <button
          class="cc-btn is-primary is-lg"
          type="button"
          :disabled="!canAct || !friend.id"
          data-testid="cc-friend-detail-challenge"
          @click="$emit('challenge', friend)"
        >
          <span class="icon-[pixelarticons--bullseye]" /><span>Herausfordern</span>
        </button>
      </div>
    </template>
  </aside>
</template>

<script setup lang="ts">
import CcPlayerBadge from "./CcPlayerBadge.vue";
import type { IFriendResolved } from "@/utils/friends-api";

defineProps<{
  friend: IFriendResolved | null;
  open: boolean;
  canAct: boolean;
  lastPlayedAt: string | null;
}>();

defineEmits<{
  (e: "close"): void;
  (e: "challenge", friend: IFriendResolved): void;
}>();

function formatDate(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
  } catch {
    return iso;
  }
}
</script>
