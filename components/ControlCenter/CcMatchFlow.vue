<template>
  <CcCard
    title="Match Flow"
    subtitle="Letzte Visits, Leg-Fortschritt und Momentum"
    icon="icon-[pixelarticons--reload]"
    data-testid="cc-card-matchflow"
  >
    <template v-if="hasMatch && !matchFinished">
      <!-- Leg-Fortschritt: reine Anzeige bereits gewonnener Legs (scores[].legs).
           Bewusst KEIN Ziel-/Restpunkt: das Match-Format (Best of N) meldet
           Autodarts für reguläre Matches nicht — siehe FACTORY_STATUS.md /
           CONSOLIDATION_MATRIX.md. Kein erfundenes Format, nur reale Zählung. -->
      <div v-if="heroPair" class="cc-flow-legs" data-testid="cc-flow-legs">
        <span class="cc-flow-legs-label">Legs</span>
        <div class="cc-flow-leg-dots">
          <span
            v-for="n in (heroPair.left.legs ?? 0)"
            :key="`left-${n}`"
            class="cc-leg-dot is-red"
          />
          <span
            v-for="n in (heroPair.right.legs ?? 0)"
            :key="`right-${n}`"
            class="cc-leg-dot is-blue"
          />
          <span v-if="!heroPair.left.legs && !heroPair.right.legs" class="cc-note" style="font-size: 11px;">
            Noch kein Leg entschieden
          </span>
        </div>
      </div>

      <!-- Momentum: der zuletzt abgeschlossene Visit des aktiven Spielers
           gegen dessen eigenen Match-Average — ein einzelner Rückblick, keine
           Vorhersage. Siehe deriveMomentum in utils/match-flow.ts. -->
      <div v-if="momentum.visible" class="cc-flow-momentum" data-testid="cc-flow-momentum">
        <span :class="[ 'cc-momentum-badge', `is-${momentum.trend}` ]">
          <span v-if="momentum.trend === 'up'" class="icon-[pixelarticons--chevron-up]" />
          <span v-else-if="momentum.trend === 'down'" class="icon-[pixelarticons--arrow-down]" />
          <span v-else class="icon-[pixelarticons--circle]" />
        </span>
        <span class="cc-momentum-text">
          Letzter Visit <b>{{ momentum.visitScore }}</b> — {{ momentum.deltaPercent! >= 0 ? "+" : "" }}{{ momentum.deltaPercent!.toFixed(0) }}% ggü. eigenem Average ({{ momentum.average!.toFixed(1) }})
        </span>
      </div>

      <!-- Letzte abgeschlossene Visits. Der laufende Zug wird hier bewusst
           NICHT gezeigt (der gehört der Live Throw Area / Checkout-Route). -->
      <div class="cc-flow-visits">
        <div v-if="recentVisits.length === 0" class="cc-note" data-testid="cc-flow-visits-empty">
          Noch keine abgeschlossenen Visits in diesem Leg.
        </div>
        <div
          v-for="visit in recentVisits"
          :key="visit.id"
          class="cc-flow-visit-row"
          data-testid="cc-flow-visit"
        >
          <span class="cc-flow-visit-who">
            <span :class="[ 'cc-flow-who-dot', visit.playerIndex === 0 ? 'is-red' : visit.playerIndex === 1 ? 'is-blue' : 'is-plain' ]" />
            {{ visit.playerName }}
          </span>
          <span class="cc-flow-visit-darts">{{ visit.darts.length > 0 ? visit.darts.join(" ") : "—" }}</span>
          <span class="cc-flow-visit-score">{{ visit.score }}</span>
        </div>
      </div>
    </template>

    <CcEmptyState
      v-else
      icon="icon-[pixelarticons--reload]"
      title="Kein laufendes Leg"
      text="Sobald ein Match läuft, erscheinen hier die letzten Visits, der Leg-Fortschritt und das Momentum des aktiven Spielers."
    />
  </CcCard>
</template>

<script setup lang="ts">
import CcCard from "./CcCard.vue";
import CcEmptyState from "./CcEmptyState.vue";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

const {
  hasMatch,
  matchFinished,
  heroPair,
  recentVisits,
  momentum,
} = useControlCenterStatus();
</script>
