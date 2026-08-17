<template>
  <CcCard
    title="Freunde"
    :subtitle="subtitle"
    icon="icon-[pixelarticons--contact-multiple]"
    accent="muted"
    data-testid="cc-card-friends"
  >
    <template #status>
      <CcStatusPill :label="stateLabel" :tone="stateTone" class="is-sm" />
    </template>

    <!-- Fall 1: Token fehlt, ist zu alt oder wurde abgelehnt -->
    <CcEmptyState
      v-if="state === 'no-auth'"
      icon="icon-[pixelarticons--lock]"
      title="Freundesliste nicht verfügbar"
      :text="noAuthText"
    >
      <template #action>
        <button @click="openAutodarts()" class="cc-btn is-primary" type="button" data-testid="cc-friends-open-autodarts">
          <span class="icon-[pixelarticons--external-link]" />
          <span>Autodarts öffnen</span>
        </button>
        <button @click="load" class="cc-btn" type="button" data-testid="cc-friends-retry">
          <span class="icon-[pixelarticons--reload]" />
          <span>Erneut prüfen</span>
        </button>
      </template>
    </CcEmptyState>

    <!-- Fall 2: Abruf lief auf einen Fehler -->
    <CcEmptyState
      v-else-if="state === 'unavailable'"
      icon="icon-[pixelarticons--alert]"
      title="Abruf fehlgeschlagen"
      :text="errorText ?? 'Die Freundesliste konnte nicht geladen werden.'"
    >
      <template #action>
        <button @click="load" class="cc-btn" type="button">
          <span class="icon-[pixelarticons--reload]" />
          <span>Nochmal versuchen</span>
        </button>
      </template>
    </CcEmptyState>

    <!-- Fall 3: läuft -->
    <div v-else-if="isLoading" class="cc-empty">
      <span class="cc-empty-icon"><span class="icon-[pixelarticons--loader] animate-spin" /></span>
      <p class="cc-empty-title">Freundesliste wird geladen …</p>
    </div>

    <!-- Fall 4: geladen -->
    <template v-else-if="state === 'ready'">
      <!-- Ehrliche Hinweise, statt Platzhalter als Wahrheit auszugeben -->
      <div v-if="nameIssueText" class="cc-notice" data-testid="cc-friends-name-issue">
        <span class="icon-[pixelarticons--alert] cc-notice-icon" />
        <span>{{ nameIssueText }}</span>
      </div>
      <div v-if="onlineIssueText" class="cc-notice" data-testid="cc-friends-online-issue">
        <span class="icon-[pixelarticons--info-box] cc-notice-icon" />
        <span>{{ onlineIssueText }}</span>
      </div>

      <div v-if="friends.length > 0">
        <!-- Gruppiert nur, wenn der Online-Status wirklich bekannt ist -->
        <template v-if="onlineStatusAvailable">
          <div v-if="online.length > 0" class="cc-friend-group">
            <div class="cc-tile-label">Online · {{ online.length }}</div>
            <CcFriendRow
              @challenge="askChallenge"
              v-for="friend in online"
              :key="friend.id"
              :friend="friend"
              :busy="busyFriendId === friend.id"
              :pending="pendingId === friend.id"
              :can-act="canAct"
            />
          </div>

          <div v-if="offline.length > 0" class="cc-friend-group">
            <div class="cc-tile-label">Offline · {{ offline.length }}</div>
            <CcFriendRow
              @challenge="askChallenge"
              v-for="friend in offline"
              :key="friend.id"
              :friend="friend"
              :busy="busyFriendId === friend.id"
              :pending="pendingId === friend.id"
              :can-act="canAct"
            />
          </div>

          <div v-if="unknownOnline.length > 0" class="cc-friend-group">
            <div class="cc-tile-label">Status unbekannt · {{ unknownOnline.length }}</div>
            <CcFriendRow
              @challenge="askChallenge"
              v-for="friend in unknownOnline"
              :key="friend.id"
              :friend="friend"
              :busy="busyFriendId === friend.id"
              :pending="pendingId === friend.id"
              :can-act="canAct"
            />
          </div>
        </template>

        <!-- Ohne Online-Status: flache Liste, keine erfundene Offline-Gruppe -->
        <div v-else class="cc-friend-group">
          <div class="cc-tile-label">{{ friends.length }} Einträge · Status unbekannt</div>
          <CcFriendRow
            @challenge="askChallenge"
            v-for="friend in friends"
            :key="friend.id"
            :friend="friend"
            :busy="busyFriendId === friend.id"
            :pending="pendingId === friend.id"
            :can-act="canAct"
          />
        </div>
      </div>

      <!-- Leere Antwort: wir behaupten nicht, dass es keine Freunde gibt -->
      <CcEmptyState
        v-else
        icon="icon-[pixelarticons--contact-multiple]"
        title="Keine Freunde zurückgemeldet"
        text="Autodarts hat eine leere Liste geliefert. Das heißt entweder, dass keine Freunde eingetragen sind, oder dass der Abruf nicht durchkam. Das vollständige Freunde-Panel der Erweiterung liegt in der klassischen Ansicht."
      >
        <template #action>
          <button @click="openClassicSettings()" class="cc-btn" type="button">
            <span class="icon-[pixelarticons--sliders]" />
            <span>Freunde-Panel öffnen</span>
          </button>
        </template>
      </CcEmptyState>
    </template>

    <!-- Fall 5: noch nichts versucht -->
    <CcEmptyState
      v-else
      icon="icon-[pixelarticons--contact-multiple]"
      title="Freundesliste noch nicht geladen"
      text="Die Liste wird direkt von Autodarts abgerufen — nur auf Klick, damit keine Anfrage ohne dein Zutun läuft."
    >
      <template #action>
        <button @click="load" class="cc-btn is-primary" type="button" data-testid="cc-friends-load">
          <span class="icon-[pixelarticons--download]" />
          <span>Freunde laden</span>
        </button>
      </template>
    </CcEmptyState>

    <!-- Rückmeldung der letzten Aktion -->
    <p
      v-if="lastActionText"
      class="cc-note"
      :style="{ marginTop: '12px', color: lastActionOk ? 'var(--cc-ok)' : 'var(--cc-bad)' }"
      data-testid="cc-friends-action-result"
    >
      {{ lastActionText }}
    </p>

    <template #footer>
      Quelle: bestehende Freunde-Schnittstelle der Erweiterung. „Herausfordern" erstellt über die
      vorhandene Quick-Play-Funktion eine private Lobby und sendet eine echte Einladung — daher
      die Rückfrage vor dem Absenden.
    </template>
  </CcCard>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import CcCard from "./CcCard.vue";
