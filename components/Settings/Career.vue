<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { AutodartsToolsGameData } from '@/utils/game-data-storage';
import { AutodartsToolsLobbyData } from '@/utils/lobby-data-storage';
import { createCareerLobby } from '@/utils/friends-api';
import { autoApplyVenueForDifficulty } from '@/utils/venue';
import {
  CareerEngine,
  DIFFICULTY_CONFIGS,
  PDC_TOURNAMENT_CALENDAR,
  PDC_ORDER_OF_MERIT_2026,
  CAREER_TROPHIES,
  CAREER_SPONSORS,
  CAREER_STORAGE_KEY,
  fetchLiveRankings,
  getLastRankingsFetchTime,
  buildTournamentField,
  type CareerSeason,
  type CareerTournament,
  type CareerMatchConfig,
  type CareerDifficulty,
  type PdcRankingEntry,
} from '@/utils/career-engine';

// ─── State ───────────────────────────────────────────────────────────────────

const season = ref<CareerSeason | null>(null);
const engine = ref<CareerEngine | null>(null);
const view = ref<'start' | 'dashboard' | 'calendar' | 'match_preview' | 'trophies' | 'rankings'>('start');
const selectedTournament = ref<CareerTournament | null>(null);
const pendingMatchConfig = ref<CareerMatchConfig | null>(null);
const isLoading = ref(false);
const showNewSeasonModal = ref(false);
const newPlayerName = ref('');
const newDifficulty = ref<CareerDifficulty>('amateur');

// ─── Session-State Persistenz ────────────────────────────────────────────────
// Career-Komponente wird bei URL-Wechsel unmountet (configVisible = false in App.vue).
// Deshalb view/selectedTournament/pendingMatchConfig in sessionStorage speichern
// damit sie beim nächsten Mount wiederhergestellt werden können.
const SESSION_VIEW_KEY = 'career-session-view';
const SESSION_TOURNAMENT_KEY = 'career-session-tournament';
const SESSION_MATCH_KEY = 'career-session-match';

// browser.storage.local ist in Firefox und Chrome identisch und überlebt
// vollständige Seitennavigationen (window.location.href = lobbyUrl).
// localStorage im Content Script ist in Firefox vom Seiten-Storage isoliert
// und deshalb nach Navigation leer — daher dieser Wechsel.
async function saveSessionState() {
  try {
    await browser.storage.local.set({
      [SESSION_VIEW_KEY]: view.value,
      [SESSION_TOURNAMENT_KEY]: JSON.stringify(selectedTournament.value),
      [SESSION_MATCH_KEY]: JSON.stringify(pendingMatchConfig.value),
    });
  } catch (e) { /* ignorieren */ }
}

async function restoreSessionState() {
  try {
    const result = await browser.storage.local.get([
      SESSION_VIEW_KEY,
      SESSION_TOURNAMENT_KEY,
      SESSION_MATCH_KEY,
    ]);
    const savedView = result[SESSION_VIEW_KEY] as typeof view.value | undefined;
    const savedTournament = result[SESSION_TOURNAMENT_KEY] as string | undefined;
    const savedMatch = result[SESSION_MATCH_KEY] as string | undefined;
    if (savedView && savedView !== 'start') {
      view.value = savedView;
    }
    if (savedTournament && savedTournament !== 'null') {
      selectedTournament.value = JSON.parse(savedTournament);
    }
    if (savedMatch && savedMatch !== 'null') {
      pendingMatchConfig.value = JSON.parse(savedMatch);
    }
  } catch (e) { /* ignorieren */ }
}

watch(view, saveSessionState);
watch(selectedTournament, saveSessionState);
watch(pendingMatchConfig, saveSessionState);

// Autodarts-Spieler (v2.8.3)
const autodartPlayer = ref<{ name: string; avatarUrl: string; average: number; checkoutRate: number; country: string } | null>(null);
const autodartPlayerLoading = ref(false);
const showPlayerSearch = ref(false);
const playerSearchQuery = ref('');

// Spieler-Suche togglen
function searchAutodartPlayer() {
  showPlayerSearch.value = !showPlayerSearch.value;
  playerSearchQuery.value = '';
}

// autodarts.io in neuem Tab öffnen
function openAutodartsSite() {
  const url = 'https://play.autodarts.io/';
  if (typeof browser !== 'undefined' && browser.tabs) {
    browser.tabs.create({ url });
  } else {
    window.open(url, '_blank');
  }
}

