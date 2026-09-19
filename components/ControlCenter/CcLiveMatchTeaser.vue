<template>
  <div v-if="heroPair" :class="[ 'cc-activity', 'is-live', checkoutPath.visible && 'is-checkout' ]" data-testid="cc-live-teaser">
    <div class="cc-activity-top">
      <span class="cc-activity-eyebrow"><span class="cc-live-dot" />Live Match</span>
      <span class="cc-activity-open" data-testid="cc-live-teaser-open" @click="openMatchCenter">Match Center öffnen →</span>
    </div>

    <div class="cc-activity-body">
      <div class="cc-activity-side left">
        <div class="cc-activity-badge is-red">
          <CcPlayerBadge :name="heroPair.left.name" :is-bot="heroPair.left.isBot" variant="red" size="md" />
        </div>
        <div>
          <div class="cc-activity-name">{{ heroPair.left.name }}</div>
          <div v-if="heroPair.left.isActive" class="cc-activity-tag is-red">Am Wurf</div>
          <div v-if="heroPair.left.remaining !== undefined" class="cc-activity-rem is-red">{{ heroPair.left.remaining }}</div>
        </div>
      </div>

      <div v-if="heroScoreLine" class="cc-activity-legs">
        <div class="cc-activity-legs-label">{{ heroScoreLine.label }}</div>
        <div class="cc-activity-legs-value">{{ heroScoreLine.text }}</div>
      </div>

      <div class="cc-activity-side right">
        <div class="cc-activity-badge is-blue">
          <CcPlayerBadge :name="heroPair.right.name" :is-bot="heroPair.right.isBot" variant="blue" size="md" />
        </div>
        <div>
          <div class="cc-activity-name">{{ heroPair.right.name }}</div>
          <div v-if="heroPair.right.isActive" class="cc-activity-tag is-blue">Am Wurf</div>
          <div v-if="heroPair.right.remaining !== undefined" class="cc-activity-rem is-blue">{{ heroPair.right.remaining }}</div>
        </div>
      </div>
    </div>

    <div v-if="checkoutPath.visible" class="cc-activity-checkout" data-testid="cc-live-teaser-checkout">
      <span>Checkout-Route</span>
      <span
        v-for="(dart, index) in checkoutPath.darts"
        :key="index"
        :class="[ 'cc-activity-cn', dart.hit && 'is-hit' ]"
      >{{ dart.hit ? dart.label : "–" }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import CcPlayerBadge from "./CcPlayerBadge.vue";
import { openLobby, openMatch } from "./open-autodarts";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

/**
 * Kompakter Teaser für das Dashboard — bewusst NICHT das vollständige Live
 * Match Center (CcMatchHero.vue): keine Live-Throw-Darts, keine Performance-
 * Kacheln, keine Recent-Visits-Liste. Nur Namen, Restscore, aktiver Spieler,
 * Legs und — nur wenn relevant — die Checkout-Route. Dieselben, unveränderten
 * Ableitungen (heroPair, heroScoreLine, checkoutPath) wie im Match Center.
 */
const {
  heroPair,
  heroScoreLine,
  checkoutPath,
  openableMatchId,
  openableLobbyId,
  autodartsOrigin,
} = useControlCenterStatus();

function openMatchCenter(): void {
  if (openableMatchId.value) {
    openMatch(openableMatchId.value, autodartsOrigin.value);
  } else if (openableLobbyId.value) {
    openLobby(openableLobbyId.value, autodartsOrigin.value);
  } else {
    window.location.hash = "match";
  }
}
</script>