import CcStatusPill from "./CcStatusPill.vue";
import CcEmptyState from "./CcEmptyState.vue";
import CcFriendRow from "./CcFriendRow.vue";
import { openAutodarts, openClassicSettings, openUrl } from "./open-autodarts";
import { useControlCenterFriends } from "@/composables/useControlCenterFriends";
import type { TTone } from "@/composables/useControlCenterStatus";
import type { IFriendResolved } from "@/utils/friends-api";

const {
  state,
  friends,
  online,
  offline,
  unknownOnline,
  onlineStatusAvailable,
  nameIssueText,
  onlineIssueText,
  httpStatus,
  isLoading,
  canAct,
  errorText,
  busyFriendId,
  lastActionText,
  lastActionOk,
  load,
  challenge,
} = useControlCenterFriends();

/** Welcher Freund wartet auf die Bestätigung der Einladung? */
const pendingId = ref<string | null>(null);

const subtitle = computed(() => {
  if (state.value !== "ready") return "Freundesliste von Autodarts";
  const count = `${friends.value.length} Einträge`;
  return onlineStatusAvailable.value
    ? `${count} · ${online.value.length} online`
    : `${count} · Online-Status unbekannt`;
});

const stateLabel = computed(() => {
  switch (state.value) {
    case "ready": return "Geladen";
    case "loading": return "Lädt …";
    case "no-auth": return "Nicht verfügbar";
    case "unavailable": return "Fehler";
    default: return "Nicht geladen";
  }
});

const stateTone = computed<TTone>(() => {
  switch (state.value) {
    case "ready": return "ok";
    case "loading": return "warn";
    case "no-auth": return "idle";
    case "unavailable": return "bad";
    default: return "idle";
  }
});

const noAuthText = computed(() => {
  const base = "Die Autodarts-Freundesliste braucht ein frisches Zugangstoken. Dieses wird ausschließlich beim Besuch von play.autodarts.io erfasst und lebt nur wenige Minuten — von dieser Seite aus kann es nicht erneuert werden.";
  if (httpStatus.value === 401 || httpStatus.value === 403) {
    return `Autodarts hat den vorhandenen Token abgelehnt (HTTP ${httpStatus.value}). ${base}`;
  }
  return base;
});

/**
 * Zwei-Schritt-Bestätigung: erster Klick fragt nach, zweiter sendet wirklich.
 * Eine Einladung erstellt eine echte Lobby auf dem Autodarts-Konto — das soll
 * nicht durch einen Fehlklick passieren.
 */
async function askChallenge(friend: IFriendResolved): Promise<void> {
  if (pendingId.value !== friend.id) {
    pendingId.value = friend.id;
    return;
  }
  pendingId.value = null;
  const result = await challenge(friend);
  if (result.success && result.lobbyUrl) openUrl(result.lobbyUrl);
}
</script>
