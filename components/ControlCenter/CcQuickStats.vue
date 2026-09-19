<template>
  <CcCard
    title="Quick Stats"
    :subtitle="subtitle"
    icon="icon-[pixelarticons--trending-up]"
    accent="gold"
    data-testid="cc-card-quickstats"
  >
    <template v-if="focusPlayer">
      <!-- Spielerauswahl aus den tatsächlich gemeldeten Spielern -->
      <div v-if="players.length > 1" class="cc-focus-switch">
        <button
          @click="setFocusSeat(player.seat)"
          v-for="player in players"
          :key="player.seat"
          :class="[ 'cc-focus-btn', player.seat === focusPlayer.seat && 'is-active' ]"
          :data-testid="`cc-quickstats-player-${player.seat}`"
          type="button"
        >
          <CcPlayerBadge :name="player.name" :is-bot="player.isBot" size="sm" />
          <span>{{ player.name }}</span>
        </button>
      </div>

      <div class="cc-tiles">
        <CcStatTile
          v-for="stat in quickStats"
          :key="stat.key"
          :label="stat.label"
          :value="stat.value"
          :unit="stat.unit"
          :decimals="stat.decimals"
          :accent="stat.accent"
          :data-testid="`cc-stat-${stat.key}`"
        />
      </div>
    </template>

    <CcEmptyState
      v-else
      icon="icon-[pixelarticons--chart-bar]"
      title="Keine Statistikwerte"
      text="Quick Stats stammen aus den Match-Statistiken von Autodarts. Ohne laufendes oder zuletzt gemeldetes Match liegen keine Werte vor."
    />

    <template #footer>
      Alle Werte kommen unverändert aus den Match-Statistiken. „High Finish" ist das höchste
      Checkout. Ein „–" heißt: von Autodarts nicht gemeldet.
    </template>
  </CcCard>
</template>

<script setup lang="ts">
import { computed } from "vue";

import CcCard from "./CcCard.vue";
import CcStatTile from "./CcStatTile.vue";
import CcEmptyState from "./CcEmptyState.vue";
import CcPlayerBadge from "./CcPlayerBadge.vue";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

const { players, focusPlayer, setFocusSeat, quickStats, matchFinished } = useControlCenterStatus();

const subtitle = computed(() => {
  if (!focusPlayer.value) return "Statistik des laufenden Matches";
  const scope = matchFinished.value ? "Endstand" : "laufendes Match";
  return `${focusPlayer.value.name} · ${scope}`;
});
</script>
