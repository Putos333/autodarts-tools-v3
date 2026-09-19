<script setup lang="ts">
/**
 * Popup.vue — Toolbar-Icon Popup (v2.9.86)
 *
 * Zeigt beim Klick auf das Extension-Icon:
 *  - Version + Status-LED (Backend erreichbar? Selektor-Health OK?)
 *  - 5 Schnell-Toggles für die wichtigsten Features
 *  - Button "Einstellungen öffnen" → wechselt zu play.autodarts.io und
 *    zeigt das Settings-Panel
 *  - Backend-Ping (Latenz-Anzeige)
 */
import { ref, onMounted, computed } from "vue";
import { AutodartsToolsConfig } from "@/utils/storage";
import { getBackendUrl } from "@/utils/backend-url";
import { COIN_SHOP, spendCoins, type CoinShopItem, type DartCoinsState } from "@/utils/dart-coins";

const version = ref("2.9.98"); // synchron mit package.json halten
const backendStatus = ref<"checking" | "ok" | "error">("checking");
const backendLatencyMs = ref<number | null>(null);
const backendUrl = ref<string>("");
const wsStatus = ref<"unknown" | "connected" | "disconnected" | "error">("unknown");
const wsInfo = ref<string>("");
const coinBalance = ref<number>(0);
const coinTotalEarned = ref<number>(0);
const coinUnlocked = ref<string[]>([]);
const showShop = ref<boolean>(false);

const config = ref<any>(null);
const activeMode = ref<"autodarts" | "elite">("autodarts");

const toggles = ref({
  caller: false,
  crowd: false,
  animations: false,
  screenshot: false,
  career: false,
});

const statusColor = computed(() => {
  if (backendStatus.value === "ok") return "#10B981";
  if (backendStatus.value === "error") return "#EF4444";
  return "#F59F00";
});

const statusLabel = computed(() => {
  if (backendStatus.value === "ok") return `Aktiv · Backend OK (${backendLatencyMs.value ?? "?"}ms)`;
  if (backendStatus.value === "error") return "Backend nicht erreichbar";
  return "Prüfe Backend …";
});

onMounted(async () => {
  try {
    const cfg = await AutodartsToolsConfig.getValue();
    config.value = cfg;
    toggles.value.caller = !!cfg?.caller?.enabled;
    toggles.value.crowd = !!cfg?.crowd?.enabled;
    toggles.value.animations = !!cfg?.animations?.enabled;
    toggles.value.screenshot = !!cfg?.screenshot?.enabled;
    toggles.value.career = !!cfg?.career?.enabled;
  } catch (e) {
    console.warn("[Popup] config konnte nicht geladen werden", e);
  }
  backendUrl.value = getBackendUrl(config.value?.aiCommentator?.backendUrl);
  await pingBackend();
  await readWsStatus();
  await readCoins();
  await readLastMode();
});

// ── AUTODARTS / ELITE — Signature-Umschalter ─────────────────────────────
async function readLastMode() {
  try {
    const r = await browser.storage.local.get("adt-popup-mode");
    const m = (r as any)["adt-popup-mode"];
    if (m === "elite" || m === "autodarts") activeMode.value = m;
  } catch { /* ignore */ }
}

async function selectMode(mode: "autodarts" | "elite") {
  activeMode.value = mode;
  try {
    await browser.storage.local.set({ "adt-popup-mode": mode });
  } catch { /* ignore */ }
  if (mode === "elite") {
    openControlCenter();
  } else {
    openAutodarts();
  }
}

async function readCoins() {
  try {
    const r = await browser.storage.local.get('career-season-v1');
    const season = (r as any)['career-season-v1'];
    const dc = season?.dartCoins;
    if (dc) {
      coinBalance.value = dc.balance ?? 0;
      coinTotalEarned.value = dc.totalEarned ?? 0;
      coinUnlocked.value = Array.isArray(dc.unlockedItemIds) ? dc.unlockedItemIds : [];
    }
  } catch { /* ignore */ }
}

