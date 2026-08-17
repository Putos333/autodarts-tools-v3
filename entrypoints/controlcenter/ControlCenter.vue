<script setup lang="ts">
/**
 * ControlCenter.vue — Wurzel der eigenen Control-Center-Seite (MVP 1).
 *
 * Navigation ohne zusätzliche Router-Dependency: `location.hash` ist die
 * einzige Quelle der Wahrheit. Ein Klick setzt den Hash, der `hashchange`-
 * Handler setzt daraufhin den Section-State. Damit funktionieren auch
 * Vor/Zurück im Browser und direkt aufgerufene Deep-Links
 * (z.B. controlcenter.html#stats).
 *
 * Die Bereiche werden per `defineAsyncComponent` nachgeladen, damit die Seite
 * schnell erscheint und später eingehängte, große Panels das Startbündel nicht
 * aufblähen.
 */
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, provide, ref } from "vue";

import CcShell from "@/components/ControlCenter/CcShell.vue";
import AppNotification from "@/components/AppNotification.vue";
import { useNotification } from "@/composables/useNotification";
import {
  CC_DEFAULT_SECTION,
  getCcSection,
  isCcSectionId,
  type TCcSectionId,
} from "@/components/ControlCenter/sections";

import packageConfig from "../../package.json";

/** Version kommt aus package.json — keine zweite, driftende Quelle. */
const version = packageConfig.version;

const active = ref<TCcSectionId>(CC_DEFAULT_SECTION);
const section = computed(() => getCcSection(active.value));

const views: Record<TCcSectionId, ReturnType<typeof defineAsyncComponent>> = {
  dashboard: defineAsyncComponent(() => import("@/components/ControlCenter/views/CcDashboard.vue")),
  board: defineAsyncComponent(() => import("@/components/ControlCenter/views/CcBoard.vue")),
  match: defineAsyncComponent(() => import("@/components/ControlCenter/views/CcMatch.vue")),
  training: defineAsyncComponent(() => import("@/components/ControlCenter/views/CcTraining.vue")),
  party: defineAsyncComponent(() => import("@/components/ControlCenter/views/CcParty.vue")),
  sound: defineAsyncComponent(() => import("@/components/ControlCenter/views/CcSound.vue")),
  lighting: defineAsyncComponent(() => import("@/components/ControlCenter/views/CcLighting.vue")),
  stats: defineAsyncComponent(() => import("@/components/ControlCenter/views/CcStats.vue")),
  history: defineAsyncComponent(() => import("@/components/ControlCenter/views/CcHistory.vue")),
  settings: defineAsyncComponent(() => import("@/components/ControlCenter/views/CcSettings.vue")),
};

const currentView = computed(() => views[active.value]);

/* Globale Notification über provide() — alle View-Komponenten (z.B.
   CcExerciseCard) können sie ohne Prop-Drilling auslösen. */
const { notification, showNotification, hideNotification } = useNotification();
provide("cc-notification", showNotification);

function readHash(): TCcSectionId {
  const raw = window.location.hash.replace(/^#/, "").trim();
  return isCcSectionId(raw) ? raw : CC_DEFAULT_SECTION;
}

function applyHash(): void {
  active.value = readHash();
  document.title = `${section.value.label} · Autodarts Tools Control Center`;
}

/** Klick in der Sidebar: nur den Hash setzen, den Rest macht applyHash(). */
function navigate(id: TCcSectionId): void {
  if (window.location.hash.replace(/^#/, "") === id) return;
  window.location.hash = id;
}

onMounted(() => {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!isCcSectionId(raw)) {
    // Ungültiger/leerer Hash → Standardbereich, ohne Verlaufseintrag.
    window.history.replaceState(null, "", `#${CC_DEFAULT_SECTION}`);
  }
  applyHash();
  window.addEventListener("hashchange", applyHash);
});

onBeforeUnmount(() => {
  window.removeEventListener("hashchange", applyHash);
});
</script>

<template>
  <CcShell
    @navigate="navigate"
    :active="active"
    :section="section"
    :version="version"
  >
    <component :is="currentView" :key="active" />
  </CcShell>

  <!-- Global toast notification -->
  <AppNotification
    @close="hideNotification"
    :show="notification.show"
    :message="notification.message"
    :type="notification.type"
  />
</template>
