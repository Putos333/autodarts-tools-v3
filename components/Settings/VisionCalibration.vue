<script setup lang="ts">
/**
 * VisionCalibration.vue (v2.9.93)
 *
 * Reines Adress-Konfigurationsfeld für einen externen Kalibrierungs-Server
 * (z.B. lokal laufender Vision-Auto-Kalibrierungs-Dienst). Aktuell KEINE
 * Datenübertragung — nur speichern & Health-Check-Anzeige, damit später
 * ein eigenständiges Vision-Modul weiß, wo der Server läuft.
 *
 * Muster ist bewusst identisch zu `aiCommentator.backendUrl` in TtsProvider.vue.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { AutodartsToolsConfig } from '@/utils/storage'

type HealthState = 'idle' | 'checking' | 'ok' | 'unreachable' | 'invalid'

const backendUrl = ref('')
const initialLoaded = ref(false)
const healthState = ref<HealthState>('idle')
const healthDetail = ref<string>('')
const lastCheckedUrl = ref<string>('')
const savedTs = ref<number>(0)
let checkTimer: ReturnType<typeof setTimeout> | null = null

// Trailing-Slash entfernen und http/https-Präfix prüfen.
function normalize(url: string): string {
  return (url || '').trim().replace(/\/+$/, '')
}

function isValidUrl(url: string): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch { return false }
}

const isValid = computed(() => !backendUrl.value || isValidUrl(backendUrl.value))
const badgeText = computed(() => {
  switch (healthState.value) {
    case 'ok': return '● Erreichbar'
    case 'checking': return '● Prüfe …'
    case 'unreachable': return '● Nicht erreichbar'
    case 'invalid': return '● Ungültige URL'
    default: return backendUrl.value ? '● Bereit zum Prüfen' : '● Nicht konfiguriert'
  }
})
const badgeColor = computed(() => {
  switch (healthState.value) {
    case 'ok': return '#34D399'
    case 'checking': return '#F5C842'
    case 'unreachable': return '#EF4444'
    case 'invalid': return '#EF4444'
    default: return '#64748B'
  }
})

async function loadFromConfig() {
  const cfg = await AutodartsToolsConfig.getValue()
  backendUrl.value = cfg.visionCalibration?.backendUrl ?? ''
  initialLoaded.value = true
}

async function persist(newValue: string) {
  const cfg = await AutodartsToolsConfig.getValue()
  await AutodartsToolsConfig.setValue({
    ...cfg,
    visionCalibration: { ...(cfg.visionCalibration ?? { backendUrl: '' }), backendUrl: normalize(newValue) },
  })
  savedTs.value = Date.now()
}

/**
 * Health-Check: `GET {url}/api/health`. Toleriert 200-299 als „ok".
 * Der Server muss KEIN spezielles Format zurückliefern — nur ein erreichbarer
 * HTTP-Endpoint reicht als Signal, dass die Adresse korrekt ist.
 */
