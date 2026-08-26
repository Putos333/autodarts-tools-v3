<template>
  <div class="cc-friends-page" data-testid="cc-party-view">
    <CcFriendsHero
      :state="state"
      :friends-count="friends.length"
      :online-count="online.length"
      :online-status-available="onlineStatusAvailable"
      :has-lobby="hasLobby"
      @challenge="scrollTo('cc-online-section')"
      @party="scrollTo('cc-party-section')"
    />

    <CcOnlineFriends
      :state="state"
      :online="online"
      :unknown-online="unknownOnline"
      :offline="offline"
      :friends-total="friends.length"
      :name-issue-text="nameIssueText"
      :online-issue-text="onlineIssueText"
      :is-loading="isLoading"
      :can-act="canAct"
      :error-text="errorText"
      :selected-friend-id="selectedFriendId"
      :last-played-map="lastPlayedMap"
      @load="load"
      @select="selectFriend"
      @open-detail="openDetail"
    />

    <section id="cc-challenge-section">
      <div class="cc-section-title">
        <span class="icon-[pixelarticons--bullseye]" />
        <span>Herausforderung</span>
      </div>
      <CcChallengeZone
        :friend="selectedFriend"
        :sending="selectedFriend !== null && busyFriendId === selectedFriend.id"
        :result="challengeResult"
        @send="sendChallenge"
        @reset="resetChallenge"
      />
    </section>

    <section id="cc-party-section">
      <div class="cc-section-title">
        <span class="icon-[pixelarticons--users]" />
        <span>Party / Lobby</span>
      </div>
      <CcPartyLobby
        v-if="hasLobby"
        :lobby-id="lobbyId"
        :lobby-players="lobbyPlayers"
        :lobby-host-name="lobbyHostName"
        :lobby-variant="lobbyVariant"
        :lobby-max-players="lobbyMaxPlayers"
        :lobby-is-private="lobbyIsPrivate"
        :lobby-created-at="lobbyCreatedAt"
        :lobby-rules="lobbyRules"
        :liveness="liveness"
        :last-signal-ago="lastSignalAgo"
        :autodarts-origin="autodartsOrigin"
      />
      <CcPartyMultiInvite
        v-else
        :state="state"
        :online="online"
        :busy="busyGroup"
        :result="lastGroupResult"
        :autodarts-origin="autodartsOrigin"
        @load="load"
        @start="startParty"
      />
    </section>

    <CcRecentOpponentsPanel
      :records="results"
      :my-user-id="myUserId"
      :friends="friends"
      :limit="6"
      @challenge="selectFriend"
    />

    <CcFriendDetail
      :friend="detailFriend"
      :open="detailFriendId !== null"
      :can-act="canAct"
      :last-played-at="detailFriend && detailFriend.id ? (lastPlayedMap[detailFriend.id] ?? null) : null"
      @close="closeDetail"
      @challenge="challengeFromDetail"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Friends & Party V4 — Produktionsimplementierung.
 *
 * Orchestriert ausschließlich bereits vorhandene Datenquellen:
 *   • Freunde/Quick-Play  → useControlCenterFriends() (utils/friends-api.ts)
 *   • Lobby/Party         → useControlCenterStatus()  (local:lobby-data)
 *   • Match-Historie      → useControlCenterStatus().results (CMR-Store, nur lesend)
 *   • eigene userId       → getUserIdFromToken() (JWT, kein Netzwerk-Call) —
 *                           dieselbe Quelle wie CcRecentActivity.vue.
 *
 * Diese Komponente hält bewusst den EINEN Composable-Aufruf pro Quelle und
 * reicht bereits entpackte Werte an kleine, fokussierte Kindkomponenten
 * weiter — keine zweite Freundes-/Lobby-Engine, keine doppelten Fetches.
 */
import { computed, onMounted, ref } from "vue";

import CcFriendsHero from "../CcFriendsHero.vue";
import CcOnlineFriends from "../CcOnlineFriends.vue";
import CcChallengeZone, { type IChallengeResult } from "../CcChallengeZone.vue";
import CcPartyLobby from "../CcPartyLobby.vue";
import CcPartyMultiInvite from "../CcPartyMultiInvite.vue";
import CcRecentOpponentsPanel from "../CcRecentOpponentsPanel.vue";
import CcFriendDetail from "../CcFriendDetail.vue";

