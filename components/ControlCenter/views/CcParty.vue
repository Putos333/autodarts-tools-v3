<template>
  <div class="cc-grid" data-testid="cc-party-view">
    <CcPartyCard class="cc-col-5" />
    <CcFriendsCard class="cc-col-7" />

    <!-- Was in diesem Bereich bewusst noch NICHT enthalten ist -->
    <CcCard
      class="cc-col-12"
      title="Noch nicht im Control Center"
      subtitle="Vorhanden in der klassischen Ansicht"
      icon="icon-[pixelarticons--info-box]"
      accent="muted"
    >
      <p class="cc-note" style="margin-bottom: 12px;">
        Diese Funktionen existieren in der Erweiterung und sind vollständig nutzbar — sie sind hier
        noch nicht eingehängt, damit der funktionierende Stand unangetastet bleibt.
      </p>
      <div class="cc-list">
        <div v-for="item in pending" :key="item" class="cc-list-row">
          <span class="cc-list-bullet">▸</span>
          <span>{{ item }}</span>
        </div>
      </div>
      <template #footer>
        <button @click="openClassicSettings()" class="cc-btn is-accent" type="button" data-testid="cc-party-classic">
          <span class="icon-[pixelarticons--sliders]" />
          <span>Klassische Ansicht öffnen</span>
        </button>
      </template>
    </CcCard>
  </div>
</template>

<script setup lang="ts">
/**
 * Freunde / Party (MVP 3).
 *
 * Zwei echte Quellen:
 *   • Lobby/Party  → `local:lobby-data`, kein API-Call nötig
 *   • Freunde      → bestehende `utils/friends-api.ts` (Autodarts-Konto),
 *                    nur mit frischem Zugangstoken möglich
 *
 * Alles, was ohne verlässliche Datenlage bliebe, wird nicht simuliert, sondern
 * benannt.
 */
import CcPartyCard from "../CcPartyCard.vue";
import CcFriendsCard from "../CcFriendsCard.vue";
import CcCard from "../CcCard.vue";
import { openClassicSettings } from "../open-autodarts";

const pending = [
  "Head-to-Head-Statistiken gegen einzelne Freunde",
  "Stammgruppe mit Ein-Klick-Lobby für mehrere Freunde",
  "Freunde-Turniere inklusive automatischer Ergebniserkennung",
  "Party-Buzzer mit QR-Code für Handys",
];
</script>
