<template>
  <router-link :to="`/video/${video.id}`" class="video-card-link">
    <div class="video-card">
      <div class="thumbnail-container">
        <img
          :src="video.thumbnail"
          :alt="video.title"
          loading="lazy"
          class="video-thumbnail"
        />
        
        <div v-if="progress > 0.05 && progress < 0.95" class="progress-bar-overlay">
          <div class="progress-fill" :style="{ width: `${progress * 100}%` }" />
        </div>
        
        <span v-if="isWatched" class="watched-badge">✓ Gesehen</span>
        <span class="video-duration">{{ formatDuration(video.duration) }}</span>
      </div>
      
      <div class="video-info">
        <h3 class="video-title">{{ video.title }}</h3>
        <p class="video-category">{{ video.category }}</p>
        <span v-if="progress > 0.05" class="progress-text">
          {{ Math.round(progress * 100) }}% angesehen
        </span>
      </div>
    </div>
  </router-link>
</template>

<script setup>
import { computed } from 'vue'
import { useWatchHistory } from '../composables/useStorage'

const props = defineProps({
  video: {
    type: Object,
    required: true
  }
})

const { history } = useWatchHistory()
const progress = computed(() => {
  const item = history.value.find(h => h.id === props.video.id)
  return item?.progress || 0
})

const isWatched = computed(() => progress.value > 0.95)

const formatDuration = (seconds) => {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
@import '../styles/VideoCard.css';
</style>
