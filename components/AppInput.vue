<template>
  <div>
    <label v-if="label" :for="id" class="mb-1 block text-sm font-medium text-white">{{ label }}</label>
    <input
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      :id="id"
      :value="modelValue"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :class="twMerge(
        'w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white placeholder:text-white/50 focus:border-white/40 focus:outline-none',
        disabled && 'cursor-not-allowed opacity-60',
        $attrs.class?.toString(),
      )"
    >
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
  label?: string;
  placeholder?: string;
  helperText?: string;
  id?: string;
  type?: string;
  disabled?: boolean;
}>(), {
  placeholder: "",
  id: `input-${Math.random().toString(36).substring(2, 9)}`,
  type: "text",
  disabled: false,
});

defineEmits([ "update:modelValue" ]);
</script>
