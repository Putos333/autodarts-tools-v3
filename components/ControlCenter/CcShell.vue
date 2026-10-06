<template>
  <div class="cc-root">
    <!--
      Skip-Link (UI-2A): erstes fokussierbares Element der Seite. Bewusst KEIN
      Hash-Sprung auf #cc-content — das Control Center routet über
      `location.hash` (siehe ControlCenter.vue::readHash), ein fremder Hash
      würde den Bereich auf den Standardbereich zurücksetzen. Daher
      preventDefault und programmatischer Fokus auf <main>.
    -->
    <a
      @click.prevent="focusContent"
      class="cc-skip-link"
      href="#cc-content"
      data-testid="cc-skip-link"
    >
      Zum Inhalt springen
    </a>

    <CcSidebar
      @navigate="navigate"
      :active="active"
      :version="version"
    />

    <div class="cc-main">
      <CcTopBar ref="topBar" :section="section" :version="version" />
      <main
        id="cc-content"
        ref="content"
        class="cc-content"
        tabindex="-1"
        data-testid="cc-content"
      >
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

import CcSidebar from "./CcSidebar.vue";
import CcTopBar from "./CcTopBar.vue";
import type { ICcSection, TCcSectionId } from "./sections";

const props = defineProps<{
  active: TCcSectionId;
  section: ICcSection;
  version: string;
}>();

const emit = defineEmits<{ (e: "navigate", id: TCcSectionId): void }>();

const topBar = ref<InstanceType<typeof CcTopBar> | null>(null);
const content = ref<HTMLElement | null>(null);

function navigate(id: TCcSectionId): void {
  emit("navigate", id);
}

function focusContent(): void {
  content.value?.focus();
}

/**
 * Fokus-Management beim Bereichswechsel: Die Ansicht wird ausgetauscht, ohne dass der Browser
 * navigiert — ohne Fokus-Übergabe bliebe der Fokus auf dem (weiterhin vorhandenen) Navigationseintrag
 * und Screenreader-Nutzer bekämen keinen Hinweis auf den neuen Inhalt. Der Fokus wandert deshalb auf
 * die Hauptüberschrift. Nicht beim Erstladen: `ControlCenter.vue` setzt den Bereich aus dem URL-Hash
 * erst in seinem eigenen `onMounted` (nach dem unseres), dieser Wechsel ist keine Nutzeraktion.
 */
let ready = false;
let readyTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  readyTimer = setTimeout(() => { ready = true; }, 0);
});

onBeforeUnmount(() => {
  clearTimeout(readyTimer);
});

watch(() => props.section.id, async () => {
  if (!ready) return;
  await nextTick();
  topBar.value?.focusHeading();
});
</script>
