<template>
  <aside class="cc-sidebar" data-testid="cc-sidebar">
    <div class="cc-brand">
      <span class="cc-brand-mark">🎯</span>
      <div class="cc-brand-text">
        <div class="cc-brand-title">Control Center</div>
        <div class="cc-brand-sub">Autodarts Tools v{{ version }}</div>
      </div>
    </div>

    <nav class="cc-nav" aria-label="Control-Center-Bereiche">
      <button
        @click="$emit('navigate', section.id)"
        v-for="section in sections"
        :key="section.id"
        :class="[ 'cc-nav-item', section.id === active && 'is-active' ]"
        :aria-current="section.id === active ? 'page' : undefined"
        :title="section.label"
        :data-testid="`cc-nav-${section.id}`"
        type="button"
      >
        <span class="cc-nav-icon"><span :class="section.icon" /></span>
        <span class="cc-nav-label">{{ section.label }}</span>
        <span v-if="section.preview" class="cc-nav-badge">bald</span>
      </button>
    </nav>

    <!-- Live-Match-Widget: erscheint nur bei echten Matchdaten -->
    <CcLiveMatchWidget />

    <div class="cc-sidebar-foot">
      Die klassische Einstellungsansicht bleibt unverändert erreichbar.
    </div>
  </aside>

  <!--
    Mobile Navigation (#8): dieselbe Section-Liste, dasselbe Emit — nur als
    fixierte Leiste unten statt Icon-Rail. Reine CSS-Sichtbarkeitsumschaltung
    (siehe .cc-bottom-nav / .cc-sidebar in style.css, @media max-width:640px),
    exakt dasselbe Muster wie .cc-live-widget/.cc-live-rail in
    CcLiveMatchWidget.vue. Kein zweiter Navigations-Zustand, keine zweite
    Datenquelle — beide Listen lesen `active`/`sections` und emittieren
    dasselbe "navigate".
  -->
  <nav class="cc-bottom-nav" aria-label="Control-Center-Bereiche (mobil)">
    <!--
      Code-Review-Fund (#8): .cc-sidebar wird bei max-width:640px vollständig
      ausgeblendet — damit verschwand das einzige Live-Match-Widget (nur dort
      gerendert) ersatzlos, obwohl es bis 1080px (Icon-Rail) durchgehend
      sichtbar war. Dieselbe Komponente hier ein zweites Mal zu montieren ist
      sicher: useControlCenterStatus() ist ein Refcount-Singleton (siehe
      composables/useControlCenterStatus.ts), keine zweiten Watcher, keine
      neue Datenquelle. .cc-live-rail greift automatisch — dieselbe Regel
      (@media max-width:1080px) ist bei ≤640px ohnehin schon aktiv.
    -->
    <div class="cc-bottom-nav-live"><CcLiveMatchWidget id-suffix="-mobile" /></div>
    <button
      @click="$emit('navigate', section.id)"
      v-for="section in sections"
      :key="section.id"
      :class="[ 'cc-bottom-nav-item', section.id === active && 'is-active' ]"
      :aria-current="section.id === active ? 'page' : undefined"
      :title="section.label"
      :data-testid="`cc-bottom-nav-${section.id}`"
      type="button"
    >
      <span class="cc-bottom-nav-icon">
        <span :class="section.icon" />
        <span v-if="section.preview" class="cc-bottom-nav-badge" aria-hidden="true" />
      </span>
      <span class="cc-bottom-nav-label">{{ section.shortLabel ?? section.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import CcLiveMatchWidget from "./CcLiveMatchWidget.vue";
import { CC_SECTIONS, type TCcSectionId } from "./sections";

defineProps<{
  active: TCcSectionId;
  version: string;
}>();

defineEmits<{ (e: "navigate", id: TCcSectionId): void }>();

const sections = CC_SECTIONS;
</script>