async function buyItem(item: CoinShopItem) {
  try {
    const r = await browser.storage.local.get('career-season-v1');
    const season = (r as any)['career-season-v1'];
    if (!season?.dartCoins) {
      alert('Starte erst eine Karriere, um Coins zu verdienen.');
      return;
    }
    const res = spendCoins(season.dartCoins as DartCoinsState, item.price, item.id);
    if (!res.ok) {
      if (res.reason === 'insufficient-balance') {
        alert(`Nicht genug Coins.\nBenötigt: ${item.price}\nDu hast: ${season.dartCoins.balance}`);
      } else if (res.reason === 'already-unlocked') {
        alert('Bereits freigeschaltet.');
      }
      return;
    }
    season.dartCoins = res.state;
    await browser.storage.local.set({ 'career-season-v1': season });
    coinBalance.value = res.state.balance;
    coinUnlocked.value = res.state.unlockedItemIds;
    alert(`✅ ${item.labelDe} freigeschaltet!\n\n${item.descriptionDe}`);
  } catch (e) {
    console.warn('[Popup] buyItem failed', e);
    alert('Kauf fehlgeschlagen: ' + (e as Error).message);
  }
}

const shopItems = computed(() => COIN_SHOP);

async function readWsStatus() {
  try {
    const r = await browser.storage.local.get('adt-ws-status');
    const s = (r as any)['adt-ws-status'];
    if (s && typeof s.status === 'string') {
      wsStatus.value = s.status;
      wsInfo.value = s.info ?? '';
    }
  } catch { /* ignore */ }
}

async function pingBackend() {
  const url = backendUrl.value.replace(/\/+$/, "") + "/api/marathon/health";
  const started = performance.now();
  try {
    const r = await fetch(url, { method: "GET", cache: "no-cache" });
    if (r.ok) {
      backendStatus.value = "ok";
      backendLatencyMs.value = Math.round(performance.now() - started);
    } else {
      backendStatus.value = "error";
    }
  } catch {
    backendStatus.value = "error";
  }
}

async function toggle(key: keyof typeof toggles.value) {
  toggles.value[key] = !toggles.value[key];
  try {
    const cfg = await AutodartsToolsConfig.getValue();
    if (!(cfg as any)[key]) (cfg as any)[key] = {};
    ((cfg as any)[key] as any).enabled = toggles.value[key];
    await AutodartsToolsConfig.setValue(cfg);
  } catch (e) {
    console.warn("[Popup] toggle failed", e);
  }
}

function openAutodarts() {
  try {
    browser.tabs.create({ url: "https://play.autodarts.io/" });
    window.close();
  } catch {
    /* ignore */
  }
}

function openOptions() {
  // Wir haben (noch) keine echte options_page — direkter Sprung zu play.autodarts.io,
  // dort öffnet der In-Page Settings-Hub. Reload triggert Content-Script + Panel.
  try {
    browser.tabs.create({ url: "https://play.autodarts.io/#adt-open-settings" });
    window.close();
  } catch {
    /* ignore */
  }
}

// ── Control Center — eigene Extension-Seite (controlcenter.html) ─────────
function openControlCenter() {
  try {
    browser.tabs.create({ url: browser.runtime.getURL("/controlcenter.html") });
    window.close();
  } catch {
    /* ignore */
  }
}

// ── v2.9.87 — Settings Export / Import ──────────────────────────────────

const busy = ref<'' | 'export' | 'import' | 'csv'>('');

async function exportSettings() {
  busy.value = 'export';
  try {
    // Alles in storage.local exportieren (Config + Storage-Keys wie Venue, Career, etc.)
    const all = await browser.storage.local.get(null as any);
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autodarts-tools-settings-${date}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    console.warn('[Popup] Export failed', e);
    alert('Export fehlgeschlagen: ' + (e as Error).message);
  } finally {
    busy.value = '';
  }
}

