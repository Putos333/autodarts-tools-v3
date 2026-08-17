<template>
  <div class="cc-grid" data-testid="cc-dashboard">
    <!-- ── LIVE / MATCH HERO ───────────────────────────────────────────── -->
    <div class="cc-col-12">
      <CcMatchHero />
    </div>

    <!-- ── BOARD │ VERBINDUNG │ QUICK STATS ────────────────────────────────
         Drei kompakte Karten auf breiten Schirmen, zwei ab 1440px,
         eine auf Mobil — das füllt 16:9-Flächen ohne Leerraum. -->
    <CcBoardCard class="cc-col-4" />
    <CcConnectionCard class="cc-col-4" />
    <CcQuickStats class="cc-col-4" />

    <!-- ── SPIELER │ LETZTES / AKTUELLES MATCH ─────────────────────────── -->
    <CcPlayersCard class="cc-col-7" />
    <CcMatchDetails class="cc-col-5" />
  </div>
</template>

<script setup lang="ts">
/**
 * Dashboard — reine Komposition.
 *
 * Jede Karte holt sich ihre Daten selbst aus `useControlCenterStatus()`, das
 * per Refcount ein geteilter Singleton ist. Dadurch bleibt diese Datei ein
 * Layout und nichts weiter.
 */
import CcMatchHero from "../CcMatchHero.vue";
import CcBoardCard from "../CcBoardCard.vue";
import CcConnectionCard from "../CcConnectionCard.vue";
import CcQuickStats from "../CcQuickStats.vue";
import CcPlayersCard from "../CcPlayersCard.vue";
import CcMatchDetails from "../CcMatchDetails.vue";
</script>