import { useControlCenterFriends } from "@/composables/useControlCenterFriends";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";
import { getUserIdFromToken } from "@/utils/helpers";
import { getRecentOpponents } from "@/utils/dashboard-activity";
import { openUrl } from "../open-autodarts";
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
  isLoading,
  canAct,
  errorText,
  busyFriendId,
  load,
  challenge,
  busyGroup,
  lastGroupResult,
  challengeGroup,
} = useControlCenterFriends();

const {
  hasLobby,
  lobbyId,
  lobbyPlayers,
  lobbyHostName,
  lobbyVariant,
  lobbyMaxPlayers,
  lobbyIsPrivate,
  lobbyCreatedAt,
  lobbyRules,
  liveness,
  lastSignalAgo,
  autodartsOrigin,
  results,
} = useControlCenterStatus();

/** Eigene userId — nur zur Identitätsauflösung (Match-Historie, "Nochmal herausfordern"). Kein Netzwerk-Call. */
const myUserId = ref<string | null>(null);
onMounted(async () => {
  try {
    myUserId.value = await getUserIdFromToken();
  } catch {
    myUserId.value = null;
  }

  // RUNTIME-FIX (Realtest 2): Das gezielte Navigieren zur Seite "Freunde /
  // Party" IST bereits das ausdrückliche Zutun — anders als beim Dashboard-
  // Widget (CcHomeFriends.vue), das bewusst ohne Auto-Load bleibt, weil dort
  // Freunde nicht die Absicht des Besuchs sind. Vorher lud diese dedizierte
  // Seite nie automatisch: der globale "Aktualisieren"-Button (CcTopBar.vue)
  // ruft ausschließlich useControlCenterStatus().refresh() auf und rührt
  // useControlCenterFriends() nicht an, wodurch die Liste ohne einen
  // zusätzlichen, separaten Klick auf "Freunde laden" innerhalb der Seite nie
  // geladen wurde. Nutzt weiterhin exakt denselben load() wie der manuelle
  // Button — keine zweite Datenquelle.
  void load();
});

/** userId → Datum des letzten gemeinsamen Matches. Nur echte, per userId aufgelöste Treffer. */
const lastPlayedMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {};
  for (const opp of getRecentOpponents(results.value, myUserId.value, results.value.length)) {
    if (opp.userId) map[opp.userId] = opp.recordedAt;
  }
  return map;
});

// ── Auswahl / Challenge-Zone ────────────────────────────────────────────────

const selectedFriendId = ref<string | null>(null);
const selectedFriend = computed<IFriendResolved | null>(
  () => friends.value.find(f => f.id === selectedFriendId.value) ?? null,
);
const challengeResult = ref<IChallengeResult | null>(null);

function selectFriend(friend: IFriendResolved): void {
  if (!friend.id) return;
  selectedFriendId.value = friend.id;
  detailFriendId.value = null;
  scrollTo("cc-challenge-section");
}

function resetChallenge(): void {
  selectedFriendId.value = null;
  challengeResult.value = null;
}

async function sendChallenge(friend: IFriendResolved): Promise<void> {
  const result = await challenge(friend);
  challengeResult.value = {
    ok: result.success,
    text: result.success
      ? `Lobby erstellt und Einladung an ${friend.name ?? "diesen Freund"} gesendet.`
      : (result.error ?? "Unbekannter Fehler."),
    friendId: friend.id,
  };
  if (result.success && result.lobbyUrl) openUrl(result.lobbyUrl);
}

// ── Friend Detail ────────────────────────────────────────────────────────

const detailFriendId = ref<string | null>(null);
const detailFriend = computed<IFriendResolved | null>(
  () => friends.value.find(f => f.id === detailFriendId.value) ?? null,
);

function openDetail(friend: IFriendResolved): void {
  detailFriendId.value = friend.id || null;
}
function closeDetail(): void {
  detailFriendId.value = null;
}
function challengeFromDetail(friend: IFriendResolved): void {
  closeDetail();
  selectFriend(friend);
}

// ── Party / Multi-Friend ─────────────────────────────────────────────────

async function startParty(friendIds: string[]): Promise<void> {
  const result = await challengeGroup(friendIds);
  if (result.success && result.lobbyUrl) openUrl(result.lobbyUrl);
}

function scrollTo(id: string): void {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
</script>