async function importSettings(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  busy.value = 'import';
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Ungültiges Backup-Format');
    }
    if (!confirm(`Wirklich importieren?\n\n${Object.keys(data).length} Schlüssel gefunden.\nAlle aktuellen Einstellungen werden ÜBERSCHRIEBEN.`)) {
      busy.value = '';
      input.value = '';
      return;
    }
    await browser.storage.local.clear();
    await browser.storage.local.set(data);
    alert('Import erfolgreich! autodarts.io-Tabs werden nach Reload aktualisiert.');
    // Reload alle Tabs auf autodarts.io
    try {
      const tabs = await browser.tabs.query({ url: [ '*://play.autodarts.io/*', '*://play.autodarts.com/*' ] });
      for (const t of tabs) if (t.id) await browser.tabs.reload(t.id);
    } catch { /* ignore */ }
  } catch (e) {
    console.warn('[Popup] Import failed', e);
    alert('Import fehlgeschlagen: ' + (e as Error).message);
  } finally {
    busy.value = '';
    input.value = '';
  }
}

// ── v2.9.87 — Turnier-Historie CSV-Export + Match-Log CSV ───────────────

async function exportCareerCsv() {
  busy.value = 'csv';
  try {
    const CAREER_STORAGE_KEY = 'career-season-v1';
    const raw = await browser.storage.local.get(CAREER_STORAGE_KEY);
    const season = (raw as any)[CAREER_STORAGE_KEY];
    if (!season || !season.completedTournaments) {
      alert('Keine Karriere-Historie gefunden. Starte erst eine Karriere.');
      return;
    }
    // Match-Log bevorzugt (v2.9.87), sonst fällt auf completedTournaments zurück
    const matchLog = Array.isArray(season.matchLog) ? season.matchLog : [];
    let csv: string;
    let filename: string;
    if (matchLog.length > 0) {
      csv = matchLogToCsv(matchLog);
      filename = `autodarts-tools-matches-${new Date().toISOString().slice(0, 10)}.csv`;
    } else {
      csv = tournamentsToCsv(season.completedTournaments, season.playerName ?? '');
      filename = `autodarts-tools-tournaments-${new Date().toISOString().slice(0, 10)}.csv`;
    }
    downloadTextFile(csv, filename, 'text/csv;charset=utf-8');
  } catch (e) {
    console.warn('[Popup] CSV-Export failed', e);
    alert('CSV-Export fehlgeschlagen: ' + (e as Error).message);
  } finally {
    busy.value = '';
  }
}

function tournamentsToCsv(list: any[], playerName: string): string {
  const header = ['Woche', 'Turnier', 'Ergebnis', 'Preisgeld_EUR', 'Player', 'Avg', '180s', 'Best_Checkout'];
  const rows = list.map((t) => [
    String(t.week ?? ''),
    csvEscape(t.tournamentName ?? t.tournamentId ?? ''),
    csvEscape(t.result ?? ''),
    String(t.prizeMoneyEarned ?? 0),
    csvEscape(playerName),
    (Number(t.playerAverage ?? 0)).toFixed(2),
    String(t.best180s ?? 0),
    String(t.bestCheckout ?? 0),
  ].join(','));
  return [header.join(','), ...rows].join('\n');
}

function matchLogToCsv(list: any[]): string {
  const header = ['Datum', 'Turnier', 'Runde', 'Gegner', 'Ergebnis', 'Legs_Ich', 'Legs_Gegner', 'Avg', 'Gegner_Avg', 'Checkout_Quote_Prozent', 'HighCO', 'Anzahl_180'];
  const rows = list.map((m) => [
    csvEscape(m.date ?? ''),
    csvEscape(m.tournamentName ?? m.tournamentId ?? ''),
    csvEscape(m.round ?? ''),
    csvEscape(m.opponent ?? ''),
    csvEscape(m.result ?? ''),
    String(m.legsWon ?? 0),
    String(m.legsLost ?? 0),
    (Number(m.playerAverage ?? 0)).toFixed(2),
    (Number(m.opponentAverage ?? 0)).toFixed(2),
    (Number(m.checkoutQuotePct ?? 0)).toFixed(1),
    String(m.highCheckout ?? 0),
    String(m.player180s ?? 0),
  ].join(','));
  return [header.join(','), ...rows].join('\n');
}

