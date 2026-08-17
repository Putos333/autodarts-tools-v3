<template>
  <CcPreviewSection
    :section="getCcSection('lighting')"
    :items="[
      'WLED-Effekte je Wurf, Score und Board-Ereignis',
      'Board-IDs, für die Effekte ausgelöst werden',
      'Effekt-Import per CSV',
      'Erreichbarkeitsprüfung der WLED-Adresse',
    ]"
  />
</template>

<script setup lang="ts">
import CcPreviewSection from "../CcPreviewSection.vue";
import { getCcSection } from "../sections";
</script>
