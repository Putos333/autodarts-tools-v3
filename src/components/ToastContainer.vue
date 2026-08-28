<template>
  <div class="toast-container">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="['toast', `toast-${toast.type}`]"
    >
      <div class="toast-content">
        {{ getIcon(toast.type) }} {{ toast.message }}
      </div>
      <button class="toast-close" @click="removeToast(toast.id)">
        ✕
      </button>
      <div
        class="toast-progress"
        :style="{ animationDuration: `${toast.duration}ms` }"
      />
    </div>
  </div>
</template>

<script setup>
import { useToast } from '../composables/useToast'

const { toasts, removeToast } = useToast()

const getIcon = (type) => {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }
  return icons[type] || ''
}
</script>

<style scoped>
@import '../styles/Toast.css';
</style>