function csvEscape(v: string): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadTextFile(text: string, filename: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const wsColor = computed(() => {
  if (wsStatus.value === 'connected') return '#10B981';
  if (wsStatus.value === 'disconnected' || wsStatus.value === 'error') return '#EF4444';
  return '#6b7385';
});
const wsLabel = computed(() => {
  if (wsStatus.value === 'connected') return 'Board verbunden';
  if (wsStatus.value === 'disconnected') return 'Board getrennt';
  if (wsStatus.value === 'error') return 'Board-Fehler';
  return 'Board-Status unbekannt';
});
</script>

<template>
  <div class="popup-root" data-testid="popup-root">
    <!-- Header -->
    <header class="popup-header">
      <div class="logo">🎯</div>
      <div class="title">
        <div class="title-main">Tools for Autodarts</div>
        <div class="title-version" data-testid="popup-version">v{{ version }}</div>
      </div>
      <div class="coin-badge" @click="showShop = !showShop" data-testid="coin-badge" :title="`Lifetime verdient: ${coinTotalEarned}`">
        <span class="coin-icon">🪙</span>
        <span class="coin-balance" data-testid="coin-balance">{{ coinBalance }}</span>
      </div>
    </header>

    <!-- AUTODARTS / ELITE — Signature-Umschalter -->
    <div class="mode-switch" role="group" aria-label="Bereich wählen" data-testid="mode-switch">
      <button
        class="mode-btn mode-autodarts"
        :class="{ active: activeMode === 'autodarts' }"
        :aria-pressed="activeMode === 'autodarts'"
        @click="selectMode('autodarts')"
        data-testid="btn-play"
      >
        <span class="mode-icon">🎯</span>
        <span>Autodarts</span>
      </button>
      <button
        class="mode-btn mode-elite"
        :class="{ active: activeMode === 'elite' }"
        :aria-pressed="activeMode === 'elite'"
        @click="selectMode('elite')"
        data-testid="btn-control-center"
      >
        <span class="mode-icon">⚡</span>
        <span>Elite</span>
      </button>
    </div>

    <!-- Coin Shop (togglable) -->
    <div v-if="showShop" class="shop" data-testid="coin-shop">
      <div class="shop-header">
        <span class="shop-title">🛒 Dart-Coin Shop</span>
        <button class="shop-close" @click="showShop = false" data-testid="shop-close">×</button>
      </div>
      <div class="shop-hint">Verdiene Coins: 180er = 25 · Match-Sieg = 50 · Turnier = 500 · 9-Darter = 1000</div>
      <div v-for="item in shopItems" :key="item.id"
           class="shop-item"
           :class="{ unlocked: coinUnlocked.includes(item.id), affordable: coinBalance >= item.price && !coinUnlocked.includes(item.id) }"
           :data-testid="`shop-item-${item.id}`">
        <div class="shop-item-icon">{{ item.icon }}</div>
        <div class="shop-item-body">
          <div class="shop-item-label">{{ item.labelDe }}</div>
          <div class="shop-item-desc">{{ item.descriptionDe }}</div>
        </div>
        <button v-if="coinUnlocked.includes(item.id)" class="btn small unlocked-btn" disabled>✓ Freigeschaltet</button>
        <button v-else class="btn small" :class="{ primary: coinBalance >= item.price }"
                :disabled="coinBalance < item.price"
                @click="buyItem(item)"
                :data-testid="`shop-buy-${item.id}`">
          🪙 {{ item.price }}
        </button>
      </div>
    </div>

    <!-- Status LED (Backend) -->
    <div class="status-row" data-testid="popup-status">
      <span class="led" :style="{ background: statusColor }" data-testid="status-led" />
      <span class="status-text">{{ statusLabel }}</span>
    </div>

    <!-- v2.9.87 — WS-Board-Status -->
    <div class="status-row" data-testid="popup-ws-status">
      <span class="led" :style="{ background: wsColor }" data-testid="ws-led" />
      <span class="status-text">{{ wsLabel }}<span v-if="wsInfo" class="ws-info"> · {{ wsInfo }}</span></span>
    </div>

    <!-- Quick Toggles -->
    <div class="toggles" data-testid="popup-toggles">
      <button class="toggle" :class="{ on: toggles.caller }"
              @click="toggle('caller')" data-testid="toggle-caller">
        <span class="toggle-emoji">🎙️</span>
        <span class="toggle-label">Caller</span>
        <span class="toggle-state">{{ toggles.caller ? "AN" : "AUS" }}</span>
      </button>
      <button class="toggle" :class="{ on: toggles.crowd }"
              @click="toggle('crowd')" data-testid="toggle-crowd">
        <span class="toggle-emoji">📣</span>
        <span class="toggle-label">Crowd</span>
        <span class="toggle-state">{{ toggles.crowd ? "AN" : "AUS" }}</span>
      </button>
      <button class="toggle" :class="{ on: toggles.animations }"
              @click="toggle('animations')" data-testid="toggle-animations">
        <span class="toggle-emoji">✨</span>
        <span class="toggle-label">Animationen</span>
        <span class="toggle-state">{{ toggles.animations ? "AN" : "AUS" }}</span>
      </button>
      <button class="toggle" :class="{ on: toggles.screenshot }"
              @click="toggle('screenshot')" data-testid="toggle-screenshot">
        <span class="toggle-emoji">📷</span>
        <span class="toggle-label">Screenshots</span>
        <span class="toggle-state">{{ toggles.screenshot ? "AN" : "AUS" }}</span>
      </button>
      <button class="toggle" :class="{ on: toggles.career }"
              @click="toggle('career')" data-testid="toggle-career">
        <span class="toggle-emoji">🏆</span>
        <span class="toggle-label">Karriere</span>
        <span class="toggle-state">{{ toggles.career ? "AN" : "AUS" }}</span>
      </button>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button class="btn ghost" @click="openOptions" data-testid="btn-settings">
        Einstellungen
      </button>
    </div>

    <!-- v2.9.87 — Backup / Export -->
    <div class="backup" data-testid="popup-backup">
      <div class="backup-title">Backup &amp; Export</div>
      <div class="backup-row">
        <button class="btn ghost small" @click="exportSettings" :disabled="busy !== ''"
                data-testid="btn-export-settings">
          {{ busy === 'export' ? 'Export …' : '⬇️ Einstellungen JSON' }}
        </button>
        <label class="btn ghost small" :class="{ disabled: busy !== '' }"
               data-testid="btn-import-settings">
          {{ busy === 'import' ? 'Import …' : '⬆️ Import JSON' }}
          <input type="file" accept="application/json,.json"
                 style="display:none;"
                 @change="importSettings"
                 data-testid="input-import-settings" />
        </label>
      </div>
      <button class="btn ghost small full" @click="exportCareerCsv" :disabled="busy !== ''"
              data-testid="btn-export-career-csv">
        {{ busy === 'csv' ? 'CSV …' : '📊 Karriere-Historie als CSV' }}
      </button>
    </div>

    <div class="footer">
      Emergent · Open Source · <a href="https://darts-caller-ext.emergent.host" target="_blank" rel="noopener">Website</a>
    </div>
  </div>
</template>

<style scoped>
.popup-root {
  padding: 14px 14px 12px;
  background: linear-gradient(180deg, #0d1b2a 0%, #10233a 100%);
}
.popup-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.title { flex: 1; }
.coin-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: linear-gradient(135deg, #F5C842 0%, #f2b91a 100%);
  border-radius: 20px;
  color: #0d1b2a;
  font-weight: 800;
  font-size: 13px;
  cursor: pointer;
  transition: transform 0.15s;
  box-shadow: 0 2px 8px rgba(245,200,66,0.3);
}
.coin-badge:hover { transform: scale(1.05); }
.coin-icon { font-size: 14px; }

.shop {
  background: rgba(0,0,0,0.25);
  border: 1px solid rgba(245,200,66,0.25);
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 12px;
  animation: shopSlide 0.2s ease-out;
}
@keyframes shopSlide { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
.shop-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 4px;
}
.shop-title { font-weight: 800; color: #F5C842; font-size: 13px; letter-spacing: 0.5px; }
.shop-close {
  background: transparent; color: #8992a8; border: none;
  font-size: 20px; line-height: 1; cursor: pointer; padding: 0 4px;
}
.shop-close:hover { color: #e8eaf0; }
.shop-hint {
  color: #8992a8; font-size: 10px; margin-bottom: 8px;
  padding-bottom: 6px; border-bottom: 1px dashed rgba(255,255,255,0.08);
}
.shop-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 0;
  border-top: 1px solid rgba(255,255,255,0.05);
}
.shop-item:first-of-type { border-top: none; }
.shop-item-icon { font-size: 22px; }
.shop-item-body { flex: 1; }
.shop-item-label { font-size: 11px; font-weight: 700; color: #e8eaf0; }
.shop-item-desc { font-size: 10px; color: #8992a8; margin-top: 2px; line-height: 1.35; }
.shop-item.unlocked { opacity: 0.5; }
.unlocked-btn { background: rgba(16,185,129,0.15) !important; color: #10B981 !important; border-color: rgba(16,185,129,0.35) !important; cursor: default; }
.logo {
  font-size: 26px;
  line-height: 1;
}
.title-main {
  font-family: "Barlow Condensed", "Arial Narrow", sans-serif;
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #F5C842;
}
.title-version {
  font-size: 10px;
  color: #8992a8;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-top: 2px;
}
.status-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.04);
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 11px;
}
.led {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 6px currentColor;
  flex-shrink: 0;
}
.status-text {
  color: #cdd2df;
}
.ws-info {
  color: #8992a8;
  font-size: 10px;
}
.backup {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 4px;
  padding: 8px 10px;
  margin-bottom: 10px;
}
.backup-title {
  font-size: 10px;
  color: #8992a8;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 6px;
  font-weight: 700;
}
.backup-row {
  display: flex;
  gap: 6px;
  margin-bottom: 6px;
}
.btn.small {
  padding: 6px 8px;
  font-size: 10px;
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.btn.small.full { width: 100%; flex: unset; }
.btn.ghost.disabled { pointer-events: none; opacity: 0.5; }
.toggles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 12px;
}
.toggle {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 8px 10px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 4px;
  color: #e8eaf0;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  font-family: inherit;
  text-align: left;
}
.toggle:hover { background: rgba(255,255,255,0.08); }
.toggle.on {
  border-color: #F5C842;
  background: rgba(245,200,66,0.12);
}
.toggle-emoji { font-size: 16px; }
.toggle-label { font-size: 11px; font-weight: 600; }
.toggle-state {
  font-size: 9px;
  letter-spacing: 1px;
  color: #F5C842;
  font-weight: 800;
}
.toggle:not(.on) .toggle-state { color: #6b7385; }

.mode-switch {
  display: flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 14px;
  background: rgba(0,0,0,0.3);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
}
.mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 8px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: #8992a8;
  font-family: inherit;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s, transform 0.1s;
}
.mode-btn:hover { color: #e8eaf0; background: rgba(255,255,255,0.07); }
.mode-btn:active { transform: scale(0.98); }
.mode-btn:focus-visible {
  outline: 2px solid #F5C842;
  outline-offset: 2px;
}
.mode-btn.mode-autodarts.active {
  background: #e8eaf0;
  color: #0d1b2a;
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
}
.mode-btn.mode-elite { color: #F5C842; }
.mode-btn.mode-elite:hover { color: #ffe08a; background: rgba(245,200,66,0.1); }
.mode-btn.mode-elite.active {
  background: linear-gradient(90deg, #F5C842 0%, #E8002D 100%);
  color: #0d1b2a;
  box-shadow: 0 3px 12px rgba(232,0,45,0.4);
}
.mode-icon { font-size: 14px; line-height: 1; }

.actions {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
}
.btn {
  flex: 1;
  padding: 8px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border: 1px solid transparent;
  transition: all 0.15s;
}
.btn.primary {
  background: #F5C842;
  color: #0d1b2a;
}
.btn.primary:hover { background: #f2b91a; }
.btn.ghost {
  background: transparent;
  border-color: rgba(255,255,255,0.15);
  color: #e8eaf0;
}
.btn.ghost:hover { background: rgba(255,255,255,0.05); }

.footer {
  text-align: center;
  color: #6b7385;
  font-size: 10px;
  border-top: 1px solid rgba(255,255,255,0.06);
  padding-top: 8px;
}
.footer a { color: #F5C842; text-decoration: none; }
.footer a:hover { text-decoration: underline; }
</style>
