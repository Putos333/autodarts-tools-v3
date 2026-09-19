<template>
  <div class="cc-player-stats" :class="align === 'right' && 'is-right'">
    <div v-for="entry in entries" :key="entry.key" class="cc-stat">
      <div class="cc-stat-label">{{ entry.label }}</div>
      <div :class="[ 'cc-stat-value', entry.value === null && 'is-unknown' ]">
        {{ entry.text }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { ICcPlayer } from "@/composables/useControlCenterStatus";

/**
 * Kennzahlen-Raster für einen Spieler. Welche Werte gezeigt werden, gibt der
 * Aufrufer über `stats` vor — so kann das Match-Scoreboard bei Cricket & Co.
 * einen anderen Satz zeigen als bei X01, ohne dass hier etwas erfunden wird.
 * `null` erscheint immer als "–", niemals als 0.
 */
const props = withDefaults(defineProps<{
  player: ICcPlayer;
  stats: string[];
  anySets?: boolean;
  /** Zusätzlich den Punkte-/Restwert anzeigen (Mehrspieler-Ansicht). */
  withScore?: boolean;
  scoreLabel?: string;
  align?: "left" | "right";
}>(), {
  anySets: false,
  withScore: false,
  scoreLabel: "Punkte",
  align: "left",
});

interface IEntry {
  key: string;
  label: string;
  value: number | null;
  text: string;
}

function make(key: string, label: string, value: number | undefined, decimals = 0): IEntry {
  return {
    key,
    label,
    value: value ?? null,
    text: value === undefined ? "–" : value.toFixed(decimals),
  };
}

const entries = computed<IEntry[]>(() => {
  const list: IEntry[] = [];

  if (props.withScore) {
    list.push(make("score", props.scoreLabel, props.player.remaining));
  }

  for (const key of props.stats) {
    switch (key) {
      case "average":
        list.push(make("average", "Average", props.player.average, 2));
        break;
      case "first9":
        list.push(make("first9", "First 9", props.player.first9Average, 2));
        break;
      case "checkout":
        list.push(make("checkout", "Checkout", props.player.checkoutPercent, 1));
        break;
      case "legs":
        list.push(make("legs", "Legs", props.player.legs));
        break;
      case "sets":
        // Sets nur, wenn das Match überhaupt Sets führt.
        if (props.anySets) list.push(make("sets", "Sets", props.player.sets));
        break;
      case "darts":
        list.push(make("darts", "Darts", props.player.dartsThrown));
        break;
      case "total180":
        list.push(make("total180", "180er", props.player.total180));
        break;
      case "highFinish":
        list.push(make("highFinish", "High Finish", props.player.checkoutPoints));
        break;
    }
  }

  return list;
});
</script>
