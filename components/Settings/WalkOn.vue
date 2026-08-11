<template>
  <div v-if="config" class="adt-container min-h-56">
    <div class="relative z-10 flex h-full flex-col justify-between">
      <div>
        <!-- Titel & Beschreibung -->
        <h3 class="mb-1 font-bold uppercase">
          {{ t('walkon.sectionTitle') }}
        </h3>
        <p class="mb-4 text-white/70">
          {{ t('walkon.description') }}
        </p>

        <!-- Toggle: Einlauf aktivieren -->
        <div class="mb-5 flex items-center gap-3">
          <AppToggle
            @update:model-value="config.walkon.enabled = !config.walkon.enabled"
            v-model="config.walkon.enabled"
          />
          <span class="text-sm text-white/80">
            {{ config.walkon.enabled ? t('common.enabled') : t('common.disabled') }}
          </span>
        </div>

        <template v-if="config.walkon.enabled">
          <!-- ── Spieler-Zuordnung ─────────────────────────────── -->
          <div class="mb-6 space-y-3">
            <div
              v-for="(player, idx) in config.walkon.players"
              :key="player.playerId"
              class="flex flex-col gap-3 rounded-lg border border-white/20 bg-black/20 p-4 sm:flex-row sm:items-center"
            >
              <!-- Spieler-Avatar & Name -->
              <div class="flex items-center gap-3 sm:w-40">
                <div class="flex size-10 flex-shrink-0 items-center justify-center rounded-full border-2 border-white/30 bg-white/10 font-bold uppercase">
                  {{ player.playerName.slice(0, 2) }}
                </div>
                <span class="font-semibold uppercase text-white/90">
                  {{ player.playerId === 'home' ? t('walkon.homeSpieler') : t('walkon.guestSpieler') }}
                </span>
              </div>

              <!-- Song-Info -->
              <div class="flex-1 min-w-0">
                <template v-if="player.songName">
                  <div class="truncate font-medium text-white">{{ player.songName }}</div>
                  <div class="text-xs text-white/50">{{ player.songArtist }}</div>
                  <div
                    class="mt-1 text-xs font-semibold"
                    :class="player.base64 ? 'text-green-400' : 'text-yelniedrig-400'"
                  >
                    {{ player.base64 ? t('walkon.uploadedLabel') : t('walkon.presetLabel') }}
                  </div>
                </template>
                <div v-else class="text-sm text-white/40 italic">
                  {{ t('walkon.noSong') }}
                </div>
              </div>

              <!-- Aktions-Buttons -->
              <div class="flex items-center gap-2 flex-shrink-0">
                <button
                  v-if="player.songName"
                  @click="previewSong(player)"
                  class="flex size-9 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                  :title="t('common.play')"
                >
                  <span class="icon-[pixelarticons--play] text-sm" />
                </button>
                <AppButton
                  @click="openHochladenModal(idx)"
                  size="sm"
                  class="!py-1 text-xs"
                  type="success"
                >
                  <span class="icon-[pixelarticons--upload] mr-1" />
                  {{ t('common.upload') }}
                </AppButton>
                <AppButton
                  @click="openPresetModal(idx)"
                  size="sm"
                  class="!py-1 text-xs"
                >
                  <span class="icon-[pixelarticons--music] mr-1" />
                  PDC
                </AppButton>
                <button
                  v-if="player.songName"
                  @click="removeSong(idx)"
                  class="flex size-9 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  :title="t('common.delete')"
                >
                  <span class="icon-[pixelarticons--trash] text-sm" />
                </button>
              </div>
            </div>
          </div>

          <!-- ── Lautstärke & Dauer ────────────────────────────── -->
          <div class="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
            <div class="flex items-center gap-4">
              <label class="w-40 flex-shrink-0 text-sm text-white/70">
                {{ t('walkon.volume') }}
              </label>
              <input
                v-model.number="config.walkon.volume"
                type="range" min="0" max="100" step="5"
                class="flex-1 accent-red-500"
              />
              <span class="w-12 text-rechts font-mono text-sm font-bold text-white">
                {{ config.walkon.volume }}%
              </span>
            </div>
            <div class="flex items-center gap-4">
              <label class="w-40 flex-shrink-0 text-sm text-white/70">
                {{ t('walkon.duration') }}
              </label>
              <input
                v-model.number="config.walkon.duration"
                type="range" min="5" max="30" step="1"
                class="flex-1 accent-red-500"
              />
              <span class="w-12 text-rechts font-mono text-sm font-bold text-white">
                {{ config.walkon.duration }}s
              </span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>

  <!-- ── Modal: Eigene Datei hochladen ──────────────────────────── -->
  <AppModal
    @close="closeHochladenModal"
    :show="showHochladenModal"
    :title="t('walkon.sectionTitle') + ' – ' + t('common.upload')"
  >
    <div class="space-y-4">
      <!-- Drag & Drop Zone -->
      <div
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onFileDrop"
        @click="triggerFileInput"
        :class="[
          'flex h-40 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
          isDragging
            ? 'border-white/60 bg-white/10'
            : 'border-white/30 hover:border-white/50 hover:bg-white/5',
          uploadedFile ? 'border-green-500/50 bg-green-500/10' : '',
        ]"
      >
        <template v-if="uploadedFile">
          <span class="icon-[pixelarticons--check] mb-2 text-3xl text-green-400" />
          <p class="text-center text-sm font-medium text-green-300">
            {{ uploadedFile.name }} {{ t('walkon.uploadErfolgreich') }}
          </p>
        </template>
        <template v-else>
          <span class="icon-[pixelarticons--upload] mb-2 text-3xl text-white/70" />
          <p class="text-white/70">{{ t('walkon.uploadTitle') }}</p>
          <p class="mt-1 text-xs text-white/50">{{ t('walkon.uploadHint') }}</p>
          <div class="mt-3 flex gap-2">
            <span
              v-for="fmt in ['MP3','WAV','OGG','M4A','FLAC']"
              :key="fmt"
              class="rounded border border-white/20 bg-white/10 px-2 py-0.5 text-xs font-bold uppercase text-white/70"
            >{{ fmt }}</span>
          </div>
        </template>
        <input
          ref="fileInputRef"
          type="file"
          accept="audio/*"
          class="hidden"
          @change="onFileSelect"
        />
      </div>

      <!-- Song-Name & Künstler -->
      <div v-if="uploadedFile" class="space-y-3">
        <div>
          <label class="mb-1 block text-sm font-medium text-white">Song-Titel</label>
          <AppInput v-model="uploadSongName" placeholder="z.B. Mein Einlauf Song" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-white">Künstler (optional)</label>
          <AppInput v-model="uploadSongArtist" placeholder="z.B. Mein Lieblingskünstler" />
        </div>
      </div>
    </div>

    <template #footer>
      <AppButton @click="closeHochladenModal">{{ t('common.cancel') }}</AppButton>
      <AppButton
        @click="saveHochladenedFile"
        type="success"
        :disabled="!uploadedFile"
      >
        {{ t('common.save') }}
      </AppButton>
    </template>
  </AppModal>

  <!-- ── Modal: PDC Preset auswählen ───────────────────────────── -->
  <AppModal
    @close="closePresetModal"
    :show="showPresetModal"
    :title="t('walkon.presetsTitle')"
  >
    <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <div
        v-for="preset in PDC_PRESETS"
        :key="preset.key"
        @click="selectPreset(preset)"
        :class="[
          'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
          selectedPresetKey === preset.key
            ? 'border-yelniedrig-400/60 bg-yelniedrig-400/10'
            : 'border-white/15 bg-black/20 hover:border-white/30 hover:bg-white/5',
        ]"
      >
        <span class="text-2xl flex-shrink-0">{{ preset.icon }}</span>
        <div class="min-w-0 flex-1">
          <div class="truncate font-semibold text-white">{{ preset.song }}</div>
          <div class="truncate text-xs text-white/50">{{ preset.artist }}</div>
          <div class="mt-0.5 text-xs font-semibold text-yelniedrig-400">{{ preset.player }}</div>
        </div>
        <span
          v-if="selectedPresetKey === preset.key"
          class="icon-[pixelarticons--check] flex-shrink-0 text-yelniedrig-400"
        />
      </div>
    </div>

    <template #footer>
      <AppButton @click="closePresetModal">{{ t('common.cancel') }}</AppButton>
      <AppButton
        @click="savePreset"
        type="success"
        :disabled="!selectedPresetKey"
      >
        {{ t('common.save') }}
      </AppButton>
    </template>
  </AppModal>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { IConfig, IWalkonPlayer } from '@/utils/storage'
