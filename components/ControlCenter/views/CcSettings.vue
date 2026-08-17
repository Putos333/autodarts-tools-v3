<template>
  <CcPreviewSection
    :section="getCcSection('settings')"
    :items="[
      'Sprache (Deutsch / Englisch)',
      'Backup: Einstellungen exportieren und importieren',
      'Setup-Assistent erneut starten',
      'Erweiterte Optionen und Zurücksetzen',
    ]"
  />
</template>

<script setup lang="ts">
import CcPreviewSection from "../CcPreviewSection.vue";
import { getCcSection } from "../sections";
</script>
