<template>
  <div class="cc-grid" data-testid="cc-stats">
    <!-- (A) HEADER -->
    <div class="cc-col-12">
      <CcCard
        title="STATISTIKEN"
        subtitle="Abgeleitet aus deinen gespeicherten Match-Ergebnissen (Verlauf)"
        icon="icon-[pixelarticons--chart-bar]"
        accent="gold"
      >
        <template #status>
          <CcStatusPill :label="`${overview.summary.totalMatches} Matches`" tone="idle" class="is-sm" />
          <CcStatusPill
            v-if="overview.summary.decidedMatches > 0"
            :label="`${overview.quality.complete} vollständig`"
            tone="ok"
            class="is-sm"
          />
        </template>

        <p class="cc-note" style="font-size: 13px;">
          Alle Werte hier stammen aus denselben gespeicherten Ergebnissen wie im
          <a href="#history" style="color: var(--cc-gold); text-decoration: underline;">Verlauf</a>. Fehlende
          Werte werden ehrlich als „–" angezeigt, nie als 0. „Siege/Niederlagen" beziehen sich auf
          Spieler-Position 1 im Match — dieselbe Konvention wie im Verlauf.
        </p>
      </CcCard>
    </div>

    <!-- (B) EMPTY STATE -->
    <div v-if="overview.summary.totalMatches === 0" class="cc-col-12">
      <CcCard title="Noch keine Daten" icon="icon-[pixelarticons--chart-bar]" accent="muted">
        <CcEmptyState
          icon="icon-[pixelarticons--chart-bar]"
          title="Noch keine Statistiken verfügbar"
          text="Sobald ein Match auf play.autodarts.io beendet wird, speichert die Erweiterung das Ergebnis — danach erscheinen hier Kennzahlen und Trends."
        >
          <template #action>
            <button @click="() => openAutodarts()" class="cc-btn is-primary" type="button">
              <span class="icon-[pixelarticons--external-link]" />
              <span>Autodarts öffnen</span>
            </button>
          </template>
        </CcEmptyState>
      </CcCard>
    </div>

    <template v-else>
      <!-- (C) FILTER -->
      <div class="cc-col-12">
        <CcCard title="Filter" icon="icon-[pixelarticons--sliders]" accent="muted">
          <div class="cc-filter-row">
            <div class="cc-filter-field">
              <label class="cc-filter-label" for="cc-stats-period">Zeitraum</label>
              <select
                id="cc-stats-period"
                v-model="filters.period"
                class="cc-filter-select"
                aria-label="Nach Zeitraum filtern"
                data-testid="stats-filter-period"
              >
                <option value="all">Alle</option>
                <option value="last10">Letzte 10</option>
                <option value="last20">Letzte 20</option>
                <option value="30days">Letzte 30 Tage</option>
              </select>
            </div>
            <div class="cc-filter-field">
              <label class="cc-filter-label" for="cc-stats-mode">Spielmodus</label>
              <select
                id="cc-stats-mode"
                v-model="filters.gameMode"
                class="cc-filter-select"
                aria-label="Nach Spielmodus filtern"
                data-testid="stats-filter-mode"
              >
                <option value="all">Alle</option>
                <option v-for="mode in overview.gameModes" :key="mode" :value="mode">{{ mode }}</option>
              </select>
            </div>
          </div>
        </CcCard>
      </div>

      <!-- (D) HERO — Gesamtmatches / Siege / Niederlagen / Win Rate -->
      <div class="cc-col-12">
        <div class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
          <CcStatTile label="Matches (Filter)" :value="overview.summary.totalMatches" accent="gold" />
          <CcStatTile
            label="Siege"
            :value="overview.summary.wins"
            hint="Spieler-Position 1"
            accent="accent"
          />
          <CcStatTile
            label="Niederlagen"
            :value="overview.summary.losses"
            hint="Spieler-Position 1"
            accent="plain"
          />
          <CcStatTile
            label="Win Rate"
            :value="winRatePercent"
            unit="%"
            :hint="overview.summary.decidedMatches > 0 ? `${overview.summary.decidedMatches} entschiedene Matches` : 'noch keine entschiedenen Matches'"
            accent="accent"
          />
        </div>
      </div>

      <!-- (E) PERFORMANCE -->
      <div class="cc-col-12">
        <CcCard title="Performance" subtitle="Nur aus Matches mit bekannten Werten" icon="icon-[pixelarticons--trending-up]" accent="muted">
          <div class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
            <CcStatTile label="Ø Average" :value="overview.averages.average" :decimals="1" />
            <CcStatTile label="Bester Average" :value="overview.averages.bestAverage" :decimals="1" accent="gold" />
            <CcStatTile label="180er (gesamt)" :value="overview.scoring.total180" accent="gold" />
            <CcStatTile label="Ø 180er / Match" :value="overview.scoring.avg180PerMatch" :decimals="2" />
            <CcStatTile
              v-if="overview.scoring.avgFirst9 !== null"
              label="Ø First 9"
              :value="overview.scoring.avgFirst9"
              :decimals="1"
            />
            <CcStatTile
              v-if="overview.scoring.highestCheckout !== null"
              label="Höchster Checkout"
              :value="overview.scoring.highestCheckout"
              hint="höchster Einzel-Finish"
            />
            <CcStatTile label="Legs" :value="legsDisplay" hint="gewonnen : verloren" />
            <CcStatTile
              v-if="overview.legsSets.setsWon !== null"
              label="Sets"
              :value="`${overview.legsSets.setsWon} : ${overview.legsSets.setsLost}`"
              hint="gewonnen : verloren"
            />
          </div>
        </CcCard>
      </div>

      <!-- (F) TREND -->
      <div class="cc-col-8">
        <CcCard title="Average-Trend" subtitle="Chronologisch, nur Matches mit bekanntem Average" icon="icon-[pixelarticons--trending-up]" accent="muted">
          <div v-if="overview.trend.length >= 2" class="cc-trend">
            <svg
              class="cc-trend-svg"
              viewBox="0 0 200 60"
              preserveAspectRatio="none"
              role="img"
              :aria-label="`Average-Verlauf über ${overview.trend.length} Matches, von ${overview.trend[0].average.toFixed(1)} bis ${overview.trend[overview.trend.length - 1].average.toFixed(1)}`"
            >
              <polyline :points="trendPoints" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
            </svg>
            <div class="cc-trend-range">
              <span>{{ overview.trend[0].average.toFixed(1) }}</span>
              <span>{{ overview.trend[overview.trend.length - 1].average.toFixed(1) }}</span>
            </div>
          </div>
          <CcEmptyState
            v-else
            icon="icon-[pixelarticons--trending-up]"
            title="Noch zu wenig Daten für einen Trend"
            text="Sobald mindestens zwei Matches mit bekanntem Average vorliegen, erscheint hier ein Verlauf."
          />
        </CcCard>
      </div>

      <!-- (G) RECENT FORM -->
      <div class="cc-col-4">
        <CcCard title="Letzte Form" subtitle="Neueste zuerst" icon="icon-[pixelarticons--clock]" accent="muted">
          <div v-if="overview.recentForm.length > 0" class="cc-form-row">
            <span
              v-for="entry in overview.recentForm"
              :key="entry.matchId"
              :class="['cc-form-dot', formDotClass(entry.won)]"
              :title="formTitle(entry)"
            >{{ formLetter(entry.won) }}</span>
          </div>
          <CcEmptyState v-else icon="icon-[pixelarticons--clock]" title="Keine Matches im Filter" />
        </CcCard>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import CcCard from "../CcCard.vue";
