<template>
  <div
    :class="[ 'cc-challenge', friend && 'has-selection', showResult && result?.ok && 'is-success', showResult && result && !result.ok && 'is-error' ]"
    data-testid="cc-challenge-zone"
  >
    <svg class="cc-challenge-board" viewBox="0 0 200 200" aria-hidden="true">
      <circle cx="100" cy="100" r="96" fill="none" stroke="#fff" stroke-width="1" />
      <circle cx="100" cy="100" r="76" fill="none" stroke="#fff" stroke-width="1" />
      <circle cx="100" cy="100" r="54" fill="none" stroke="#e8002d" stroke-width="1" />
      <circle cx="100" cy="100" r="32" fill="none" stroke="#3b82f6" stroke-width="1" />
      <circle cx="100" cy="100" r="12" fill="none" stroke="#f5c842" stroke-width="1" />
      <circle cx="100" cy="100" r="3" fill="#f5c842" />
    </svg>

    <div v-if="!friend" class="cc-challenge-empty">
      <div class="cc-challenge-empty-icon"><span class="icon-[pixelarticons--bullseye]" /></div>
      <div class="cc-challenge-empty-title">Wähle oben einen Freund</div>
      <div class="cc-challenge-empty-text">Klicke bei einem Online-Freund auf „Herausfordern" — hier erscheint dann der Player-vs-Player-Screen.</div>
    </div>

    <template v-else-if="!showResult">
      <div class="cc-challenge-body">
        <div class="cc-challenge-grid">
          <div class="cc-challenge-side is-red">
            <div class="cc-challenge-side-label">Du</div>
            <div class="cc-badge is-xl is-red">DU</div>
            <div class="cc-challenge-side-name">Du</div>
            <div class="cc-challenge-side-tags"><span class="cc-tag is-accent">Herausforderer</span></div>
          </div>
          <div class="cc-challenge-center"><div class="cc-challenge-x">VS</div></div>
          <div class="cc-challenge-side is-blue">
            <div class="cc-challenge-side-label">Gegner</div>
            <CcPlayerBadge :name="friend.name ?? '?'" variant="blue" size="xl" />
            <div class="cc-challenge-side-name">{{ friend.name ?? "Name nicht auflösbar" }}</div>
            <div class="cc-challenge-side-tags">
              <span v-if="friend.online === true" class="cc-tag is-online">Online</span>
              <span v-else-if="friend.online === false" class="cc-tag">Offline</span>
              <span v-else class="cc-tag">Status unbekannt</span>
              <span v-if="friend.inMatch === true" class="cc-tag is-accent">Im Match</span>
            </div>
          </div>
        </div>

        <div class="cc-challenge-setup">
          <div class="cc-challenge-setup-title">Match Setup</div>
          <div class="cc-challenge-setup-chips">
            <span class="cc-challenge-setup-chip">{{ x01.startScore }}</span>
            <span class="cc-challenge-setup-chip">{{ capitalize(x01.inMode) }} In</span>
            <span class="cc-challenge-setup-chip">{{ capitalize(x01.outMode) }} Out</span>
            <span class="cc-challenge-setup-chip">Best of {{ x01.legs }} Legs</span>
          </div>
          <div class="cc-challenge-setup-hint">
            Standardeinstellung von <code>quickPlay()</code> — in dieser Oberfläche aktuell nicht änderbar.
          </div>
        </div>

        <div class="cc-challenge-cta">
          <button
            class="cc-btn is-primary is-lg"
            type="button"
            :disabled="sending"
            data-testid="cc-challenge-send"
            @click="onSendClick"
          >
            <span v-if="sending" class="icon-[pixelarticons--loader] animate-spin" />
            <span v-else class="icon-[pixelarticons--bullseye]" />
            <span>{{ sending ? "Sende …" : armed ? "Wirklich senden?" : "Herausforderung senden" }}</span>
          </button>
          <div class="cc-challenge-cta-hint">
            {{ armed && !sending ? "Zwei-Klick-Schutz: nochmal klicken sendet die echte Einladung." : `Erstellt eine private Lobby und lädt Du → ${friend.name ?? "Freund"} ein.` }}
          </div>
        </div>
      </div>
    </template>

    <div v-else class="cc-challenge-result">
      <template v-if="result?.ok">
        <div class="cc-challenge-result-icon">✓</div>
        <div class="cc-challenge-result-title">Herausforderung gesendet</div>
        <div class="cc-challenge-result-text">Einladung an <b>{{ friend.name ?? "diesen Freund" }}</b> wurde gesendet.</div>
      </template>
      <template v-else>
        <div class="cc-challenge-result-icon">✕</div>
        <div class="cc-challenge-result-title">Herausforderung fehlgeschlagen</div>
        <div class="cc-challenge-result-text">{{ result?.text ?? "Unbekannter Fehler." }}</div>
      </template>
      <div class="cc-challenge-result-actions">
        <button v-if="!result?.ok" class="cc-btn is-primary" type="button" data-testid="cc-challenge-retry" @click="retry">
          <span class="icon-[pixelarticons--reload]" /><span>Erneut versuchen</span>
        </button>
        <button class="cc-btn" type="button" data-testid="cc-challenge-reset" @click="$emit('reset')">
          <span>Anderen Freund wählen</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import CcPlayerBadge from "./CcPlayerBadge.vue";
import { DEFAULT_LOBBY_SETTINGS, type IFriendResolved } from "@/utils/friends-api";

export interface IChallengeResult {
  ok: boolean;
  text: string;
  friendId: string;
}

const props = defineProps<{
  friend: IFriendResolved | null;
  sending: boolean;
  result: IChallengeResult | null;
}>();

const emit = defineEmits<{
  (e: "send", friend: IFriendResolved): void;
  (e: "reset"): void;
}>();

const x01 = DEFAULT_LOBBY_SETTINGS.x01Settings!;
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Zwei-Klick-Schutz: erster Klick bewaffnet nur, zweiter sendet wirklich. */
const armed = ref(false);

/**
 * Lokale Kopie des Ergebnisses: "Erneut versuchen" muss zurück zum Setup-Screen
 * können, ohne das Eltern-Prop zu mutieren — das Elternteil überschreibt sie
 * ohnehin bei jedem echten neuen Sendeversuch.
 */
const localResult = ref<IChallengeResult | null>(props.result);
watch(() => props.result, (value) => { localResult.value = value; });
watch(() => props.friend?.id, () => { armed.value = false; });

/** Ergebnis nur zeigen, wenn es tatsächlich zum aktuell gewählten Freund gehört. */
const showResult = computed(() => localResult.value !== null && localResult.value.friendId === props.friend?.id);

function onSendClick(): void {
  if (!props.friend || props.sending) return;
  if (!armed.value) {
    armed.value = true;
    return;
  }
  armed.value = false;
  emit("send", props.friend);
}

function retry(): void {
  localResult.value = null;
  armed.value = false;
}
</script>