async function checkHealth(url: string) {
  const target = normalize(url)
  if (!target) {
    healthState.value = 'idle'
    healthDetail.value = ''
    return
  }
  if (!isValidUrl(target)) {
    healthState.value = 'invalid'
    healthDetail.value = 'URL muss mit http:// oder https:// beginnen'
    return
  }
  healthState.value = 'checking'
  healthDetail.value = ''
  lastCheckedUrl.value = target

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 4000)
  try {
    const res = await fetch(`${target}/api/health`, {
      method: 'GET',
      // Kalibrierungs-Server läuft üblicherweise lokal; cache disable.
      cache: 'no-store',
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (res.ok) {
      healthState.value = 'ok'
      try {
        // Optional: server liefert JSON mit Version — anzeigen falls vorhanden.
        const data = await res.clone().json().catch(() => null)
        if (data && typeof data === 'object' && 'version' in data) {
          healthDetail.value = `Server erreichbar (v${data.version})`
        } else {
          healthDetail.value = `HTTP ${res.status}`
        }
      } catch {
        healthDetail.value = `HTTP ${res.status}`
      }
    } else {
      healthState.value = 'unreachable'
      healthDetail.value = `HTTP ${res.status}`
    }
  } catch (e: any) {
    clearTimeout(timeout)
    healthState.value = 'unreachable'
    if (e?.name === 'AbortError') healthDetail.value = 'Timeout nach 4 s'
    else healthDetail.value = 'Verbindungsfehler'
  }
}

// Debounced auto-persist + auto-check bei jeder Änderung.
watch(backendUrl, (val) => {
  if (!initialLoaded.value) return
  if (checkTimer) clearTimeout(checkTimer)
  checkTimer = setTimeout(async () => {
    await persist(val)
    await checkHealth(val)
  }, 500)
})

onMounted(async () => {
  await loadFromConfig()
  // Beim Öffnen einmalig prüfen, wenn eine URL hinterlegt ist.
  if (backendUrl.value) await checkHealth(backendUrl.value)
})

function onManualCheck() {
  checkHealth(backendUrl.value)
}
</script>

<template>
  <div class="vision-cal-card" data-testid="vision-calibration-panel">
    <div class="vc-header">
      <div class="vc-icon">🎯</div>
      <div style="flex:1;">
        <div class="vc-title">Externer Kalibrierungs-Server</div>
        <div class="vc-sub">
          Nur die Server-Adresse. Datenübertragung folgt in einem späteren Update.
        </div>
      </div>
      <div
        class="vc-badge"
        :style="{ color: badgeColor, borderColor: badgeColor + '55' }"
        data-testid="vision-calibration-badge"
      >{{ badgeText }}</div>
    </div>

    <div class="vc-row">
      <label class="vc-label" for="vc-url">Server-URL</label>
      <input
        id="vc-url"
        v-model="backendUrl"
        type="url"
        placeholder="http://localhost:8765"
        autocomplete="off"
        spellcheck="false"
        class="vc-input"
        :class="{ invalid: !isValid }"
        data-testid="vision-calibration-url-input"
      />
      <button
        type="button"
        class="vc-check-btn"
        @click="onManualCheck"
        :disabled="!backendUrl || !isValid || healthState === 'checking'"
        data-testid="vision-calibration-check-btn"
      >
        <span v-if="healthState === 'checking'">…</span>
        <span v-else>Prüfen</span>
      </button>
    </div>

    <div v-if="healthDetail" class="vc-detail" data-testid="vision-calibration-detail">
      {{ healthDetail }}
    </div>

    <div class="vc-hint">
      💡 Erwartet einen erreichbaren <code>GET /api/health</code>-Endpoint (HTTP 2xx).
      Kein API-Key nötig. Läuft üblicherweise auf <code>http://localhost:8765</code>
      auf deinem eigenen Rechner.
    </div>
  </div>
</template>

<style scoped>
.vision-cal-card {
  background: #0a1520;
  border: 1px solid #1e3a5f;
  border-radius: 8px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.vc-header { display: flex; align-items: flex-start; gap: 12px; }
.vc-icon { font-size: 22px; }
.vc-title {
  font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
  font-size: 18px; font-weight: 900;
  letter-spacing: 1.5px; text-transform: uppercase;
  color: #e8eaf0;
}
.vc-sub { font-size: 12px; color: #8899aa; margin-top: 2px; line-height: 1.5; }
.vc-badge {
  align-self: center;
  padding: 4px 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: rgba(255,255,255,0.03);
  font-size: 11px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  font-weight: 800;
  white-space: nowrap;
}

.vc-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.vc-label {
  flex-basis: 100%;
  font-size: 11px;
  letter-spacing: 2px;
  color: #8899aa;
  text-transform: uppercase;
  font-weight: 700;
}
.vc-input {
  flex: 1 1 260px;
  background: #1e3a5f;
  color: #e8eaf0;
  border: 1px solid #2a4a7f;
  padding: 10px 12px;
  border-radius: 4px;
  font-size: 13px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
  outline: none;
}
.vc-input:focus { border-color: #F5C842; }
.vc-input.invalid { border-color: #EF4444; }

.vc-check-btn {
  padding: 10px 18px;
  background: linear-gradient(90deg, #F5C842, #E8002D);
  border: none; border-radius: 4px;
  color: #0D1B2A;
  font-weight: 900; letter-spacing: 1.5px; text-transform: uppercase; font-size: 11px;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease;
  font-family: inherit;
}
.vc-check-btn:hover:not(:disabled) { transform: translateY(-1px); }
.vc-check-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.vc-detail {
  font-size: 12px;
  color: #b8c4d0;
  background: rgba(255,255,255,0.03);
  padding: 6px 10px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', ui-monospace, monospace;
}
.vc-hint {
  font-size: 11px; color: #8899aa; line-height: 1.6;
  border-left: 3px solid #1e3a5f;
  padding: 6px 10px;
  background: rgba(255,255,255,0.02);
}
.vc-hint code {
  background: rgba(255,255,255,0.06);
  padding: 1px 5px; border-radius: 3px;
  font-size: 11px;
  color: #F5C842;
}
</style>
