<template>
  <CcCard
    title="Match-Historie"
    :subtitle="subtitle"
    icon="icon-[pixelarticons--trophy]"
    accent="gold"
    data-testid="cc-match-history"
  >
    <template #status>
      <CcStatusPill v-if="hasResults" :label="`${results.length} gespeichert`" tone="idle" class="is-sm" />
    </template>

    <template v-if="hasResults">
      <div
        v-for="result in visible"
        :key="`${result.matchId}-${result.revision}`"
        :class="[ 'cc-hist', result.matchId === matchId && 'is-current' ]"
        :data-testid="`cc-hist-${result.matchId}`"
      >
        <div class="cc-hist-head">
          <span class="cc-hist-date">{{ formatDate(result.recordedAt ?? result.createdAt) }}</span>
          <span v-if="modeOf(result)" class="cc-tag">{{ modeOf(result) }}</span>
          <span v-if="result.matchId === matchId" class="cc-tag is-accent">Aktuell</span>
          <span v-if="!result.finished" class="cc-tag">Nicht beendet</span>
          <span :class="[ 'cc-tag', qualityClass(result.quality) ]" :title="qualityHint(result.quality)">
            {{ result.quality }}
          </span>
          <button
            @click="openMatch(result.matchId, autodartsOrigin)"
            class="cc-hist-open"
            type="button"
            title="Dieses Match auf Autodarts öffnen"
            :data-testid="`cc-hist-open-${result.matchId}`"
          >
            <span class="icon-[pixelarticons--external-link]" />
          </button>
        </div>

        <div class="cc-hist-rows">
          <div
            v-for="(player, index) in result.players"
            :key="`${result.matchId}-${player.index}-${index}`"
            :class="[ 'cc-hist-row', isWinner(result, player, index) && 'is-winner' ]"
          >
            <CcPlayerBadge
              :name="player.name ?? `Spieler ${index + 1}`"
              :is-bot="player.isBot === true"
              :variant="isWinner(result, player, index) ? 'gold' : index === 0 ? 'red' : 'blue'"
              size="sm"
            />
            <span class="cc-hist-name">
              {{ player.name ?? `Spieler ${index + 1}` }}
              <span v-if="isWinner(result, player, index)" class="cc-hist-crown" title="Gewinner">★</span>
            </span>
            <span class="cc-hist-stat">
              <span class="cc-hist-stat-label">Legs</span>
              <span :class="[ 'cc-hist-stat-value', player.legs === undefined && 'is-unknown' ]">
                {{ player.legs ?? "–" }}
              </span>
            </span>
            <span v-if="hasSets(result)" class="cc-hist-stat">
              <span class="cc-hist-stat-label">Sets</span>
              <span :class="[ 'cc-hist-stat-value', player.sets === undefined && 'is-unknown' ]">
                {{ player.sets ?? "–" }}
              </span>
            </span>
            <span class="cc-hist-stat">
              <span class="cc-hist-stat-label">Average</span>
              <span :class="[ 'cc-hist-stat-value', player.average === undefined && 'is-unknown' ]">
                {{ player.average !== undefined ? player.average.toFixed(2) : "–" }}
              </span>
            </span>
          </div>
        </div>
      </div>

      <div v-if="results.length > visible.length" class="cc-btn-row" style="margin-top: 12px;">
        <button @click="showAll = !showAll" class="cc-btn" type="button" data-testid="cc-hist-toggle">
          <span :class="showAll ? 'icon-[pixelarticons--chevron-up]' : 'icon-[pixelarticons--chevron-down]'" />
          <span>{{ showAll ? "Weniger zeigen" : `Alle ${results.length} zeigen` }}</span>
        </button>
      </div>
    </template>

    <CcEmptyState
      v-else
      icon="icon-[pixelarticons--trophy]"
      title="Noch keine gespeicherten Ergebnisse"
      text="Nach jedem beendeten Match sichert die Erweiterung das Ergebnis lokal. Sobald das erste Match durch ist, erscheint es hier."
    >
      <template #action>
        <button @click="openAutodarts(autodartsOrigin)" class="cc-btn is-primary" type="button">
          <span class="icon-[pixelarticons--external-link]" />
          <span>Autodarts öffnen</span>
        </button>
      </template>
    </CcEmptyState>

    <template #footer>
      Die Ergebnisse werden ausschließlich gelesen — es wird nichts geschrieben, migriert oder
      gelöscht. Die Stufe gibt an, wie vollständig Autodarts das Ergebnis gemeldet hat.
    </template>
  </CcCard>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import CcCard from "./CcCard.vue";
import CcStatusPill from "./CcStatusPill.vue";
import CcEmptyState from "./CcEmptyState.vue";
import CcPlayerBadge from "./CcPlayerBadge.vue";
import { openAutodarts, openMatch } from "./open-autodarts";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";
import type { ICanonicalMatchResult, ICmrPlayer } from "@/utils/canonical-match-result";

const PREVIEW_ROWS = 5;

const { results, hasResults, matchId, autodartsOrigin } = useControlCenterStatus();

const showAll = ref(false);

const visible = computed(() => (showAll.value ? results.value : results.value.slice(0, PREVIEW_ROWS)));

const subtitle = computed(() =>
  hasResults.value
    ? "Lokal gesicherte Ergebnisse, neueste zuerst"
    : "Lokal gesicherte Ergebnisse",
);

function formatDate(value: string | undefined): string {
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

/** Modus aus den gemeldeten Feldern; nichts zusammengereimt. */
function modeOf(result: ICanonicalMatchResult): string | null {
  const parts = [ result.variant, result.gameMode, result.type ].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );
  // Doppelte Angaben (z.B. variant === gameMode) nur einmal zeigen.
  const unique = [ ...new Set(parts) ];
  return unique.length > 0 ? unique.join(" · ") : null;
}

function hasSets(result: ICanonicalMatchResult): boolean {
  return result.players.some(player => player.sets !== undefined);
}

function isWinner(result: ICanonicalMatchResult, player: ICmrPlayer, position: number): boolean {
  if (result.winnerIndex === undefined) return false;
  return player.index === result.winnerIndex || position === result.winnerIndex;
}

function qualityClass(quality: string): string {
  if (quality === "COMPLETE") return "is-gold";
  if (quality === "PARTIAL") return "is-accent";
  return "";
}

function qualityHint(quality: string): string {
  switch (quality) {
    case "COMPLETE": return "Autodarts hat alle erfassten Felder gemeldet.";
    case "PARTIAL": return "Autodarts hat einen Teil der Felder gemeldet.";
    default: return "Autodarts hat nur wenige Felder gemeldet.";
  }
}
</script>
