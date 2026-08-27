<template>
  <div class="cc-panel" data-testid="cc-home-training">
    <div class="cc-panel-head">
      <span class="cc-panel-title">Training</span>
      <span class="cc-panel-link" data-testid="cc-home-training-link" @click="go">Training →</span>
    </div>

    <template v-if="lastSession">
      <div class="cc-home-training-stats">
        <div><div class="k">Ø Average</div><div class="v">{{ lastSession.average.toFixed(1) }}</div></div>
        <div><div class="k">Ziele</div><div class="v">{{ lastSession.goalsReached }}/{{ lastSession.totalGoals }}</div></div>
      </div>
      <p class="cc-note" style="font-size: 11px; margin-bottom: 10px;">
        {{ lastSession.exerciseTitle ?? "Freies Training" }} · {{ formatDate(lastSession.date) }}
      </p>
      <span class="cc-panel-cta" data-testid="cc-home-training-repeat" @click="go">
        <span class="icon-[pixelarticons--reload]" /> Letzte Übung wiederholen
      </span>
    </template>
    <div v-else class="cc-empty">
      <span class="cc-empty-icon"><span class="icon-[pixelarticons--trending-up]" /></span>
      <p class="cc-empty-title">Noch keine Trainings-Session</p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Dieselbe Quelle/Ableitung wie CcDashboardSummary.vue ("Letztes Training").
 * "Letzte Übung wiederholen" springt ehrlich zum Training-Bereich — es gibt
 * keinen bestehenden Mechanismus, der eine konkrete Übung per Deep-Link
 * direkt startet, also wird das nicht vorgetäuscht.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import { AutodartsToolsTrainingHistory } from "@/utils/storage";
import type { TrainingSession } from "@/utils/training-history";

const trainingHistory = ref<TrainingSession[]>([]);
let unwatchTraining: (() => void) | undefined;

async function loadTrainingHistory(): Promise<void> {
  try {
    trainingHistory.value = await AutodartsToolsTrainingHistory.getValue();
  } catch (error) {
    console.error("[CcHomeTraining] loadTrainingHistory failed", error);
  }
}

let disposed = false;

onMounted(async () => {
  await loadTrainingHistory();
  if (disposed) return;
  unwatchTraining = AutodartsToolsTrainingHistory.watch(() => void loadTrainingHistory());
});
onBeforeUnmount(() => {
  disposed = true;
  unwatchTraining?.();
  unwatchTraining = undefined;
});

const lastSession = computed(() => trainingHistory.value[0] ?? null);

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function go(): void {
  window.location.hash = "training";
}
</script>
