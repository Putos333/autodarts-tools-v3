<template>
  <div class="cc-panel" data-testid="cc-home-friends">
    <div class="cc-panel-head">
      <span class="cc-panel-title">Freunde &amp; Party</span>
      <span class="cc-panel-link" data-testid="cc-home-friends-link" @click="go('party')">Alle →</span>
    </div>

    <template v-if="state === 'ready' && onlineStatusAvailable && online.length > 0">
      <div class="cc-home-friend-list" data-testid="cc-home-friends-online">
        <div v-for="friend in online.slice(0, 4)" :key="friend.id" class="cc-home-friend-row">
          <CcPlayerBadge :name="friend.name ?? '?'" size="sm" variant="plain" />
          <span>{{ friend.name ?? "Unbekannt" }}</span>
          <span class="cc-home-friend-dot" />
        </div>
      </div>
    </template>
    <template v-else-if="state === 'ready'">
      <p class="cc-note" style="font-size: 12px;">
        {{ onlineStatusAvailable ? "Aktuell kein Freund online." : "Online-Status derzeit nicht verfügbar." }}
      </p>
    </template>
    <p v-else-if="state === 'no-auth'" class="cc-note" style="font-size: 12px;">
      Freundesliste braucht ein frisches Autodarts-Login.
    </p>
    <template v-else-if="state === 'idle'">
      <!-- Bewusst kein Auto-Load beim Öffnen des Dashboards — dieselbe
           Zustimmungsregel wie CcFriendsCard.vue: keine Anfrage ohne
           ausdrückliches Zutun. -->
      <span class="cc-panel-cta" data-testid="cc-home-friends-load" @click="load">
        <span class="icon-[pixelarticons--download]" /> Freunde laden
      </span>
    </template>
    <p v-else class="cc-note" style="font-size: 12px;">Freundesliste wird geladen …</p>

    <span class="cc-panel-cta" data-testid="cc-home-friends-invite" @click="go('party')">
      <span class="icon-[pixelarticons--users]" /> Party einladen
    </span>
  </div>
</template>

<script setup lang="ts">
/**
 * Dieselbe, bereits bestehende Freundes-Logik wie CcFriendsCard.vue — kein
 * zweiter Datenpfad. Nur eine kompaktere Darstellung für das Dashboard.
 */
import CcPlayerBadge from "./CcPlayerBadge.vue";
import { useControlCenterFriends } from "@/composables/useControlCenterFriends";
import type { TCcSectionId } from "./sections";

const { state, online, onlineStatusAvailable, load } = useControlCenterFriends();

function go(id: TCcSectionId): void {
  window.location.hash = id;
}
</script>
