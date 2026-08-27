<template>
  <div class="cc-perfstrip" data-testid="cc-perfstrip">
    <template v-if="summary.totalMatches > 0">
      <div v-if="averageStats.average !== null" class="cc-perfstrip-stat">
        <div class="k">Average</div>
        <div class="v">{{ averageStats.average.toFixed(1) }}</div>
      </div>
      <div v-if="scoring.total180 > 0" class="cc-perfstrip-stat">
        <div class="k">180er gesamt</div>
        <div class="v gold">{{ scoring.total180 }}</div>
      </div>
      <div v-if="scoring.highestCheckout !== null" class="cc-perfstrip-stat">
        <div class="k">Bester Checkout</div>
        <div class="v gold">{{ scoring.highestCheckout }}</div>
      </div>
      <div class="cc-perfstrip-stat">
        <div class="k">Matches</div>
        <div class="v">{{ summary.totalMatches }}</div>
      </div>

      <div v-if="recentForm.length > 0" class="cc-perfstrip-form">
        <span class="l">Form</span>
        <div class="cc-form-strip" data-testid="cc-perfstrip-form">
          <span
            v-for="entry in recentForm"
            :key="entry.matchId"
            :class="[ 'cc-form-chip', entry.won === true ? 'win' : entry.won === false ? 'loss' : 'undecided' ]"
          >{{ entry.won === true ? "S" : entry.won === false ? "N" : "–" }}</span>
        </div>
      </div>
    </template>

    <div v-else class="cc-empty">
      <span class="cc-empty-icon"><span class="icon-[pixelarticons--chart-bar]" /></span>
      <p class="cc-empty-title">Noch keine Performance-Daten</p>
      <p class="cc-note" style="font-size: 12px;">Erscheint, sobald ein Match gespeichert wurde.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import {
  AutodartsToolsCanonicalMatchResults,
  getCanonicalMatchResults,
} from "@/utils/canonical-match-result-storage";
import type { ICanonicalMatchResult } from "@/utils/canonical-match-result";
import { getUserIdFromToken } from "@/utils/helpers";
import { AutodartsToolsGlobalStatus } from "@/utils/storage";
import { computeMatchSummary, computeAverageStats, computeScoringStats, computeRecentForm } from "@/utils/statistics";

/**
 * Dieselben Ableitungen wie CcDashboardSummary.vue / Statistiken-Ansicht —
 * keine neue Aggregationslogik. Checkout %, 100+, 140+ bleiben bewusst
 * draußen: `ICmrPlayer` (utils/canonical-match-result.ts) führt diese Felder
 * nicht — nur `average`, `total180`, `checkoutPoints` (bester Einzel-
 * Checkout) und `dartsThrown` werden je Match gespeichert.
 */
const rawResults = ref<ICanonicalMatchResult[]>([]);
const myUserId = ref<string | null>(null);
let unwatchCmr: (() => void) | undefined;
let unwatchGlobalStatus: (() => void) | undefined;

async function loadResults(): Promise<void> {
  try {
    rawResults.value = await getCanonicalMatchResults();
  } catch (error) {
    console.error("[CcPerformanceStrip] loadResults failed", error);
  }
}

async function loadMyUserId(): Promise<void> {
  try {
    myUserId.value = await getUserIdFromToken();
  } catch (error) {
    console.error("[CcPerformanceStrip] loadMyUserId failed", error);
    myUserId.value = null;
  }
}

let disposed = false;

onMounted(async () => {
  await Promise.all([ loadResults(), loadMyUserId() ]);
  if (disposed) return;
  unwatchCmr = AutodartsToolsCanonicalMatchResults.watch(() => void loadResults());
  // N2 (PR #16 Review): myUserId wurde bisher nur einmalig beim Mount
  // aufgelöst. Kam der Auth-Token erst nach dem Mount an (später Login),
  // blieben alle Statistik-Werte dauerhaft leer — derselbe Live-Refresh-Fix
  // wie bereits bei useControlCenterStatus.ts.
  unwatchGlobalStatus = AutodartsToolsGlobalStatus.watch(() => void loadMyUserId());
});
onBeforeUnmount(() => {
  disposed = true;
  unwatchCmr?.();
  unwatchGlobalStatus?.();
  unwatchCmr = undefined;
  unwatchGlobalStatus = undefined;
});

const summary = computed(() => computeMatchSummary(rawResults.value, myUserId.value));
const averageStats = computed(() => computeAverageStats(rawResults.value, myUserId.value));
const scoring = computed(() => computeScoringStats(rawResults.value, myUserId.value));
const recentForm = computed(() => computeRecentForm(rawResults.value, 5, myUserId.value));
</script>
