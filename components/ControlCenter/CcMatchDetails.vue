<template>
  <CcCard
    :title="hasMatch ? 'Aktuelles Match' : 'Letzte Matches'"
    :subtitle="subtitle"
    icon="icon-[pixelarticons--list]"
    accent="gold"
    data-testid="cc-card-match-details"
  >
    <template #status>
      <CcStatusPill v-if="hasMatch" :label="matchStateLabel" :tone="matchStateTone" class="is-sm" />
    </template>

    <!-- Details zum aktuell gemeldeten Match -->
    <div v-if="hasMatch" class="cc-kv" style="margin-bottom: 18px;">
      <span class="cc-kv-key">Variante</span>
      <span class="cc-kv-val">{{ matchVariant ?? "–" }}</span>

      <span class="cc-kv-key">Modus</span>
      <span class="cc-kv-val">{{ gameMode ?? "–" }}</span>

      <template v-if="matchSettings?.baseScore !== null && matchSettings?.baseScore !== undefined">
        <span class="cc-kv-key">Startwert</span>
        <span class="cc-kv-val">{{ matchSettings.baseScore }}</span>
      </template>

      <template v-if="checkoutRule">
        <span class="cc-kv-key">Regeln</span>
        <span class="cc-kv-val">{{ checkoutRule }}</span>
      </template>

      <template v-if="matchType">
        <span class="cc-kv-key">Typ</span>
        <span class="cc-kv-val">{{ matchType }}</span>
      </template>

      <template v-if="createdAtLabel">
        <span class="cc-kv-key">Gestartet</span>
        <span class="cc-kv-val">{{ createdAtLabel }}</span>
      </template>

      <span class="cc-kv-key">Match-ID</span>
      <span class="cc-kv-val" style="font-family: monospace; font-size: 12px;">{{ matchId ?? "–" }}</span>
    </div>

    <!-- Gespeicherte Ergebnisse (Canonical Match Result, nur gelesen) -->
    <div v-if="hasResults">
      <div class="cc-tile-label" style="margin-bottom: 8px;">Gespeicherte Ergebnisse</div>
      <div
        v-for="result in visibleResults"
        :key="`${result.matchId}-${result.revision}`"
        :class="[ 'cc-result', result.matchId === matchId && 'is-current' ]"
        :data-testid="`cc-result-${result.matchId}`"
      >
        <span class="cc-result-date">{{ formatDate(result.recordedAt ?? result.createdAt) }}</span>
        <div style="min-width: 0;">
          <div class="cc-result-names">{{ namesOf(result) }}</div>
          <div class="cc-result-sub">
            <span v-if="result.variant">{{ result.variant }}</span>
            <span v-if="result.variant && winnerNameOf(result)"> · </span>
            <span v-if="winnerNameOf(result)">Sieger: {{ winnerNameOf(result) }}</span>
            <span v-if="!result.finished"> · unvollständig</span>
            <span> · Datenlage {{ result.quality }}</span>
          </div>
        </div>
        <span class="cc-result-score">{{ scoreOf(result) }}</span>
      </div>

      <p v-if="results.length > visibleResults.length" class="cc-note" style="margin-top: 10px;">
        {{ results.length - visibleResults.length }} weitere gespeicherte Ergebnisse vorhanden.
      </p>
    </div>

    <CcEmptyState
      v-else-if="!hasMatch"
      icon="icon-[pixelarticons--trophy]"
      title="Noch keine gespeicherten Ergebnisse"
      text="Nach jedem beendeten Match wird das Ergebnis lokal gesichert und erscheint dann hier."
    >
      <template #action>
        <button @click="openAutodarts()" class="cc-btn is-primary" type="button">
          <span class="icon-[pixelarticons--external-link]" />
          <span>Autodarts öffnen</span>
        </button>
      </template>
    </CcEmptyState>

    <p v-else class="cc-note">
      Für dieses Match liegt noch kein gespeichertes Endergebnis vor — das entsteht erst,
      wenn das Match beendet ist.
    </p>

    <template #footer>
      Ergebnisse werden ausschließlich gelesen. „Datenlage" gibt an, wie vollständig Autodarts
      das Ergebnis gemeldet hat (MINIMAL / PARTIAL / COMPLETE).
    </template>
  </CcCard>
</template>

<script setup lang="ts">
import { computed } from "vue";

import CcCard from "./CcCard.vue";
import CcStatusPill from "./CcStatusPill.vue";
import CcEmptyState from "./CcEmptyState.vue";
import { openAutodarts } from "./open-autodarts";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";
import type { ICanonicalMatchResult } from "@/utils/canonical-match-result";

const MAX_ROWS = 6;

const {
  hasMatch,
  matchId,
  matchVariant,
  matchType,
  matchSettings,
  matchCreatedAt,
  matchStateLabel,
  matchStateTone,
  gameMode,
  results,
  hasResults,
} = useControlCenterStatus();

const visibleResults = computed(() => results.value.slice(0, MAX_ROWS));

const subtitle = computed(() =>
  hasMatch.value
    ? "Einstellungen des laufenden Matches und gespeicherte Ergebnisse"
    : "Lokal gesicherte Match-Ergebnisse",
);

const checkoutRule = computed(() => {
  const settings = matchSettings.value;
  if (!settings) return null;
  const parts: string[] = [];
  if (settings.inMode) parts.push(`In ${settings.inMode}`);
  if (settings.outMode) parts.push(`Out ${settings.outMode}`);
  if (settings.bullMode) parts.push(`Bull ${settings.bullMode}`);
  return parts.length > 0 ? parts.join(" · ") : null;
});

const createdAtLabel = computed(() => formatDate(matchCreatedAt.value));

function formatDate(value: string | undefined | null): string {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function namesOf(result: ICanonicalMatchResult): string {
  const names = result.players.map((player, index) => player.name ?? `Spieler ${index + 1}`);
  if (names.length === 0) return "Unbekannte Spieler";
  return names.join(" vs ");
}

/** Sets, wenn das Match Sets führte, sonst Legs — sonst "–". */
function scoreOf(result: ICanonicalMatchResult): string {
  const useSets = result.players.some(player => player.sets !== undefined);
  const values = result.players.map((player) => {
    const value = useSets ? player.sets : player.legs;
    return value === undefined ? "–" : String(value);
  });
  return values.length > 0 ? values.join(" : ") : "–";
}

function winnerNameOf(result: ICanonicalMatchResult): string | null {
  if (result.winnerIndex === undefined) return null;
  // Kein Array-Positions-Fallback: player.index ist die einzige verlässliche
  // Identität (siehe CMR-Konstruktion in canonical-match-result.ts). Weicht die
  // Array-Reihenfolge davon ab, würde ein Positions-Fallback einen falschen
  // Namen zeigen — dann lieber gar keinen (Issue #13, P1-3).
  const winner = result.players.find(player => player.index === result.winnerIndex);
  return winner?.name ?? null;
}
</script>