import CcStatTile from "../CcStatTile.vue";
import CcStatusPill from "../CcStatusPill.vue";
import CcEmptyState from "../CcEmptyState.vue";
import { openAutodarts } from "../open-autodarts";
import { CC_STATS_PENDING_GAME_MODE_KEY } from "../sections";
import {
  AutodartsToolsCanonicalMatchResults,
  getCanonicalMatchResults,
} from "@/utils/canonical-match-result-storage";
import type { ICanonicalMatchResult } from "@/utils/canonical-match-result";
import {
  DEFAULT_STATISTICS_FILTERS,
  computeStatisticsOverview,
  type IRecentFormEntry,
  type IStatisticsFilters,
} from "@/utils/statistics";

/* ─── Raw CMR Data (dieselbe Quelle wie CcHistory.vue) ─────────────────────── */
const rawResults = ref<ICanonicalMatchResult[]>([]);
let unwatch: (() => void) | undefined;

async function loadResults(): Promise<void> {
  try {
    rawResults.value = await getCanonicalMatchResults();
  } catch (error) {
    console.error("[CcStats] loadResults failed", error);
    rawResults.value = [];
  }
}

/* ─── Filter & Ableitung ─────────────────────────────────────────────────────── */
const filters = ref<IStatisticsFilters>({ ...DEFAULT_STATISTICS_FILTERS });

