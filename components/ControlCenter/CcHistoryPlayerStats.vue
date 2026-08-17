<template>
  <div class="cc-history-player-stats">
    <div
      v-for="entry in entries"
      :key="entry.key"
      class="cc-history-stat"
    >
      <span class="cc-history-stat-label">{{ entry.label }}</span>
      <span :class="[ 'cc-history-stat-value', entry.value === null && 'is-unknown' ]">
        {{ entry.text }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

/**
 * Statistik-Raster für einen Spieler im History-Detail.
 * Erwartet den Display-Shape ICmrPlayerDisplay (aus match-history-view.ts).
 * KEIN Live-State, keine Annahmen — nur das, was im CMR steht.
 */
interface ICmrPlayerDisplay {
  index: number;
  name: string;
  userId?: string;
  isBot?: boolean;
  legs?: number;
  sets?: number;
  average?: number;
  checkoutPoints?: number;
  total180?: number;
  dartsThrown?: number;
  first9Average?: number;
  isWinner: boolean;
}

const props = withDefaults(defineProps<{
  player: ICmrPlayerDisplay;
  /** Welche Stats angezeigt werden (Keys siehe make()). */
  stats?: string[];
  /** Ob das Match überhaupt Sets führt. */
  anySets?: boolean;
}>(), {
  stats: () => ["average", "first9", "total180", "checkout", "darts", "legs", "sets"],
  anySets: false,
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
  const p = props.player;

  for (const key of props.stats!) {
    switch (key) {
      case "average":
        list.push(make("average", "Average", p.average, 2));
        break;
      case "first9":
        list.push(make("first9", "First 9", p.first9Average, 2));
        break;
      case "checkout":
        // p.checkoutPoints ist laut Codebase-Konvention (siehe CcPlayerStatGrid.vue "highFinish",
        // match-card.ts HIGH_FINISH/BIG_FISH-Badges) der höchste Einzel-Checkout, keine kumulierte
        // Punktzahl — eine Prozentrechnung darauf wäre irreführend. Zeigt daher den rohen Wert.
        list.push(make("checkout", "Bester Checkout", p.checkoutPoints));
        break;
      case "legs":
        list.push(make("legs", "Legs", p.legs));
        break;
      case "sets":
        if (props.anySets) list.push(make("sets", "Sets", p.sets));
        break;
      case "darts":
        list.push(make("darts", "Darts", p.dartsThrown));
        break;
      case "total180":
        list.push(make("total180", "180er", p.total180));
        break;
      case "highFinish":
        list.push(make("highFinish", "High Finish", p.checkoutPoints));
        break;
    }
  }

  return list;
});
</script>

<style scoped>
.cc-history-player-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.cc-history-stat {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 80px;
}

.cc-history-stat-label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--cc-text-faint);
}

.cc-history-stat-value {
  font-family: var(--cc-font-display);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  color: var(--cc-text);
}

.cc-history-stat-value.is-unknown {
  color: var(--cc-text-faint);
}
</style>