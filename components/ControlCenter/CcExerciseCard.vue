<template>
  <article :class="[ 'cc-ex', large && 'is-lg' ]" :data-testid="`cc-exercise-${exercise.id}`">
    <div class="cc-ex-head">
      <span class="cc-ex-cat" :title="categoryMeta.label">{{ categoryMeta.icon }}</span>
      <div class="cc-ex-titles">
        <div class="cc-ex-title">{{ exercise.title }}</div>
        <div class="cc-ex-meta">
          {{ categoryMeta.label }} · ~{{ exercise.durationMin }} min
          <template v-if="exercise.suggestedVariant"> · {{ exercise.suggestedVariant }}</template>
        </div>
      </div>
      <span v-if="medal" class="cc-ex-medal" :title="`Medaille: ${medalLabel}`">{{ medalEmoji }}</span>
    </div>

    <p class="cc-ex-desc">{{ exercise.description }}</p>

    <div class="cc-ex-goals">
      <span class="cc-ex-goal"><b>🥉</b> {{ goalText(exercise.goals.bronze) }}</span>
      <span class="cc-ex-goal"><b>🥈</b> {{ goalText(exercise.goals.silver) }}</span>
      <span class="cc-ex-goal"><b>🥇</b> {{ goalText(exercise.goals.gold) }}</span>
    </div>

    <div class="cc-ex-btn-row">
      <button
        class="cc-btn is-primary"
        type="button"
        :data-testid="`cc-exercise-start-${exercise.id}`"
        @click="start"
      >
        <span class="icon-[pixelarticons--play]" />
        <span>{{ large ? "Jetzt trainieren" : "Übung starten" }}</span>
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";

import {
  EXERCISE_CATEGORIES,
  type ExerciseGoal,
  type Medal,
  type TrainingExercise,
} from "@/utils/training-exercises";

/** Vom Control-Center-Root via provide() zur Verfügung gestellt. */
type ShowNotification = (message: string, type?: "success" | "error", duration?: number) => void;
const showNotification = inject<ShowNotification>("cc-notification");

const props = withDefaults(defineProps<{
  exercise: TrainingExercise;
  medal?: Medal | null;
  /** Größere Variante für die Schnellstart-Kacheln. */
  large?: boolean;
}>(), {
  medal: null,
  large: false,
});

const categoryMeta = computed(() => EXERCISE_CATEGORIES[props.exercise.category]);

const medalEmoji = computed(() => {
  if (props.medal === "gold") return "🥇";
  if (props.medal === "silver") return "🥈";
  if (props.medal === "bronze") return "🥉";
  return "";
});

const medalLabel = computed(() => {
  if (props.medal === "gold") return "Gold";
  if (props.medal === "silver") return "Silber";
  if (props.medal === "bronze") return "Bronze";
  return "Keine";
});

function goalText(g: ExerciseGoal): string {
  if (g.customCondition) return g.customCondition;
  if (g.minAverage) return `Avg ≥ ${g.minAverage}`;
  if (g.min140Plus) return `${g.min140Plus}× 140+`;
  if (g.min180s) return `${g.min180s}× 180`;
  if (g.minCheckoutRate) return `Checkout ≥ ${g.minCheckoutRate}%`;
  if (g.maxMissRate) return `Max ${g.maxMissRate}% Miss`;
  if (g.minCheckouts) return `${g.minCheckouts}× Finish`;
  return "—";
}

/**
 * Start übernimmt exakt den bestehenden Workflow aus TrainingExercises.vue:
 * die aktive Übung wird im Storage gemerkt (training-mode.ts wertet sie im
 * Match aus) und der Nutzer wird gebeten, play.autodarts.io zu öffnen. Es gibt
 * KEINE zweite Training-Engine — hier wird nur die vorhandene angestoßen.
 */
async function start(): Promise<void> {
  try {
    await browser.storage.local.set({ "training-active-exercise": props.exercise.id });
    showNotification?.(
      `Übung „${props.exercise.title}" gestartet. Öffne jetzt play.autodarts.io und beginne ein Match ` +
      `— das Overlay zeigt den Fortschritt. Empfohlener Modus: ${props.exercise.suggestedVariant ?? "beliebig"}`,
      "success",
      8000,
    );
  } catch (error) {
    console.error("[CcExerciseCard] start failed", error);
    showNotification?.("Übung konnte nicht gestartet werden.", "error");
  }
}
</script>
