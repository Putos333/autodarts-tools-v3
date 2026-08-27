<template>
  <div class="cc-grid" data-testid="cc-match-view">
    <!-- Großes Scoreboard bzw. ehrlicher Leerzustand -->
    <div class="cc-col-12">
      <template v-if="hasMatch">
        <CcMatchHero />
        <div class="cc-btn-row" style="margin-top: 14px;">
          <!-- Nur gerendert, wenn die Match-Route dieser ID belegt ist -->
          <button
            @click="openMatch(openableMatchId, autodartsOrigin)"
            v-if="openableMatchId"
            class="cc-btn is-primary"
            type="button"
            data-testid="cc-match-open"
          >
            <span class="icon-[pixelarticons--external-link]" />
            <span>Match öffnen</span>
          </button>
          <!-- Gehört die Kennung zu einer Lobby, wird auch die Lobby angeboten -->
          <button
            @click="openLobby(openableLobbyId, autodartsOrigin)"
            v-else-if="openableLobbyId"
            class="cc-btn is-primary"
            type="button"
            data-testid="cc-match-open-lobby"
          >
            <span class="icon-[pixelarticons--external-link]" />
            <span>Lobby öffnen</span>
          </button>
          <button
            @click="openAutodarts(autodartsOrigin)"
            class="cc-btn"
            type="button"
            data-testid="cc-match-open-autodarts"
          >
            <span class="icon-[pixelarticons--play]" />
            <span>Autodarts öffnen</span>
          </button>
        </div>
        <p v-if="matchNavHint" class="cc-note" style="margin-top: 8px;" data-testid="cc-match-nav-hint">
          {{ matchNavHint }}
        </p>
      </template>

      <CcCard
        v-else
        title="Match"
        subtitle="Live-Ansicht des laufenden Matches"
        icon="icon-[pixelarticons--gamepad]"
        accent="muted"
      >
        <template #status>
          <CcStatusPill :label="connectionLabel" :tone="connectionTone" :meta="lastSignalAgo" class="is-sm" />
        </template>

        <CcEmptyState
          icon="icon-[pixelarticons--downasaur]"
          title="Kein aktives Match"
          text="Sobald auf play.autodarts.io ein Match läuft, erscheinen hier Spieler, Spielstand und alle von Autodarts gemeldeten Kennzahlen — live."
        >
          <template #action>
            <button @click="openAutodarts(autodartsOrigin)" class="cc-btn is-primary" type="button" data-testid="cc-match-empty-open">
              <span class="icon-[pixelarticons--external-link]" />
              <span>Autodarts öffnen</span>
            </button>
          </template>
        </CcEmptyState>

        <template #footer>
          {{ connectionHint }}
        </template>
      </CcCard>
    </div>

    <!-- Alle Spieler im Detail (auch bei mehr als zwei) -->
    <CcPlayersCard v-if="hasMatch" class="cc-col-5" />
    <CcMatchDetails v-if="hasMatch" class="cc-col-7" />

    <!-- Historie, rein lesend aus dem gespeicherten Ergebnis-Store -->
    <CcMatchHistory class="cc-col-12" />

    <!-- TEMPORÄR (Phase 5, 301/2-Legs Human Test) — siehe CcMatchHumanTestPanel.vue.
         Nur sichtbar, wenn der Live-Tester es bewusst aktiviert hat
         (localStorage.setItem("adt-human-test-panel", "1") in den DevTools der
         Control-Center-Seite). Kein import.meta.env.DEV-Gate: das Panel muss
         gerade gegen den echten Produktions-Build laufen, wenn der Human Test
         tatsächlich stattfindet (N5, PR #16 Review). -->
    <CcMatchHumanTestPanel v-if="showHumanTestPanel" class="cc-col-12" />
  </div>
</template>

<script setup lang="ts">
/**
 * Match-Bereich (MVP 3).
 *
 * Alle Werte stammen aus `local:game-data` (Kanal `autodarts.matches`) bzw. für
 * die Historie aus dem bestehenden Ergebnis-Store — dieser wird ausschließlich
 * gelesen. Keine eigene Match-Logik, keine Änderung an der WebSocket-
 * Verarbeitung.
 *
 * RUNTIME-FIX (Phase 5 Match Center Inventur): `CcMatchScoreboard.vue` wurde
 * hier durch `CcMatchHero.vue` ersetzt. `CcMatchHero.vue` war bereits
 * vollständig fertiggestellt (inkl. Live-Throw-/Checkout-Route-Zone, letzte
 * Visits, Momentum), aber nie in eine View eingebunden — laut
 * tests/match-flow.test.ts Kommentar ("fusioniert in CcMatchHero.vue statt in
 * der jetzt ungenutzten CcMatchFlow.vue") war das bereits die beabsichtigte
 * Konsolidierung, nur nie vollzogen. Reine Wiederverwendung vorhandener,
 * bereits fertiger Komponenten — keine Neuentwicklung, keine Datenänderung.
 */
import CcMatchHero from "../CcMatchHero.vue";
import CcPlayersCard from "../CcPlayersCard.vue";
import CcMatchDetails from "../CcMatchDetails.vue";
import CcMatchHistory from "../CcMatchHistory.vue";
import CcMatchHumanTestPanel from "../CcMatchHumanTestPanel.vue";
import CcCard from "../CcCard.vue";
import CcEmptyState from "../CcEmptyState.vue";
import CcStatusPill from "../CcStatusPill.vue";
import { computed } from "vue";

import { openAutodarts, openLobby, openMatch } from "../open-autodarts";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

const {
  hasMatch,
  openableMatchId,
  openableLobbyId,
  autodartsOrigin,
  matchNavHint,
  connectionLabel,
  connectionTone,
  connectionHint,
  lastSignalAgo,
} = useControlCenterStatus();

// N5 (PR #16 Review): CcMatchHumanTestPanel lief bisher ungegated für jeden
// Nutzer mit aktivem Match mit. Sichtbar nur nach explizitem Opt-in des
// Live-Testers, siehe Kommentar im Template oben.
const showHumanTestPanel = computed(() => {
  try {
    return localStorage.getItem("adt-human-test-panel") === "1";
  } catch {
    return false;
  }
});
</script>
