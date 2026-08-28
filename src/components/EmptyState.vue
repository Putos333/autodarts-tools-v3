<template>
  <div class="empty-state">
    <div class="empty-state-icon">{{ config.icon }}</div>
    <h3 class="empty-state-title">{{ config.title }}</h3>
    <p class="empty-state-message">{{ message || config.message }}</p>
    <button v-if="actionText || config.action" class="empty-state-action" @click="handleAction">
      {{ actionText || config.action }}
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  type: {
    type: String,
    default: 'default'
  },
  message: String,
  actionText: String,
  onAction: Function
})

const router = useRouter()

const configs = {
  search: {
    icon: '🔍',
    title: 'Keine Ergebnisse',
    message: 'Versuche es mit einem anderen Suchbegriff',
    action: 'Zurück zur Startseite',
    actionFn: () => router.push('/')
  },
  favorites: {
    icon: '❤️',
    title: 'Keine Favoriten',
    message: 'Füge Videos zu deinen Favoriten hinzu',
    action: 'Videos entdecken',
    actionFn: () => router.push('/')
  },
  watchlist: {
    icon: '📋',
    title: 'Watchlist ist leer',
    message: 'Speichere Videos für später',
    action: 'Videos durchstöbern',
    actionFn: () => router.push('/')
  },
  history: {
    icon: '🕒',
    title: 'Kein Verlauf',
    message: 'Deine angesehenen Videos werden hier angezeigt',
    action: 'Starte jetzt',
    actionFn: () => router.push('/')
  },
  default: {
    icon: '📺',
    title: 'Nichts zu sehen',
    message: 'Hier gibt es noch keine Inhalte',
    action: 'Zurück',
    actionFn: () => router.go(-1)
  }
}

const config = computed(() => configs[props.type] || configs.default)

const handleAction = () => {
  if (props.onAction) {
    props.onAction()
  } else {
    config.value.actionFn()
  }
}
</script>

<style scoped>
@import '../styles/EmptyState.css';
</style>