/** Übernimmt einen von CcHistory.vue übergebenen Spielmodus-Filter (falls vorhanden) und löscht ihn danach. */
function applyPendingGameModeFilter(): void {
  try {
    const pending = sessionStorage.getItem(CC_STATS_PENDING_GAME_MODE_KEY);
    if (pending) {
      filters.value.gameMode = pending;
      sessionStorage.removeItem(CC_STATS_PENDING_GAME_MODE_KEY);
    }
  } catch {
    // sessionStorage nicht verfügbar — Filter bleibt auf "Alle"
  }
}

const overview = computed(() => computeStatisticsOverview(rawResults.value, filters.value));

const winRatePercent = computed(() => {
  const rate = overview.value.summary.winRate;
  return rate === null ? null : Math.round(rate * 100);
});

const legsDisplay = computed(() => `${overview.value.legsSets.legsWon} : ${overview.value.legsSets.legsLost}`);

/* ─── Trend-SVG (reines SVG, keine Chart-Library) ───────────────────────────── */
const trendPoints = computed(() => {
  const points = overview.value.trend;
  if (points.length < 2) return "";
  const values = points.map(p => p.average);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // Division durch 0 vermeiden, falls alle Werte gleich sind
  const stepX = 200 / (points.length - 1);
  return points
    .map((p, i) => {
      const x = i * stepX;
      const y = 55 - ((p.average - min) / range) * 50; // 5..55, Y wächst nach unten in SVG
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
});

/* ─── Form-Anzeige ───────────────────────────────────────────────────────────── */
function formLetter(won: boolean | null): string {
  if (won === null) return "?";
  return won ? "S" : "N";
}
function formDotClass(won: boolean | null): string {
  if (won === null) return "is-idle";
  return won ? "is-win" : "is-loss";
}
function formTitle(entry: IRecentFormEntry): string {
  const outcome = entry.won === null ? "unentschieden/unbekannt" : entry.won ? "Sieg" : "Niederlage";
  return `${outcome} — ${new Date(entry.recordedAt).toLocaleDateString("de-DE")}`;
}

/* ─── Init & Cleanup ─────────────────────────────────────────────────────────── */
onMounted(async () => {
  applyPendingGameModeFilter();
  await loadResults();
  unwatch = AutodartsToolsCanonicalMatchResults.watch(() => {
    void loadResults();
  });
});

onBeforeUnmount(() => {
  unwatch?.();
  unwatch = undefined;
});
</script>

<style scoped>
.cc-trend {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cc-trend-svg {
  width: 100%;
  height: 80px;
  color: var(--cc-gold, #d4af37);
}
.cc-trend-range {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--cc-text-faint);
}
.cc-form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cc-form-dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
  cursor: default;
}
.cc-form-dot.is-win { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
.cc-form-dot.is-loss { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
.cc-form-dot.is-idle { background: rgba(148, 163, 184, 0.15); color: var(--cc-text-faint); }
</style>
