<template>
  <section id="cc-online-section" data-testid="cc-online-friends">
    <div class="cc-section-title">
      <span class="icon-[pixelarticons--contact-multiple]" />
      <span>Online jetzt</span>
    </div>

    <CcEmptyState
      v-if="state === 'no-auth'"
      icon="icon-[pixelarticons--lock]"
      title="Freundesliste nicht verfügbar"
      text="Die Autodarts-Freundesliste braucht ein frisches Zugangstoken. Dieses wird ausschließlich beim Besuch von play.autodarts.io erfasst und lebt nur wenige Minuten — von dieser Seite aus kann es nicht erneuert werden."
    >
      <template #action>
        <button class="cc-btn is-primary" type="button" data-testid="cc-online-open-autodarts" @click="openAutodarts()">
          <span class="icon-[pixelarticons--external-link]" /><span>Autodarts öffnen</span>
        </button>
        <button class="cc-btn" type="button" @click="$emit('load')">
          <span class="icon-[pixelarticons--reload]" /><span>Erneut prüfen</span>
        </button>
      </template>
    </CcEmptyState>

    <CcEmptyState
      v-else-if="state === 'unavailable'"
      icon="icon-[pixelarticons--alert]"
      title="Abruf fehlgeschlagen"
      :text="errorText ?? 'Die Freundesliste konnte nicht geladen werden.'"
    >
      <template #action>
        <button class="cc-btn is-primary" type="button" @click="$emit('load')">
          <span class="icon-[pixelarticons--reload]" /><span>Nochmal versuchen</span>
        </button>
      </template>
    </CcEmptyState>

    <div v-else-if="isLoading" class="cc-empty">
      <span class="cc-empty-icon"><span class="icon-[pixelarticons--loader] animate-spin" /></span>
      <p class="cc-empty-title">Freundesliste wird geladen …</p>
    </div>

    <CcEmptyState
      v-else-if="state === 'idle'"
      icon="icon-[pixelarticons--contact-multiple]"
      title="Freundesliste noch nicht geladen"
      text="Die Liste wird direkt von Autodarts abgerufen — nur auf Klick, damit keine Anfrage ohne dein Zutun läuft."
    >
      <template #action>
        <button class="cc-btn is-primary" type="button" data-testid="cc-online-load" @click="$emit('load')">
          <span class="icon-[pixelarticons--download]" /><span>Freunde laden</span>
        </button>
      </template>
    </CcEmptyState>

    <template v-else-if="state === 'ready'">
      <div v-if="nameIssueText" class="cc-notice" data-testid="cc-online-name-issue">
        <span class="icon-[pixelarticons--alert] cc-notice-icon" /><span>{{ nameIssueText }}</span>
      </div>
      <div v-if="onlineIssueText" class="cc-notice" data-testid="cc-online-status-issue">
        <span class="icon-[pixelarticons--info-box] cc-notice-icon" /><span>{{ onlineIssueText }}</span>
      </div>

      <CcEmptyState
        v-if="friendsTotal === 0"
        icon="icon-[pixelarticons--contact-multiple]"
        title="Keine Freunde zurückgemeldet"
        text="Autodarts hat eine leere Liste geliefert. Das heißt entweder, dass keine Freunde eingetragen sind, oder dass der Abruf nicht durchkam."
      />

      <template v-else-if="highlighted.length > 0">
        <div class="cc-online-grid" data-testid="cc-online-grid">
          <CcOnlineFriendCard
            v-for="friend in highlighted"
            :key="friend.id"
            :friend="friend"
            :can-act="canAct"
            :selected="friend.id === selectedFriendId"
            :last-played-at="friend.id ? (lastPlayedMap[friend.id] ?? null) : null"
            @select="(f) => $emit('select', f)"
            @open-detail="(f) => $emit('open-detail', f)"
          />
        </div>
      </template>

      <CcEmptyState
        v-else
        icon="icon-[pixelarticons--mood-sad]"
        title="Aktuell niemand online"
        text="Sobald ein Freund online geht oder der Status wieder verfügbar ist, erscheint er hier."
      />

      <template v-if="offline.length > 0">
        <div class="cc-online-toggle" data-testid="cc-online-offline-toggle" @click="showOffline = !showOffline">
          <span class="icon-[pixelarticons--chevron-down]" />
          {{ showOffline ? "Offline-Freunde ausblenden" : `${offline.length} offline anzeigen` }}
        </div>
        <div v-if="showOffline" class="cc-online-grid" style="margin-top: 10px;" data-testid="cc-online-grid-offline">
          <CcOnlineFriendCard
            v-for="friend in offline"
            :key="friend.id"
            :friend="friend"
            :can-act="canAct"
            :selected="friend.id === selectedFriendId"
            :last-played-at="friend.id ? (lastPlayedMap[friend.id] ?? null) : null"
            @select="(f) => $emit('select', f)"
            @open-detail="(f) => $emit('open-detail', f)"
          />
        </div>
      </template>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import CcEmptyState from "./CcEmptyState.vue";
import CcOnlineFriendCard from "./CcOnlineFriendCard.vue";
import { openAutodarts } from "./open-autodarts";
import type { TFriendsState } from "@/composables/useControlCenterFriends";
import type { IFriendResolved } from "@/utils/friends-api";

const props = defineProps<{
  state: TFriendsState;
  online: IFriendResolved[];
  unknownOnline: IFriendResolved[];
  offline: IFriendResolved[];
  friendsTotal: number;
  nameIssueText: string | null;
  onlineIssueText: string | null;
  isLoading: boolean;
  canAct: boolean;
  errorText: string | null;
  selectedFriendId: string | null;
  lastPlayedMap: Record<string, string>;
}>();

defineEmits<{
  (e: "load"): void;
  (e: "select", friend: IFriendResolved): void;
  (e: "open-detail", friend: IFriendResolved): void;
}>();

const showOffline = ref(false);

/** Online + Status-unbekannt zusammen — nur bestätigt Offline wird standardmäßig ausgeblendet. */
const highlighted = computed<IFriendResolved[]>(() => [ ...props.online, ...props.unknownOnline ]);
</script>
