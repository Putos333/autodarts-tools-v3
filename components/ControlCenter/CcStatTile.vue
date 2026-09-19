<template>
  <div :class="[ 'cc-tile', isUnknown ? 'is-dim' : accent === 'gold' ? 'is-gold' : accent === 'accent' ? 'is-accent' : '' ]">
    <div class="cc-tile-label">{{ label }}</div>
    <div class="cc-tile-value">
      {{ display }}<span v-if="unit && !isUnknown" class="cc-tile-unit">{{ unit }}</span>
    </div>
    <div v-if="hint" class="cc-tile-hint">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  label: string;
  /**
   * `undefined`/`null` bedeutet ausdrücklich "unbekannt" und wird als "–"
   * dargestellt — nicht als 0. Dieselbe Regel wie im Canonical Match Result.
   */
  value?: number | string | null;
  unit?: string;
  hint?: string | null;
  /** Anzahl Dezimalstellen für numerische Werte. */
  decimals?: number;
  accent?: "plain" | "accent" | "gold";
}>(), {
  accent: "plain",
  decimals: 0,
});

const isUnknown = computed(() => props.value === undefined || props.value === null || props.value === "");

const display = computed(() => {
  if (isUnknown.value) return "–";
  if (typeof props.value === "number") {
    return Number.isFinite(props.value) ? props.value.toFixed(props.decimals) : "–";
  }
  return String(props.value);
});
</script>
