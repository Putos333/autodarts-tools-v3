<template>
  <div class="cc-root">
    <CcSidebar
      @navigate="navigate"
      :active="active"
      :version="version"
    />

    <div class="cc-main">
      <CcTopBar :section="section" :version="version" />
      <main class="cc-content">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import CcSidebar from "./CcSidebar.vue";
import CcTopBar from "./CcTopBar.vue";
import type { ICcSection, TCcSectionId } from "./sections";

defineProps<{
  active: TCcSectionId;
  section: ICcSection;
  version: string;
}>();

const emit = defineEmits<{ (e: "navigate", id: TCcSectionId): void }>();

function navigate(id: TCcSectionId): void {
  emit("navigate", id);
}
</script>
