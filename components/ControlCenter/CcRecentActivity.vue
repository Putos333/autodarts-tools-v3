<template>
  <div class="cc-activity" data-testid="cc-recent-activity">
    <template v-if="lastMatch">
      <div class="cc-last-match">
        <div class="cc-last-match-result">
          <span v-if="lastMatch.result !== 'undecided'" :class="[ 'cc-last-match-pill', lastMatch.result ]">
            {{ lastMatch.result === "win" ? "Sieg" : "Niederlage" }}
          </span>
          <span class="cc-last-match-vs">
            vs. <b>{{ lastMatch.opponentName }}</b>
            <template v-if="lastMatch.variant"> · {{ lastMatch.variant }}</template>
            <template v-if="lastMatch.myLegs !== undefined && lastMatch.opponentLegs !== undefined">
              · {{ lastMatch.myLegs }}:{{ lastMatch.opponentLegs }} Legs
            </template>
          </span>
        </div>
        <span class="cc-last-match-meta">
          <template v-if="lastMatch.myAverage !== undefined">Ø {{ lastMatch.myAverage.toFixed(1) }} · </template>{{ recordedAgo }}
        </span>
      </div>

      <div v-if="recentOpponents.length > 0" class="cc-opponents" data-testid="cc-recent-opponents">
        <span class="cc-opponents-label">Letzte Gegner</span>
        <span v-for="opp in recentOpponents" :key="opp.matchId + opp.name" class="cc-opponent-chip">
          <span class="cc-opponent-dot" />{{ opp.name }}
        </span>
      </div>
    </template>

    <div v-else class="cc-empty">
      <span class="cc-empty-icon"><span class="icon-[pixelarticons--gamepad]" /></span>
      <p class="cc-empty-title">Noch kein Match gespeichert</p>
      <p class="cc-note" style="font-size: 12px;">Sobald ein Match auf Autodarts endet, erscheint hier eine Zusammenfassung.</p>
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
import { getLastMatchSummary, getRecentOpponents } from "@/utils/dashboard-activity";

const rawResults = ref<ICanonicalMatchResult[]>([]);
const myUserId = ref<string | null>(null);
let unwatchCmr: (() => void) | undefined;
let unwatchGlobalStatus: (() => void) | undefined;

async function loadResults(): Promise<void> {
  try {
    rawResults.value = await getCanonicalMatchResults();
  } catch (error) {
    console.error("[CcRecentActivity] loadResults failed", error);
  }
}

async function loadMyUserId(): Promise<void> {
  try {
    myUserId.value = await getUserIdFromToken();
  } catch (error) {
    console.error("[CcRecentActivity] loadMyUserId failed", error);
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
  // blieb die Identität dauerhaft `null` und Bilanz/Recent-Activity dauerhaft
  // leer — derselbe Live-Refresh-Fix wie bereits bei useControlCenterStatus.ts.
  unwatchGlobalStatus = AutodartsToolsGlobalStatus.watch(() => void loadMyUserId());
});
onBeforeUnmount(() => {
  disposed = true;
  unwatchCmr?.();
  unwatchGlobalStatus?.();
  unwatchCmr = undefined;
  unwatchGlobalStatus = undefined;
});

const lastMatch = computed(() => getLastMatchSummary(rawResults.value, myUserId.value));
const recentOpponents = computed(() => getRecentOpponents(rawResults.value, myUserId.value, 3));

const recordedAgo = computed(() => {
  if (!lastMatch.value) return "";
  try {
    return new Date(lastMatch.value.recordedAt).toLocaleDateString("de-DE", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return lastMatch.value.recordedAt;
  }
});
</script>
