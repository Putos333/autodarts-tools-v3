<template>
  <div class="cc-grid" data-testid="cc-history">
    <!-- (A) HEADER -->
    <div class="cc-col-12">
      <CcCard
        title="MATCH HISTORY"
        subtitle="Deine lokal gespeicherten Matches"
        icon="icon-[pixelarticons--clock]"
        accent="gold"
      >
        <template #status>
          <CcStatusPill :label="`${kpis.total} Matches`" tone="idle" class="is-sm" />
          <CcStatusPill
            v-if="kpis.total > 0"
            :label="`${kpis.complete} vollständig`"
            tone="ok"
            class="is-sm"
          />
        </template>

        <div class="cc-card-body" style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: center;">
          <div>
            <p class="cc-note" style="font-size: 13px; margin-bottom: 8px;">
              Hier siehst du alle gespeicherten Canonical Match Results. Jedes beendete Match wird
              lokal gesichert und steht sofort zur Verfügung — neueste zuerst. Klicke auf ein Match,
              um Details, Spielerwerte und technische Informationen zu sehen.
            </p>
          </div>
        </div>
      </CcCard>
    </div>

    <!-- (B) KPI SUMMARY -->
    <template v-if="kpis.total > 0">
      <div class="cc-col-12">
        <div class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
          <CcStatTile label="Gespeichert" :value="kpis.total" accent="gold" />
          <CcStatTile label="Vollständig" :value="kpis.complete" accent="accent" />
          <CcStatTile label="Teilweise" :value="kpis.partial" accent="accent" />
          <CcStatTile label="Minimal" :value="kpis.minimal" accent="plain" />
          <CcStatTile label="Siege" :value="kpis.wins" hint="Deine Nutzer-ID" accent="gold" />
          <CcStatTile label="Ø Average" :value="kpis.avgAverage" :decimals="1" hint="Aus vollständigen Matches" accent="accent" />
        </div>
      </div>

      <!-- (C) FILTERS -->
      <div class="cc-col-12">
        <CcCard title="Filter" subtitle="Durchsuche deine gespeicherten Matches" icon="icon-[pixelarticons--sliders]" accent="muted">
          <div class="cc-filter-row">
            <div class="cc-filter-field">
              <label class="cc-filter-label" for="cc-history-search">Spieler suchen</label>
              <input
                id="cc-history-search"
                v-model="filters.search"
                type="search"
                class="cc-filter-input"
                placeholder="Spielername …"
                aria-label="Nach Spielername suchen"
                data-testid="cc-history-search"
              />
            </div>

            <div class="cc-filter-field">
              <label class="cc-filter-label" for="cc-history-quality">Datenlage</label>
              <select
                id="cc-history-quality"
                v-model="filters.quality"
                class="cc-filter-select"
                aria-label="Nach Datenlage filtern"
                data-testid="cc-history-quality"
              >
                <option value="all">Alle</option>
                <option value="COMPLETE">Vollständig</option>
                <option value="PARTIAL">Teilweise</option>
                <option value="MINIMAL">Minimal</option>
              </select>
            </div>

            <div class="cc-filter-field">
              <label class="cc-filter-label" for="cc-history-status">Status</label>
              <select
                id="cc-history-status"
                v-model="filters.status"
                class="cc-filter-select"
                aria-label="Nach Status filtern"
                data-testid="cc-history-status"
              >
                <option value="all">Alle</option>
                <option value="finished">Abgeschlossen</option>
                <option value="unfinished">Unvollständig</option>
              </select>
            </div>

            <div class="cc-filter-field">
              <label class="cc-filter-label" for="cc-history-mode">Spielmodus</label>
              <select
                id="cc-history-mode"
                v-model="filters.gameMode"
                class="cc-filter-select"
                aria-label="Nach Spielmodus filtern"
                data-testid="cc-history-mode"
              >
                <option value="all">Alle</option>
                <option v-for="mode in availableGameModes" :key="mode" :value="mode">{{ mode }}</option>
              </select>
            </div>

            <div class="cc-filter-field">
              <label class="cc-filter-label" for="cc-history-sort">Sortierung</label>
              <select
                id="cc-history-sort"
                v-model="sortBy"
                class="cc-filter-select"
                aria-label="Sortierung wählen"
                data-testid="cc-history-sort"
              >
                <option value="newest">Neueste zuerst</option>
                <option value="oldest">Älteste zuerst</option>
                <option value="quality">Nach Datenlage</option>
                <option value="gameMode">Nach Spielmodus</option>
              </select>
            </div>

            <button
              v-if="hasActiveFilters"
              @click="resetFilters"
              class="cc-btn"
              type="button"
              data-testid="cc-history-reset"
            >
              <span class="icon-[pixelarticons--close]" />
              <span>Zurücksetzen</span>
            </button>
          </div>

          <p v-if="filteredAndSorted.length !== allDisplay.length" class="cc-note" style="margin-top: 8px;">
            {{ filteredAndSorted.length }} von {{ allDisplay.length }} Matches.
          </p>
        </CcCard>
      </div>

      <!-- (D) MATCH LIST -->
      <div class="cc-col-12">
        <CcCard
          title="Matches"
          :subtitle="matchListSubtitle"
          icon="icon-[pixelarticons--list]"
          accent="muted"
        >
          <template #status>
            <CcStatusPill :label="`${filteredAndSorted.length} angezeigt`" tone="idle" class="is-sm" />
          </template>

          <div v-if="filteredAndSorted.length > 0" class="cc-list" style="max-height: 560px; overflow-y: auto;">
            <div
              v-for="match in filteredAndSorted"
              :key="match.matchId"
              class="cc-result"
              :class="{ 'is-current': match === selectedMatch }"
              :data-testid="`cc-hist-${match.matchId}`"
            >
              <button
                @click="toggleSelect(match)"
                class="cc-result-main"
                type="button"
                :aria-expanded="match === selectedMatch ? 'true' : 'false'"
                :data-testid="`cc-hist-toggle-${match.matchId}`"
              >
                <div class="cc-result-date">{{ formatDateDisplay(match.recordedAt ?? match.createdAt) }}</div>
                <div class="cc-result-names">
                  <span>{{ namesOf(match) }}</span>
                  <div class="cc-result-sub">
                    <CcStatusPill :label="qualityLabel(match.quality)" :tone="qualityTone(match.quality)" class="is-xs" />
                    <CcStatusPill
                      :label="match.finished ? 'Beendet' : 'Läuft'" :tone="match.finished ? 'ok' : 'bad'"
                      class="is-xs"
                    />
                    <span v-if="winnerNameOf(match)"> · Sieger: {{ winnerNameOf(match) }}</span>
                    <span v-if="modeOf(match)"> · {{ modeOf(match) }}</span>
                  </div>
                </div>
                <div class="cc-result-score" :class="isWinnerMatch(match) ? 'is-gold' : ''">
                  {{ scoreOf(match) }}
                </div>
                <span class="cc-result-chevron">
                  <span :class="match === selectedMatch ? 'icon-[pixelarticons--chevron-up]' : 'icon-[pixelarticons--chevron-down]'" />
                </span>
              </button>

              <!-- Detail-Ansicht (eingeklappt im Listenknoten) -->
              <div v-if="match === selectedMatch" class="cc-detail" data-testid="cc-history-detail">
                <!-- Spieler-Details -->
                <div class="cc-detail-section">
                  <div class="cc-detail-heading">Spieler</div>
                  <div class="cc-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;">
                    <div
                      v-for="player in match.players"
                      :key="player.index"
                      :class="[ 'cc-detail-player', player.isWinner && 'is-winner' ]"
                    >
                      <div class="cc-detail-player-head">
                        <CcPlayerBadge
                          :name="player.name"
                          :is-bot="player.isBot === true"
                          :variant="player.isWinner ? 'gold' : player.index === 0 ? 'red' : 'blue'"
                          size="sm"
                        />
                        <div class="cc-detail-player-name">
                          {{ player.name }}
                          <span v-if="player.isWinner" class="cc-hist-crown" title="Gewinner">★</span>
                          <span v-if="player.isBot === true" class="cc-tag">Bot</span>
                        </div>
                      </div>
                      <div class="cc-detail-player-stats">
                        <CcHistoryPlayerStats
                          :player="player"
                          :stats="['average', 'first9', 'total180', 'checkout', 'darts', 'legs', 'sets']"
                          :any-sets="hasSets(match)"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Verknüpfung zu Statistiken (nur wenn ein filterbarer Spielmodus bekannt ist) -->
                <div v-if="match.gameMode" class="cc-detail-section">
                  <button
                    @click="viewInStatistics(match.gameMode)"
                    class="cc-btn is-ghost"
                    type="button"
                    data-testid="cc-history-view-in-stats"
                  >
                    <span class="icon-[pixelarticons--chart-bar]" />
                    <span>In Statistiken ansehen (Modus: {{ match.gameMode }})</span>
                  </button>
                </div>

                <!-- Technische Details -->
                <div class="cc-detail-section">
                  <button
                    @click="showTechnical = !showTechnical"
                    class="cc-btn is-ghost"
                    type="button"
                    :aria-expanded="showTechnical ? 'true' : 'false'"
                    data-testid="cc-history-technical-toggle"
                  >
                    <span :class="showTechnical ? 'icon-[pixelarticons--chevron-up]' : 'icon-[pixelarticons--chevron-down]'" />
                    <span>Technische Details</span>
                  </button>
                  <div v-if="showTechnical" class="cc-kv" style="margin-top: 8px;">
                    <span class="cc-kv-key">Match-ID</span>
                    <span class="cc-kv-val" style="font-family: monospace; font-size: 12px;">{{ match.matchId ?? "–" }}</span>

                    <span class="cc-kv-key">Datenlage</span>
                    <span class="cc-kv-val">{{ qualityLabel(match.quality) }} ({{ match.quality }})</span>

                    <span class="cc-kv-key">Revision</span>
                    <span class="cc-kv-val">{{ match.revision }}</span>

                    <span class="cc-kv-key">Variante</span>
                    <span class="cc-kv-val">{{ match.variant ?? "–" }}</span>

                    <span class="cc-kv-key">Modus</span>
                    <span class="cc-kv-val">{{ match.gameMode ?? "–" }}</span>

                    <span class="cc-kv-key">Typ</span>
                    <span class="cc-kv-val">{{ match.type ?? "–" }}</span>

                    <span class="cc-kv-key">Erfasst am</span>
                    <span class="cc-kv-val">{{ match.recordedAt ? formatDateDisplay(match.recordedAt) : "–" }}</span>

                    <span class="cc-kv-key">Gestartet</span>
                    <span class="cc-kv-val">{{ match.createdAt ? formatDateDisplay(match.createdAt) : "–" }}</span>

                    <span class="cc-kv-key">Beendet</span>
                    <span class="cc-kv-val">{{ match.finished ? "Ja" : "Nein" }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <CcEmptyState
            v-else-if="allDisplay.length === 0"
            icon="icon-[pixelarticons--clock]"
            title="Noch keine gespeicherten Matches"
            text="Sobald ein Match auf play.autodarts.io beendet wird, speichert die Erweiterung das Ergebnis hier lokal."
          >
            <template #action>
              <button @click="() => openAutodarts()" class="cc-btn is-primary" type="button">
                <span class="icon-[pixelarticons--external-link]" />
                <span>Autodarts öffnen</span>
              </button>
            </template>
          </CcEmptyState>

          <CcEmptyState
            v-else
            icon="icon-[pixelarticons--sliders]"
            title="Keine Treffer"
            text="Kein gespeichertes Match passt zu den aktuellen Filtern."
          >
            <template #action>
              <button @click="resetFilters" class="cc-btn is-primary" type="button">
                <span class="icon-[pixelarticons--close]" />
                <span>Filter zurücksetzen</span>
              </button>
            </template>
          </CcEmptyState>
        </CcCard>
      </div>
    </template>

    <!-- Empty State ohne Daten -->
    <div v-else class="cc-col-12">
      <CcCard title="MATCH HISTORY" subtitle="Deine lokal gespeicherten Matches" icon="icon-[pixelarticons--clock]" accent="gold">
        <CcEmptyState
          icon="icon-[pixelarticons--clock]"
          title="Noch keine gespeicherten Matches"
          text="Sobald ein Match auf play.autodarts.io beendet wird, speichert die Erweiterung das Ergebnis hier lokal. Danach erscheinen hier Verlauf, Filter und Details."
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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import CcCard from "../CcCard.vue";
import CcStatTile from "../CcStatTile.vue";
import CcStatusPill from "../CcStatusPill.vue";
import CcEmptyState from "../CcEmptyState.vue";
import CcPlayerBadge from "../CcPlayerBadge.vue";
import CcHistoryPlayerStats from "../CcHistoryPlayerStats.vue";
import { openAutodarts } from "../open-autodarts";
import { CC_STATS_PENDING_GAME_MODE_KEY } from "../sections";
import {
  AutodartsToolsCanonicalMatchResults,
  initCanonicalMatchResults,
} from "@/utils/canonical-match-result-storage";
import type { ICanonicalMatchResult } from "@/utils/canonical-match-result";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";
import {
  computeHistoryKPIs,
  DEFAULT_HISTORY_FILTERS,
  extractGameModes,
  filterHistory,
  formatDateDisplay,
  getQualityLabel,
  getQualityTone,
  mapCmrsToDisplay,
  sortHistory,
  type ICmrMatchDisplay,
  type IHistoryFilters,
  type THistorySort,
} from "@/utils/match-history-view";

/* ─── Zentrale Status-Quelle (N2 Centralization) ────────────────────────────── */
const { myUserId } = useControlCenterStatus();

/* ─── Raw CMR Data ──────────────────────────────────────────────────────────── */
const rawResults = ref<ICanonicalMatchResult[]>([]);

/** Registrierte Cleanup-Funktionen (Reaktivität). */
let unwatch: (() => void) | undefined;

async function loadResults(): Promise<void> {
  try {
    rawResults.value = await initCanonicalMatchResults();
  } catch (error) {
    console.error("[CcHistory] loadResults failed", error);
    rawResults.value = [];
  }
}

/* ─── Display Model ─────────────────────────────────────────────────────────── */
const allDisplay = computed<ICmrMatchDisplay[]>(() => mapCmrsToDisplay(rawResults.value));

/* ─── Filters & Sorting ─────────────────────────────────────────────────────── */
const filters = ref<IHistoryFilters>({ ...DEFAULT_HISTORY_FILTERS });
const sortBy = ref<THistorySort>("newest");

const availableGameModes = computed(() => extractGameModes(allDisplay.value));

const hasActiveFilters = computed(() =>
  filters.value.search.trim().length > 0
  || filters.value.quality !== "all"
  || filters.value.status !== "all"
  || filters.value.gameMode !== "all",
);

const filteredAndSorted = computed(() =>
  sortHistory(filterHistory(allDisplay.value, filters.value), sortBy.value),
);

const matchListSubtitle = computed(() => {
  const total = allDisplay.value.length;
  if (total === 0) return "Noch keine gespeicherten Matches";
  const shown = filteredAndSorted.value.length;
  return shown === total ? `${total} Matches, neueste zuerst` : `${shown} von ${total} Matches`;
});

function resetFilters(): void {
  filters.value = { ...DEFAULT_HISTORY_FILTERS };
  sortBy.value = "newest";
}

/** Übergibt den Spielmodus dieses Matches transient an die Statistics-Ansicht und navigiert dorthin. */
function viewInStatistics(gameMode: string): void {
  try {
    sessionStorage.setItem(CC_STATS_PENDING_GAME_MODE_KEY, gameMode);
  } catch {
    // sessionStorage nicht verfügbar (z.B. privater Modus) — Navigation trotzdem erlauben,
    // Statistics zeigt dann einfach ungefiltert.
  }
  window.location.hash = "stats";
}

/* ─── KPIs ──────────────────────────────────────────────────────────────────── */
const kpis = computed(() => computeHistoryKPIs(allDisplay.value, myUserId.value));

/* ─── Selected Match (Detail) ───────────────────────────────────────────────── */
const selectedMatch = ref<ICmrMatchDisplay | null>(null);
const showTechnical = ref(false);

function toggleSelect(match: ICmrMatchDisplay): void {
  if (selectedMatch.value?.matchId === match.matchId) {
    selectedMatch.value = null;
  } else {
    selectedMatch.value = match;
    showTechnical.value = false;
  }
}

/* ─── Display Helpers ───────────────────────────────────────────────────────── */
function namesOf(match: ICmrMatchDisplay): string {
  const names = match.players.map((p) => p.name);
  if (names.length === 0) return "Unbekannte Spieler";
  return names.join(" vs ");
}

/** Sets, wenn das Match Sets führte, sonst Legs — sonst "–". */
function scoreOf(match: ICmrMatchDisplay): string {
  const useSets = match.players.some((p) => p.sets !== undefined);
  const values = match.players.map((p) => {
    const value = useSets ? p.sets : p.legs;
    return value === undefined ? "–" : String(value);
  });
  return values.length > 0 ? values.join(" : ") : "–";
}

function winnerNameOf(match: ICmrMatchDisplay): string | null {
  if (match.winnerIndex === undefined) return null;
  const winner = match.players.find((p) => p.index === match.winnerIndex)
    ?? match.players[match.winnerIndex];
  return winner?.name ?? null;
}

function isWinnerMatch(match: ICmrMatchDisplay): boolean {
  if (!match.finished || match.winnerIndex === undefined || !myUserId.value) return false;
  const me = match.players.find((p) => p.userId === myUserId.value);
  return me !== undefined && me.index === match.winnerIndex;
}

function modeOf(match: ICmrMatchDisplay): string | null {
  const parts = [ match.variant, match.gameMode, match.type ].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  const unique = [ ...new Set(parts) ];
  return unique.length > 0 ? unique.join(" · ") : null;
}

function hasSets(match: ICmrMatchDisplay): boolean {
  return match.players.some((p) => p.sets !== undefined);
}

function qualityLabel(quality: ICmrMatchDisplay["quality"]): string {
  return getQualityLabel(quality);
}

function qualityTone(quality: ICmrMatchDisplay["quality"]): ReturnType<typeof getQualityTone> {
  return getQualityTone(quality);
}

/* ─── Init & Cleanup ────────────────────────────────────────────────────────── */
let disposed = false;

onMounted(async () => {
  await loadResults();
  if (disposed) return;
  unwatch = AutodartsToolsCanonicalMatchResults.watch(() => {
    void loadResults();
  });
});

onBeforeUnmount(() => {
  disposed = true;
  unwatch?.();
  unwatch = undefined;
});
</script>
