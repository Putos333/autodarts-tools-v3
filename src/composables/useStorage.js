import { ref, watch } from 'vue'

export function useStorage(key, initialValue) {
  const stored = localStorage.getItem(key)
  const data = ref(stored ? JSON.parse(stored) : initialValue)
  
  watch(data, (newVal) => {
    localStorage.setItem(key, JSON.stringify(newVal))
  }, { deep: true })
  
  return data
}

export function useFavorites() {
  const favorites = useStorage('favorites', [])
  
  const toggleFavorite = (videoId) => {
    const index = favorites.value.indexOf(videoId)
    if (index > -1) {
      favorites.value.splice(index, 1)
    } else {
      favorites.value.push(videoId)
    }
  }
  
  const isFavorite = (videoId) => favorites.value.includes(videoId)
  
  return { favorites, toggleFavorite, isFavorite }
}

export function useWatchlist() {
  const watchlist = useStorage('watchlist', [])
  
  const addToWatchlist = (videoId) => {
    if (!watchlist.value.includes(videoId)) {
      watchlist.value.push(videoId)
    }
  }
  
  const removeFromWatchlist = (videoId) => {
    const index = watchlist.value.indexOf(videoId)
    if (index > -1) {
      watchlist.value.splice(index, 1)
    }
  }
  
  const isInWatchlist = (videoId) => watchlist.value.includes(videoId)
  
  return { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist }
}

export function useWatchHistory() {
  const history = useStorage('watchHistory', [])
  
  const addToHistory = (videoId, progress = 0) => {
    const filtered = history.value.filter(item => item.id !== videoId)
    history.value = [{ id: videoId, progress, timestamp: Date.now() }, ...filtered]
  }
  
  return { history, addToHistory }
}
