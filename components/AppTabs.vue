<template>
  <div class="tabs-container w-full overflow-y-auto pt-3">
    <div class="flex w-full flex-row items-center gap-1">
      <button
        @click="updateActiveTab(index)"
        v-for="(tab, index) in tabs"
        :key="index"
        :class="twMerge(
          'flex-1 whitespace-nowrap rounded-md border-b-2 border-transparent bg-[var(--chakra-colors-whiteAlpha-200)] px-6 py-4 text-center font-semibold transition-colors duration-200',
          activeTab === index
            ? 'active-tab border-blue-400 bg-[var(--chakra-colors-whiteAlpha-300)] text-white'
            : 'inactive-tab text-white/70 hover:bg-[var(--chakra-colors-whiteAlpha-300)]',
        )"
      >
        {{ tab }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { twMerge } from "tailwind-merge";

const props = defineProps<{
  tabs: string[];
  modelValue: number;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: number): void;
}>();

const activeTab = computed(() => props.modelValue);

function updateActiveTab(index: number) {
  emit("update:modelValue", index);
}
</script>

<style scoped>
/* Tabs styling */
.tabs-container {
  --chakra-colors-blue-400: #4299e1;
  --chakra-colors-whiteAlpha-200: rgba(255, 255, 255, 0.08);
  --chakra-colors-whiteAlpha-300: rgba(255, 255, 255, 0.16);
  --chakra-radii-md: 0.375rem;
  --chakra-fontWeights-semibold: 600;
  --chakra-transition-duration-normal: 200ms;
}

.tabs-container .active-tab {
  border-color: var(--chakra-colors-blue-400);
  color: var(--chakra-colors-white, #FFFFFF);
  position: relative;
}

.tabs-container .inactive-tab {
  color: rgba(255, 255, 255, 0.7);
  transition: background-color var(--chakra-transition-duration-normal);
}
</style>
