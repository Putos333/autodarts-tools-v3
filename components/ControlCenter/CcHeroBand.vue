<template>
  <section class="cc-hero cc-herobar" data-testid="cc-herobar">
    <div class="cc-herobar-id">
      <CcPlayerBadge :name="myName ?? 'Autodarts Elite'" variant="red" size="md" />
      <div>
        <div class="cc-herobar-brand">Autodarts <span class="cc-herobar-accent">Elite</span></div>
        <div v-if="myName" class="cc-herobar-player" data-testid="cc-herobar-player">{{ myName }}</div>
      </div>
    </div>

    <div class="cc-herobar-status">
      <span class="cc-herobar-stat" data-testid="cc-herobar-board">
        <span :class="[ 'cc-herobar-dot', boardTone === 'ok' ? 'is-ok' : 'is-idle' ]" />
        Board<template v-if="autoscoringLabel"> + Autoscoring</template>
        <b>{{ boardStatusShort }}</b>
      </span>
      <span class="cc-herobar-stat" data-testid="cc-herobar-connection">
        <span :class="[ 'cc-herobar-dot', liveness === 'live' ? 'is-ok' : 'is-idle' ]" />
        Erweiterung <b>{{ liveness === 'live' ? 'online' : 'kein Signal' }}</b>
      </span>
    </div>

    <button
      v-if="hasMatch && !matchFinished"
      class="cc-herobar-cta is-continue"
      type="button"
      data-testid="cc-herobar-continue"
      @click="continueMatch"
    >
      <span class="icon-[pixelarticons--play]" />
      <span>Match fortsetzen</span>
    </button>
    <button
      v-else
      class="cc-herobar-cta"
      type="button"
      data-testid="cc-herobar-start"
      @click="openAutodarts(autodartsOrigin)"
    >
      <span class="icon-[pixelarticons--bullseye]" />
      <span>Match starten</span>
    </button>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

import CcPlayerBadge from "./CcPlayerBadge.vue";
import { openAutodarts, openLobby, openMatch } from "./open-autodarts";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";
import { AutodartsToolsGlobalStatus } from "@/utils/storage";

const {
  hasMatch,
  matchFinished,
  hasBoardSignal,
  boardData,
  boardTone,
  liveness,
  openableMatchId,
  openableLobbyId,
  autodartsOrigin,
} = useControlCenterStatus();

/**
 * Eigener Name aus `local:globalstatus` (Autodarts-Login). Kein Avatar-Bild
 * hier — `IGlobalStatus` führt außerhalb eines laufenden Matches keine
 * `avatarUrl` (die existiert nur pro Match-Teilnehmer, `IPlayer.avatarUrl`).
 * `CcPlayerBadge` zeigt daher ehrlich Initialen statt eines erfundenen Fotos.
 */
const myName = ref<string | null>(null);
let unwatchGlobalStatus: (() => void) | undefined;

async function loadGlobalStatus(): Promise<void> {
  try {
    const status = await AutodartsToolsGlobalStatus.getValue();
    myName.value = status?.user?.name || null;
  } catch (error) {
    console.error("[CcHeroBand] loadGlobalStatus failed", error);
  }
}

let disposed = false;

onMounted(async () => {
  await loadGlobalStatus();
  if (disposed) return;
  unwatchGlobalStatus = AutodartsToolsGlobalStatus.watch(() => void loadGlobalStatus());
});
onBeforeUnmount(() => {
  disposed = true;
  unwatchGlobalStatus?.();
  unwatchGlobalStatus = undefined;
});

/**
 * Dieselbe Ableitung wie CcBoardCard.vue: Autoscoring gilt als aktiv, wenn das
 * Board verbunden ist UND das Signal frisch ist — alles andere ist "Unbekannt",
 * nicht "inaktiv" vorgetäuscht.
 */
const autoscoringLabel = computed(() => {
  if (!hasBoardSignal.value) return null;
  if (liveness.value !== "live") return "Unbekannt";
  return boardData.value.connected ? "Aktiv" : "Inaktiv";
});

const boardStatusShort = computed(() => {
  if (!hasBoardSignal.value) return "unbekannt";
  return boardData.value.connected ? "verbunden" : "getrennt";
});

/** Dieselbe Aktion wie "Match Center öffnen" im Live-Teaser — echtes Öffnen des laufenden Matches. */
function continueMatch(): void {
  if (openableMatchId.value) {
    openMatch(openableMatchId.value, autodartsOrigin.value);
  } else if (openableLobbyId.value) {
    openLobby(openableLobbyId.value, autodartsOrigin.value);
  } else {
    openAutodarts(autodartsOrigin.value);
  }
}
</script>
