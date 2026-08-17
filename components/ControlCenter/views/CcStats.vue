<template>
  <CcPreviewSection
    :section="getCcSection('stats')"
    :items="[
      'Match-History aus den gespeicherten kanonischen Ergebnissen (nur lesend)',
      'Precision Map: Heatmap und Trefferbild',
      'Liga-Tabelle und Head-to-Head',
      'Karriere-Verlauf und CSV-Export',
    ]"
  />
</template>

<script setup lang="ts">
import CcPreviewSection from "../CcPreviewSection.vue";
import { getCcSection } from "../sections";
</script>
