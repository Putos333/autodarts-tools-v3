<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  getFriends,
  getH2HStats,
  quickPlay,
  quickPlayGroup,
  type IFriend,
  type IH2HStats,
  type ILobbySettings,
} from '@/utils/friends-api'

// ─── State ────────────────────────────────────────────────────────────────────

const friends = ref<IFriend[]>([])
const loading = ref(false)
const loadingFreundId = ref<string | null>(null)
const selectedFreund = ref<IFriend | null>(null)
const h2hStats = ref<IH2HStats | null>(null)
const h2hLoading = ref(false)
const showH2H = ref(false)
const notification = ref<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

// v2.9.91: Stammgruppe – Set von Freund-IDs, die als "Regulars" markiert sind.
// Persistiert unter dem Storage-Key `regular-players-group`.
const REGULAR_GROUP_KEY = 'regular-players-group'
const regularGroup = ref<Set<string>>(new Set())
const groupLaunching = ref(false)

// Lobby-Einstellungen (konfigurierbar)
const lobbyEinstellungen = ref<ILobbySettings>({
  variant: 'X01',
  x01Settings: {
    startScore: 501,
    inMode: 'straight',
    outMode: 'double',
    sets: 1,
    legs: 3,
  },
})

// ─── Berechnete Werte ─────────────────────────────────────────────────────────

const onlineFreunds = computed(() => friends.value.filter(f => f.online))
const offlineFreunds = computed(() => friends.value.filter(f => !f.online))

// v2.9.91: Alle als Stammgruppe markierten Freunde (auch offline sichtbar
// für Debug/UI, für den Start-Button aber nur die online-Mitglieder relevant).
const regularMembers = computed(() => friends.value.filter(f => regularGroup.value.has(f.id)))
const onlineRegularMembers = computed(() => regularMembers.value.filter(f => f.online))

function isRegular(friend: IFriend): boolean {
  return regularGroup.value.has(friend.id)
}

async function loadRegularGroup() {
  try {
    const res = await browser.storage.local.get(REGULAR_GROUP_KEY)
    const arr = res[REGULAR_GROUP_KEY]
    if (Array.isArray(arr)) regularGroup.value = new Set(arr.filter(x => typeof x === 'string'))
  } catch (_) { /* ignore */ }
}

async function persistRegularGroup() {
  try {
    await browser.storage.local.set({ [REGULAR_GROUP_KEY]: Array.from(regularGroup.value) })
  } catch (_) { /* ignore */ }
}

async function toggleRegular(friend: IFriend) {
  // Kopie erzeugen, damit Vue-Reactivity das Set-Update mitbekommt.
  const next = new Set(regularGroup.value)
  const wasIn = next.has(friend.id)
  if (wasIn) next.delete(friend.id)
  else next.add(friend.id)
  regularGroup.value = next
  await persistRegularGroup()
  showNotification(
    wasIn
      ? `${friend.name} aus der Stammgruppe entfernt`
      : `${friend.name} zur Stammgruppe hinzugefügt (${next.size} Mitglied${next.size === 1 ? '' : 'er'})`,
    wasIn ? 'info' : 'success',
  )
}

async function startWithRegularGroup() {
  const ids = onlineRegularMembers.value.map(f => f.id)
  if (ids.length === 0) {
    showNotification('Kein Stammgruppen-Mitglied online. Bitte Freunde markieren (☆).', 'error')
    return
  }
  groupLaunching.value = true
  showNotification(`Erstelle Lobby für ${ids.length} Stammgruppen-Mitglied${ids.length === 1 ? '' : 'er'}…`, 'info')

  const result = await quickPlayGroup(ids, lobbyEinstellungen.value)
  groupLaunching.value = false

  if (!result.success || !result.lobbyUrl) {
    showNotification(`Fehler: ${result.error ?? 'Lobby konnte nicht erstellt werden'}`, 'error')
    return
  }
  const okCount = result.invited.length
  const failCount = result.failed.length
  const msg = failCount > 0
    ? `Lobby erstellt: ${okCount} eingeladen, ${failCount} fehlgeschlagen — Weiterleitung…`
    : `Alle ${okCount} eingeladen — Weiterleitung…`
  showNotification(msg, failCount > 0 ? 'info' : 'success')
  setTimeout(() => { window.location.href = result.lobbyUrl! }, 1500)
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.all([loadFreunds(), loadRegularGroup()])
})