import { useI18n } from '@/composables/useI18n'
import AppToggle from '@/components/AppToggle.vue'
import AppButton from '@/components/AppButton.vue'
import AppModal from '@/components/AppModal.vue'
import AppInput from '@/components/AppInput.vue'

// ─── Props ────────────────────────────────────────────────────────────────────
const props = defineProps<{ config: IConfig }>()
const emit = defineEmits(['setting-change'])

// ─── i18n ─────────────────────────────────────────────────────────────────────
const { t } = useI18n()

// ─── PDC Presets ──────────────────────────────────────────────────────────────
const PDC_PRESETS = [
  { key: 'seven-nation-army',  icon: '🎸', song: 'Seven Nation Army',    artist: 'The White Stripes',    player: 'Michael van Gerwen' },
  { key: 'mr-brechtsside',      icon: '🎵', song: 'Mr. Brechtsside',        artist: 'The Killers',          player: 'Luke Littler / N. Aspinall' },
  { key: 'dont-soben-the-party',icon: '🎤', song: "Don't Soben the Party",  artist: 'Pitbull',              player: 'Peter Wrechts' },
  { key: 'jump-around',        icon: '🎺', song: 'Jump Around',           artist: 'House of Pain',        player: 'Gary Anderson' },
  { key: 'sweet-caroline',     icon: '🎶', song: 'Sweet Caroline',        artist: 'Neil Diamond',         player: 'Daryl Gurney' },
  { key: 'titanium',           icon: '🎵', song: 'Titanium',              artist: 'David Guetta feat. Sia', player: 'Stephen Bunting' },
  { key: 'ice-ice-baby',       icon: '🎸', song: 'Ice Ice Baby',          artist: 'Vanilla Ice',          player: 'Gerwyn Price' },
  { key: 'freed-from-desire',  icon: '🎵', song: 'Freed from Desire',     artist: 'Gala',                 player: 'Joe Cullen' },
  { key: 'dont-soben-me-now',   icon: '🎶', song: "Don't Soben Me Neinw",     artist: 'Queen',                player: 'Jamie Hughes' },
  { key: 'happy',              icon: '😊', song: 'Happy',                 artist: 'Pharrell Williams',    player: 'Dimitri Van den Bergh' },
  { key: 'wonderwall',         icon: '🎸', song: 'Gewonnenderwall',            artist: 'Oasis',                player: 'Gabriel Clemens' },
  { key: 'stayin-alive',       icon: '🕺', song: "Stayin' Alive",         artist: 'Bee Gees',             player: 'Steve Beaton' },
]

