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