// Spieler nach Benutzernamen suchen und als autodartPlayer setzen
async function fetchPlayerByName() {
  if (!playerSearchQuery.value.trim()) return;
  autodartPlayerLoading.value = true;
  try {
    // Versuche Spieler aus dem Storage zu finden (nach Name)
    const allData = await browser.storage.local.get(null);
    const matchKeys = Object.keys(allData).filter(k => k.includes('match') || k.includes('game'));
    let found = false;
    for (const key of matchKeys) {
      const data = allData[key];
      if (data && typeof data === 'object') {
        const players = (data as any).players || (data as any).match?.players || [];
        for (const p of players) {
          const name = p?.user?.name || p?.name || '';
          if (name.toLowerCase().includes(playerSearchQuery.value.toLowerCase())) {
            autodartPlayer.value = {
              name: name,
              avatarUrl: p?.user?.avatarUrl || p?.avatarUrl || '',
              average: p?.user?.stats?.average ?? p?.stats?.average ?? 0,
              checkoutRate: p?.user?.stats?.checkoutRate ?? p?.stats?.checkoutRate ?? 0,
              country: p?.user?.country || '',
            };
            newPlayerName.value = name;
            if (autodartPlayer.value.average > 0) {
              newDifficulty.value = recommendDifficulty(autodartPlayer.value.average);
            }
            showPlayerSearch.value = false;
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
    if (!found) {
      // Fallback: Name direkt übernehmen
      autodartPlayer.value = {
        name: playerSearchQuery.value.trim(),
        avatarUrl: '',
        average: 0,
        checkoutRate: 0,
        country: '',
      };
      newPlayerName.value = playerSearchQuery.value.trim();
      showPlayerSearch.value = false;
    }
  } catch (e) {
    console.error('[Career] Spieler-Suche Fehler:', e);
  } finally {
    autodartPlayerLoading.value = false;
  }
}

// Autodarts-Spielerdaten aus dem letzten Match laden
async function loadAutodartPlayer() {
  autodartPlayerLoading.value = true;
  try {
    // 1. Versuche aus dem letzten Match den Host-Spieler zu laden
    // IMatch.host ist der Host-User, IMatch.players[n].user ist der Spieler
    // Der lokale Spieler ist derjenige dessen userId mit match.host.id übereinstimmt
    const gameData = await AutodartsToolsGameData.getValue();
    if (gameData?.match) {
      const match = gameData.match;
      const hostId = match.host?.id;
      let foundPlayer: any = null;
      if (hostId && match.players?.length) {
        // Suche Spieler dessen userId dem Host entspricht
        foundPlayer = match.players.find((p: any) => p.userId === hostId || (p as any).user?.id === hostId);
      }
      // Fallback: ersten Spieler nehmen
      if (!foundPlayer && match.players?.length) {
        foundPlayer = match.players[0];
      }
      // Aus host direkt lesen wenn kein Spieler gefunden
      const user = (foundPlayer as any)?.user ?? (match as any).host;
      if (user?.name) {
        autodartPlayer.value = {
          name: user.name,
          avatarUrl: (user as any)?.avatarUrl ?? (foundPlayer as any)?.avatarUrl ?? '',
          average: Math.round((user.average ?? 0) * 10) / 10,
          checkoutRate: Math.round((user.checkoutRate ?? 0) * 10) / 10,
          country: user.country ?? 'DEU',
        };
        console.log('[Career] Spieler aus Match geladen:', autodartPlayer.value.name);
        return;
      }
    }
    // 2. Fallback: Aus dem Lobby-Storage lesen
    const lobbyData = await AutodartsToolsLobbyData.getValue();
    if (lobbyData?.host?.name) {
      autodartPlayer.value = {
        name: lobbyData.host.name,
        avatarUrl: (lobbyData.host as any).avatarUrl ?? '',
        average: Math.round((lobbyData.host.average ?? 0) * 10) / 10,
        checkoutRate: Math.round((lobbyData.host.checkoutRate ?? 0) * 10) / 10,
        country: lobbyData.host.country ?? 'DEU',
      };
      console.log('[Career] Spieler aus Lobby geladen:', autodartPlayer.value.name);
      return;
    }
    // 3. Fallback: Aus dem local storage nach gespeichertem Spielernamen suchen
    const allData = await browser.storage.local.get(null);
    for (const key of Object.keys(allData)) {
      const val = allData[key];
      if (val && typeof val === 'object' && (val as any).playerName) {
        // Gespeicherte Karriere gefunden
        autodartPlayer.value = {
          name: (val as any).playerName,
          avatarUrl: '',
          average: 0,
          checkoutRate: 0,
          country: 'DEU',
        };
        console.log('[Career] Spieler aus gespeicherter Karriere geladen:', autodartPlayer.value.name);
        return;
      }
    }
    console.log('[Career] Kein Autodarts-Spieler gefunden');
  } catch (e) {
    console.warn('[Career] Autodarts-Spieler konnte nicht geladen werden:', e);
  } finally {
    autodartPlayerLoading.value = false;
  }
}

// Schwierigkeitsempfehlung basierend auf echtem Average (v2.8.3 – angepasst für 35–45 Avg Freizeitspieler)
function recommendDifficulty(average: number): CareerDifficulty {
  if (average >= 85) return 'elite';      // PDC-Niveau
  if (average >= 65) return 'pro';        // Fortgeschrittener
  if (average >= 45) return 'semipro';    // Vereinsspieler
  if (average >= 30) return 'amateur';    // Hobbyspieler (35–45 Avg → hier landen die meisten)
  return 'pub';                           // Freizeitspieler (unter 30)
}

// Autodarts-Spieler in Karriere übernehmen
const applySuccess = ref(false);
function applyAutodartPlayer() {
  if (!autodartPlayer.value) return;
  newPlayerName.value = autodartPlayer.value.name;
  if (autodartPlayer.value.average > 0) {
    newDifficulty.value = recommendDifficulty(autodartPlayer.value.average);
  } else {
    // Ohne Average: Hobbyspieler als Standard
    newDifficulty.value = 'amateur';
  }
  // Kurze visuelle Bestätigung
  applySuccess.value = true;
  setTimeout(() => { applySuccess.value = false; }, 2000);
}

// Match-Launch State (v2.8.5)
const matchLaunchSuccess = ref(false);

// Karriere-Match starten: Lobby mit korrekten Einstellungen erstellen und direkt navigieren
const lobbyCreating = ref(false);
const lobbyError = ref('');

async function launchCareerMatch() {
  if (!pendingMatchConfig.value || !season.value) return;
  if (lobbyCreating.value) return;

  lobbyCreating.value = true;
  lobbyError.value = '';
  matchLaunchSuccess.value = false;

  const cfg = pendingMatchConfig.value;

  // v2.9.65: Storage MUSS awaited werden bevor die Lobby-Navigation startet —
  // sonst kennt der Career-Bot-Hint in der Lobby die active-match-Config nicht.
  try {
    await browser.storage.local.set({
      'career-active-match': cfg,
      'local:career-active-match': cfg,
    });
  } catch (e) {
    console.error('[Career] Storage-Fehler:', e);
  }

  // Lobby-Einstellungen aus der Match-Config ableiten
  // Format: sets → sets/legs aus setsToWin/legsPerSet; legs → legsToWin
  const sets = cfg.format === 'sets' ? (cfg.setsToWin ?? 3) : 1;
  const legs = cfg.format === 'sets' ? (cfg.legsPerSet ?? 3) : (cfg.legsToWin ?? 5);

  const result = await createCareerLobby({
    startScore: 501,
    inMode: cfg.inMode as 'straight' | 'double' | 'master',
    outMode: cfg.outMode as 'double' | 'master' | 'straight',
    sets,
    legs,
  });

  lobbyCreating.value = false;

  if (result.success && result.lobbyUrl) {
    matchLaunchSuccess.value = true;
    console.log('[Career] Navigiere zur Lobby:', result.lobbyUrl);
    // Direkt zur Lobby navigieren (gleicher Tab – kein Popup-Blocker)
    window.location.href = result.lobbyUrl;
  } else {
    // Fehlermeldung anzeigen – kein stiller Fallback mehr
    lobbyError.value = result.error ?? 'Unbekannter Fehler';
    console.warn('[Career] Lobby-Erstellung fehlgeschlagen:', result.error);
    // Nur bei echtem Netzwerkfehler (nicht bei fehlendem Token) Fallback öffnen
    if (!result.error?.includes('eingeloggt')) {
      window.open('https://play.autodarts.io/', '_blank', 'noopener,noreferrer');
    }
  }
}

// Board-Finder: öffnet die Boards-Seite auf autodarts.io
// Synchron beim Klick öffnen (User-Gesture-Kontext erhalten)
function openBoardFinder() {
  window.open('https://play.autodarts.io/boards', '_blank', 'noopener,noreferrer');
}

// Live-Rangliste (v2.7.0 / v2.8.2)
const liveRankings = ref<PdcRankingEntry[]>(PDC_ORDER_OF_MERIT_2026);
const rankingsIsLive = ref(false);
const rankingsLastFetch = ref<Date | null>(null);
const rankingsLoading = ref(false);
const rankingsUpdateMessage = ref('');
const rankingsUpdateSuccess = ref(false);
let rankingsMessageTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Lifecycle ───────────────────────────────────────────────────────────────

onMounted(async () => {
  // Session-State zuerst wiederherstellen (view, selectedTournament, pendingMatchConfig)
  // damit nach URL-Wechsel und Re-Mount der korrekte Zustand angezeigt wird
  // WICHTIG: await — browser.storage.local ist async, muss vor loadSeason() fertig sein
  await restoreSessionState();
  await loadSeason();
  await loadLiveRankings();
  await loadAutodartPlayer();
});

// ─── Live-Rangliste laden (v2.7.0) ──────────────────────────────────────────

async function loadLiveRankings() {
  rankingsLoading.value = true;
  try {
    const result = await fetchLiveRankings();
    liveRankings.value = result.rankings;
    rankingsIsLive.value = result.isLive;
    rankingsLastFetch.value = await getLastRankingsFetchTime();
  } catch (e) {
    console.warn('[Career] Live-Rangliste konnte nicht geladen werden:', e);
    liveRankings.value = PDC_ORDER_OF_MERIT_2026;
    rankingsIsLive.value = false;
  } finally {
    rankingsLoading.value = false;
  }
}

// Manuelles Update der Weltrangliste (v2.8.2)
async function forceUpdateRankings() {
  if (rankingsLoading.value) return;
  rankingsLoading.value = true;
  rankingsUpdateMessage.value = '';
  if (rankingsMessageTimer) clearTimeout(rankingsMessageTimer);

  try {
    // Cache umgehen: direkt live abrufen
    const result = await fetchLiveRankings(true);
    liveRankings.value = result.rankings;
    rankingsIsLive.value = result.isLive;
    rankingsLastFetch.value = new Date();

    if (result.isLive) {
      rankingsUpdateSuccess.value = true;
      rankingsUpdateMessage.value = `✅ Weltrangliste erfolgreich aktualisiert! ${result.rankings.length} Spieler geladen (Stand: ${new Date().toLocaleDateString('de-DE')}).`;
    } else {
      rankingsUpdateSuccess.value = false;
      rankingsUpdateMessage.value = '⚠️ Live-Abruf nicht möglich – Fallback-Rangliste (Stand: 24.06.2026) wird verwendet.';
    }
  } catch (e) {
    rankingsUpdateSuccess.value = false;
    rankingsUpdateMessage.value = '❌ Fehler beim Abrufen der Weltrangliste. Bitte Internetverbindung prüfen.';
    console.error('[Career] Force-Update fehlgeschlagen:', e);
  } finally {
    rankingsLoading.value = false;
    // Nachricht nach 6 Sekunden ausblenden
    rankingsMessageTimer = setTimeout(() => {
      rankingsUpdateMessage.value = '';
    }, 6000);
  }
}

// Hilfsfunktionen: Storage über Background-Script routen (zuverlässig in Firefox + Chrome MV3)
async function careerStorageSet(key: string, value: any): Promise<void> {
  try {
    // Zuerst direkt versuchen (funktioniert in Chrome)
    await browser.storage.local.set({ [key]: value });
    console.log('[Career] Storage SET direkt:', key);
  } catch (e) {
    // Fallback: über Background-Script (Firefox)
    try {
      const resp = await browser.runtime.sendMessage({ type: 'CAREER_STORAGE_SET', key, value });
      if (resp?.ok) {
        console.log('[Career] Storage SET via Background:', key);
      } else {
        console.error('[Career] Storage SET via Background fehlgeschlagen:', resp?.error);
      }
    } catch (e2) {
      console.error('[Career] Storage SET komplett fehlgeschlagen:', e2);
    }
  }
}

async function careerStorageGet(key: string): Promise<any> {
  try {
    // Zuerst direkt versuchen (funktioniert in Chrome)
    const stored = await browser.storage.local.get(key);
    if (stored[key] !== undefined) {
      console.log('[Career] Storage GET direkt:', key);
      return stored[key];
    }
  } catch (e) {
    // Ignorieren, Fallback versuchen
  }
  // Fallback: über Background-Script (Firefox)
  try {
    const resp = await browser.runtime.sendMessage({ type: 'CAREER_STORAGE_GET', key });
    if (resp?.ok) {
      console.log('[Career] Storage GET via Background:', key, '->', resp.value ? 'gefunden' : 'leer');
      return resp.value;
    }
  } catch (e2) {
    console.error('[Career] Storage GET komplett fehlgeschlagen:', e2);
  }
  return null;
}

async function loadSeason() {
  try {
    const data = await careerStorageGet(CAREER_STORAGE_KEY);
    if (data) {
      season.value = data as CareerSeason;
      engine.value = new CareerEngine(season.value);
      // View nur auf 'dashboard' setzen wenn noch kein aktiver State vorhanden
      // (nicht überschreiben falls bereits 'calendar', 'match_preview' etc. aktiv)
      if (view.value === 'start') {
        view.value = 'dashboard';
      }
      console.log('[Career] Karriere geladen:', (season.value as any).playerName, '| View:', view.value);
    } else {
      console.log('[Career] Keine gespeicherte Karriere gefunden');
    }
  } catch (e) {
    console.error('[Career] Fehler beim Laden:', e);
  }
}

async function saveSeason() {
  if (!season.value) return;
  await careerStorageSet(CAREER_STORAGE_KEY, season.value);
  console.log('[Career] Karriere gespeichert:', (season.value as any).playerName);
}

// ─── Neue Karriere starten ───────────────────────────────────────────────────

async function startNewCareer() {
  const name = newPlayerName.value?.trim();
  if (!name) {
    console.warn('[Career] Kein Spielername eingegeben');
    return;
  }
  console.log('[Career] Starte neue Karriere für:', name, 'Schwierigkeit:', newDifficulty.value);
  isLoading.value = true;
  try {
    const newSeason = CareerEngine.createNewSeason(name, newDifficulty.value);
    console.log('[Career] Season erstellt:', newSeason);
    season.value = newSeason;
    engine.value = new CareerEngine(newSeason);
    await saveSeason();
    // v2.9.85 — Auto-Venue passend zur Difficulty setzen (falls Toggle an).
    try {
      const v = await autoApplyVenueForDifficulty(newDifficulty.value, false);
      if (v) console.log('[Career] Auto-Venue gesetzt:', v.name);
    } catch (e) {
      console.warn('[Career] Auto-Venue konnte nicht gesetzt werden', e);
    }
    console.log('[Career] Season gespeichert, wechsle zu Turnierkalender');
    showNewSeasonModal.value = false;
    view.value = 'calendar'; // Direkt zum Turnierkalender für das erste Spiel!
  } catch (err) {
    console.error('[Career] Fehler beim Starten der Karriere:', err);
  } finally {
    isLoading.value = false;
  }
}

// ─── Turnier auswählen ───────────────────────────────────────────────────────

function selectTournament(tournament: CareerTournament) {
  if (!engine.value) return;
  selectedTournament.value = tournament;
  pendingMatchConfig.value = engine.value.buildMatchConfig(tournament, 'Runde 1');
  view.value = 'match_preview';
  // v2.9.85 — Bei TV-Turnieren automatisch Ally-Pally-Atmosphäre laden
  // (überstimmt aktuelle Difficulty-Wahl für die Dauer des Turniers).
  if (tournament.isTvEvent && season.value) {
    autoApplyVenueForDifficulty(season.value.difficulty, true)
      .then((v) => { if (v) console.log('[Career] TV-Event Venue-Upgrade:', v.name); })
      .catch((e) => console.warn('[Career] TV-Venue-Upgrade fehlgeschlagen', e));
  }
}

// ─── v2.9.48: Karriere Export / Import (Backup-Datei) ─────────────────────────

function exportCareer() {
  if (!season.value) {
    alert('Keine aktive Saison zum Exportieren.');
    return;
  }
  const exportData = {
    version: 'v2.9.48',
    exportedAt: new Date().toISOString(),
    season: season.value,
  };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const playerName = (season.value as any).playerName?.replace(/[^\w]/g, '_') ?? 'unknown';
  a.href = url;
  a.download = `saison-${playerName}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('[Career] Karriere exportiert:', a.download);
}

function importCareer() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.season || !data.season.playerName) {
        alert('Ungültige Saison-Datei — es fehlt "season.playerName".');
        return;
      }
      if (season.value && !confirm(`Aktuelle Saison von "${(season.value as any).playerName}" wird überschrieben. Fortfahren?`)) {
        return;
      }
      season.value = data.season as CareerSeason;
      engine.value = new CareerEngine(season.value);
      await saveSeason();
      view.value = 'dashboard';
      console.log('[Career] Karriere importiert:', (season.value as any).playerName);
      alert(`✅ Karriere von "${(season.value as any).playerName}" wurde geladen.`);
    } catch (err) {
      console.error('[Career] Import-Fehler:', err);
      alert('Fehler beim Laden der Saison-Datei. Ist es eine gültige JSON-Datei?');
    }
  };
  input.click();
}

async function manualSaveCareer() {
  await saveSeason();
  alert(`💾 Karriere gespeichert: "${(season.value as any)?.playerName}"`);
}

// ─── Computed ────────────────────────────────────────────────────────────────

const availableTournaments = computed(() => {
  if (!engine.value) return [];
  return engine.value.getAvailableTournaments();
});

const difficultyConfig = computed(() => {
  if (!season.value) return null;
  return DIFFICULTY_CONFIGS[season.value.difficulty];
});

const rankingProgressPercent = computed(() => {
  if (!season.value) return 0;
  const max = 200;
  return Math.max(0, Math.min(100, Math.round(((max - season.value.worldRanking) / max) * 100)));
});

const tierLabel: Record<string, string> = {
  qschool: 'Q-School',
  secondary: 'Secondary Tour',
  protour: 'Pro Tour',
  major: '⭐ TV-Major',
  premier_league: '👑 Premier League',
  world_series: '🌍 World Series',
  world_cup: '🏳️ World Cup',
  world_championship: '🏆 WELTMEISTERSCHAFT',
};

const tierColor: Record<string, string> = {
  qschool: '#6B7280',
  secondary: '#9CA3AF',
  protour: '#60A5FA',
  major: '#F5C842',
  premier_league: '#E8002D',
  world_series: '#34D399',
  world_cup: '#A78BFA',
  world_championship: '#F5C842',
};

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);
}

// ─── v2.9.52: Saison-Timeline (Monat + Woche → 1..48) ─────────────────────────
const MONTH_NAMES = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

function weekOfYear(t: CareerTournament): number {
  return (t.month - 1) * 4 + t.week;
}

// Turniere chronologisch, gruppiert nach Monat
const seasonSchedule = computed(() => {
  const sorted = [...PDC_TOURNAMENT_CALENDAR].sort((a, b) => weekOfYear(a) - weekOfYear(b));
  const groups: { month: number; monthName: string; tournaments: CareerTournament[] }[] = [];
  for (const t of sorted) {
    let g = groups.find(x => x.month === t.month);
    if (!g) {
      g = { month: t.month, monthName: MONTH_NAMES[t.month - 1], tournaments: [] };
      groups.push(g);
    }
    g.tournaments.push(t);
  }
  return groups;
});

// Status pro Turnier basierend auf Saison-Verlauf
function getTournamentStatus(t: CareerTournament): 'completed' | 'next' | 'available' | 'locked_qual' | 'locked_time' {
  if (!season.value) return 'available';
  const done = season.value.completedTournaments.find(c => c.tournamentId === t.id);
  if (done) return 'completed';
  const isAvailable = availableTournaments.value.some(x => x.id === t.id);
  if (!isAvailable) return 'locked_qual';
  // Bereits nächstes Turnier chronologisch (kleinste nicht abgeschlossene, qualifizierte)
  return 'available';
}

const nextTournament = computed<CareerTournament | null>(() => {
  if (!season.value) return null;
  const sorted = [...PDC_TOURNAMENT_CALENDAR].sort((a, b) => weekOfYear(a) - weekOfYear(b));
  return sorted.find(t => {
    if (!season.value) return false;
    const done = season.value.completedTournaments.find(c => c.tournamentId === t.id);
    if (done) return false;
    return availableTournaments.value.some(x => x.id === t.id);
  }) ?? null;
});

// Fortschritt in Prozent
const seasonProgressPercent = computed(() => {
  if (!season.value) return 0;
  const total = PDC_TOURNAMENT_CALENDAR.filter(t => availableTournaments.value.some(x => x.id === t.id) || season.value!.completedTournaments.some(c => c.tournamentId === t.id)).length;
  if (total === 0) return 0;
  return Math.round((season.value.completedTournaments.length / total) * 100);
});

const seasonFinished = computed(() => {
  return !!season.value && nextTournament.value === null && season.value.completedTournaments.length > 0;
});

function resultBadge(res: string): { label: string; color: string; bg: string } {
  switch (res) {
    case 'won':       return { label: '🏆 CHAMPION', color: '#F5C842', bg: 'rgba(245,200,66,0.18)' };
    case 'runner_up': return { label: '🥈 Finale',   color: '#60A5FA', bg: 'rgba(96,165,250,0.15)' };
    case 'semi':      return { label: '🥉 Halbfinale', color: '#A78BFA', bg: 'rgba(167,139,250,0.15)' };
    case 'quarter':   return { label: 'Viertelfinale', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
    case 'r16':       return { label: 'Achtelfinale', color: '#94A3B8', bg: 'rgba(148,163,184,0.10)' };
    case 'r32':       return { label: 'Runde 2',     color: '#94A3B8', bg: 'rgba(148,163,184,0.10)' };
    case 'r64':       return { label: 'Runde 1',     color: '#94A3B8', bg: 'rgba(148,163,184,0.10)' };
    case 'eliminated':return { label: 'Ausgeschieden', color: '#F87171', bg: 'rgba(239,68,68,0.10)' };
    default:          return { label: res, color: '#94A3B8', bg: 'rgba(148,163,184,0.08)' };
  }
}

// Ranglisten-Tabelle: 5 Einträge rund um den Spieler, aus Live-Daten
const rankingsTableRows = computed(() => {
  if (!season.value) return [];
  const playerRank = season.value.worldRanking;
  const rows: Array<{ rank: number; name: string; prize: string; country: string; isPlayer: boolean }> = [];

  // 2 Plätze vor dem Spieler aus Live-Rangliste
  for (let offset = -2; offset <= 2; offset++) {
    const rank = playerRank + offset;
    if (rank < 1) continue;

    if (offset === 0) {
      // Der Spieler selbst
      rows.push({
        rank,
        name: (season.value as any).playerName,
        prize: formatMoney(season.value.totalPrizeMoney),
        country: 'DEU',
        isPlayer: true,
      });
    } else {
      // Echter Spieler aus Live-Rangliste (0-basiert: rank-1)
      const liveEntry = liveRankings.value[rank - 1];
      if (liveEntry) {
        rows.push({
          rank,
          name: liveEntry.name,
          prize: new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(liveEntry.earnings * 1000),
          country: liveEntry.country ?? '---',
          isPlayer: false,
        });
      } else {
        // Fallback wenn Rang nicht in Live-Daten
        rows.push({ rank, name: `Spieler #${rank}`, prize: '---', country: '---', isPlayer: false });
      }
    }
  }
  return rows;
});
</script>