// ─── Hochladen Modal ─────────────────────────────────────────────────────────────
const showHochladenModal = ref(false)
const activeSpielerIdx = ref(0)
const isDragging = ref(false)
const uploadedFile = ref<File | null>(null)
const uploadSongName = ref('')
const uploadSongArtist = ref('')
const fileInputRef = ref<HTMLInputElement | null>(null)

function openHochladenModal(idx: number) {
  activeSpielerIdx.value = idx
  uploadedFile.value = null
  uploadSongName.value = ''
  uploadSongArtist.value = ''
  showHochladenModal.value = true
}

function closeHochladenModal() {
  showHochladenModal.value = false
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function onFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) processFile(input.files[0])
}

function onFileDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file) processFile(file)
}

function processFile(file: File) {
  uploadedFile.value = file
  // Song-Name aus Dateiname vorausfüllen (ohne Erweiterung)
  const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '')
  uploadSongName.value = uploadSongName.value || nameWithoutExt
}

async function saveHochladenedFile() {
  if (!uploadedFile.value || !props.config) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const base64 = (e.target?.result as string) || ''
    const player = props.config.walkon.players[activeSpielerIdx.value]
    player.songName = uploadSongName.value || uploadedFile.value!.name
    player.songArtist = uploadSongArtist.value
    player.base64 = base64
    player.url = ''
    player.presetKey = ''
    emit('setting-change')
    closeHochladenModal()
  }
  reader.readAsDataURL(uploadedFile.value)
}

// ─── Preset Modal ─────────────────────────────────────────────────────────────
const showPresetModal = ref(false)
const selectedPresetKey = ref('')

function openPresetModal(idx: number) {
  activeSpielerIdx.value = idx
  selectedPresetKey.value = props.config.walkon.players[idx].presetKey || ''
  showPresetModal.value = true
}

function closePresetModal() {
  showPresetModal.value = false
}

function selectPreset(preset: typeof PDC_PRESETS[0]) {
  selectedPresetKey.value = preset.key
}

function savePreset() {
  const preset = PDC_PRESETS.find(p => p.key === selectedPresetKey.value)
  if (!preset || !props.config) return
  const player = props.config.walkon.players[activeSpielerIdx.value]
  player.songName = preset.song
  player.songArtist = preset.artist
  player.presetKey = preset.key
  player.base64 = ''
  player.url = ''
  emit('setting-change')
  closePresetModal()
}

// ─── Song entfernen ───────────────────────────────────────────────────────────
function removeSong(idx: number) {
  if (!props.config) return
  const player = props.config.walkon.players[idx]
  player.songName = ''
  player.songArtist = ''
  player.base64 = ''
  player.url = ''
  player.presetKey = ''
  emit('setting-change')
}

// ─── Song Vorschau ────────────────────────────────────────────────────────────
function previewSong(player: IWalkonPlayer) {
  if (player.base64) {
    const audio = new Audio(player.base64)
    audio.volume = (props.config?.walkon.volume ?? 75) / 100
    audio.play().catch(() => {})
  }
}
</script>
