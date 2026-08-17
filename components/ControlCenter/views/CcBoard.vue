<template>
  <CcPreviewSection
    :section="getCcSection('board')"
    :items="[
      'Board-Verbindung und Autoscoring-Zustand im Detail',
      'Externe Boards verwalten (bereits vorhanden: Einstellungen › Boards)',
      'Kalibrierungs-Server und Board-Diagnose',
      'Board-Themes und Take-out-Verhalten',
    ]"
  />
</template>

<script setup lang="ts">
import CcPreviewSection from "../CcPreviewSection.vue";
import { getCcSection } from "../sections";
</script>