<template>
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!--  PDC-SAISON-MODUS  –  Autodarts Extended Edition                     -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <div class="career-root" style="background: #0D1B2A; min-height: 100%; color: #F0F4F8; font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;">

    <!-- ─── STARTBILDSCHIRM (keine aktive Karriere) ──────────────────────── -->
    <div v-if="view === 'start'" class="career-start" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center;">
      <!-- Logo / Titel -->
      <div style="margin-bottom: 32px;">
        <div style="font-size: 14px; letter-spacing: 4px; color: #E8002D; text-transform: uppercase; margin-bottom: 8px;">Autodarts Extended Edition</div>
        <div style="font-size: 48px; font-weight: 900; color: #F5C842; letter-spacing: 2px; line-height: 1; text-transform: uppercase;">PDC</div>
        <div style="font-size: 36px; font-weight: 700; color: #FFFFFF; letter-spacing: 3px; text-transform: uppercase;">Karriere-Modus</div>
        <div style="width: 80px; height: 3px; background: #E8002D; margin: 16px auto;"></div>
        <div style="font-size: 16px; color: #94A3B8; max-width: 400px; line-height: 1.5;">
          Von der Q-School bis zur WM im Alexandra Palace. Erlebe eine echte PDC-Karriere an deiner eigenen Dartscheibe.
        </div>
      </div>

      <!-- Feature-Übersicht -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; max-width: 500px; margin-bottom: 32px; width: 100%;">
        <div v-for="feature in [
          { icon: '🎯', text: 'Alle echten PDC-Turnierformate' },
          { icon: '📺', text: 'TV-Atmosphäre bei Majors' },
          { icon: '🏆', text: 'WM im Alexandra Palace' },
          { icon: '⚡', text: 'Double-In beim World Grand Prix' },
          { icon: '👑', text: 'Premier League mit Top 8' },
          { icon: '🌍', text: 'World Series auf 5 Kontinenten' },
        ]" :key="feature.text"
          style="background: rgba(255,255,255,0.05); border: 1px solid rgba(245,200,66,0.2); border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">{{ feature.icon }}</span>
          <span style="font-size: 13px; color: #CBD5E1;">{{ feature.text }}</span>
        </div>
      </div>

      <!-- ─── STEP-BY-STEP ANLEITUNG ─────────────────────────────────── -->
      <div style="width: 100%; max-width: 520px; margin-bottom: 28px;">
        <div style="font-size: 11px; color: #64748B; letter-spacing: 3px; text-transform: uppercase; text-align: center; margin-bottom: 16px; font-weight: 700;">So startest du deine Saison</div>
        <div style="display: flex; flex-direction: column; gap: 0;">

          <!-- Schritt 1 -->
          <div style="display: flex; gap: 0; align-items: stretch;">
            <div style="display: flex; flex-direction: column; align-items: center; width: 40px; flex-shrink: 0;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: #E8002D; color: white; font-size: 14px; font-weight: 900; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">1</div>
              <div style="width: 2px; flex: 1; background: rgba(232,0,45,0.25); margin: 4px 0;"></div>
            </div>
            <div style="padding: 0 0 20px 14px;">
              <div style="font-size: 14px; font-weight: 700; color: #FFFFFF; margin-bottom: 3px;">Board verbinden</div>
              <div style="font-size: 12px; color: #94A3B8; line-height: 1.5;">Öffne <strong style="color: #60A5FA;">play.autodarts.io</strong> und stelle sicher, dass dein Autodarts-Board verbunden ist und erkannt wird.</div>
            </div>
          </div>

          <!-- Schritt 2 -->
          <div style="display: flex; gap: 0; align-items: stretch;">
            <div style="display: flex; flex-direction: column; align-items: center; width: 40px; flex-shrink: 0;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: #E8002D; color: white; font-size: 14px; font-weight: 900; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">2</div>
              <div style="width: 2px; flex: 1; background: rgba(232,0,45,0.25); margin: 4px 0;"></div>
            </div>
            <div style="padding: 0 0 20px 14px;">
              <div style="font-size: 14px; font-weight: 700; color: #FFFFFF; margin-bottom: 3px;">Karriere einrichten</div>
              <div style="font-size: 12px; color: #94A3B8; line-height: 1.5;">Klicke auf <strong style="color: #F5C842;">„Karriere starten"</strong>, gib deinen Namen ein und wähle die Schwierigkeit passend zu deinem Spielniveau.</div>
            </div>
          </div>

          <!-- Schritt 3 -->
          <div style="display: flex; gap: 0; align-items: stretch;">
            <div style="display: flex; flex-direction: column; align-items: center; width: 40px; flex-shrink: 0;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: #E8002D; color: white; font-size: 14px; font-weight: 900; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">3</div>
              <div style="width: 2px; flex: 1; background: rgba(232,0,45,0.25); margin: 4px 0;"></div>
            </div>
            <div style="padding: 0 0 20px 14px;">
              <div style="font-size: 14px; font-weight: 700; color: #FFFFFF; margin-bottom: 3px;">Turnier auswählen</div>
              <div style="font-size: 12px; color: #94A3B8; line-height: 1.5;">Im <strong style="color: #F5C842;">Turnierkalender</strong> siehst du alle verfügbaren Events der Saison. Wähle ein Turnier aus – grün = verfügbar, grau = noch nicht qualifiziert.</div>
            </div>
          </div>

          <!-- Schritt 4 -->
          <div style="display: flex; gap: 0; align-items: stretch;">
            <div style="display: flex; flex-direction: column; align-items: center; width: 40px; flex-shrink: 0;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: #E8002D; color: white; font-size: 14px; font-weight: 900; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">4</div>
              <div style="width: 2px; flex: 1; background: rgba(232,0,45,0.25); margin: 4px 0;"></div>
            </div>
            <div style="padding: 0 0 20px 14px;">
              <div style="font-size: 14px; font-weight: 700; color: #FFFFFF; margin-bottom: 3px;">Board finden & Match starten</div>
              <div style="font-size: 12px; color: #94A3B8; line-height: 1.5;">In der Match-Vorschau klicke auf <strong style="color: #60A5FA;">„Board finden"</strong> um dein Board auszuwählen, dann auf <strong style="color: #34D399;">„Match starten"</strong> – eine Lobby wird automatisch erstellt.</div>
            </div>
          </div>

          <!-- Schritt 5 -->
          <div style="display: flex; gap: 0; align-items: stretch;">
            <div style="display: flex; flex-direction: column; align-items: center; width: 40px; flex-shrink: 0;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #34D399, #059669); color: #0D1B2A; font-size: 14px; font-weight: 900; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">5</div>
            </div>
            <div style="padding: 0 0 0 14px;">
              <div style="font-size: 14px; font-weight: 700; color: #34D399; margin-bottom: 3px;">Spielen & aufsteigen</div>
              <div style="font-size: 12px; color: #94A3B8; line-height: 1.5;">Das HUD erscheint automatisch. Nach dem Match werden Ergebnis, Preisgeld und Weltrangliste aktualisiert. Qualifiziere dich für größere Turniere!</div>
            </div>
          </div>

        </div>
      </div>

      <!-- Start-Button -->
      <button
        @click="showNewSeasonModal = true"
        style="background: linear-gradient(135deg, #E8002D, #B00020); color: white; border: none; padding: 16px 48px; font-size: 20px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; border-radius: 4px; cursor: pointer; transition: all 0.2s;">
        🎯 Karriere starten
      </button>
    </div>

    <!-- ─── NEUE KARRIERE MODAL ───────────────────────────────────────────── -->
    <div v-if="showNewSeasonModal"
      style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px;">
      <div style="background: #0D1B2A; border: 2px solid #E8002D; border-radius: 8px; max-width: 480px; width: 100%; display: flex; flex-direction: column; max-height: calc(100vh - 32px);">
        <!-- Fixer Header -->
        <div style="padding: 20px 24px 16px 24px; border-bottom: 1px solid rgba(232,0,45,0.3); flex-shrink: 0;">
          <div style="font-size: 22px; font-weight: 700; color: #F5C842; text-transform: uppercase; letter-spacing: 2px;">Neue Saison</div>
        </div>
        <!-- Scrollbarer Inhalt -->
        <div style="padding: 20px 24px; overflow-y: auto; flex: 1;">

        <!-- ─── AUTODARTS-SPIELER ÜBERNEHMEN (v2.8.3) ───────────────────────────────────────────────────── -->
        <div v-if="autodartPlayer" style="margin-bottom: 20px; background: rgba(52,211,153,0.08); border: 1px solid rgba(52,211,153,0.25); border-radius: 8px; padding: 16px;">
          <div style="font-size: 11px; color: #34D399; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">Autodarts-Spieler erkannt</div>
          <div style="display: flex; align-items: center; gap: 14px;">
            <!-- Avatar -->
            <div style="flex-shrink: 0;">
              <img
                v-if="(autodartPlayer as any).avatarUrl"
                :src="(autodartPlayer as any).avatarUrl"
                style="width: 52px; height: 52px; border-radius: 50%; border: 2px solid #34D399; object-fit: cover;"
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              />
              <div v-else style="width: 52px; height: 52px; border-radius: 50%; border: 2px solid #34D399; background: rgba(52,211,153,0.15); display: flex; align-items: center; justify-content: center; font-size: 22px;">👤</div>
            </div>
            <!-- Spieler-Info -->
            <div style="flex: 1;">
              <div style="font-size: 18px; font-weight: 700; color: #FFFFFF;">{{ autodartPlayer.name }}</div>
              <div style="display: flex; gap: 16px; margin-top: 4px;">
                <span style="font-size: 12px; color: #94A3B8;">
                  Ø <strong style="color: #F5C842;">{{ autodartPlayer.average > 0 ? autodartPlayer.average : '---' }}</strong>
                </span>
                <span style="font-size: 12px; color: #94A3B8;">
                  Checkout: <strong style="color: #60A5FA;">{{ autodartPlayer.checkoutRate > 0 ? autodartPlayer.checkoutRate + '%' : '---' }}</strong>
                </span>
                <span v-if="autodartPlayer.average > 0" style="font-size: 12px; color: #94A3B8;">
                  Empfehlung: <strong :style="{ color: '#F59E0B' }">{{ DIFFICULTY_CONFIGS[recommendDifficulty(autodartPlayer.average)].label }}</strong>
                </span>
              </div>
            </div>
            <!-- Übernehmen-Button -->
            <button
              @click="applyAutodartPlayer"
              :style="{
                flexShrink: 0,
                background: applySuccess ? 'linear-gradient(135deg, #22C55E, #16A34A)' : 'linear-gradient(135deg, #34D399, #059669)',
                color: '#0D1B2A',
                border: 'none',
                borderRadius: '4px',
                padding: '10px 18px',
                fontSize: '13px',
                fontWeight: '700',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transform: applySuccess ? 'scale(0.97)' : 'scale(1)',
                transition: 'all 0.15s',
              }">
              {{ applySuccess ? '✅ Übernommen!' : '✔ Übernehmen' }}
            </button>
          </div>
        </div>

        <!-- Kein Autodarts-Spieler gefunden -->
        <div v-else-if="!autodartPlayerLoading" style="margin-bottom: 16px; background: rgba(148,163,184,0.06); border: 1px solid rgba(148,163,184,0.15); border-radius: 6px; padding: 12px 16px;">
          <div style="font-size: 12px; color: #6B7280; margin-bottom: 10px;">Kein Autodarts-Spieler erkannt. Spieler manuell suchen oder zuerst ein Match auf autodarts.io spielen.</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <!-- Spieler-Name manuell eingeben Hinweis -->
            <button
              @click="searchAutodartPlayer"
              :disabled="autodartPlayerLoading"
              style="background: rgba(96,165,250,0.15); color: #60A5FA; border: 1px solid rgba(96,165,250,0.35); border-radius: 4px; padding: 8px 14px; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              🔍 Spieler suchen
            </button>
            <button
              @click="openAutodartsSite"
              style="background: rgba(245,200,66,0.1); color: #F5C842; border: 1px solid rgba(245,200,66,0.3); border-radius: 4px; padding: 8px 14px; font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer;">
              autodarts.io ↗
            </button>
          </div>
          <!-- Suchfeld für Spielernamen -->
          <div v-if="showPlayerSearch" style="margin-top: 10px; display: flex; gap: 8px;">
            <input
              v-model="playerSearchQuery"
              @keyup.enter="fetchPlayerByName"
              placeholder="Autodarts-Benutzername eingeben..."
              style="flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(96,165,250,0.4); border-radius: 4px; padding: 8px 12px; color: white; font-size: 13px; outline: none;"
            />
            <button
              @click="fetchPlayerByName"
              :disabled="!playerSearchQuery.trim() || autodartPlayerLoading"
              style="background: #60A5FA; color: #0D1B2A; border: none; border-radius: 4px; padding: 8px 14px; font-size: 12px; font-weight: 700; cursor: pointer;">
              {{ autodartPlayerLoading ? '...' : 'OK' }}
            </button>
          </div>
        </div>

        <!-- Spielername -->
        <div style="margin-bottom: 20px;">
          <label style="display: block; font-size: 12px; color: #94A3B8; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">Dein Spielername</label>
          <input
            v-model="newPlayerName"
            placeholder="z.B. Max Mustermann"
            style="width: 100%; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 12px 16px; color: white; font-size: 16px; outline: none; box-sizing: border-box;"
          />
        </div>

        <!-- Schwierigkeit -->
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 12px; color: #94A3B8; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 12px;">Schwierigkeit</label>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div
              v-for="(config, key) in DIFFICULTY_CONFIGS"
              :key="key"
              @click="newDifficulty = key as CareerDifficulty"
              :style="{
                padding: '12px 16px',
                borderRadius: '4px',
                border: newDifficulty === key ? '2px solid #E8002D' : '1px solid rgba(255,255,255,0.15)',
                background: newDifficulty === key ? 'rgba(232,0,45,0.15)' : 'rgba(255,255,255,0.04)',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }">
              <div>
                <div style="font-size: 15px; font-weight: 600; color: white;">{{ config.label }}</div>
                <div style="font-size: 12px; color: #94A3B8; margin-top: 2px;">{{ config.description }}</div>
              </div>
              <div v-if="newDifficulty === key" style="color: #E8002D; font-size: 18px;">✓</div>
            </div>
          </div>
        </div>

        </div>
        <!-- Fixer Footer mit Buttons – immer sichtbar, nicht scrollbar -->
        <div style="padding: 16px 24px; border-top: 1px solid rgba(232,0,45,0.3); flex-shrink: 0; display: flex; gap: 12px; background: #0D1B2A; border-radius: 0 0 8px 8px;">
          <button
            @click="showNewSeasonModal = false"
            style="flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: #94A3B8; padding: 14px; border-radius: 4px; cursor: pointer; font-size: 14px;">
            Abbrechen
          </button>
          <button
            @click="startNewCareer"
            :disabled="isLoading"
            :style="{
              flex: 2,
              background: isLoading ? '#666' : 'linear-gradient(135deg, #E8002D, #B00020)',
              color: 'white',
              border: 'none',
              padding: '14px',
              borderRadius: '4px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: '700',
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }">
            {{ isLoading ? '⏳ Wird gestartet...' : '🎯 Karriere starten' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ─── KARRIERE DASHBOARD + ALLE SEASON-VIEWS ─────────────────────── -->
    <!-- Dieser Container ist für ALLE Views aktiv solange eine Karriere existiert -->
    <div v-if="season && (view === 'dashboard' || view === 'calendar' || view === 'trophies' || view === 'rankings' || view === 'match_preview')" style="padding: 20px;">

      <!-- Header: Spieler-Info (nur im Dashboard-Tab sichtbar) -->
      <div v-if="view === 'dashboard'" style="background: linear-gradient(135deg, #1a2e45, #0D1B2A); border: 1px solid rgba(245,200,66,0.3); border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
          <div>
            <div style="font-size: 11px; color: #E8002D; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 4px;">PDC-Saison</div>
            <div style="font-size: 32px; font-weight: 900; color: #FFFFFF; letter-spacing: 1px;">{{ (season as any).playerName }}</div>
            <div style="font-size: 14px; color: #94A3B8; margin-top: 4px;">
              {{ difficultyConfig?.label }} · Saison {{ season.year }}
              <span v-if="season.tourCardActive" style="color: #34D399; margin-left: 8px;">✓ Tour Card aktiv</span>
              <span v-else style="color: #F59E0B; margin-left: 8px;">⚠ Keine Tour Card</span>
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; color: #94A3B8; letter-spacing: 2px; text-transform: uppercase;">Weltrangliste</div>
            <div style="font-size: 48px; font-weight: 900; color: #F5C842; line-height: 1;">#{{ season.worldRanking }}</div>
          </div>
        </div>

        <!-- Statistik-Leiste -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
          <div style="text-align: center;">
            <div style="font-size: 11px; color: #94A3B8; letter-spacing: 1px; text-transform: uppercase;">Preisgeld</div>
            <div style="font-size: 20px; font-weight: 700; color: #34D399;">{{ formatMoney(season.totalPrizeMoney) }}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 11px; color: #94A3B8; letter-spacing: 1px; text-transform: uppercase;">Trophäen</div>
            <div style="font-size: 20px; font-weight: 700; color: #F5C842;">{{ season.trophies.length }}</div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 11px; color: #94A3B8; letter-spacing: 1px; text-transform: uppercase;">Turniere</div>
            <div style="font-size: 20px; font-weight: 700; color: #60A5FA;">{{ season.completedTournaments.length }}</div>
          </div>
        </div>

        <!-- Ranking-Fortschrittsbalken -->
        <div style="margin-top: 16px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; color: #94A3B8; margin-bottom: 6px;">
            <span>Weltranglisten-Fortschritt</span>
            <span>#{{ season.worldRanking }} von 200</span>
          </div>
          <div style="background: rgba(255,255,255,0.1); border-radius: 4px; height: 6px; overflow: hidden;">
            <div :style="{ width: rankingProgressPercent + '%', background: 'linear-gradient(90deg, #E8002D, #F5C842)', height: '100%', borderRadius: '4px', transition: 'width 0.5s ease' }"></div>
          </div>
        </div>
      </div><!-- Ende Spieler-Header -->

      <!-- Kompakter Spieler-Header für alle anderen Tabs (Kalender, Trophäen, Rangliste) -->
      <div v-if="view !== 'dashboard'" style="background: rgba(13,27,42,0.8); border: 1px solid rgba(245,200,66,0.2); border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-size: 11px; color: #E8002D; letter-spacing: 2px; text-transform: uppercase;">PDC-Saison</span>
          <span style="font-size: 18px; font-weight: 700; color: #FFFFFF; margin-left: 12px;">{{ (season as any).playerName }}</span>
        </div>
        <div style="display: flex; gap: 16px; align-items: center;">
          <span style="font-size: 13px; color: #94A3B8;">Rang <span style="color: #F5C842; font-weight: 700;">#{{ season.worldRanking }}</span></span>
          <span style="font-size: 13px; color: #34D399; font-weight: 700;">{{ formatMoney(season.totalPrizeMoney) }}</span>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; align-items: center;">
        <button
          v-for="tab in [
            { id: 'dashboard', label: '🏠 Dashboard' },
            { id: 'calendar', label: '📅 Saisonkalender' },
            { id: 'trophies', label: '🏆 Trophäen' },
            { id: 'rankings', label: '📊 Rangliste' },
          ]"
          :key="tab.id"
          @click="view = tab.id as any"
          :style="{
            padding: '8px 16px',
            borderRadius: '4px',
            border: view === tab.id ? '2px solid #E8002D' : '1px solid rgba(255,255,255,0.15)',
            background: view === tab.id ? 'rgba(232,0,45,0.2)' : 'rgba(255,255,255,0.05)',
            color: view === tab.id ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: view === tab.id ? '700' : '400',
          }">
          {{ tab.label }}
        </button>

        <!-- v2.9.48: Speicher-Aktionen -->
        <div style="margin-left: auto; display: flex; gap: 6px;">
          <button
            @click="manualSaveCareer"
            title="Saison jetzt speichern"
            style="padding: 8px 12px; border-radius: 4px; border: 1px solid rgba(52,211,153,0.3); background: rgba(52,211,153,0.08); color: #34D399; cursor: pointer; font-size: 12px;">
            💾 Speichern
          </button>
          <button
            @click="exportCareer"
            title="Karriere als Datei herunterladen (Backup)"
            style="padding: 8px 12px; border-radius: 4px; border: 1px solid rgba(96,165,250,0.3); background: rgba(96,165,250,0.08); color: #60A5FA; cursor: pointer; font-size: 12px;">
            📤 Exportieren
          </button>
          <button
            @click="importCareer"
            title="Karriere aus Datei laden"
            style="padding: 8px 12px; border-radius: 4px; border: 1px solid rgba(245,200,66,0.3); background: rgba(245,200,66,0.08); color: #F5C842; cursor: pointer; font-size: 12px;">
            📥 Importieren
          </button>
          <button
            @click="showNewSeasonModal = true"
            title="Neue Saison starten (löscht die aktuelle)"
            style="padding: 8px 12px; border-radius: 4px; border: 1px solid rgba(255,100,100,0.3); background: rgba(255,0,0,0.08); color: #F87171; cursor: pointer; font-size: 12px;">
            ↺ Neu
          </button>
        </div>
      </div>

      <!-- ─── SAISON-KALENDER v2.9.52 ─────────────────────────────────────── -->
      <div v-if="view === 'calendar'">
        <!-- Season Overview -->
        <div style="background: linear-gradient(135deg, rgba(232,0,45,0.08), rgba(245,200,66,0.05)); border: 1px solid rgba(245,200,66,0.25); border-radius: 8px; padding: 16px 20px; margin-bottom: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="font-size: 11px; color: #F5C842; letter-spacing: 3px; text-transform: uppercase; font-weight: 900;">Saisonkalender {{ season.year }}</div>
              <div style="font-size: 14px; color: #FFFFFF; margin-top: 2px;">
                {{ season.completedTournaments.length }} von {{ PDC_TOURNAMENT_CALENDAR.filter(t => availableTournaments.some(x => x.id === t.id) || season.completedTournaments.some(c => c.tournamentId === t.id)).length }} Turniere gespielt
              </div>
            </div>
            <div v-if="nextTournament && !seasonFinished" style="text-align: right;">
              <div style="font-size: 10px; color: #94A3B8; letter-spacing: 2px; text-transform: uppercase;">Nächstes Turnier</div>
              <div style="font-size: 16px; color: #E8002D; font-weight: 900; text-transform: uppercase;">{{ nextTournament.name }}</div>
              <div style="font-size: 11px; color: #94A3B8;">{{ MONTH_NAMES[nextTournament.month - 1] }}, Woche {{ nextTournament.week }}</div>
            </div>
          </div>
          <!-- Fortschrittsbalken -->
          <div style="background: rgba(0,0,0,0.4); height: 8px; border-radius: 4px; overflow: hidden;">
            <div :style="{ width: seasonProgressPercent + '%', background: 'linear-gradient(90deg, #E8002D, #F5C842)', height: '100%', transition: 'width 0.5s ease' }"></div>
          </div>
          <div style="font-size: 10px; color: #94A3B8; margin-top: 4px; text-align: right;">{{ seasonProgressPercent }}% der Saison</div>
        </div>

        <!-- Saison-Ende Screen -->
        <div v-if="seasonFinished" style="background: linear-gradient(135deg, rgba(245,200,66,0.2), rgba(245,200,66,0.05)); border: 2px solid rgba(245,200,66,0.5); border-radius: 12px; padding: 30px 24px; text-align: center; margin-bottom: 20px;">
          <div style="font-size: 12px; color: #F5C842; letter-spacing: 5px; text-transform: uppercase; margin-bottom: 8px;">Saison abgeschlossen</div>
          <div style="font-size: 34px; font-weight: 900; color: #FFFFFF; letter-spacing: 2px; margin-bottom: 20px;">SAISON {{ season.year }}</div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; max-width: 700px; margin: 0 auto 20px auto;">
            <div style="background: rgba(0,0,0,0.35); padding: 12px 14px; border-radius: 6px;">
              <div style="font-size: 9px; color: #94A3B8; letter-spacing: 2px; text-transform: uppercase;">Endrang</div>
              <div style="font-size: 22px; font-weight: 900; color: #F5C842;">#{{ season.worldRanking }}</div>
            </div>
            <div style="background: rgba(0,0,0,0.35); padding: 12px 14px; border-radius: 6px;">
              <div style="font-size: 9px; color: #94A3B8; letter-spacing: 2px; text-transform: uppercase;">Preisgeld</div>
              <div style="font-size: 22px; font-weight: 900; color: #34D399;">{{ formatMoney(season.totalPrizeMoney) }}</div>
            </div>
            <div style="background: rgba(0,0,0,0.35); padding: 12px 14px; border-radius: 6px;">
              <div style="font-size: 9px; color: #94A3B8; letter-spacing: 2px; text-transform: uppercase;">Turniere gespielt</div>
              <div style="font-size: 22px; font-weight: 900; color: #FFFFFF;">{{ season.completedTournaments.length }}</div>
            </div>
            <div style="background: rgba(0,0,0,0.35); padding: 12px 14px; border-radius: 6px;">
              <div style="font-size: 9px; color: #94A3B8; letter-spacing: 2px; text-transform: uppercase;">Titel</div>
              <div style="font-size: 22px; font-weight: 900; color: #F5C842;">{{ season.completedTournaments.filter(c => c.result === 'won').length }}</div>
            </div>
          </div>
          <button @click="showNewSeasonModal = true" style="background: linear-gradient(135deg, #E8002D, #B00020); color: white; border: none; padding: 14px 32px; font-size: 14px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; border-radius: 5px; cursor: pointer;">
            🎯 NEUE SAISON STARTEN
          </button>
        </div>

        <!-- Chronologische Turnierliste, gruppiert nach Monat -->
        <div v-for="group in seasonSchedule" :key="group.month" style="margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
            <div style="font-size: 14px; color: #F5C842; letter-spacing: 3px; text-transform: uppercase; font-weight: 900;">{{ group.monthName }}</div>
            <div style="flex: 1; height: 1px; background: linear-gradient(90deg, rgba(245,200,66,0.4), transparent);"></div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div
              v-for="tournament in group.tournaments"
              :key="tournament.id"
              :style="{
                background: getTournamentStatus(tournament) === 'next' || tournament.id === nextTournament?.id ? 'rgba(232,0,45,0.08)' : (getTournamentStatus(tournament) === 'completed' ? 'rgba(52,211,153,0.05)' : 'rgba(255,255,255,0.03)'),
                border: tournament.id === nextTournament?.id ? '2px solid #E8002D' : `1px solid ${getTournamentStatus(tournament) === 'completed' ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderLeft: `4px solid ${tierColor[tournament.tier]}`,
                borderRadius: '6px',
                padding: '12px 16px',
                opacity: getTournamentStatus(tournament) === 'locked_qual' ? 0.4 : 1,
                cursor: getTournamentStatus(tournament) === 'available' || tournament.id === nextTournament?.id ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }"
              @click="(getTournamentStatus(tournament) === 'available' || tournament.id === nextTournament?.id) && selectTournament(tournament)"
            >
              <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                    <span style="font-size: 10px; color: #64748B; letter-spacing: 1px; font-weight: 700;">W{{ tournament.week }}</span>
                    <span :style="{ fontSize: '9px', letterSpacing: '2px', textTransform: 'uppercase', color: tierColor[tournament.tier], fontWeight: '700' }">{{ tierLabel[tournament.tier] }}</span>
                    <span v-if="tournament.inMode === 'double'" style="background: #E8002D; color: white; font-size: 9px; padding: 1px 5px; border-radius: 3px; font-weight: 700;">DOUBLE-IN</span>
                    <span v-if="tournament.isTvEvent" style="background: rgba(245,200,66,0.2); color: #F5C842; font-size: 9px; padding: 1px 5px; border-radius: 3px; font-weight: 700;">TV</span>
                    <span v-if="tournament.id === nextTournament?.id" style="background: #E8002D; color: white; font-size: 9px; padding: 2px 8px; border-radius: 3px; font-weight: 900; letter-spacing: 1px; animation: pulse 1.5s infinite;">▶ AKTUELL</span>
                  </div>
                  <div style="font-size: 16px; font-weight: 700; color: #FFFFFF;">{{ tournament.name }}</div>
                  <div style="font-size: 11px; color: #94A3B8; margin-top: 2px;">📍 {{ tournament.venue }}</div>
                </div>
                <div style="text-align: right; flex-shrink: 0;">
                  <template v-if="getTournamentStatus(tournament) === 'completed'">
                    <div v-for="c in [season.completedTournaments.find(x => x.tournamentId === tournament.id)]" :key="c?.tournamentId ?? 'x'">
                      <div v-if="c" :style="{ background: resultBadge(c.result).bg, color: resultBadge(c.result).color, fontSize: '11px', padding: '4px 10px', borderRadius: '3px', fontWeight: '900', letterSpacing: '1px', textTransform: 'uppercase' }">
                        {{ resultBadge(c.result).label }}
                      </div>
                      <div v-if="c" style="font-size: 12px; color: #34D399; font-weight: 700; margin-top: 4px;">+{{ formatMoney(c.prizeMoneyEarned) }}</div>
                    </div>
                  </template>
                  <template v-else>
                    <div style="font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px;">Sieger</div>
                    <div style="font-size: 14px; font-weight: 700; color: #34D399;">{{ formatMoney(tournament.prizeMoneyWinner) }}</div>
                  </template>
                </div>
              </div>
              <div v-if="getTournamentStatus(tournament) === 'locked_qual'" style="font-size: 10px; color: #6B7280; margin-top: 6px;">
                🔒 Qualifikation erforderlich (Top {{ tournament.qualificationRank ?? 'Tour Card' }})
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── TROPHÄEN ────────────────────────────────────────────────────── -->
      <div v-if="view === 'trophies'">
        <div style="font-size: 18px; font-weight: 700; color: #F5C842; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">Trophäen & Errungenschaften</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px;">
          <div
            v-for="trophy in CAREER_TROPHIES"
            :key="trophy.id"
            :style="{
              background: season.trophies.find(t => t.id === trophy.id) ? 'rgba(245,200,66,0.1)' : 'rgba(255,255,255,0.03)',
              border: season.trophies.find(t => t.id === trophy.id) ? '1px solid rgba(245,200,66,0.4)' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              padding: '16px',
              opacity: season.trophies.find(t => t.id === trophy.id) ? 1 : 0.4,
              textAlign: 'center',
            }">
            <div style="font-size: 32px; margin-bottom: 8px;">{{ trophy.icon }}</div>
            <div style="font-size: 14px; font-weight: 700; color: #FFFFFF; margin-bottom: 4px;">{{ trophy.name }}</div>
            <div style="font-size: 11px; color: #94A3B8; line-height: 1.4;">{{ trophy.description }}</div>
            <div v-if="season.trophies.find(t => t.id === trophy.id)" style="font-size: 10px; color: #F5C842; margin-top: 8px;">
              ✓ Erreicht
            </div>
          </div>
        </div>
      </div>

      <!-- ─── RANGLISTE ───────────────────────────────────────────────────── -->
      <div v-if="view === 'rankings'">

        <!-- Header mit Update-Button -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
          <div style="font-size: 18px; font-weight: 700; color: #F5C842; text-transform: uppercase; letter-spacing: 2px;">PDC Order of Merit</div>

          <!-- Live-Status + Update-Button -->
          <div style="display: flex; align-items: center; gap: 10px;">
            <!-- Status-Badge -->
            <div :style="{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: rankingsIsLive ? 'rgba(52,211,153,0.12)' : 'rgba(148,163,184,0.1)',
              border: rankingsIsLive ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(148,163,184,0.2)',
              borderRadius: '20px', padding: '4px 12px',
            }">
              <!-- Pulsierender Punkt -->
              <span :style="{ width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', background: rankingsIsLive ? '#34D399' : '#6B7280' }"></span>
              <span style="font-size: 11px; letter-spacing: 1px; text-transform: uppercase;" :style="{ color: rankingsIsLive ? '#34D399' : '#6B7280' }">
                {{ rankingsIsLive ? 'Live' : 'Fallback' }}
              </span>
            </div>

            <!-- Letzter Abruf -->
            <div v-if="rankingsLastFetch" style="font-size: 11px; color: #6B7280;">
              Stand: {{ rankingsLastFetch.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) }}
            </div>

            <!-- Update-Button -->
            <button
              @click="forceUpdateRankings"
              :disabled="rankingsLoading"
              :style="{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: rankingsLoading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #E8002D, #B00020)',
                color: rankingsLoading ? '#6B7280' : '#FFFFFF',
                border: 'none', borderRadius: '4px',
                padding: '8px 16px', fontSize: '12px', fontWeight: '700',
                letterSpacing: '1px', textTransform: 'uppercase',
                cursor: rankingsLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
              }">
              <span :style="{ display: 'inline-block', animation: rankingsLoading ? 'spin 1s linear infinite' : 'none' }">🔄</span>
              {{ rankingsLoading ? 'Lädt...' : 'Rangliste aktualisieren' }}
            </button>
          </div>
        </div>

        <!-- Erfolgs-/Fehlermeldung nach Update -->
        <div v-if="rankingsUpdateMessage"
          :style="{
            padding: '10px 16px', borderRadius: '6px', marginBottom: '16px',
            fontSize: '13px', fontWeight: '600',
            background: rankingsUpdateSuccess ? 'rgba(52,211,153,0.12)' : 'rgba(232,0,45,0.12)',
            border: rankingsUpdateSuccess ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(232,0,45,0.3)',
            color: rankingsUpdateSuccess ? '#34D399' : '#F87171',
          }">
          {{ rankingsUpdateMessage }}
        </div>

        <!-- Ranglisten-Tabelle -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; overflow: hidden;">
          <div style="display: grid; grid-template-columns: 60px 1fr 120px 120px; background: rgba(232,0,45,0.2); padding: 10px 16px; font-size: 11px; color: #94A3B8; letter-spacing: 2px; text-transform: uppercase;">
            <div>Rang</div><div>Spieler</div><div style="text-align: right;">Preisgeld</div><div style="text-align: right;">Land</div>
          </div>

          <!-- Spieler-Umgebung aus Live-Rangliste -->
          <div
            v-for="(player, idx) in rankingsTableRows"
            :key="idx"
            :style="{
              display: 'grid',
              gridTemplateColumns: '60px 1fr 120px 120px',
              padding: '12px 16px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              background: player.isPlayer ? 'rgba(232,0,45,0.12)' : 'transparent',
              fontWeight: player.isPlayer ? '700' : '400',
            }">
            <div :style="{ color: player.isPlayer ? '#F5C842' : '#94A3B8', fontSize: '16px', fontWeight: '700' }">#{{ player.rank }}</div>
            <div :style="{ color: player.isPlayer ? '#FFFFFF' : '#CBD5E1', fontSize: '15px' }">
              {{ player.isPlayer ? '👤 ' : '' }}{{ player.name }}
            </div>
            <div :style="{ color: player.isPlayer ? '#34D399' : '#94A3B8', textAlign: 'right', fontSize: '14px' }">{{ player.prize }}</div>
            <div style="color: #6B7280; text-align: right; font-size: 13px;">{{ player.country }}</div>
          </div>
        </div>

        <!-- Info-Text -->
        <div style="margin-top: 12px; font-size: 11px; color: #4B5563; text-align: center;">
          Quelle: dartsrankings.com · Automatische Aktualisierung alle 24 Stunden
        </div>
      </div>

      <!-- ─── MATCH VORSCHAU ─────────────────────────────────────────────── -->
            <div v-if="view === 'match_preview' && pendingMatchConfig && selectedTournament" style="padding-top: 4px;">

        <!-- Zurück-Button -->
        <button @click="view = 'calendar'" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 12px; margin-bottom: 16px; padding: 0; letter-spacing: 2px; text-transform: uppercase;">
          ← KALENDER
        </button>

        <!-- Turnier-Header -->
        <div :style="{
          background: 'linear-gradient(135deg, rgba(13,27,42,0.98) 0%, rgba(20,40,60,0.95) 100%)',
          borderLeft: `4px solid ${tierColor[selectedTournament.tier]}`,
          border: '1px solid rgba(255,255,255,0.08)',
          borderLeftWidth: '4px',
          borderLeftColor: tierColor[selectedTournament.tier],
          borderRadius: '6px',
          padding: '20px 24px',
          marginBottom: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }">
          <div>
            <div :style="{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: tierColor[selectedTournament.tier], marginBottom: '6px', fontWeight: '700' }">{{ tierLabel[selectedTournament.tier] }}</div>
            <div style="font-size: 24px; font-weight: 900; color: #FFFFFF; line-height: 1.1;">{{ selectedTournament.name }}</div>
            <div style="font-size: 12px; color: #64748B; margin-top: 4px;">{{ selectedTournament.venue }}</div>
          </div>
          <div v-if="pendingMatchConfig.isTvMatch" style="background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.35); border-radius: 4px; padding: 6px 12px; font-size: 10px; font-weight: 700; color: #34D399; letter-spacing: 2px; text-transform: uppercase; white-space: nowrap; margin-left: 16px;">
            📺 TV-MATCH
          </div>
        </div>

        <!-- Duell: Spieler vs Gegner -->
        <div style="display: grid; grid-template-columns: 1fr 56px 1fr; margin-bottom: 14px; background: rgba(13,27,42,0.98); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden;">
          <!-- Spieler -->
          <div style="padding: 22px 18px; text-align: center; border-right: 1px solid rgba(255,255,255,0.06);">
            <div style="font-size: 10px; color: #60A5FA; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px; font-weight: 700;">DU</div>
            <div style="font-size: 20px; font-weight: 900; color: #FFFFFF; margin-bottom: 5px;">{{ season?.playerName }}</div>
            <div style="font-size: 12px; color: #60A5FA; font-weight: 600; letter-spacing: 1px;">RANG #{{ season?.worldRanking }}</div>
          </div>
          <!-- VS -->
          <div style="display: flex; align-items: center; justify-content: center; background: rgba(232,0,45,0.06);">
            <div style="font-size: 16px; font-weight: 900; color: #E8002D; letter-spacing: 2px;">VS</div>
          </div>
          <!-- Gegner -->
          <div style="padding: 22px 18px; text-align: center; border-left: 1px solid rgba(255,255,255,0.06); background: rgba(232,0,45,0.03);">
            <div style="font-size: 10px; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px; font-weight: 700;">
              <span v-if="pendingMatchConfig.opponent.isNemesis" style="color: #F59E0B;">⚔️ NEMESIS</span>
              <span v-else style="color: #94A3B8;">GEGNER</span>
            </div>
            <div style="font-size: 20px; font-weight: 900; color: #FFFFFF; margin-bottom: 5px;">{{ pendingMatchConfig.opponent.name }}</div>
            <div style="font-size: 12px; color: #94A3B8; font-weight: 600; letter-spacing: 1px;">RANG #{{ pendingMatchConfig.opponent.worldRanking }}</div>
            <div style="font-size: 11px; color: #4B5563; margin-top: 3px;">Ø {{ pendingMatchConfig.opponent.averageMin }}–{{ pendingMatchConfig.opponent.averageMax }}</div>
          </div>
        </div>

        <!-- Match-Format Leiste -->
        <div style="background: rgba(13,27,42,0.98); border: 1px solid rgba(245,200,66,0.2); border-left: 4px solid #F5C842; border-radius: 6px; padding: 14px 20px; margin-bottom: 14px;">
          <div style="font-size: 10px; color: #F5C842; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 10px; font-weight: 700;">MATCH-FORMAT</div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            <div>
              <div style="font-size: 10px; color: #4B5563; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px;">Format</div>
              <div style="font-size: 14px; font-weight: 800; color: #FFFFFF;">
                {{ pendingMatchConfig.format === 'sets' ? `BO${(pendingMatchConfig.setsToWin ?? 3) * 2 - 1} Sets` : `BO${(pendingMatchConfig.legsToWin ?? 4) * 2 - 1} Legs` }}
              </div>
            </div>
            <div>
              <div style="font-size: 10px; color: #4B5563; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px;">Einwurf</div>
              <div :style="{ fontSize: '14px', fontWeight: '800', color: pendingMatchConfig.inMode === 'double' ? '#E8002D' : '#FFFFFF' }">
                {{ pendingMatchConfig.inMode === 'double' ? 'DOUBLE' : 'STRAIGHT' }}
              </div>
            </div>
            <div>
              <div style="font-size: 10px; color: #4B5563; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px;">Auswerfen</div>
              <div style="font-size: 14px; font-weight: 800; color: #FFFFFF;">DOUBLE</div>
            </div>
            <div>
              <div style="font-size: 10px; color: #4B5563; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px;">Preisgeld</div>
              <div style="font-size: 14px; font-weight: 800; color: #34D399;">{{ formatMoney((pendingMatchConfig as any).earnings) }}</div>
            </div>
          </div>
        </div>

        <!-- TV-Hinweis -->
        <div v-if="pendingMatchConfig.isTvMatch" style="background: rgba(52,211,153,0.05); border: 1px solid rgba(52,211,153,0.15); border-radius: 6px; padding: 8px 16px; margin-bottom: 14px; font-size: 11px; color: #34D399; letter-spacing: 1px; text-align: center;">
          Walk-On Song · Crowd-Atmosphäre · KI-Kommentator werden automatisch aktiviert
        </div>

        <!-- Aktions-Leiste -->
        <div style="background: rgba(13,27,42,0.98); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 16px 20px;">
          <div style="display: flex; gap: 10px; align-items: stretch;">
            <button
              @click="openBoardFinder"
              :disabled="lobbyCreating"
              style="background: rgba(96,165,250,0.08); color: #60A5FA; border: 1px solid rgba(96,165,250,0.25); padding: 0 20px; font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; border-radius: 4px; cursor: pointer; white-space: nowrap; min-height: 52px;">
              BOARD FINDEN
            </button>
            <button
              @click="launchCareerMatch"
              :disabled="lobbyCreating"
              :style="{
                flex: '1',
                background: lobbyCreating ? 'rgba(232,0,45,0.35)' : 'linear-gradient(135deg, #E8002D 0%, #B00020 100%)',
                color: 'white',
                border: 'none',
                padding: '0 28px',
                fontSize: '16px',
                fontWeight: '900',
                letterSpacing: '3px',
                textTransform: 'uppercase',
                borderRadius: '4px',
                cursor: lobbyCreating ? 'not-allowed' : 'pointer',
                minHeight: '52px'
              }">
              {{ lobbyCreating ? 'LOBBY WIRD ERSTELLT...' : 'MATCH STARTEN' }}
            </button>
          </div>
          <div v-if="matchLaunchSuccess" style="margin-top: 10px; font-size: 11px; color: #34D399; text-align: center; letter-spacing: 2px; text-transform: uppercase;">
            ✓ LOBBY ERSTELLT — WEITERLEITUNG...
          </div>
          <div v-if="lobbyError" style="margin-top: 10px; font-size: 11px; color: #F87171; text-align: center;">
            {{ lobbyError }} — autodarts.io wurde als Fallback geöffnet
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<style scoped>
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.5; }
}
</style>
