<template>
  <div v-if="visible" class="cc-active-refl" data-testid="cc-training-active-reflection">
    <div class="cc-active-refl-head">
      <span class="cc-active-refl-dot" />
      <span class="cc-active-refl-title">Aktive Übung: {{ exerciseTitle }}</span>
      <span class="cc-panel-cta" data-testid="cc-training-clear-active" @click="clearActive">
        <span class="icon-[pixelarticons--close]" /> Beenden
      </span>
    </div>

    <p class="cc-note" style="font-size: 12px;">
      Direkter Blick auf dein laufendes Match — keine eigene Auswertung, die
      Ziel-Prüfung passiert wie gewohnt im Match-Overlay.
    </p>

    <div class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); margin-top: 8px;">
      <CcStatTile label="Am Wurf" :value="activePlayer?.name ?? '—'" />
      <CcStatTile v-if="typeof activePlayer?.average === 'number'" label="Average" :value="activePlayer.average" :decimals="1" />
      <CcStatTile v-if="liveThrow.visitScore !== null" label="Aktueller Visit" :value="liveThrow.visitScore" accent="accent" />
    </div>

    <div v-if="liveThrow.hasTurn" class="cc-active-refl-darts">
      <span
        v-for="(dart, i) in liveThrow.darts"
        :key="i"
        :class="['cc-active-refl-dart', dart.hit && 'is-hit']"
      >{{ dart.hit ? dart.label : "—" }}</span>
    </div>

    <p v-if="exerciseGoalText" class="cc-note" style="font-size: 12px; margin-top: 6px;">
      Zielstufen dieser Übung: {{ exerciseGoalText }}
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * Rein lesende Momentaufnahme des laufenden Trainings: zeigt an, welche Übung
 * aktiv ist (aus dem echten `training-active-exercise`-Storage-Key, den auch
 * CcExerciseCard.vue setzt) und spiegelt den bereits vorhandenen Live-Zustand
 * (useControlCenterStatus) dazu. Führt KEINE eigene Ziel-Prüfung durch — das
 * bleibt allein Aufgabe von training-mode.ts im Match-Overlay, um keine
 * zweite Trainings-Engine zu erzeugen.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import CcStatTile from "./CcStatTile.vue";
import { TRAINING_EXERCISES } from "@/utils/training-exercises";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

const ACTIVE_EXERCISE_KEY = "training-active-exercise";

const activeExerciseId = ref<string | null>(null);

async function loadActiveExercise(): Promise<void> {
  try {
    const r = await browser.storage.local.get(ACTIVE_EXERCISE_KEY);
    activeExerciseId.value = (r[ACTIVE_EXERCISE_KEY] as string | undefined) ?? null;
  } catch (e) {
    console.error("[CcTrainingActiveReflection] loadActiveExercise failed", e);
    activeExerciseId.value = null;
  }
}

function onStorageChange(changes: Record<string, any>, area: string): void {
  if (area === "local" && ACTIVE_EXERCISE_KEY in changes) {
    activeExerciseId.value = (changes[ACTIVE_EXERCISE_KEY].newValue as string | undefined) ?? null;
  }
}

const { hasMatch, matchFinished, players, liveThrow } = useControlCenterStatus();

const activeExercise = computed(() => TRAINING_EXERCISES.find(ex => ex.id === activeExerciseId.value) ?? null);
const exerciseTitle = computed(() => activeExercise.value?.title ?? "Unbekannte Übung");

const exerciseGoalText = computed(() => {
  const ex = activeExercise.value;
  if (!ex) return "";
  const parts: string[] = [];
  if (ex.goals.bronze.minAverage) parts.push(`Bronze Avg ≥ ${ex.goals.bronze.minAverage}`);
  if (ex.goals.gold.minAverage) parts.push(`Gold Avg ≥ ${ex.goals.gold.minAverage}`);
  return parts.join(" · ");
});

/** Dieselbe Auflösung wie das bestehende Momentum (kein zweiter Identitäts-Mechanismus). */
const activePlayer = computed(() => players.value.find(p => p.isActive) ?? null);

const visible = computed(() => activeExerciseId.value !== null && hasMatch.value && !matchFinished.value);

async function clearActive(): Promise<void> {
  try {
    await browser.storage.local.remove(ACTIVE_EXERCISE_KEY);
    activeExerciseId.value = null;
  } catch (e) {
    console.error("[CcTrainingActiveReflection] clearActive failed", e);
  }
}

onMounted(() => {
  void loadActiveExercise();
  browser.storage.onChanged.addListener(onStorageChange);
});

onBeforeUnmount(() => {
  browser.storage.onChanged.removeListener(onStorageChange);
});
</script>

<style scoped>
.cc-active-refl {
  border: 1px solid var(--cc-accent-line);
  background: var(--cc-accent-soft);
  border-radius: 10px;
  padding: 12px 14px;
  margin-top: 12px;
}
.cc-active-refl-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cc-active-refl-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--cc-ok);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cc-ok) 25%, transparent);
}
.cc-active-refl-title {
  font-family: var(--cc-font-display);
  font-weight: 700;
  flex: 1;
}
.cc-active-refl-darts {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.cc-active-refl-dart {
  min-width: 40px;
  text-align: center;
  padding: 4px 8px;
  border-radius: 6px;
  background: var(--cc-surface-strong);
  font-family: var(--cc-font-display);
  font-weight: 700;
  opacity: 0.5;
}
.cc-active-refl-dart.is-hit {
  opacity: 1;
  color: #fff;
  background: var(--cc-accent);
}
</style>
