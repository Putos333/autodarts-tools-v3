<template>
  <div class="flex items-center overflow-hidden rounded-md border border-white/20">
    <button
      v-for="option in options"
      :key="option.value"
      @click="setLang(option.value)"
      :class="[
        'flex items-center gap-1 px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
        lang === option.value
          ? 'bg-[var(--chakra-colors-borderRed)] text-white'
          : 'bg-transparent text-white/50 hover:bg-white/10 hover:text-white',
      ]"
      :title="option.label"
    >
      <span>{{ option.flag }}</span>
      <span>{{ option.value.toUpperCase() }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from '@/composables/useI18n'
import type { Lang } from '@/composables/useI18n'

const { lang, setLang } = useI18n()

const options: { value: Lang; flag: string; label: string }[] = [
  { value: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { value: 'en', flag: '🇬🇧', label: 'English' },
]
</script>
