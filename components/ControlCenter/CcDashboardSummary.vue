<template>
  <CcCard title="Kurzübersicht" subtitle="Bilanz & letztes Training" icon="icon-[pixelarticons--chart-bar]" accent="muted" data-testid="cc-card-dashboard-summary">
    <div class="cc-grid" style="grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px;">
      <div>
        <div class="cc-detail-heading">Bilanz</div>
        <div v-if="summary.totalMatches > 0" class="cc-tiles" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
          <CcStatTile label="Matches" :value="summary.totalMatches" accent="gold" />
          <CcStatTile label="Win Rate" :value="winRatePercent" unit="%" hint="Deine Nutzer-ID" />
        </div>
        <p v-else class="cc-note" style="font-size: 12px;">Noch keine gespeicherten Matches.</p>
      </div>
      <div>
        <div class="cc-detail-heading">Letztes Training</div>
        <template v-if="lastSession">
          <div class="cc-tiles" style="grid-template-columns: repeat(2, minmax(0, 1fr));">
            <CcStatTile label="Ø Average" :value="lastSession.average" :decimals="1" />
            <CcStatTile label="Ziele" :value="`${lastSession.goalsReached}/${lastSession.totalGoals}`" />
          </div>
          <p class="cc-note" style="font-size: 11px; margin-top: 4px;">
            {{ lastSession.exerciseTitle ?? 'Freies Training' }} · {{ formatDate(lastSession.date) }}
          </p>
        </template>
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
  getCanonicalMatchResults,
} from "@/utils/canonical-match-result-storage";
import type { ICanonicalMatchResult } from "@/utils/canonical-match-result";
import { AutodartsToolsGlobalStatus, AutodartsToolsTrainingHistory } from "@/utils/storage";
import type { TrainingSession } from "@/utils/training-history";
import { getUserIdFromToken } from "@/utils/helpers";
import { computeMatchSummary } from "@/utils/statistics";

/* ─── Match-Bilanz (aus CMR, ungefiltert — dieselbe Quelle wie Verlauf/Statistiken) ── */
const rawResults = ref<ICanonicalMatchResult[]>([]);
let unwatchCmr: (() => void) | undefined;

async function loadResults(): Promise<void> {
  try {
    rawResults.value = await getCanonicalMatchResults();
  } catch (error) {
    console.error("[CcDashboardSummary] loadResults failed", error);
  }
}

/* ─── Eigene Identität (Player-Identity-Fix, siehe ROADMAP_DEPENDENCIES.md) ── */
const myUserId = ref<string | null>(null);

async function loadMyUserId(): Promise<void> {
  try {
    myUserId.value = await getUserIdFromToken();
  } catch (error) {
    console.error("[CcDashboardSummary] loadMyUserId failed", error);
    myUserId.value = null;
  }
}

const summary = computed(() => computeMatchSummary(rawResults.value, myUserId.value));
const winRatePercent = computed(() => {
  const rate = summary.value.winRate;
  return rate === null ? null : Math.round(rate * 100);
});

/* ─── Letztes Training ───────────────────────────────────────────────────── */
const trainingHistory = ref<TrainingSession[]>([]);
let unwatchTraining: (() => void) | undefined;
let unwatchGlobalStatus: (() => void) | undefined;

async function loadTrainingHistory(): Promise<void> {
  try {
    trainingHistory.value = await AutodartsToolsTrainingHistory.getValue();
  } catch (error) {
    console.error("[CcDashboardSummary] loadTrainingHistory failed", error);
  }
}

const lastSession = computed(() => trainingHistory.value[0] ?? null);

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

let disposed = false;

onMounted(async () => {
  await Promise.all([ loadResults(), loadTrainingHistory(), loadMyUserId() ]);
  if (disposed) return;
  unwatchCmr = AutodartsToolsCanonicalMatchResults.watch(() => void loadResults());
  unwatchTraining = AutodartsToolsTrainingHistory.watch(() => void loadTrainingHistory());
  // N2 (PR #16 Review): myUserId wurde bisher nur einmalig beim Mount
  // aufgelöst. Kam der Auth-Token erst nach dem Mount an (später Login),
  // blieb die Bilanz dauerhaft leer — derselbe Live-Refresh-Fix wie bereits
  // bei useControlCenterStatus.ts.
  unwatchGlobalStatus = AutodartsToolsGlobalStatus.watch(() => void loadMyUserId());
});

onBeforeUnmount(() => {
  disposed = true;
  unwatchCmr?.();
  unwatchTraining?.();
  unwatchGlobalStatus?.();
  unwatchCmr = undefined;
  unwatchTraining = undefined;
  unwatchGlobalStatus = undefined;
});
</script>
