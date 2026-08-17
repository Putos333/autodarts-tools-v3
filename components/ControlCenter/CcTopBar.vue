<template>
  <header class="cc-topbar" data-testid="cc-topbar">
    <div class="cc-topbar-title">
      <div class="cc-topbar-crumb">
        <span>Control Center</span>
        <span class="cc-topbar-crumb-sep">›</span>
        <span class="cc-topbar-crumb-current">{{ section.label }}</span>
        <span class="cc-topbar-version" :title="`Erweiterungsversion ${version}`">v{{ version }}</span>
      </div>
      <h1 class="cc-topbar-heading">{{ section.label }}</h1>
      <p class="cc-topbar-hint">{{ section.hint }}</p>
    </div>

    <div class="cc-topbar-status">
      <!-- Live-/Staleness-Status; Semantik unverändert aus MVP 1 -->
      <CcStatusPill
        :label="connectionLabel"
        :tone="connectionTone"
        :meta="lastSignalAgo"
        :title="connectionHint"
      />
      <CcStatusPill
        :label="backendLabel"
        :tone="backendTone"
        :title="backendUrl"
      />
      <button
        @click="refresh()"
        class="cc-btn"
        :disabled="isRefreshing"
        type="button"
        data-testid="cc-refresh"
      >
        <span class="icon-[pixelarticons--reload]" :class="isRefreshing && 'animate-spin'" />
        <span>{{ isRefreshing ? "Lädt" : "Aktualisieren" }}</span>
      </button>
      <button
        @click="openAutodarts()"
        class="cc-btn is-primary"
        type="button"
        title="Öffnet play.autodarts.io in einem neuen Tab"
        data-testid="cc-open-autodarts"
      >
        <span class="icon-[pixelarticons--external-link]" />
        <span>Autodarts öffnen</span>
      </button>
      <button
        @click="openClassicSettings()"
        class="cc-btn"
        type="button"
        title="Öffnet play.autodarts.io/tools in einem neuen Tab"
        data-testid="cc-open-classic"
      >
        <span class="icon-[pixelarticons--sliders]" />
        <span>Klassische Ansicht</span>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import CcStatusPill from "./CcStatusPill.vue";
import type { ICcSection } from "./sections";
import { openAutodarts, openClassicSettings } from "./open-autodarts";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

defineProps<{
  section: ICcSection;
  version: string;
}>();

// Der Composable ist ein per Refcount geteilter Singleton — Top-Bar und
// Dashboard sehen dieselben Daten, ohne dass Watcher doppelt registriert werden.
const {
  connectionLabel,
  connectionTone,
  connectionHint,
  lastSignalAgo,
  backendLabel,
  backendTone,
  backendUrl,
  isRefreshing,
  refresh,
} = useControlCenterStatus();
</script>
