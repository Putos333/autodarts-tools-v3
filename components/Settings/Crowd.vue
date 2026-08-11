<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { AutodartsToolsConfig } from '@/utils/storage'
import {
  BUILTIN_VENUES,
  applyVenue,
  getActiveVenueId,
  getVenue,
  previewVenue,
  setActiveVenue,
  stopVenuePreview,
  type VenueId,
  type VenueProfile,
} from '@/utils/venue'
// v2.9.91 – Board-Theme-System
import {
  BOARD_THEMES,
  BOARD_THEME_MODE_KEY,
  BOARD_THEME_MANUAL_KEY,
  setBoardThemeMode,
  setBoardThemeManual,
  type BoardThemeId,
  type BoardThemeMode,
} from '@/utils/board-themes'

// ─── Crowd-Reaktions-Definitionen ─────────────────────────────────────────────

const CROWD_EVENTS = [
  { key: 'crowd_180',               label: '180!',                   icon: '🎯', desc: 'Eskalierender Jubel + Gesang' },
  { key: 'crowd_140plus',           label: '140+',                   icon: '👏', desc: 'Lauter Applaus' },
  { key: 'crowd_100plus',           label: '100+',                   icon: '👐', desc: 'Applaus' },
  { key: 'crowd_gameshot',          label: 'Game Shot!',             icon: '🏆', desc: 'Jubel beim Leg-Gewinn' },
  { key: 'crowd_matchshot',         label: 'Match Shot!',            icon: '🥇', desc: 'Maximale Eskalation beim Match-Gewinn' },
  { key: 'crowd_bust',              label: 'Überworfen (Überworfen)',      icon: '😬', desc: 'Enttäuschtes Raunen' },
  { key: 'crowd_niedrig_score',         label: 'Schlechter Wurf (≤ 3)', icon: '😂', desc: 'Spöttisches Pfeifen' },
  { key: 'crowd_checkout_pressure', label: 'Checkout-Druck',        icon: '😰', desc: 'Angespanntes Gemurmel auf dem Doppel' },
  { key: 'crowd_gameon',            label: 'Game An!',               icon: '🎉', desc: 'Jubel beim Match-Start' },
  { key: 'crowd_ambient',           label: 'Hintergrundgemurmel',   icon: '🔊', desc: 'Konstantes Stadionrauschen' },
]

// ─── State ────────────────────────────────────────────────────────────────────

const enabled = ref(false)
const ambientEnabled = ref(true)
const pressureEnabled = ref(true)
const lowScoreBoosEnabled = ref(true)
const autoVenueByDifficulty = ref(true)  // v2.9.85
const ambientVolume = ref(30)
const crowdVolume = ref(80)
const reactions = ref<Record<string, { enabled: boolean; base64: string; soundUrl: string }>>({})
const saving = ref(false)
const uploadingKey = ref<string | null>(null)

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  const config = await AutodartsToolsConfig.getValue()
  enabled.value = config.crowd?.enabled ?? false
  ambientEnabled.value = config.crowd?.ambientEnabled ?? true
  pressureEnabled.value = config.crowd?.pressureEnabled ?? true
  lowScoreBoosEnabled.value = config.crowd?.lowScoreBoosEnabled ?? true
  autoVenueByDifficulty.value = config.crowd?.autoVenueByDifficulty ?? true
  ambientVolume.value = config.crowd?.ambientVolume ?? 30
  crowdVolume.value = config.crowd?.crowdVolume ?? 80

  // v2.9.63: Venue-Preset laden
  activeVenueId.value = await getActiveVenueId()

  // v2.9.91: Board-Theme-Präferenz laden
  await loadBoardThemePrefs()

  // Reaktionen initialisieren
  const savedReactions = config.crowd?.reactions ?? []
  CROWD_EVENTS.forEach(event => {
    const saved = savedReactions.find((r: any) => r.eventKey === event.key)
    reactions.value[event.key] = {
      enabled: saved?.enabled ?? true,
      base64: saved?.base64 ?? '',
      soundUrl: saved?.soundUrl ?? '',
    }
  })
})

