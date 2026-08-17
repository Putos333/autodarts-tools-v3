<template>
  <CcPreviewSection
    :section="getCcSection('sound')"
    :items="[
      'Caller mit Voice-Packs, Zufalls-Caller und TTS',
      'Sound-FX mit eigenen Triggern',
      'Crowd & Atmosphäre inklusive Ambient-Lautstärke',
      'Walk-On-Songs, Soundboard und Dart-Aufprall',
      'Sound-Presets (Turnier-Immersion, Chill, Alles aus)',
    ]"
  />
</template>

<script setup lang="ts">
import CcPreviewSection from "../CcPreviewSection.vue";
import { getCcSection } from "../sections";
</script>
