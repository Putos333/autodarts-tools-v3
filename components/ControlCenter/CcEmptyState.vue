<template>
  <div class="cc-empty">
    <span class="cc-empty-icon">
      <span :class="icon" />
    </span>
    <p class="cc-empty-title">{{ title }}</p>
    <p v-if="text" class="cc-empty-text">{{ text }}</p>
    <div v-if="$slots.action" class="cc-btn-row" style="margin-top: 4px;">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  text?: string | null;
  icon?: string;
}>(), {
  icon: "icon-[pixelarticons--info-box]",
});
</script>