// v2.9.63: Venue-Handling
const venues = BUILTIN_VENUES
const activeVenueId = ref<VenueId | null>(null)
const activeVenue = computed<VenueProfile | null>(() => activeVenueId.value ? (getVenue(activeVenueId.value) ?? null) : null)

async function chooseVenue(id: VenueId) {
  const v = await applyVenue(id)
  if (v) {
    activeVenueId.value = id
    // UI-State refresh
    enabled.value = true
    ambientEnabled.value = v.ambientVolume > 0
    ambientVolume.value = v.ambientVolume
    crowdVolume.value = v.crowdVolume
    pressureEnabled.value = v.pressureEnabled
    lowScoreBoosEnabled.value = v.lowScoreBoosEnabled
  }
}

async function clearVenue() {
  await setActiveVenue(null)
  activeVenueId.value = null
}

async function doPreviewVenue(id: VenueId) {
  await previewVenue(id)
}

// ─── v2.9.91: Board-Theme (manueller Override) ───────────────────────────────
const boardThemes = BOARD_THEMES
const boardThemeMode = ref<BoardThemeMode>('auto')
const boardThemeManualId = ref<BoardThemeId>('oche-classic')

async function loadBoardThemePrefs() {
  try {
    const res = await browser.storage.local.get([BOARD_THEME_MODE_KEY, BOARD_THEME_MANUAL_KEY])
    boardThemeMode.value = (res[BOARD_THEME_MODE_KEY] as BoardThemeMode) || 'auto'
    boardThemeManualId.value = (res[BOARD_THEME_MANUAL_KEY] as BoardThemeId) || 'oche-classic'
  } catch (_) { /* ignore */ }
}

async function chooseBoardThemeMode(mode: BoardThemeMode) {
  boardThemeMode.value = mode
  await setBoardThemeMode(mode)
}

async function chooseBoardThemeManual(id: BoardThemeId) {
  boardThemeManualId.value = id
  await setBoardThemeManual(id)
  // Wechselt automatisch in Manual-Modus, wenn User ein Theme wählt.
  if (boardThemeMode.value !== 'manual') {
    await chooseBoardThemeMode('manual')
  }
}

// ─── Methoden ─────────────────────────────────────────────────────────────────

async function save() {
  saving.value = true
  try {
    const config = await AutodartsToolsConfig.getValue()
    config.crowd = {
      enabled: enabled.value,
      ambientEnabled: ambientEnabled.value,
      pressureEnabled: pressureEnabled.value,
      lowScoreBoosEnabled: lowScoreBoosEnabled.value,
      autoVenueByDifficulty: autoVenueByDifficulty.value,
      ambientVolume: ambientVolume.value,
      crowdVolume: crowdVolume.value,
      reactions: CROWD_EVENTS.map(event => ({
        eventKey: event.key,
        enabled: reactions.value[event.key]?.enabled ?? true,
        base64: reactions.value[event.key]?.base64 ?? '',
        soundUrl: '',
      })),
    }
    await AutodartsToolsConfig.setValue(config)
  } finally {
    saving.value = false
  }
}

function handleFileHochladen(event: Event, key: string) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploadingKey.value = key
  const reader = new FileReader()
  reader.onload = async (e) => {
    const base64 = e.target?.result as string
    reactions.value[key] = {
      ...reactions.value[key],
      base64,
      soundUrl: file.name,
    }
    uploadingKey.value = null
    await save()
  }
  reader.readAsDataURL(file)
}

function clearSound(key: string) {
  reactions.value[key] = { ...reactions.value[key], base64: '', soundUrl: '' }
  save()
}

