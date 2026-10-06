<template>
  <header class="cc-topbar" data-testid="cc-topbar">
    <div class="cc-topbar-title">
      <div class="cc-topbar-crumb">
        <span>Control Center</span>
        <span class="cc-topbar-crumb-sep">›</span>
        <span class="cc-topbar-crumb-current">{{ section.label }}</span>
        <span class="cc-topbar-version" :title="`Erweiterungsversion ${version}`">v{{ version }}</span>
      </div>
      <!-- tabindex="-1": Ziel des Fokus-Managements beim Bereichswechsel (CcShell), nicht Teil der Tab-Reihenfolge. -->
      <h1
        ref="heading"
        class="cc-topbar-heading"
        tabindex="-1"
        data-testid="cc-heading"
      >
        {{ section.label }}
      </h1>
      <p class="cc-topbar-hint">{{ section.hint }}</p>
    </div>

    <!-- Ein gemeinsamer Container, damit Status und Aktionen beim Umbruch wie ein Block neben/unter dem Titel wandern. -->
    <div class="cc-topbar-controls">
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
      </div>

      <!--
        Aktionen: Auf Phones (max-width:640px) werden die beiden Nebenaktionen zu Icon-Buttons. Das Label
        bleibt im DOM und wird nur visuell versteckt (kein aria-label) — sichtbarer und zugänglicher Name
        sind damit per Konstruktion identisch (WCAG 2.5.3), siehe .cc-btn-compact in style.css.
      -->
      <div class="cc-topbar-actions">
        <button
          @click="refresh()"
          class="cc-btn cc-btn-compact"
          :disabled="isRefreshing"
          type="button"
          data-testid="cc-refresh"
        >
          <span class="icon-[pixelarticons--reload]" :class="isRefreshing && 'animate-spin'" aria-hidden="true" />
          <span class="cc-btn-label">{{ isRefreshing ? "Lädt" : "Aktualisieren" }}</span>
        </button>
        <button
          @click="openAutodarts()"
          class="cc-btn is-primary"
          type="button"
          title="Öffnet play.autodarts.io in einem neuen Tab"
          data-testid="cc-open-autodarts"
        >
          <span class="icon-[pixelarticons--external-link]" aria-hidden="true" />
          <span class="cc-btn-label">Autodarts öffnen</span>
        </button>
        <button
          @click="openClassicSettings()"
          class="cc-btn cc-btn-compact"
          type="button"
          title="Öffnet play.autodarts.io/tools in einem neuen Tab"
          data-testid="cc-open-classic"
        >
          <span class="icon-[pixelarticons--sliders]" aria-hidden="true" />
          <span class="cc-btn-label">Klassische Ansicht</span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from "vue";

import CcStatusPill from "./CcStatusPill.vue";
import type { ICcSection } from "./sections";
import { openAutodarts, openClassicSettings } from "./open-autodarts";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

defineProps<{
  section: ICcSection;
  version: string;
}>();

const heading = ref<HTMLElement | null>(null);

/** Fokus-Ziel beim Bereichswechsel (aufgerufen von CcShell). */
function focusHeading(): void {
  heading.value?.focus();
}

defineExpose({ focusHeading });

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
