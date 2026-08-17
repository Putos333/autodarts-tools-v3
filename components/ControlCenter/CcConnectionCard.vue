<template>
  <CcCard
    title="Verbindung"
    subtitle="Datenkanäle der Erweiterung"
    icon="icon-[pixelarticons--wifi]"
    data-testid="cc-card-connection"
  >
    <template #status>
      <CcStatusPill
        :label="connectionLabel"
        :tone="connectionTone"
        :meta="lastSignalAgo"
        :title="connectionHint"
        class="is-sm"
      />
    </template>

    <!-- Kompakt: eine Zeile pro Kanal -->
    <div class="cc-kv" style="grid-template-columns: minmax(0, 1fr) auto; gap: 10px 12px;">
      <div>
        <div class="cc-kv-val" style="font-weight: 700;">Autodarts WebSocket</div>
        <div class="cc-note" style="font-size: 11px;">
          {{ openSockets !== null ? `${openSockets} offene Sockets` : "Anzahl Sockets unbekannt" }}
        </div>
      </div>
      <CcStatusPill :label="connectionLabel" :tone="connectionTone" class="is-sm" />

      <div>
        <div class="cc-kv-val" style="font-weight: 700;">Tools Backend</div>
        <div class="cc-note" style="font-size: 11px;">{{ backendUrl || "Adresse wird geladen …" }}</div>
      </div>
      <CcStatusPill :label="backendShortLabel" :tone="backendTone" :meta="latencyMeta" class="is-sm" />

      <div>
        <div class="cc-kv-val" style="font-weight: 700;">Autodarts Auth</div>
        <div class="cc-note" style="font-size: 11px;">{{ authHint }}</div>
      </div>
      <CcStatusPill :label="authLabel" :tone="authTone" :meta="authAgo" class="is-sm" />
    </div>

    <div v-if="connectionInfo" class="cc-kv" style="margin-top: 12px;">
      <span class="cc-kv-key">Meldung</span>
      <span class="cc-kv-val">{{ connectionInfo }}</span>
    </div>

    <template #footer>
      Letzte Meldung: {{ lastSignalAgo ?? "noch keine" }} · Ein fehlendes oder altes Signal
      bedeutet nicht „getrennt", sondern nur, dass gerade kein Autodarts-Tab Daten liefert.
    </template>
  </CcCard>
</template>

<script setup lang="ts">
import { computed } from "vue";

import CcCard from "./CcCard.vue";
import CcStatusPill from "./CcStatusPill.vue";
import { useControlCenterStatus, type TTone } from "@/composables/useControlCenterStatus";

const {
  connectionLabel,
  connectionTone,
  connectionHint,
  connectionInfo,
  lastSignalAgo,
  openSockets,
  authFresh,
  authAgo,
  backendState,
  backendTone,
  backendUrl,
  backendLatencyMs,
} = useControlCenterStatus();

const backendShortLabel = computed(() => {
  switch (backendState.value) {
    case "ok": return "Erreichbar";
    case "error": return "Nicht erreichbar";
    case "checking": return "Prüfe …";
    default: return "Nicht geprüft";
  }
});

const latencyMeta = computed(() => (backendLatencyMs.value !== null ? `${backendLatencyMs.value} ms` : null));

const authLabel = computed(() => {
  if (authFresh.value === null) return "Kein Token";
  return authFresh.value ? "Token frisch" : "Token veraltet";
});

const authTone = computed<TTone>(() => {
  if (authFresh.value === null) return "idle";
  return authFresh.value ? "ok" : "warn";
});

const authHint = computed(() => {
  if (authFresh.value === null) return "Wird beim Besuch von play.autodarts.io erfasst";
  return authFresh.value ? "Autodarts-API-Abfragen möglich" : "Token leben nur wenige Minuten";
});
</script>