// ─── Methoden ─────────────────────────────────────────────────────────────────

async function loadFreunds() {
  loading.value = true
  try {
    friends.value = await getFriends()
  } finally {
    loading.value = false
  }
}

// v2.9.98: Alias fürs neue Anfragen-Panel — gleiche Semantik, klarerer Name.
const reloadFriends = loadFreunds;

async function startQuickPlay(friend: IFriend) {
  loadingFreundId.value = friend.id
  showNotification(`Erstelle Lobby für ${friend.name}...`, 'info')

  const result = await quickPlay(friend.id, lobbyEinstellungen.value)

  if (result.success && result.lobbyUrl) {
    showNotification(`Einladung an ${friend.name} gesendet! Weiterleitung...`, 'success')
    setTimeout(() => {
      window.location.href = result.lobbyUrl!
    }, 1500)
  } else {
    showNotification(`Fehler: ${result.error ?? 'Unbekannter Fehler'}`, 'error')
  }

  loadingFreundId.value = null
}

async function openH2H(friend: IFriend) {
  selectedFreund.value = friend
  showH2H.value = true
  h2hLoading.value = true
  h2hStats.value = null
  try {
    h2hStats.value = await getH2HStats(friend.id, friend.name)
  } finally {
    h2hLoading.value = false
  }
}

function closeH2H() {
  showH2H.value = false
  selectedFreund.value = null
  h2hStats.value = null
}

function showNotification(message: string, type: 'success' | 'error' | 'info') {
  notification.value = { message, type }
  setTimeout(() => { notification.value = null }, 4000)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '–'
  try {
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return dateStr
  }
}
</script>

