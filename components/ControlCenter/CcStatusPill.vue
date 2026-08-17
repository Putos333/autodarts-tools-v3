<template>
  <span :class="[ 'cc-pill', `cc-tone-${tone}` ]" :title="title">
    <span class="cc-pill-led" />
    <span class="cc-pill-label">{{ label }}</span>
    <span v-if="meta" class="cc-pill-meta">· {{ meta }}</span>
  </span>
</template>

<script setup lang="ts">
import type { TTone } from "@/composables/useControlCenterStatus";

withDefaults(defineProps<{
  label: string;
  tone?: TTone;
  meta?: string | null;
  title?: string;
}>(), {
  tone: "idle",
});
</script>
