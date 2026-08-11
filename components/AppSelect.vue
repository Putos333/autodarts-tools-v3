<template>
  <div>
    <label v-if="label" :for="id" class="mb-1 block text-sm font-medium text-white">{{ label }}</label>
    <div class="relative">
      <select
        @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
        :id="id"
        :value="modelValue"
        :disabled="disabled"
        :class="twMerge(
          'w-full appearance-none rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white focus:border-white/40 focus:outline-none',
          disabled && 'cursor-not-allowed opacity-60',
          $attrs.class?.toString(),
        )"
      >
        <option v-for="option in options" :key="option.value" :value="option.value" class="bg-white text-gray-800">
          {{ option.label }}
        </option>
      </select>
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white/60">
        <span class="icon-[pixelarticons--arrow-down]" />
      </div>
    </div>
    <p v-if="helperText" class="mt-1 text-xs text-white/60">
      {{ helperText }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { twMerge } from "tailwind-merge";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(defineProps<{
  modelValue: string;
  options: { value: string; label: string }[];
  label?: string;
  helperText?: string;
  id?: string;
  disabled?: boolean;
}>(), {
  id: `select-${Math.random().toString(36).substring(2, 9)}`,
  disabled: false,
});

defineEmits([ "update:modelValue" ]);
</script>
