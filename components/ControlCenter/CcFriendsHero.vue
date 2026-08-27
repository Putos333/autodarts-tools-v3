<template>
  <section class="cc-friends-hero" data-testid="cc-friends-hero">
    <div class="cc-friends-hero-id">
      <div class="cc-badge is-xl is-red">DU</div>
      <div>
        <div class="cc-friends-hero-eyebrow">Autodarts Elite</div>
        <h1 class="cc-friends-hero-name">Freunde &amp; Party</h1>
        <div class="cc-friends-hero-meta">
          <span v-if="state === 'ready'" class="cc-pill cc-tone-idle">{{ friendsCount }} {{ friendsCount === 1 ? "Freund" : "Freunde" }} geladen</span>
          <span v-if="state === 'ready' && onlineStatusAvailable" class="cc-pill cc-tone-ok" data-testid="cc-friends-hero-online">
            <span class="cc-pill-led" />{{ onlineCount }} {{ onlineCount === 1 ? "online" : "online" }}
          </span>
          <span v-else-if="state === 'ready'" class="cc-pill cc-tone-idle" data-testid="cc-friends-hero-unknown">Online-Status unbekannt</span>
          <span v-if="hasLobby" class="cc-pill cc-tone-accent">Lobby aktiv</span>
        </div>
      </div>
    </div>
    <div class="cc-friends-hero-actions">
      <button class="cc-btn is-primary" type="button" data-testid="cc-friends-hero-challenge" @click="$emit('challenge')">
        <span class="icon-[pixelarticons--bullseye]" />
        <span>Freund herausfordern</span>
      </button>
      <button class="cc-btn" type="button" data-testid="cc-friends-hero-party" @click="$emit('party')">
        <span class="icon-[pixelarticons--users]" />
        <span>Party / Lobby</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { TFriendsState } from "@/composables/useControlCenterFriends";

defineProps<{
  state: TFriendsState;
  friendsCount: number;
  onlineCount: number;
  onlineStatusAvailable: boolean;
  hasLobby: boolean;
}>();

defineEmits<{ (e: "challenge"): void; (e: "party"): void }>();
</script>