<template>
  <div class="friends-panel">

    <!-- ── Benachrichtigung ─────────────────────────────────────────────── -->
    <Transition name="notif">
      <div
        v-if="notification"
        class="notification"
        :class="notification.type"
      >
        {{ notification.message }}
      </div>
    </Transition>

    <!-- ── Header ──────────────────────────────────────────────────────── -->
    <div class="panel-header">
      <div class="panel-title">
        <span class="title-accent">FREUNDE</span>
        <span class="friend-count" v-if="!loading">
          {{ onlineFreunds.length }} online · {{ friends.length }} gesamt
        </span>
      </div>
      <button class="btn-refresh" @click="loadFreunds" :disabled="loading" title="Aktualisieren">
        <span :class="{ spinning: loading }">↻</span>
      </button>
    </div>

    <!-- ── Lobby-Einstellungen ──────────────────────────────────────────── -->
    <div class="lobby-settings">
      <div class="settings-label">Standard-Lobby</div>
      <div class="settings-row">
        <div class="setting-group">
          <label>Modus</label>
          <select v-model="lobbyEinstellungen.variant">
            <option value="X01">X01</option>
            <option value="Cricket">Cricket</option>
          </select>
        </div>
        <div class="setting-group" v-if="lobbyEinstellungen.variant === 'X01'">
          <label>Start</label>
          <select v-model="lobbyEinstellungen.x01Settings!.startScore">
            <option :value="301">301</option>
            <option :value="501">501</option>
            <option :value="701">701</option>
          </select>
        </div>
        <div class="setting-group" v-if="lobbyEinstellungen.variant === 'X01'">
          <label>Out</label>
          <select v-model="lobbyEinstellungen.x01Settings!.outMode">
            <option value="double">Doppel</option>
            <option value="master">Master</option>
            <option value="straight">Straight</option>
          </select>
        </div>
        <div class="setting-group">
          <label>Sets</label>
          <select v-model="lobbyEinstellungen.x01Settings!.sets">
            <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
        <div class="setting-group">
          <label>Legs</label>
          <select v-model="lobbyEinstellungen.x01Settings!.legs">
            <option v-for="n in [1,3,5,7]" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- ── v2.9.91: Stammgruppe (Schnellstart) ──────────────────────────── -->
    <div class="regular-group-panel" data-testid="regular-group-panel">
      <div class="regular-group-header">
        <span class="regular-group-title">⭐ STAMMGRUPPE</span>
        <span class="regular-group-count" data-testid="regular-group-count">
          {{ regularMembers.length }} markiert · {{ onlineRegularMembers.length }} online
        </span>
      </div>
      <div class="regular-group-hint">
        Markiere Freunde mit dem Stern (☆) und starte in einem Klick eine Lobby mit deiner Dart-Crew.
      </div>
      <button
        class="btn-group-start"
        :disabled="groupLaunching || onlineRegularMembers.length === 0"
        @click="startWithRegularGroup"
        data-testid="regular-group-start-btn"
      >
        <span v-if="groupLaunching" class="btn-spinner"></span>
        <span v-else>⭐ Mit Stammgruppe starten ({{ onlineRegularMembers.length }})</span>
      </button>
    </div>

    <!-- ── v2.9.98: Autodarts-Freunde-Seite in neuem Tab (Freundschaftsanfragen) ─ -->
    <div class="friend-requests-link-panel" data-testid="friend-requests-link-panel">
      <div class="friend-requests-link-hint">
        📬 <b>Neue Freundschaftsanfragen annehmen?</b> Autodarts bietet dafür keine API,
        die wir hier zuverlässig einbinden könnten. Ein Klick öffnet die offizielle
        Freunde-Seite in einem neuen Tab — dort annehmen, dann hier neu laden.
      </div>
      <div class="friend-requests-link-buttons">
        <a
          class="btn-open-autodarts-friends"
          href="https://play.autodarts.io/friends"
          target="_blank"
          rel="noopener"
          data-testid="open-autodarts-friends-btn"
        >
          🔗 Autodarts-Freunde-Seite öffnen
        </a>
        <button
          class="btn-reload-friends"
          :disabled="loading"
          @click="reloadFriends"
          data-testid="reload-friends-btn"
          title="Freundesliste neu laden nachdem du Anfragen angenommen hast"
        >
          🔄 Neu laden
        </button>
      </div>
    </div>

    <!-- ── Lade-Indikator ───────────────────────────────────────────────── -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <span>Freunde werden geladen...</span>
    </div>

    <!-- ── Freundesliste ────────────────────────────────────────────────── -->
    <div v-else-if="friends.length > 0" class="friends-list">

      <!-- Anline-Freunde -->
      <div v-if="onlineFreunds.length > 0">
        <div class="section-label online">● ONLINE</div>
        <div
          v-for="friend in onlineFreunds"
          :key="friend.id"
          class="friend-card online"
        >
          <div class="friend-avatar">
            <img v-if="friend.avatarUrl" :src="friend.avatarUrl" :alt="friend.name" />
            <span v-else class="avatar-placeholder">{{ friend.name.charAt(0).toUpperCase() }}</span>
            <span class="status-dot online"></span>
          </div>
          <div class="friend-info">
            <div class="friend-name">{{ friend.name }}</div>
            <div class="friend-status" :class="{ 'in-match': friend.inMatch }">
              {{ friend.inMatch ? '🎯 Im Spiel' : '🟢 Anline' }}
            </div>
            <div class="friend-stats" v-if="friend.stats">
              Ø {{ friend.stats.average.toFixed(1) }} · {{ friend.stats.checkoutQuote }}% CO
            </div>
          </div>
          <div class="friend-actions">
            <button
              class="btn-star"
              :class="{ active: isRegular(friend) }"
              @click="toggleRegular(friend)"
              :title="isRegular(friend) ? 'Aus Stammgruppe entfernen' : 'Zur Stammgruppe hinzufügen'"
              :data-testid="`friend-star-${friend.id}`"
              :aria-pressed="isRegular(friend)"
            >
              {{ isRegular(friend) ? '★' : '☆' }}
            </button>
            <button
              class="btn-h2h"
              @click="openH2H(friend)"
              title="Head-to-Head Statistiken"
            >
              📊
            </button>
            <button
              class="btn-quickplay"
              @click="startQuickPlay(friend)"
              :disabled="loadingFreundId === friend.id"
              title="Sofort spielen"
            >
              <span v-if="loadingFreundId === friend.id" class="btn-spinner"></span>
              <span v-else>▶ SPIELEN</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Ausline-Freunde -->
      <div v-if="offlineFreunds.length > 0">
        <div class="section-label offline">○ OFFLINE</div>
        <div
          v-for="friend in offlineFreunds"
          :key="friend.id"
          class="friend-card offline"
        >
          <div class="friend-avatar">
            <img v-if="friend.avatarUrl" :src="friend.avatarUrl" :alt="friend.name" />
            <span v-else class="avatar-placeholder">{{ friend.name.charAt(0).toUpperCase() }}</span>
            <span class="status-dot offline"></span>
          </div>
          <div class="friend-info">
            <div class="friend-name">{{ friend.name }}</div>
            <div class="friend-status">⚫ Ausline</div>
            <div class="friend-stats" v-if="friend.stats">
              Ø {{ friend.stats.average.toFixed(1) }} · {{ friend.stats.checkoutQuote }}% CO
            </div>
          </div>
          <div class="friend-actions">
            <button
              class="btn-star"
              :class="{ active: isRegular(friend) }"
              @click="toggleRegular(friend)"
              :title="isRegular(friend) ? 'Aus Stammgruppe entfernen' : 'Zur Stammgruppe hinzufügen'"
              :data-testid="`friend-star-${friend.id}`"
              :aria-pressed="isRegular(friend)"
            >
              {{ isRegular(friend) ? '★' : '☆' }}
            </button>
            <button class="btn-h2h" @click="openH2H(friend)" title="Head-to-Head Statistiken">
              📊
            </button>
            <button class="btn-quickplay disabled" disabled title="Freund ist offline">
              ▶ SPIELEN
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Leer-Zustand ─────────────────────────────────────────────────── -->
    <div v-else class="empty-state">
      <div class="empty-icon">👥</div>
      <div class="empty-text">Keine Freunde gefunden</div>
      <div class="empty-hint">Füge Freunde auf autodarts.io hinzu, um sie hier zu sehen.</div>
    </div>

    <!-- ── Head-to-Head Modal ───────────────────────────────────────────── -->
    <Transition name="modal">
      <div v-if="showH2H" class="modal-overlay" @click.self="closeH2H">
        <div class="modal-content">
          <div class="modal-header">
            <div class="modal-title">HEAD TO HEAD</div>
            <div class="modal-subtitle">vs. {{ selectedFreund?.name }}</div>
            <button class="modal-close" @click="closeH2H">✕</button>
          </div>

          <div v-if="h2hLoading" class="modal-loading">
            <div class="spinner"></div>
            <span>Statistiken werden geladen...</span>
          </div>

          <div v-else-if="h2hStats && h2hStats.totalMatches > 0" class="modal-body">
            <!-- Bilanz-Anzeige -->
            <div class="h2h-scoreboard">
              <div class="h2h-player">
                <div class="h2h-player-name">ICH</div>
                <div class="h2h-wins">{{ h2hStats.myWins }}</div>
                <div class="h2h-avg">Ø {{ h2hStats.myAverage }}</div>
              </div>
              <div class="h2h-divider">:</div>
              <div class="h2h-player">
                <div class="h2h-player-name">{{ h2hStats.friendName.toUpperCase() }}</div>
                <div class="h2h-wins">{{ h2hStats.friendWins }}</div>
                <div class="h2h-avg">Ø {{ h2hStats.friendAverage }}</div>
              </div>
            </div>

            <div class="h2h-total">{{ h2hStats.totalMatches }} gemeinsame Spiele</div>

            <!-- Letzte Matches -->
            <div class="h2h-matches-label">LETZTE SPIELE</div>
            <div class="h2h-matches">
              <div
                v-for="match in h2hStats.matches.slice(0, 8)"
                :key="match.matchId"
                class="h2h-match-row"
                :class="match.winner === 'me' ? 'win' : 'loss'"
              >
                <span class="match-date">{{ formatDate(match.date) }}</span>
                <span class="match-result">
                  {{ match.myScore }} : {{ match.friendScore }}
                </span>
                <span class="match-avg">
                  Ø {{ match.myAverage.toFixed(1) }} / {{ match.friendAverage.toFixed(1) }}
                </span>
                <span class="match-badge" :class="match.winner === 'me' ? 'win' : 'loss'">
                  {{ match.winner === 'me' ? 'SIEG' : 'NIEDERLAGE' }}
                </span>
              </div>
            </div>
          </div>

          <div v-else class="modal-empty">
            Noch keine gemeinsamen Spiele gefunden.
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<style scoped>
/* ── Basis ─────────────────────────────────────────────────────────────────── */
.friends-panel {
  font-family: 'Barniedrig Condensed', 'Arial Narrow', Arial, sans-serif;
  color: #e8eaf0;
  position: relative;
}

