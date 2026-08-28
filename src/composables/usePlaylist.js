import { ref, computed } from 'vue'
import { useStorage } from './useStorage'

export function usePlaylist() {
  const playlists = useStorage('playlists', [])
  const currentPlaylist = ref(null)
  
  const createPlaylist = (name, description = '') => {
    const newPlaylist = {
      id: Date.now().toString(),
      name,
      description,
      videos: [],
      createdAt: new Date().toISOString()
    }
    playlists.value.push(newPlaylist)
    return newPlaylist
  }
  
  const deletePlaylist = (playlistId) => {
    const index = playlists.value.findIndex(p => p.id === playlistId)
    if (index > -1) {
      playlists.value.splice(index, 1)
    }
    if (currentPlaylist.value?.id === playlistId) {
      currentPlaylist.value = null
    }
  }
  
  const addToPlaylist = (playlistId, video) => {
    const playlist = playlists.value.find(p => p.id === playlistId)
    if (playlist && !playlist.videos.some(v => v.id === video.id)) {
      playlist.videos.push(video)
    }
  }
  
  const removeFromPlaylist = (playlistId, videoId) => {
    const playlist = playlists.value.find(p => p.id === playlistId)
    if (playlist) {
      const index = playlist.videos.findIndex(v => v.id === videoId)
      if (index > -1) {
        playlist.videos.splice(index, 1)
      }
    }
  }
  
  const getPlaylistVideos = (playlistId) => {
    const playlist = playlists.value.find(p => p.id === playlistId)
    return playlist?.videos || []
  }
  
  return {
    playlists: computed(() => playlists.value),
    currentPlaylist: computed(() => currentPlaylist.value),
    createPlaylist,
    deletePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    getPlaylistVideos
  }
}
