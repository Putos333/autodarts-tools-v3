<template>
  <div class="cc-card" data-testid="cc-party-multi">
    <header class="cc-card-head">
      <span class="cc-card-icon"><span class="icon-[pixelarticons--users]" /></span>
      <div class="cc-card-titles">
        <h2 class="cc-card-title">Party starten</h2>
        <p class="cc-card-sub">Erstellt eine neue private Lobby und lädt mehrere Freunde gleichzeitig ein</p>
      </div>
    </header>

    <div class="cc-card-body">
      <CcEmptyState
        v-if="state !== 'ready'"
        icon="icon-[pixelarticons--contact-multiple]"
        title="Freundesliste wird benötigt"
        text="Lade zuerst deine Freundesliste, um mehrere Freunde gleichzeitig in eine neue Party einzuladen."
      >
        <template #action>
          <button class="cc-btn is-primary" type="button" data-testid="cc-party-multi-load" @click="$emit('load')">
            <span class="icon-[pixelarticons--download]" /><span>Freunde laden</span>
          </button>
        </template>
      </CcEmptyState>

      <CcEmptyState
        v-else-if="online.length === 0"
        icon="icon-[pixelarticons--mood-sad]"
        title="Aktuell niemand online"
        text="Eine Party lässt sich nur mit Online-Freunden starten."
      />

      <template v-else>
        <div class="cc-multi-grid" data-testid="cc-multi-grid">
          <div
            v-for="friend in online"
            :key="friend.id"
            :class="[ 'cc-multi-card', picked.has(friend.id) && 'is-picked' ]"
            :data-testid="`cc-multi-card-${friend.id}`"
            @click="toggle(friend.id)"
          >
            <span class="cc-multi-check">✓</span>
            <CcPlayerBadge :name="friend.name ?? '?'" variant="red" size="sm" />
            <div style="min-width: 0;">
              <div style="font-weight: 700; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ friend.name ?? "Name nicht auflösbar" }}</div>
              <span class="cc-tag is-online">Online</span>
            </div>
          </div>
        </div>

        <div class="cc-multi-actions">
          <div class="cc-multi-count" data-testid="cc-multi-count"><b>{{ picked.size }}</b> ausgewählt</div>
          <button
            class="cc-btn is-primary is-lg"
            type="button"
            :disabled="picked.size === 0 || busy"
            data-testid="cc-multi-start"
            @click="start"
          >
            <span v-if="busy" class="icon-[pixelarticons--loader] animate-spin" />
            <span v-else class="icon-[pixelarticons--users]" />
            <span>{{ busy ? "Erstelle Party …" : "Party starten" }}</span>
          </button>
        </div>

        <p v-if="result" class="cc-note" :style="{ marginTop: '12px', color: result.ok ? 'var(--cc-ok)' : 'var(--cc-bad)' }" data-testid="cc-multi-result">
          {{ result.text }}
        </p>
      </template>
    </div>

    <footer class="cc-card-foot">
      <button class="cc-btn" type="button" data-testid="cc-multi-open-autodarts" @click="openAutodarts(autodartsOrigin)">
        <span class="icon-[pixelarticons--external-link]" /><span>Stattdessen Autodarts öffnen</span>
      </button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import CcEmptyState from "./CcEmptyState.vue";
import CcPlayerBadge from "./CcPlayerBadge.vue";
import { openAutodarts } from "./open-autodarts";
import type { TFriendsState } from "@/composables/useControlCenterFriends";
import type { IFriendResolved } from "@/utils/friends-api";

const props = defineProps<{
  state: TFriendsState;
  online: IFriendResolved[];
  busy: boolean;
  result: { ok: boolean; text: string; invited: string[]; failed: string[] } | null;
  autodartsOrigin: string;
}>();

const emit = defineEmits<{
  (e: "load"): void;
  (e: "start", friendIds: string[]): void;
}>();

const picked = ref<Set<string>>(new Set());

function toggle(id: string): void {
  if (!id) return;
  const next = new Set(picked.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  picked.value = next;
}

function start(): void {
  if (picked.value.size === 0 || props.busy) return;
  emit("start", [ ...picked.value ]);
}
</script>