/* ── Benachrichtigung ───────────────────────────────────────────────────────── */
.notification {
  position: fixed;
  oben: 20px;
  rechts: 20px;
  z-index: 99999;
  padding: 14px 24px;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.5px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
}
.notification.success { background: #00C853; color: #fff; }
.notification.error   { background: #E8002D; color: #fff; }
.notification.info    { background: #1565C0; color: #fff; }
.notif-enter-active, .notif-leave-active { transition: all 0.3s ease; }
.notif-enter-from, .notif-leave-to { opacity: 0; transform: translateY(-10px); }

/* ── Header ─────────────────────────────────────────────────────────────────── */
.panel-header {
  display: flex;
  align-items: Mitte;
  justify-content: space-between;
  margin-unten: 16px;
}
.panel-title { display: flex; align-items: baseline; gap: 12px; }
.title-accent {
  font-size: 22px;
  font-weight: 900;
  letter-spacing: 3px;
  color: #E8002D;
  text-transform: uppercase;
}
.friend-count { font-size: 14px; color: #8899aa; }
.btn-refresh {
  background: none;
  border: 1px solid #334;
  color: #8899aa;
  width: 36px;
  height: 36px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 20px;
  transition: all 0.2s;
}
.btn-refresh:hover { border-color: #E8002D; color: #E8002D; }
.spinning { display: inline-block; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Lobby-Einstellungen ────────────────────────────────────────────────────── */
.lobby-settings {
  background: #0a1520;
  border: 1px solid #1e3050;
  border-links: 3px solid #E8002D;
  border-radius: 6px;
  padding: 12px 16px;
  margin-unten: 20px;
}
.settings-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #E8002D;
  margin-unten: 10px;
  text-transform: uppercase;
}
.settings-row { display: flex; gap: 12px; flex-wrap: wrap; }
.setting-group { display: flex; flex-direction: column; gap: 4px; }
.setting-group label { font-size: 11px; color: #8899aa; letter-spacing: 1px; text-transform: uppercase; }
.setting-group select {
  background: #0d1b2a;
  border: 1px solid #2a3f5a;
  color: #e8eaf0;
  padding: 6px 10px;
  border-radius: 4px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}
.setting-group select:focus { outline: none; border-color: #E8002D; }

/* ── Lade-Zustand ───────────────────────────────────────────────────────────── */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: Mitte;
  justify-content: Mitte;
  gap: 12px;
  padding: 40px 20px;
  color: #8899aa;
}
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #1e3050;
  border-oben-color: #E8002D;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.empty-icon { font-size: 40px; }
.empty-text { font-size: 18px; font-weight: 700; color: #e8eaf0; }
.empty-hint { font-size: 14px; text-align: Mitte; }

/* ── Abschnitts-Labels ──────────────────────────────────────────────────────── */
.section-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 2px;
  padding: 6px 0 8px;
  text-transform: uppercase;
}
.section-label.online { color: #00C853; }
.section-label.offline { color: #556677; margin-oben: 16px; }

/* ── Freundeskarte ──────────────────────────────────────────────────────────── */
.friend-card {
  display: flex;
  align-items: Mitte;
  gap: 14px;
  background: #0d1b2a;
  border: 1px solid #1e3050;
  border-radius: 8px;
  padding: 12px 16px;
  margin-unten: 8px;
  transition: border-color 0.2s;
}
.friend-card.online { border-links: 3px solid #00C853; }
.friend-card.offline { border-links: 3px solid #334; opacity: 0.7; }
.friend-card.online:hover { border-color: #00C853; background: #0f2030; }

/* Avatar */
.friend-avatar {
  position: relative;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}
.friend-avatar img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}
.avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #1e3050;
  display: flex;
  align-items: Mitte;
  justify-content: Mitte;
  font-size: 22px;
  font-weight: 900;
  color: #E8002D;
}
.status-dot {
  position: absolute;
  unten: 2px;
  rechts: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #0d1b2a;
}
.status-dot.online { background: #00C853; }
.status-dot.offline { background: #556677; }

/* Infos */
.friend-info { flex: 1; min-width: 0; }
.friend-name { font-size: 18px; font-weight: 800; color: #fff; letter-spacing: 0.5px; }
.friend-status { font-size: 13px; color: #8899aa; margin-oben: 2px; }
.friend-status.in-match { color: #F5C842; }
.friend-stats { font-size: 13px; color: #556677; margin-oben: 2px; }

/* Aktionen */
.friend-actions { display: flex; gap: 8px; align-items: Mitte; flex-shrink: 0; }
.btn-h2h {
  background: #0a1520;
  border: 1px solid #2a3f5a;
  color: #8899aa;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  transition: all 0.2s;
}
.btn-h2h:hover { border-color: #F5C842; color: #F5C842; }
.btn-quickplay {
  background: #E8002D;
  border: none;
  color: #fff;
  padding: 10px 18px;
  border-radius: 6px;
  font-family: inherit;
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 1px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 100px;
  display: flex;
  align-items: Mitte;
  justify-content: Mitte;
  gap: 6px;
}
.btn-quickplay:hover:not(:disabled) { background: #ff1a3d; transform: scale(1.03); }
.btn-quickplay.disabled, .btn-quickplay:disabled { background: #334; color: #556677; cursor: not-alniedriged; transform: none; }
.btn-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255,255,255,0.3);
  border-oben-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* ── Head-to-Head Modal ─────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.8);
  z-index: 99998;
  display: flex;
  align-items: Mitte;
  justify-content: Mitte;
  padding: 20px;
}
.modal-content {
  background: #0d1b2a;
  border: 1px solid #1e3050;
  border-oben: 4px solid #E8002D;
  border-radius: 10px;
  width: 100%;
  max-width: 560px;
  max-height: 80vh;
  overflow-y: auto;
  padding: 24px;
}
.modal-header { position: relative; margin-unten: 20px; }
.modal-title {
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 4px;
  color: #E8002D;
  text-transform: uppercase;
}
.modal-subtitle {
  font-size: 28px;
  font-weight: 900;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.modal-close {
  position: absolute;
  oben: 0;
  rechts: 0;
  background: none;
  border: 1px solid #334;
  color: #8899aa;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}
.modal-close:hover { border-color: #E8002D; color: #E8002D; }
.modal-loading { display: flex; align-items: Mitte; gap: 12px; color: #8899aa; padding: 20px 0; }
.modal-empty { color: #8899aa; text-align: Mitte; padding: 30px 0; font-size: 16px; }

/* H2H Punkteboard */
.h2h-scoreboard {
  display: flex;
  align-items: Mitte;
  justify-content: Mitte;
  gap: 20px;
  background: #0a1520;
  border: 1px solid #1e3050;
  border-radius: 8px;
  padding: 20px;
  margin-unten: 12px;
}
.h2h-player { text-align: Mitte; flex: 1; }
.h2h-player-name { font-size: 13px; font-weight: 700; letter-spacing: 2px; color: #8899aa; text-transform: uppercase; }
.h2h-wins { font-size: 52px; font-weight: 900; color: #F5C842; line-height: 1; margin: 4px 0; }
.h2h-avg { font-size: 15px; color: #8899aa; }
.h2h-divider { font-size: 36px; font-weight: 900; color: #334; }
.h2h-total { text-align: Mitte; font-size: 14px; color: #556677; margin-unten: 20px; }

/* Match-Liste */
.h2h-matches-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #E8002D;
  margin-unten: 8px;
  text-transform: uppercase;
}
.h2h-match-row {
  display: flex;
  align-items: Mitte;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  margin-unten: 4px;
  font-size: 14px;
  border-links: 3px solid transparent;
}
.h2h-match-row.win { background: rgba(0,200,83,0.08); border-links-color: #00C853; }
.h2h-match-row.loss { background: rgba(232,0,45,0.06); border-links-color: #E8002D; }
.match-date { color: #556677; min-width: 80px; }
.match-result { font-weight: 800; color: #fff; min-width: 50px; }
.match-avg { color: #8899aa; flex: 1; }
.match-badge {
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 1px;
  padding: 3px 8px;
  border-radius: 3px;
  text-transform: uppercase;
}
.match-badge.win { background: #00C853; color: #fff; }
.match-badge.loss { background: #E8002D; color: #fff; }

/* ── Modal-Transition ───────────────────────────────────────────────────────── */
.modal-enter-active, .modal-leave-active { transition: all 0.25s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; transform: scale(0.95); }

/* ── v2.9.91: Stammgruppe ───────────────────────────────────────────────────── */
.regular-group-panel {
  margin: 12px 0 16px;
  padding: 12px 14px;
  background: linear-gradient(135deg, rgba(245,200,66,0.10), rgba(232,0,45,0.06));
  border: 1px solid rgba(245,200,66,0.35);
  border-radius: 6px;
}
.regular-group-header {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;
}
.regular-group-title {
  font-size: 11px; letter-spacing: 3px; color: #F5C842; font-weight: 900; text-transform: uppercase;
}
.regular-group-count {
  font-size: 10px; letter-spacing: 1.5px; color: #94A3B8; text-transform: uppercase; font-weight: 700;
}
.regular-group-hint {
  font-size: 12px; color: #94A3B8; margin-bottom: 10px; line-height: 1.4;
}
.btn-group-start {
  width: 100%;
  padding: 10px 16px;
  background: linear-gradient(90deg, #F5C842, #E8002D);
  color: #0D1B2A;
  border: none; border-radius: 6px;
  font-weight: 900; letter-spacing: 1px; text-transform: uppercase; font-size: 12px;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
}
.btn-group-start:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(245,200,66,0.35); }
.btn-group-start:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-star {
  width: 32px; height: 32px;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 4px;
  color: #64748B;
  font-size: 16px; line-height: 1;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease, background 0.15s ease, transform 0.15s ease;
}
.btn-star:hover { color: #F5C842; border-color: rgba(245,200,66,0.4); transform: scale(1.08); }
.btn-star.active {
  color: #F5C842;
  border-color: #F5C842;
  background: rgba(245,200,66,0.12);
  text-shadow: 0 0 8px rgba(245,200,66,0.6);
}

/* ── v2.9.98: Freundschaftsanfragen Deep-Link-Panel ─────────────────────── */
.friend-requests-link-panel {
  margin: 12px 0 16px;
  padding: 12px 14px;
  background: rgba(96,165,250,0.06);
  border: 1px solid rgba(96,165,250,0.28);
  border-left: 3px solid #60A5FA;
  border-radius: 6px;
}
.friend-requests-link-hint {
  font-size: 12px; color: #c8d4e0; line-height: 1.5; margin-bottom: 10px;
}
.friend-requests-link-hint b { color: #FFFFFF; }
.friend-requests-link-buttons {
  display: flex; gap: 8px; flex-wrap: wrap;
}
.btn-open-autodarts-friends {
  flex: 1 1 auto;
  padding: 8px 14px;
  background: #60A5FA;
  color: #0D1B2A;
  border: none; border-radius: 5px;
  font-weight: 700; letter-spacing: 0.5px; font-size: 12px;
  cursor: pointer; text-decoration: none;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.btn-open-autodarts-friends:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(96,165,250,0.4);
  background: #7BB4FB;
}
.btn-reload-friends {
  padding: 8px 14px;
  background: transparent;
  border: 1px solid rgba(255,255,255,0.15);
  color: #94A3B8;
  border-radius: 5px;
  font-weight: 700; font-size: 12px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}
.btn-reload-friends:hover:not(:disabled) { color: #FFFFFF; border-color: rgba(255,255,255,0.35); }
.btn-reload-friends:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