function previewSynth(key: string) {
  // Kurze synthetische Vorschau via Web Audio API
  try {
    const ctx = new AudioContext()
    const bufferGröße = ctx.sampleRate * 0.8
    const buffer = ctx.createBuffer(1, bufferGröße, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferGröße; i++) {
      const t = i / bufferGröße
      data[i] = (Math.random() * 2 - 1) * Math.sin(t * Math.PI) * 0.3
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    gain.gain.value = crowdVolume.value / 100
    source.connect(gain)
    gain.connect(ctx.destination)
    source.start()
    setTimeout(() => ctx.close(), 1000)
  } catch (e) {
    console.warn('Vorschau nicht verfügbar', e)
  }
}
</script>

<template>
  <div class="crowd-panel">

    <!-- ── Header ──────────────────────────────────────────────────────── -->
    <div class="panel-header">
      <div class="panel-title">
        <span class="title-accent">CROWD & ATMOSPHÄRE</span>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" v-model="enabled" @change="save" />
        <span class="toggle-track">
          <span class="toggle-thumb"></span>
        </span>
        <span class="toggle-label">{{ enabled ? 'AN' : 'AUS' }}</span>
      </label>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- v2.9.97: Board-Theme UNABHÄNGIG vom Crowd-Toggle. Farbschema soll auch  -->
    <!-- wählbar sein wenn "Crowd & Atmosphäre" AUS ist. Vorher lag der Block    -->
    <!-- innerhalb des panel-disabled Wrappers und war deshalb nicht klickbar    -->
    <!-- (pointer-events: none), wenn der Master-Toggle deaktiviert war.        -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div class="board-theme-block" data-testid="board-theme-panel">
      <div class="board-theme-header">
        <span class="board-theme-icon">🎨</span>
        <div>
          <div class="board-theme-title">Board-Theme</div>
          <div class="board-theme-desc">
            Farbschema für UI-Chrome (Rahmen, Vignette, Badge). Wird zusätzlich
            zur Venue-Palette gerendert — die Dartboard-Kamera bleibt unberührt.
          </div>
        </div>
      </div>
      <div class="board-theme-modes">
        <button
          :class="['bt-mode', { active: boardThemeMode === 'auto' }]"
          @click="chooseBoardThemeMode('auto')"
          data-testid="board-theme-mode-auto"
        >
          <span class="bt-mode-emoji">🏟️</span>
          <span class="bt-mode-label">Auto</span>
          <span class="bt-mode-sub">an Venue gekoppelt</span>
        </button>
        <button
          :class="['bt-mode', { active: boardThemeMode === 'manual' }]"
          @click="chooseBoardThemeMode('manual')"
          data-testid="board-theme-mode-manual"
        >
          <span class="bt-mode-emoji">🎨</span>
          <span class="bt-mode-label">Manuell</span>
          <span class="bt-mode-sub">festes Farbthema</span>
        </button>
      </div>

      <div class="board-theme-grid" :class="{ disabled: boardThemeMode !== 'manual' }">
        <button
          v-for="theme in boardThemes"
          :key="theme.id"
          :class="['bt-theme', { active: boardThemeMode === 'manual' && boardThemeManualId === theme.id }]"
          @click="chooseBoardThemeManual(theme.id)"
          :data-testid="`board-theme-${theme.id}`"
          :title="theme.description"
          :style="{
            '--bt-primary': theme.primary,
            '--bt-secondary': theme.secondary,
            '--bt-glow': theme.glow,
          }"
        >
          <span class="bt-theme-emoji">{{ theme.emoji }}</span>
          <span class="bt-theme-name">{{ theme.label }}</span>
          <span class="bt-theme-swatch"></span>
        </button>
      </div>
      <div class="board-theme-note">
        ⚠️ Nur Rahmen und Hintergrund werden eingefärbt. Die Kamera-Ansicht der
        Dartscheibe (Video/Canvas) wird niemals überdeckt oder verändert.
      </div>
    </div>

    <div :class="{ 'panel-disabled': !enabled }">

      <!-- ── v2.9.63: Venue-Presets — PDC-Hotspots ──────────────────────── -->
      <div class="venue-block">
        <div class="venue-header">
          <span class="venue-header-icon">🏟️</span>
          <div>
            <div class="venue-title">
              PDC-Venue-Atmosphäre
              <span v-if="activeVenue" class="venue-active-badge">✓ {{ activeVenue.name }}</span>
            </div>
            <div class="venue-desc">
              Ein-Klick-Preset für berühmte PDC-Locations: Reverb, Lautstärken, Deciding-Leg-Wahnsinn.
            </div>
          </div>
        </div>
        <div class="venue-grid">
          <button
            v-for="v in venues"
            :key="v.id"
            :class="['venue-card', { active: activeVenueId === v.id }]"
            @click="chooseVenue(v.id)"
            :data-testid="`venue-card-${v.id}`"
            :title="v.description"
          >
            <span class="venue-emoji">{{ v.emoji }}</span>
            <span class="venue-name">{{ v.name }}</span>
            <span class="venue-location">{{ v.location }}</span>
            <span
              class="venue-preview-btn"
              @click.stop="doPreviewVenue(v.id)"
              :data-testid="`venue-preview-${v.id}`"
            >▶ Anhören</span>
          </button>
          <button
            :class="['venue-card', 'venue-card-reset', { active: activeVenueId === null }]"
            @click="clearVenue"
            data-testid="venue-card-none"
            title="Venue-Preset entfernen — Standard-Konfiguration verwenden"
          >
            <span class="venue-emoji">✕</span>
            <span class="venue-name">Kein Venue</span>
            <span class="venue-location">Manuelle Config</span>
          </button>
        </div>
        <div v-if="activeVenue" class="venue-active-info">
          <b>{{ activeVenue.emoji }} {{ activeVenue.name }}</b> aktiv —
          Reverb {{ Math.round(activeVenue.reverb.wetMix * 100) }}%,
          Ambient {{ activeVenue.ambientVolume }},
          Deciding-Leg-Boost ×{{ activeVenue.decidingLegBoost.toFixed(2) }}.
          Match-Shot ×{{ activeVenue.matchShotBoost.toFixed(2) }}.
        </div>
      </div>

      <!-- ── v2.9.50: Sound-Quellen Info-Box ────────────────────────────── -->
      <div class="sources-block">
        <div class="sources-header">
          <span class="sources-icon">🎧</span>
          <div>
            <div class="sources-title">Kostenlose Crowd-Sounds finden</div>
            <div class="sources-desc">Diese Seiten haben freie/CC0-Sounds für Applaus, Jubel und Stadion-Ambiente. Download als MP3/WAV und unten pro Ereignis hochladen.</div>
          </div>
        </div>
        <div class="sources-links">
          <a href="https://mixkit.co/free-sound-effects/applause/" target="_blank" rel="noopener" class="source-btn">
            <span class="source-btn-title">Mixkit — Applaus (41 Sounds)</span>
            <span class="source-btn-hint">🎯 Für 180! · Game Shot · Match Shot</span>
          </a>
          <a href="https://www.zapsplat.com/sound-effect-category/audiences-and-crowds/" target="_blank" rel="noopener" class="source-btn">
            <span class="source-btn-title">Zapsplat — Publikum</span>
            <span class="source-btn-hint">🔊 Hintergrundgemurmel · Enttäuschtes Raunen</span>
          </a>
          <a href="https://freesound.org/search/?q=darts+crowd+cheer&f=&s=score+desc" target="_blank" rel="noopener" class="source-btn">
            <span class="source-btn-title">Freesound — „darts crowd"</span>
            <span class="source-btn-hint">⭐ CC-BY / CC0 Sammlung</span>
          </a>
          <a href="https://archive.org/details/Red_Library_Crowds_Applause" target="_blank" rel="noopener" class="source-btn">
            <span class="source-btn-title">Archive.org — Red Library</span>
            <span class="source-btn-hint">📦 15+ CC0-Applaus/Crowd-MP3s</span>
          </a>
          <a href="https://www.youtube.com/watch?v=xua3uH0R8Xc" target="_blank" rel="noopener" class="source-btn">
            <span class="source-btn-title">YouTube — Ally Pally Atmosphäre</span>
            <span class="source-btn-hint">🎥 1h PDC-Stadion-Ambience (mit yt-dlp downloadbar)</span>
          </a>
          <a href="https://elevenlabs.io/sound-effects/applause" target="_blank" rel="noopener" class="source-btn">
            <span class="source-btn-title">ElevenLabs — KI-Applaus</span>
            <span class="source-btn-hint">🤖 KI-generiert, individuell erstellbar</span>
          </a>
        </div>
        <div class="sources-tip">
          💡 <b>Tipp:</b> Mixkit „Applause Impact" ist perfekt für <b>180!</b>, Zapsplat „Small crowd tension" für <b>Checkout-Druck</b>, Ally-Pally-YouTube-Ambience als <b>Hintergrundgemurmel</b>.
        </div>
      </div>

      <!-- ── Globale Einstellungen ────────────────────────────────────── -->
      <div class="settings-block">
        <div class="block-label">GLOBALE EINSTELLUNGEN</div>

        <div class="settings-grid">
          <!-- Lautstärke Hintergrund -->
          <div class="slider-group">
            <label>🔊 Hintergrundgemurmel</label>
            <div class="slider-row">
              <input
                type="range" min="0" max="100"
                v-model.number="ambientVolume"
                @change="save"
                class="pdc-slider"
              />
              <span class="slider-value">{{ ambientVolume }}%</span>
            </div>
          </div>

          <!-- Lautstärke Reaktionen -->
          <div class="slider-group">
            <label>📢 Reaktionslautstärke</label>
            <div class="slider-row">
              <input
                type="range" min="0" max="100"
                v-model.number="crowdVolume"
                @change="save"
                class="pdc-slider"
              />
              <span class="slider-value">{{ crowdVolume }}%</span>
            </div>
          </div>
        </div>

        <!-- Feature-Schalter -->
        <div class="feature-toggles">
          <label class="feature-toggle">
            <input type="checkbox" v-model="ambientEnabled" @change="save" />
            <span>Hintergrundgemurmel aktivieren</span>
          </label>
          <label class="feature-toggle">
            <input type="checkbox" v-model="pressureEnabled" @change="save" />
            <span>Checkout-Druck (Pfeifen auf dem Doppel)</span>
          </label>
          <label class="feature-toggle">
            <input type="checkbox" v-model="lowScoreBoosEnabled" @change="save" />
            <span>Spöttisches Pfeifen bei schlechten Würfen</span>
          </label>
          <label class="feature-toggle" data-testid="auto-venue-toggle-label">
            <input type="checkbox" v-model="autoVenueByDifficulty" @change="save" data-testid="auto-venue-toggle" />
            <span>Venue automatisch zur Karriere-Difficulty wählen (Pub→Kneipe · Elite→Ally Pally · TV→Ally Pally)</span>
          </label>
        </div>
      </div>

      <!-- ── Reaktionen ──────────────────────────────────────────────── -->
      <div class="settings-block">
        <div class="block-label">REAKTIONEN & SOUNDS</div>
        <div class="block-hint">
          Ohne eigene Datei werden synthetische Crowd-Geräusche via Web Audio API erzeugt.
          Eigene MP3/WAV-Dateien haben immer Vorrang.
        </div>

        <div class="reactions-list">
          <div
            v-for="event in CROWD_EVENTS"
            :key="event.key"
            class="reaction-row"
            :class="{ disabled: !reactions[event.key]?.enabled }"
          >
            <!-- Aktivieren/Deaktivieren -->
            <label class="reaction-toggle">
              <input
                type="checkbox"
                :checked="reactions[event.key]?.enabled ?? true"
                @change="(e) => { reactions[event.key].enabled = (e.target as HTMLInputElement).checked; save() }"
              />
              <span class="reaction-icon">{{ event.icon }}</span>
            </label>

            <!-- Info -->
            <div class="reaction-info">
              <div class="reaction-name">{{ event.label }}</div>
              <div class="reaction-desc">{{ event.desc }}</div>
            </div>

            <!-- Sound-Status -->
            <div class="reaction-sound">
              <span v-if="reactions[event.key]?.soundUrl" class="sound-file">
                🎵 {{ reactions[event.key].soundUrl }}
                <button class="btn-clear" @click="clearSound(event.key)" title="Entfernen">✕</button>
              </span>
              <span v-else class="sound-synth">⚡ Synthetisch</span>
            </div>

            <!-- Aktionen -->
            <div class="reaction-actions">
              <button
                class="btn-preview"
                @click="previewSynth(event.key)"
                title="Vorschau"
              >▶</button>
              <label class="btn-upload" :title="'Eigenen Sound hochladen'">
                <input
                  type="file"
                  accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg"
                  style="display:none"
                  @change="(e) => handleFileHochladen(e, event.key)"
                />
                <span v-if="uploadingKey === event.key" class="btn-spinner-sm"></span>
                <span v-else>📁</span>
              </label>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.crowd-panel {
  font-family: 'Barniedrig Condensed', 'Arial Narrow', Arial, sans-serif;
  color: #e8eaf0;
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.panel-header {
  display: flex;
  align-items: Mitte;
  justify-content: space-between;
  margin-unten: 20px;
}
.title-accent {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 3px;
  color: #E8002D;
  text-transform: uppercase;
}

/* ── v2.9.50: Sound-Quellen ────────────────────────────────────────────────── */
.sources-block {
  background: linear-gradient(135deg, rgba(52,211,153,0.06), rgba(52,211,153,0.02));
  border: 1px solid rgba(52,211,153,0.3);
  border-left: 4px solid #34D399;
  border-radius: 8px;
  padding: 16px 18px;
  margin-bottom: 20px;
}
.sources-header {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
  align-items: flex-start;
}
.sources-icon { font-size: 28px; }
.sources-title {
  font-size: 15px;
  font-weight: 900;
  color: #34D399;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.sources-desc { font-size: 12px; color: #94A3B8; margin-top: 3px; line-height: 1.5; }
.sources-links {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 8px;
}
.source-btn {
  display: block;
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 5px;
  padding: 10px 12px;
  color: #e8eaf0;
  text-decoration: none;
  transition: all 0.15s ease;
}
.source-btn:hover {
  border-color: #34D399;
  background: rgba(52,211,153,0.08);
  transform: translateY(-1px);
}
.source-btn-title {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #FFFFFF;
  margin-bottom: 2px;
}
.source-btn-hint { display: block; font-size: 10px; color: #94A3B8; }
.sources-tip {
  margin-top: 12px;
  padding: 10px 12px;
  background: rgba(245,200,66,0.08);
  border: 1px solid rgba(245,200,66,0.25);
  border-radius: 4px;
  font-size: 12px;
  color: #F5C842;
  line-height: 1.5;
}

/* ── Toggle ─────────────────────────────────────────────────────────────────── */
.toggle-switch {
  display: flex;
  align-items: Mitte;
  gap: 10px;
  cursor: pointer;
}
.toggle-track {
  width: 52px;
  height: 28px;
  background: #1e3050;
  border-radius: 14px;
  position: relative;
  transition: background 0.2s;
  border: 1px solid #2a3f5a;
}
input:checked + .toggle-track { background: #E8002D; }
.toggle-thumb {
  position: absolute;
  oben: 3px;
  links: 3px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}
input:checked + .toggle-track .toggle-thumb { transform: translateX(24px); }
.toggle-switch input { display: none; }
.toggle-label { font-size: 16px; font-weight: 700; color: #8899aa; min-width: 32px; }

/* ── Deaktivierend-Zustand ───────────────────────────────────────────────────────── */
.panel-disabled { opacity: 0.4; pointer-events: none; }

/* ── Einstellungen-Block ─────────────────────────────────────────────────────────── */
.settings-block {
  background: #0a1520;
  border: 1px solid #1e3050;
  border-radius: 8px;
  padding: 16px 20px;
  margin-unten: 16px;
}
.block-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #E8002D;
  margin-unten: 14px;
  text-transform: uppercase;
}
.block-hint {
  font-size: 13px;
  color: #556677;
  margin-unten: 14px;
  line-height: 1.5;
}

/* ── Slider ─────────────────────────────────────────────────────────────────── */
.settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-unten: 16px; }
.slider-group label { font-size: 14px; color: #8899aa; display: block; margin-unten: 8px; }
.slider-row { display: flex; align-items: Mitte; gap: 12px; }
.pdc-slider {
  flex: 1;
  -webkit-appearance: none;
  height: 4px;
  background: #1e3050;
  border-radius: 2px;
  outline: none;
}
.pdc-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 18px;
  height: 18px;
  background: #E8002D;
  border-radius: 50%;
  cursor: pointer;
}
.slider-value { font-size: 16px; font-weight: 700; color: #F5C842; min-width: 40px; text-align: rechts; }

/* ── Feature-Toggles ────────────────────────────────────────────────────────── */
.feature-toggles { display: flex; flex-direction: column; gap: 10px; }
.feature-toggle {
  display: flex;
  align-items: Mitte;
  gap: 10px;
  cursor: pointer;
  font-size: 15px;
  color: #c0ccd8;
}
.feature-toggle input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #E8002D;
  cursor: pointer;
}

/* ── Reaktionen-Liste ───────────────────────────────────────────────────────── */
.reactions-list { display: flex; flex-direction: column; gap: 6px; }
.reaction-row {
  display: flex;
  align-items: Mitte;
  gap: 12px;
  background: #0d1b2a;
  border: 1px solid #1e3050;
  border-radius: 6px;
  padding: 10px 14px;
  transition: border-color 0.2s;
}
.reaction-row:hover { border-color: #2a3f5a; }
.reaction-row.disabled { opacity: 0.4; }

.reaction-toggle {
  display: flex;
  align-items: Mitte;
  gap: 8px;
  cursor: pointer;
  flex-shrink: 0;
}
.reaction-toggle input { width: 16px; height: 16px; accent-color: #E8002D; cursor: pointer; }
.reaction-icon { font-size: 20px; }

.reaction-info { flex: 1; min-width: 0; }
.reaction-name { font-size: 16px; font-weight: 700; color: #e8eaf0; }
.reaction-desc { font-size: 12px; color: #556677; margin-oben: 2px; }

.reaction-sound { min-width: 160px; }
.sound-file { font-size: 13px; color: #00C853; display: flex; align-items: Mitte; gap: 6px; }
.sound-synth { font-size: 13px; color: #556677; }
.btn-clear {
  background: none;
  border: none;
  color: #E8002D;
  cursor: pointer;
  font-size: 12px;
  padding: 0 2px;
}

.reaction-actions { display: flex; gap: 6px; flex-shrink: 0; }
.btn-preview, .btn-upload {
  background: #0a1520;
  border: 1px solid #2a3f5a;
  color: #8899aa;
  width: 34px;
  height: 34px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: Mitte;
  justify-content: Mitte;
  transition: all 0.2s;
}
.btn-preview:hover { border-color: #00C853; color: #00C853; }
.btn-upload:hover { border-color: #F5C842; color: #F5C842; }

.btn-spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.2);
  border-oben-color: #F5C842;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── v2.9.63: Venue-Presets ─────────────────────────────────────────── */
.venue-block {
  background: linear-gradient(135deg, rgba(232,0,45,0.06), rgba(59,130,246,0.06));
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  padding: 18px;
  margin-bottom: 20px;
}
.venue-header { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
.venue-header-icon { font-size: 28px; }
.venue-title {
  color: #FFFFFF; font-weight: 900; font-size: 15px;
  letter-spacing: 2px; text-transform: uppercase;
}
.venue-active-badge {
  color: #34D399; font-size: 11px; letter-spacing: 2px; margin-left: 8px;
}
.venue-desc { color: #94A3B8; font-size: 12px; margin-top: 2px; }
.venue-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px;
}
.venue-card {
  display: flex; flex-direction: column; align-items: flex-start; gap: 4px;
  background: rgba(0,0,0,0.25);
  border: 2px solid rgba(255,255,255,0.08);
  border-radius: 8px;
  padding: 12px 14px 40px 14px;
  cursor: pointer; position: relative;
  transition: all 0.15s;
  text-align: left;
  font-family: inherit;
  color: inherit;
}
.venue-card:hover {
  border-color: rgba(232,0,45,0.4);
  transform: translateY(-1px);
}
.venue-card.active {
  border-color: #E8002D;
  background: rgba(232,0,45,0.12);
}
.venue-card-reset { border-style: dashed; opacity: 0.7; }
.venue-emoji { font-size: 22px; }
.venue-name {
  color: #FFFFFF; font-weight: 900; font-size: 13px;
  letter-spacing: 1px; text-transform: uppercase;
}
.venue-location { color: #94A3B8; font-size: 10px; letter-spacing: 1px; }
.venue-preview-btn {
  position: absolute; bottom: 8px; right: 8px;
  background: rgba(52,211,153,0.15);
  border: 1px solid rgba(52,211,153,0.4);
  color: #34D399; padding: 3px 8px; border-radius: 4px;
  font-size: 10px; font-weight: 700; letter-spacing: 1px;
}
.venue-active-info {
  margin-top: 12px; padding: 10px 14px;
  background: rgba(52,211,153,0.08); border-left: 3px solid #34D399;
  color: #D1FAE5; font-size: 12px; letter-spacing: 0.5px; line-height: 1.6;
}

/* ── v2.9.91: Board-Theme-Panel ───────────────────────────────────────────── */
.board-theme-block {
  margin-top: 20px;
  padding: 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 8px;
}
.board-theme-header { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
.board-theme-icon { font-size: 22px; }
.board-theme-title { font-size: 13px; font-weight: 900; color: #FFFFFF; text-transform: uppercase; letter-spacing: 2px; }
.board-theme-desc { font-size: 11px; color: #94A3B8; margin-top: 4px; line-height: 1.5; }

.board-theme-modes { display: flex; gap: 8px; margin-bottom: 12px; }
.bt-mode {
  flex: 1;
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 10px 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 6px; cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
}
.bt-mode:hover { background: rgba(255,255,255,0.08); transform: translateY(-1px); }
.bt-mode.active { background: rgba(232,0,45,0.12); border-color: #E8002D; }
.bt-mode-emoji { font-size: 20px; }
.bt-mode-label { font-size: 11px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; color: #FFFFFF; }
.bt-mode-sub { font-size: 9px; letter-spacing: 1px; color: #64748B; text-transform: uppercase; }

.board-theme-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
  transition: opacity 0.2s;
}
.board-theme-grid.disabled { opacity: 0.4; pointer-events: none; }
.bt-theme {
  display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
  padding: 10px 12px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.10);
  border-radius: 6px; cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
  position: relative;
}
.bt-theme:hover { transform: translateY(-2px); border-color: var(--bt-primary); }
.bt-theme.active {
  border-color: var(--bt-primary);
  box-shadow: 0 0 0 1px var(--bt-primary), 0 4px 14px var(--bt-glow);
}
.bt-theme-emoji { font-size: 18px; }
.bt-theme-name { font-size: 12px; font-weight: 700; color: #FFFFFF; letter-spacing: 0.5px; }
.bt-theme-swatch {
  display: block; width: 100%; height: 4px; border-radius: 2px;
  background: linear-gradient(90deg, var(--bt-primary), var(--bt-secondary));
  box-shadow: 0 0 6px var(--bt-glow);
}
.board-theme-note {
  margin-top: 12px; padding: 8px 12px;
  background: rgba(245,200,66,0.05); border-left: 3px solid #F5C842;
  color: #FCD34D; font-size: 11px; line-height: 1.5;
}
</style>
