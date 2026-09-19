<template>
  <CcCard title="Kurzübersicht" subtitle="Bilanz & letztes Training" icon="icon-[pixelarticons--chart-bar]" accent="muted" data-testid="cc-card-dashboard-summary">
    <div class="cc-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
      <div>
        <div class="cc-detail-heading">Bilanz</div>
        <div
          v-if="bilanzState === null || bilanzState === 'identity_unknown'"
          class="cc-tiles"
          style="grid-template-columns: repeat(2, minmax(0, 1fr));"
        >
          <CcStatTile label="Matches" :value="summary.totalMatches" accent="gold" />
          <CcStatTile label="Win Rate" :value="winRatePercent" unit="%" hint="Deine Nutzer-ID" />
        </div>
        <p v-if="bilanzState === 'identity_unknown'" class="cc-note" style="font-size: 11px; color: var(--cc-warn); margin-top: 4px;">
          Deine Nutzer-ID ist noch nicht aufgelöst.
        </p>
        <p v-else-if="bilanzState === 'loading'" class="cc-note" style="font-size: 12px;">Lädt …</p>
        <p v-else-if="bilanzState === 'unavailable'" class="cc-note" style="font-size: 12px; color: var(--cc-warn);">
          Bilanz nicht verfügbar.
          <a href="#" @click.prevent="() => loadResults()" style="color: var(--cc-gold); text-decoration: underline;">Erneut versuchen</a>
        </p>
        <p v-else-if="bilanzState === 'no_data'" class="cc-note" style="font-size: 12px;">Noch keine gespeicherten Matches.</p>
      </div>
      <div>
        <div class="cc-detail-heading">Letztes Training</div>
        <template v-if="trainingState === null && lastSession">
          <div class="cc-tiles" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
            <CcStatTile label="Ø Average" :value="lastSession.average" :decimals="1" />
            <CcStatTile label="Ziele" :value="`${lastSession.goalsReached}/${lastSession.totalGoals}`" />
          </div>
          <p class="cc-note" style="font-size: 11px; margin-top: 4px;">
            {{ lastSession.exerciseTitle ?? 'Freies Training' }} · {{ formatDate(lastSession.date) }}
          </p>
        </template>
        <p v-else-if="trainingState === 'loading'" class="cc-note" style="font-size: 12px;">Lädt …</p>
        <p v-else-if="trainingState === 'unavailable'" class="cc-note" style="font-size: 12px; color: var(--cc-warn);">
          Training nicht verfügbar.
          <a href="#" @click.prevent="() => loadTrainingHistory()" style="color: var(--cc-gold); text-decoration: underline;">Erneut versuchen</a>
        </p>
        <p v-else class="cc-note" style="font-size: 12px;">Noch keine Trainings-Session gespeichert.</p>
      </div>
    </div>
  </CcCard>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import CcCard from "./CcCard.vue";
import CcStatTile from "./CcStatTile.vue";
import {
  AutodartsToolsCanonicalMatchResults,
  initCanonicalMatchResults,
} from "@/utils/canonical-match-result-storage";
import type { ICanonicalMatchResult } from "@/utils/canonical-match-result";
import { AutodartsToolsTrainingHistory } from "@/utils/storage";
import type { TrainingSession } from "@/utils/training-history";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";
import { computeMatchSummary } from "@/utils/statistics";
import { deriveCcDataState } from "@/utils/control-center-data-state";

/* ─── Zentrale Status-Quelle (N2 Centralization) ────────────────────────────── */
const { myUserId } = useControlCenterStatus();

/* ─── Match-Bilanz (aus CMR, ungefiltert — dieselbe Quelle wie Verlauf/Statistiken) ── */
const rawResults = ref<ICanonicalMatchResult[]>([]);
let unwatchCmr: (() => void) | undefined;

/**
 * Issue #13, #7: "lädt noch", "Laden fehlgeschlagen" und "wirklich keine
 * Matches" zeigten bisher denselben leeren Zustand. `loading` gilt nur für
 * den ersten Ladevorgang. Ein fehlgeschlagener SPÄTERER Refresh löscht
 * `rawResults` NICHT mehr — bereits geladene, gute Daten bleiben sichtbar.
 */
const loading = ref(true);
const loadError = ref(false);

async function loadResults(): Promise<void> {
  try {
    rawResults.value = await initCanonicalMatchResults();
    loadError.value = false;
  } catch (error) {
    console.error("[CcDashboardSummary] loadResults failed", error);
    loadError.value = true;
  }
}

const summary = computed(() => computeMatchSummary(rawResults.value, myUserId.value));
const winRatePercent = computed(() => {
  const rate = summary.value.winRate;
  return rate === null ? null : Math.round(rate * 100);
});

/** Die Bilanz ist personenbezogen (Win Rate) — bei Matches ohne bekannte Identität separater Hinweis. */
const bilanzState = computed(() => deriveCcDataState({
  loading: loading.value,
  error: loadError.value,
  hasData: summary.value.totalMatches > 0,
  identityRequired: true,
  identityKnown: myUserId.value !== null,
}));

/* ─── Letztes Training ───────────────────────────────────────────────────── */
const trainingHistory = ref<TrainingSession[]>([]);
let unwatchTraining: (() => void) | undefined;
const trainingLoading = ref(true);
const trainingError = ref(false);

async function loadTrainingHistory(): Promise<void> {
  try {
    trainingHistory.value = await AutodartsToolsTrainingHistory.getValue();
    trainingError.value = false;
  } catch (error) {
    console.error("[CcDashboardSummary] loadTrainingHistory failed", error);
    trainingError.value = true;
  }
}

const lastSession = computed(() => trainingHistory.value[0] ?? null);

/** Training-Historie ist nicht identitätsabhängig (lokal pro Gerät). */
const trainingState = computed(() => deriveCcDataState({
  loading: trainingLoading.value,
  error: trainingError.value,
  hasData: trainingHistory.value.length > 0,
}));

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

let disposed = false;

onMounted(async () => {
  await Promise.all([ loadResults(), loadTrainingHistory() ]);
  loading.value = false;
  trainingLoading.value = false;
  if (disposed) return;
  unwatchCmr = AutodartsToolsCanonicalMatchResults.watch(() => void loadResults());
  unwatchTraining = AutodartsToolsTrainingHistory.watch(() => void loadTrainingHistory());
});

onBeforeUnmount(() => {
  disposed = true;
  unwatchCmr?.();
  unwatchTraining?.();
  unwatchCmr = undefined;
  unwatchTraining = undefined;
});
</script>
