<template>
  <section data-testid="cc-recent-opponents-panel">
    <div class="cc-section-title">
      <span class="icon-[pixelarticons--clock]" />
      <span>Letzte Gegner</span>
    </div>

    <div v-if="opponents.length > 0" class="cc-recent-list" data-testid="cc-recent-list">
      <div v-for="opp in opponents" :key="opp.matchId + opp.name" class="cc-recent-row">
        <CcPlayerBadge :name="opp.name" size="sm" :variant="opp.result === 'win' ? 'gold' : 'plain'" />
        <div style="min-width: 0;">
          <div class="cc-recent-name">{{ opp.name }}</div>
          <div class="cc-recent-date">{{ formatDate(opp.recordedAt) }}</div>
        </div>
        <span :class="[ 'cc-recent-pill', opp.result ]">
          {{ opp.result === "win" ? "Sieg" : opp.result === "loss" ? "Niederlage" : "Unentschieden offen" }}
        </span>
        <div class="cc-recent-avg">
          <span v-if="opp.myAverage !== undefined"><span class="k">Average</span>{{ opp.myAverage.toFixed(1) }}</span>
        </div>
        <button
          v-if="friendFor(opp.userId)"
          class="cc-btn"
          type="button"
          :data-testid="`cc-recent-challenge-${opp.userId}`"
          @click="$emit('challenge', friendFor(opp.userId)!)"
        >
          <span class="icon-[pixelarticons--reload]" /><span>Nochmal herausfordern</span>
        </button>
      </div>
    </div>

    <CcEmptyState
      v-else
      icon="icon-[pixelarticons--gamepad]"
      title="Noch keine Gegner"
      text="Sobald Matches auf Autodarts gespeichert wurden, erscheinen hier deine letzten Gegner."
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

import CcEmptyState from "./CcEmptyState.vue";
import CcPlayerBadge from "./CcPlayerBadge.vue";
import type { ICanonicalMatchResult } from "@/utils/canonical-match-result";
import { getRecentOpponents } from "@/utils/dashboard-activity";
import type { IFriendResolved } from "@/utils/friends-api";

const props = defineProps<{
  records: ICanonicalMatchResult[];
  myUserId: string | null;
  /** Bereits geladene Freundesliste — für den userId-Abgleich bei "Nochmal herausfordern". */
  friends: IFriendResolved[];
  limit?: number;
}>();

defineEmits<{ (e: "challenge", friend: IFriendResolved): void }>();

const opponents = computed(() => getRecentOpponents(props.records, props.myUserId, props.limit ?? 6));

/** Nur per userId — ein Namensgleichstand allein zählt nicht als Identität. */
function friendFor(userId: string | undefined): IFriendResolved | null {
  if (!userId) return null;
  return props.friends.find(f => f.id === userId) ?? null;
}

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
