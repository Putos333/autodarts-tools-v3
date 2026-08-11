<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import {
  PDC_TOURNAMENT_CALENDAR,
  PDC_OPPONENTS,
  DIFFICULTY_CONFIGS,
  isTournamentUnlocked,
  type CareerTournament,
  type CareerMatchConfig,
  type CareerOpponent,
  type CareerDifficulty,
} from '@/utils/career-engine';
import { createCareerLobby } from '@/utils/friends-api';
import { getBackendUrl } from '@/utils/backend-url';
import { setActiveCareerMatch, CAREER_ACTIVE_MATCH_KEY } from '@/entrypoints/match.content/career-match';

// ─── State ───────────────────────────────────────────────────────────────────
type TournamentFilter = 'all' | 'pdc' | 'europe' | 'major' | 'world_series';
const activeFilter = ref<TournamentFilter>('all');
const selectedTournament = ref<CareerTournament | null>(null);
const selectedRound = ref<string>('Runde 1');
const selectedDifficulty = ref<CareerDifficulty>('semipro');
const currentOpponent = ref<CareerOpponent | null>(null);
const lobbyCreating = ref(false);
const lobbyError = ref('');
const lobbySuccess = ref(false);

// ─── Bracket-Progression State ────────────────────────────────────────────────
// Speichert das aktuell laufende Turnier: welche Runde wurde zuletzt gewonnen,
// nächste Runde, gesamtes Preisgeld, komplette Bracket-Historie.
interface TournamentBracketState {
  tournamentId: string;
  tournamentName: string;
  difficulty: CareerDifficulty;
  currentRound: string;      // Runde die als NÄCHSTES gespielt wird
  matchesPlayed: {
    round: string;
    opponentName: string;
    opponentRanking: number;
    won: boolean;
    prizeMoney: number;
  }[];
  totalPrize: number;
  finished: boolean;         // true wenn Endergebnis (Sieg im Finale oder Niederlage)
  finalResult: 'champion' | 'runner_up' | 'semi' | 'quarter' | 'r16' | 'r32' | 'eliminated' | null;
}

const bracket = ref<TournamentBracketState | null>(null);
const lastMatchResult = ref<'won' | 'lost' | null>(null);

// v2.9.80 – Marathon-Modus State
const marathonMode = ref<boolean>(false);
const marathonStartTs = ref<number | null>(null);

const TM_TOURNAMENT_KEY = 'tm-session-tournament';
const TM_ROUND_KEY = 'tm-session-round';
const TM_DIFFICULTY_KEY = 'tm-session-difficulty';
const TM_BRACKET_KEY = 'tm-active-bracket';
const TM_LAST_RESULT_KEY = 'tm-last-match-result';
const TM_MARATHON_KEY = 'tm-marathon-mode';
const TM_MARATHON_START_KEY = 'tm-marathon-start-ts';

// ─── v2.9.90: Tour-Card + Season-Progression (nur Turnier-Modus) ─────────────
// Vollständig unabhängig vom Karriere-Modus (der eine eigene CareerSeason
// in browser.storage.local hält). Der freie Turnier-Modus bekommt hier seinen
// eigenen, einfachen Flag + Zähler.
const TM_TOUR_CARD_KEY = 'tm-tour-card-active';
const TM_SEASON_COMPLETED_KEY = 'tm-season-completed';
const TM_SEASON_PRIZE_KEY = 'tm-season-prize';
const TM_SEASON_LOG_KEY = 'tm-season-log';

// Standard-Saison: 10 Turniere, 250.000 £ Preisgeld nötig um die Tour Card
// zu verlängern. Beides ist konfigurierbar über Storage-Keys, damit die UI
// später Slider anbieten kann ohne Code-Änderung.
const SEASON_LENGTH_DEFAULT = 10;
const SEASON_THRESHOLD_DEFAULT = 250_000;

const tourCardActive = ref<boolean>(false);
const seasonCompleted = ref<number>(0);
const seasonPrize = ref<number>(0);
const seasonLength = ref<number>(SEASON_LENGTH_DEFAULT);
const seasonThreshold = ref<number>(SEASON_THRESHOLD_DEFAULT);
// Log der bereits absolvierten Turniere pro Saison — für UI-Historie.
interface SeasonLogEntry { tournamentId: string; tournamentName: string; finalResult: string; prize: number; ts: number; }
const seasonLog = ref<SeasonLogEntry[]>([]);
// Letzte Season-Auswertung — wird nach Season-Ende als Banner gezeigt.
const seasonReviewMessage = ref<string>('');

async function loadTourCardState() {
  try {
    const res = await browser.storage.local.get([
      TM_TOUR_CARD_KEY, TM_SEASON_COMPLETED_KEY, TM_SEASON_PRIZE_KEY, TM_SEASON_LOG_KEY,
    ]);
    tourCardActive.value = res[TM_TOUR_CARD_KEY] === true;
    seasonCompleted.value = typeof res[TM_SEASON_COMPLETED_KEY] === 'number' ? res[TM_SEASON_COMPLETED_KEY] : 0;
    seasonPrize.value = typeof res[TM_SEASON_PRIZE_KEY] === 'number' ? res[TM_SEASON_PRIZE_KEY] : 0;
    seasonLog.value = Array.isArray(res[TM_SEASON_LOG_KEY]) ? res[TM_SEASON_LOG_KEY] : [];
  } catch (_) { /* ignore */ }
}

async function persistTourCardState() {
  try {
    await browser.storage.local.set({
      [TM_TOUR_CARD_KEY]: tourCardActive.value,
      [TM_SEASON_COMPLETED_KEY]: seasonCompleted.value,
      [TM_SEASON_PRIZE_KEY]: seasonPrize.value,
      [TM_SEASON_LOG_KEY]: seasonLog.value,
    });
  } catch (_) { /* ignore */ }
}

/**
 * Sperr-Check für die Kachel-Ansicht.
 */
function isTournamentLocked(t: CareerTournament): boolean {
  return !isTournamentUnlocked(t, tourCardActive.value);
}

/**
 * Fortschritt der laufenden Saison als 0..100.
 */
const seasonProgressPercent = computed(() => {
  if (!seasonLength.value) return 0;
  return Math.min(100, Math.round((seasonCompleted.value / seasonLength.value) * 100));
});

/**
 * Wird am Ende jedes non-Q-School-Turniers aufgerufen. Setzt Zähler +
 * Preisgeld hoch; bei Erreichen der Saison-Länge wird ausgewertet:
 *   • Preisgeld ≥ Schwelle  → Tour-Card verlängert, Saison-Reset
 *   • Preisgeld <  Schwelle → Tour-Card verloren, zurück zur Q-School
 */
async function advanceSeasonAfterTournament(entry: SeasonLogEntry) {
  seasonCompleted.value += 1;
  seasonPrize.value += Math.max(0, entry.prize | 0);
  seasonLog.value = [...seasonLog.value, entry].slice(-100);

  if (seasonCompleted.value >= seasonLength.value) {
    const kept = seasonPrize.value >= seasonThreshold.value;
    if (kept) {
      seasonReviewMessage.value =
        `Saison beendet: ${seasonPrize.value.toLocaleString('de-DE')} £ — Tour Card verlängert.`;
      // Tour-Card bleibt aktiv; Zähler zurücksetzen für neue Saison.
    } else {
      tourCardActive.value = false;
      seasonReviewMessage.value =
        `Saison beendet: nur ${seasonPrize.value.toLocaleString('de-DE')} £ von ${seasonThreshold.value.toLocaleString('de-DE')} £. Tour Card verloren — zurück zur Q-School.`;
    }
    seasonCompleted.value = 0;
    seasonPrize.value = 0;
    seasonLog.value = [];
  }
  await persistTourCardState();
}

/**
 * Wird bei Q-School-Sieg aufgerufen — schaltet die Tour Card frei.
 */
async function unlockTourCardFromQschool() {
  if (tourCardActive.value) return;
  tourCardActive.value = true;
  seasonCompleted.value = 0;
  seasonPrize.value = 0;
  seasonLog.value = [];
  seasonReviewMessage.value = 'Q-School gewonnen — Tour Card für die neue Saison freigeschaltet!';
  await persistTourCardState();
}

async function saveTournamentState() {
  try {
    await browser.storage.local.set({
      [TM_TOURNAMENT_KEY]: JSON.stringify(selectedTournament.value),
      [TM_ROUND_KEY]: selectedRound.value,
      [TM_DIFFICULTY_KEY]: selectedDifficulty.value,
      [TM_BRACKET_KEY]: JSON.stringify(bracket.value),
      [TM_MARATHON_KEY]: marathonMode.value,
    });
  } catch (e) { /* ignorieren */ }
}

async function restoreTournamentState() {
  try {
    const result = await browser.storage.local.get([
      TM_TOURNAMENT_KEY, TM_ROUND_KEY, TM_DIFFICULTY_KEY, TM_BRACKET_KEY,
      TM_MARATHON_KEY, TM_MARATHON_START_KEY,
    ]);
    if (result[TM_TOURNAMENT_KEY] && result[TM_TOURNAMENT_KEY] !== 'null') {
      selectedTournament.value = JSON.parse(result[TM_TOURNAMENT_KEY]);
    }
    if (result[TM_ROUND_KEY]) selectedRound.value = result[TM_ROUND_KEY];
    if (result[TM_DIFFICULTY_KEY]) selectedDifficulty.value = result[TM_DIFFICULTY_KEY];
    if (result[TM_BRACKET_KEY] && result[TM_BRACKET_KEY] !== 'null') {
      bracket.value = JSON.parse(result[TM_BRACKET_KEY]);
    }
    if (typeof result[TM_MARATHON_KEY] === 'boolean') {
      marathonMode.value = result[TM_MARATHON_KEY];
    }
    if (typeof result[TM_MARATHON_START_KEY] === 'number') {
      marathonStartTs.value = result[TM_MARATHON_START_KEY];
    }
  } catch (e) { /* ignorieren */ }
}

watch(marathonMode, saveTournamentState);

watch(selectedTournament, saveTournamentState);
watch(selectedRound, saveTournamentState);
watch(selectedDifficulty, saveTournamentState);
watch(bracket, saveTournamentState, { deep: true });

onMounted(async () => {
  await restoreTournamentState();
  // v2.9.90: TourCard/Season State parallel laden.
  await loadTourCardState();
  // Aktives Bracket → State wiederherstellen (Turnier, Runde, Gegner)
  if (bracket.value && !bracket.value.finished) {
    const tournament = PDC_TOURNAMENT_CALENDAR.find(t => t.id === bracket.value!.tournamentId);
    if (tournament) {
      selectedTournament.value = tournament;
      selectedRound.value = bracket.value.currentRound;
      selectedDifficulty.value = bracket.value.difficulty;
      if (!currentOpponent.value) {
        currentOpponent.value = generateOpponent(tournament, selectedDifficulty.value);
      }
    }
  }

  // v2.9.55: NACH State-Init das Match-Ergebnis anwenden, damit
  // handleMatchResult() alle benötigten Refs bereits gesetzt findet.
  try {
    const stored = await browser.storage.local.get(TM_LAST_RESULT_KEY);
    const lastResult = stored[TM_LAST_RESULT_KEY];
    if (lastResult === 'won' || lastResult === 'lost') {
      await browser.storage.local.remove(TM_LAST_RESULT_KEY);
      lastMatchResult.value = lastResult;
      console.log('[Tournament] Match-Ergebnis geladen:', lastResult);
    }
  } catch (_) { /* ignore */ }

  // v2.9.79: Auto-Continue nach Turnier-Sieg
  try {
    const acReq = await browser.storage.local.get('tm-auto-continue-request');
    const req = acReq['tm-auto-continue-request'];
    if (req && Date.now() - (req.ts ?? 0) < 5 * 60 * 1000) {
      await browser.storage.local.remove('tm-auto-continue-request');
      // Kurz warten, damit lastMatchResult-Watcher zuerst durchläuft
      setTimeout(async () => {
        if (bracket.value && !bracket.value.finished
            && selectedTournament.value && currentOpponent.value) {
          console.log('[Tournament] Auto-Continue: starte nächstes Match automatisch');
          await launchMatch();
        }
      }, 800);
    }
  } catch (_) { /* ignore */ }
});

// ─── Tier-Farben und Labels ───────────────────────────────────────────────────
const tierColor: Record<string, string> = {
  qschool: '#6B7280', secondary: '#6B7280', protour: '#60A5FA', major: '#F5C842',
  premier_league: '#E8002D', world_series: '#A78BFA', world_cup: '#34D399', world_championship: '#F5C842',
};

const tierLabel: Record<string, string> = {
  qschool: 'Q-SCHOOL', secondary: 'SECONDARY TOUR', protour: 'PRO TOUR', major: 'MAJOR',
  premier_league: 'PREMIER LEAGUE', world_series: 'WORLD SERIES', world_cup: 'WORLD CUP',
  world_championship: 'WELTMEISTERSCHAFT',
};

// Länderflaggen
const countryFlag: Record<string, string> = {
  ENG: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', NED: '🇳🇱', SCO: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', WAL: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', NIR: '🇬🇧', GER: '🇩🇪',
  BEL: '🇧🇪', AUS: '🇦🇺', POL: '🇵🇱', USA: '🇺🇸', CAN: '🇨🇦', JPN: '🇯🇵',
  RSA: '🇿🇦', IRL: '🇮🇪', FRA: '🇫🇷', ESP: '🇪🇸', PHL: '🇵🇭', HKG: '🇭🇰',
  DEN: '🇩🇰', LTU: '🇱🇹', LAT: '🇱🇻', SWE: '🇸🇪', HUN: '🇭🇺', GIB: '🇬🇮',
};

const FILTER_GROUPS: Record<TournamentFilter, { label: string; tiers: string[] }> = {
  all:          { label: 'Alle Turniere', tiers: [] },
  pdc:          { label: 'PDC Pro Tour', tiers: ['protour', 'qschool'] },
  europe:       { label: 'PDC Europe', tiers: ['protour'] },
  major:        { label: 'Majors & WM', tiers: ['major', 'premier_league', 'world_championship', 'world_cup'] },
  world_series: { label: 'World Series', tiers: ['world_series'] },
};

const EUROPE_IDS = new Set(['european_tour_1', 'european_championship', 'world_cup']);

const filteredTournaments = computed(() => {
  // v2.9.90: Q-School wird jetzt sichtbar gemacht, wenn TourCard NICHT aktiv
  // ist (Sperr-Voraussetzung). Ist die TourCard aktiv, blenden wir Q-School
  // aus (sinnlos zu spielen wenn schon qualifiziert) — deckt sich mit der
  // filterUnlockedTournaments()-Semantik in career-engine.ts.
  const includeQschool = !tourCardActive.value;
  const all = PDC_TOURNAMENT_CALENDAR.filter(t => {
    if (t.tier === 'secondary') return false;
    if (t.tier === 'qschool') return includeQschool;
    return true;
  });
  if (activeFilter.value === 'all') return all;
  if (activeFilter.value === 'europe') return all.filter(t => EUROPE_IDS.has(t.id));
  if (activeFilter.value === 'pdc') {
    return all.filter(t => (t.tier === 'protour' && !EUROPE_IDS.has(t.id)) || t.tier === 'qschool');
  }
  const tiers = FILTER_GROUPS[activeFilter.value].tiers;
  return all.filter(t => tiers.includes(t.tier));
});

// ─── Bracket-Rounds pro Turnier ────────────────────────────────────────────────
function getRoundsForTournament(t: CareerTournament): string[] {
  if (t.maxParticipants <= 8) return ['Viertelfinale', 'Halbfinale', 'Finale'];
  if (t.maxParticipants <= 16) return ['Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'];
  if (t.maxParticipants <= 32) return ['Runde 1', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'];
  return ['Runde 1', 'Runde 2', 'Achtelfinale', 'Viertelfinale', 'Halbfinale', 'Finale'];
}

const availableRounds = computed(() => {
  return selectedTournament.value ? getRoundsForTournament(selectedTournament.value) : [];
});

// ─── PDC-Gegner-Pool basierend auf Runde + Turnier-Tier + Schwierigkeit ───────
// Idee: In frühen Runden trifft man auf niedrigere Ranglistenspieler,
// im Finale auf Top-Spieler. Schwierigkeit skaliert Averages.
function generateOpponent(tournament: CareerTournament, difficulty: CareerDifficulty): CareerOpponent {
  const rounds = getRoundsForTournament(tournament);
  const roundIdx = rounds.indexOf(selectedRound.value);
  const totalRounds = rounds.length;
  const progression = roundIdx / Math.max(totalRounds - 1, 1); // 0 = früh, 1 = Finale

  // Pool basierend auf Turnier-Tier vorfiltern
  let pool: CareerOpponent[];
  if (tournament.tier === 'world_championship' || tournament.tier === 'premier_league') {
    pool = PDC_OPPONENTS.filter(o => o.worldRanking <= 32);
  } else if (tournament.tier === 'major' || tournament.tier === 'world_series') {
    pool = PDC_OPPONENTS.filter(o => o.worldRanking <= 48);
  } else if (EUROPE_IDS.has(tournament.id)) {
    pool = PDC_OPPONENTS.filter(o => o.worldRanking <= 96);
  } else {
    pool = PDC_OPPONENTS.filter(o => o.worldRanking <= 96);
  }

  // Progression: Frühe Runden = niedrigeres Ranking (schwächere Gegner)
  // Finale = Top-Spieler
  const sortedPool = [...pool].sort((a, b) => a.worldRanking - b.worldRanking);
  const finalTop = Math.min(8, sortedPool.length);
  const earlyBottom = Math.min(sortedPool.length, Math.max(finalTop, 24));
  const minIdx = Math.floor(progression * (sortedPool.length - finalTop));
  const maxIdx = Math.min(sortedPool.length, minIdx + earlyBottom);
  const roundPool = sortedPool.slice(minIdx, maxIdx);

  // Verhindere, dass in einem Bracket derselbe Gegner zweimal kommt
  const alreadyFaced = new Set(bracket.value?.matchesPlayed.map(m => m.opponentName) ?? []);
  const availablePool = roundPool.filter(o => !alreadyFaced.has(o.name));
  const finalPool = availablePool.length > 0 ? availablePool : roundPool;

  const chosen = finalPool[Math.floor(Math.random() * finalPool.length)];

  // Schwierigkeitsanpassung
  const cfg = DIFFICULTY_CONFIGS[difficulty];
  return {
    ...chosen,
    averageMin: Math.round(chosen.averageMin * cfg.opponentAverageMultiplier),
    averageMax: Math.round(chosen.averageMax * cfg.opponentAverageMultiplier),
    checkoutRateMin: Math.round(chosen.checkoutRateMin * cfg.opponentCheckoutMultiplier),
    checkoutRateMax: Math.round(chosen.checkoutRateMax * cfg.opponentCheckoutMultiplier),
    isNemesis: false, rivalryWins: 0, rivalryLosses: 0,
  };
}

// ─── Match-Konfiguration bauen ────────────────────────────────────────────────
function buildMatchConfig(tournament: CareerTournament, round: string, opponent: CareerOpponent): CareerMatchConfig {
  const isFinal = round === 'Finale';
  const legsToWin = isFinal ? (tournament.legsToWinFinal ?? 6) : (tournament.legsToWinEarlyRounds ?? 4);
  const setsToWin = isFinal ? (tournament.setsToWinFinal ?? 4) : (tournament.setsToWinEarlyRounds ?? 2);
  return {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    round,
    opponent,
    format: tournament.format,
    legsToWin: tournament.format === 'legs' ? legsToWin : undefined,
    setsToWin: tournament.format === 'sets' ? setsToWin : undefined,
    legsPerSet: tournament.legsPerSet,
    inMode: tournament.inMode,
    outMode: tournament.outMode,
    isTvMatch: tournament.isTvEvent,
    isWalkOnEnabled: tournament.isTvEvent,
    prizeMoneyWin: isFinal ? tournament.prizeMoneyWinner : Math.round(tournament.prizeMoneyQuarterFinal * (1 + (getRoundsForTournament(tournament).indexOf(round) * 0.3))),
    prizeMoneyLoss: Math.round(tournament.prizeMoneyQuarterFinal * 0.5),
    orderOfMeritPoints: 0,
    isTournament: true,
    difficulty: selectedDifficulty.value,
  };
}

// ─── Auswahl-Handler ──────────────────────────────────────────────────────────
function selectTournament(t: CareerTournament) {
  // v2.9.90 Tour-Card-Sperre: Klick auf ein noch nicht freigeschaltetes
  // Turnier zeigt einen Hinweis und öffnet die Lobby NICHT.
  if (isTournamentLocked(t)) {
    lobbyError.value = 'Erst die Q-School gewinnen, um die Tour Card freizuschalten. Danach sind Pro Tour, Majors und WM verfügbar.';
    return;
  }
  // Neues Bracket starten wenn ein anderes Turnier gewählt wird
  if (bracket.value && bracket.value.tournamentId !== t.id) {
    if (!confirm('Ein aktives Turnier läuft. Wirklich abbrechen und ein neues starten?')) return;
    bracket.value = null;
  }
  selectedTournament.value = t;
  const rounds = getRoundsForTournament(t);
  selectedRound.value = bracket.value?.currentRound ?? rounds[0];
  currentOpponent.value = generateOpponent(t, selectedDifficulty.value);
  lobbyError.value = '';
  lobbySuccess.value = false;
}

function rerollOpponent() {
  if (!selectedTournament.value) return;
  currentOpponent.value = generateOpponent(selectedTournament.value, selectedDifficulty.value);
}

// Nach Schwierigkeit-Wechsel Gegner neu skalieren (falls schon einer da)
watch(selectedDifficulty, () => {
  if (selectedTournament.value) {
    currentOpponent.value = generateOpponent(selectedTournament.value, selectedDifficulty.value);
  }
});

// Nach Runden-Wechsel neuen Gegner ziehen
watch(selectedRound, () => {
  if (selectedTournament.value) {
    currentOpponent.value = generateOpponent(selectedTournament.value, selectedDifficulty.value);
  }
});

// ─── Bracket-Progression ──────────────────────────────────────────────────────
function initBracketIfNeeded() {
  if (!selectedTournament.value) return;
  if (!bracket.value || bracket.value.tournamentId !== selectedTournament.value.id) {
    bracket.value = {
      tournamentId: selectedTournament.value.id,
      tournamentName: selectedTournament.value.name,
      difficulty: selectedDifficulty.value,
      currentRound: selectedRound.value,
      matchesPlayed: [],
      totalPrize: 0,
      finished: false,
      finalResult: null,
    };
    // v2.9.80 – Marathon-Startzeit
    if (marathonMode.value) {
      marathonStartTs.value = Date.now();
      browser.storage.local.set({ [TM_MARATHON_START_KEY]: marathonStartTs.value });
    }
  }
}

function resultLabelForRound(round: string, lost: boolean): TournamentBracketState['finalResult'] {
  if (!lost && round === 'Finale') return 'champion';
  if (lost && round === 'Finale') return 'runner_up';
  if (lost && round === 'Halbfinale') return 'semi';
  if (lost && round === 'Viertelfinale') return 'quarter';
  if (lost && round === 'Achtelfinale') return 'r16';
  if (lost && (round === 'Runde 2' || round === 'Runde 1')) return 'r32';
  return 'eliminated';
}

// Wird durch career-controller.ts aufgerufen wenn ein Turnier-Match endet.
// Hier: nach dem "Zurück-Navigieren" prüft onMounted lastMatchResult und ruft handleMatchResult.
async function handleMatchResult(won: boolean) {
  if (!bracket.value || !selectedTournament.value) return;

  const round = bracket.value.currentRound;
  const opponentName = currentOpponent.value?.name ?? '?';
  const opponentRanking = currentOpponent.value?.worldRanking ?? 0;

  // Preisgeld berechnen basierend auf Runde
  const rounds = getRoundsForTournament(selectedTournament.value);
  const roundIdx = rounds.indexOf(round);
  const isFinal = round === 'Finale';
  const prize = won
    ? (isFinal ? selectedTournament.value.prizeMoneyWinner
                : Math.round(selectedTournament.value.prizeMoneyQuarterFinal * (0.5 + roundIdx * 0.4)))
    : Math.round(selectedTournament.value.prizeMoneyQuarterFinal * 0.3);

  bracket.value.matchesPlayed.push({ round, opponentName, opponentRanking, won, prizeMoney: prize });
  bracket.value.totalPrize += prize;

  if (!won) {
    // Turnier vorbei
    bracket.value.finished = true;
    bracket.value.finalResult = resultLabelForRound(round, true);
  } else if (isFinal) {
    // Champion!
    bracket.value.finished = true;
    bracket.value.finalResult = 'champion';
  } else {
    // Nächste Runde vorbereiten
    const nextRound = rounds[roundIdx + 1];
    bracket.value.currentRound = nextRound;
    selectedRound.value = nextRound;
    // Neuen Gegner ziehen
    currentOpponent.value = generateOpponent(selectedTournament.value, selectedDifficulty.value);
  }

  await saveTournamentState();

  // v2.9.90: Tour-Card-Sperre + Season-Progression koppeln.
  //   • Wenn Q-School gewonnen → Tour Card aktivieren.
  //   • Wenn ein anderes Turnier abgeschlossen (Sieg ODER Niederlage) →
  //     Saison-Zähler erhöhen, Preisgeld akkumulieren, ggf. Auswertung.
  if (bracket.value.finished) {
    const tid = bracket.value.tournamentId;
    const isQschool = tid === 'qschool';
    const isChampion = bracket.value.finalResult === 'champion';

    if (isQschool && isChampion) {
      await unlockTourCardFromQschool();
    } else if (!isQschool && tourCardActive.value) {
      await advanceSeasonAfterTournament({
        tournamentId: tid,
        tournamentName: bracket.value.tournamentName,
        finalResult: bracket.value.finalResult ?? 'eliminated',
        prize: bracket.value.totalPrize,
        ts: Date.now(),
      });
    }
  }

  // v2.9.80: Marathon-Ende erkannt → Speedrun-Summary anzeigen, dann State zurücksetzen
  if (bracket.value.finished && marathonMode.value && marathonStartTs.value) {
    try {
      const { showMarathonSummary } = await import('@/entrypoints/match.content/career-match');
      const durationMs = Date.now() - marathonStartTs.value;

      // v2.9.82: Marathon-Run ans Backend submitten (nur Champion zählt für Ladder)
      let ladderInfo: any = null;
      try {
        const cfgAll = await AutodartsToolsConfig.getValue();
        const backend = getBackendUrl(cfgAll.elo?.backendUrl || cfgAll.aiCommentator?.backendUrl);
        const { getIdentity } = await import('@/utils/elo-client');
        const identity = await getIdentity();
        const submitBody = {
          player_id: identity.playerId,
          display_name: (cfgAll.elo?.displayName || identity.displayName || 'Anonymous').slice(0, 24),
          tournament_id: bracket.value.tournamentId,
          tournament_name: bracket.value.tournamentName,
          difficulty: bracket.value.difficulty,
          duration_ms: durationMs,
          matches: bracket.value.matchesPlayed.map(m => ({
            round: m.round, opponent_name: m.opponentName, won: m.won, prize_money: m.prizeMoney,
          })),
          total_prize: bracket.value.totalPrize,
          final_result: bracket.value.finalResult ?? 'eliminated',
        };
        const resp = await fetch(`${backend}/api/marathon/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submitBody),
        });
        if (resp.ok) {
          const data = await resp.json();
          // Rangliste holen (Top-5)
          let leaderboard: any[] = [];
          try {
            const lbResp = await fetch(`${backend}/api/marathon/leaderboard/${encodeURIComponent(bracket.value.tournamentId)}?limit=5`);
            if (lbResp.ok) leaderboard = await lbResp.json();
          } catch (_) { /* ignore */ }
          ladderInfo = {
            rank: data.rank,
            totalRuns: data.total_runs,
            leaderboard,
          };
        }
      } catch (e) {
        console.warn('[Tournament] Marathon-Ladder-Submit failed', e);
      }

      showMarathonSummary({
        tournamentName: bracket.value.tournamentName,
        matches: bracket.value.matchesPlayed.map(m => ({
          round: m.round, opponentName: m.opponentName, won: m.won, prizeMoney: m.prizeMoney,
        })),
        totalPrize: bracket.value.totalPrize,
        finalResult: bracket.value.finalResult ?? 'eliminated',
        startTs: marathonStartTs.value,
        ladder: ladderInfo,
      });
    } catch (e) {
      console.warn('[Tournament] showMarathonSummary failed', e);
    }
    marathonStartTs.value = null;
    await browser.storage.local.remove(TM_MARATHON_START_KEY);
  }
}

// Beim Mount: gab es einen lastMatchResult? Dann verarbeiten
watch(lastMatchResult, async (val) => {
  if (val === 'won' || val === 'lost') {
    await handleMatchResult(val === 'won');
  }
});

// ─── Match starten ────────────────────────────────────────────────────────────
async function launchMatch() {
  if (!selectedTournament.value || !currentOpponent.value) return;
  initBracketIfNeeded();

  lobbyCreating.value = true;
  lobbyError.value = '';
  lobbySuccess.value = false;

  const config = buildMatchConfig(selectedTournament.value, selectedRound.value, currentOpponent.value);
  // v2.9.80: Marathon-Flag an career-match weiterreichen
  (config as any).marathonMode = marathonMode.value;
  (config as any).marathonStartTs = marathonStartTs.value;

  // v2.9.65: Storage MUSS synchron persistiert sein bevor wir navigieren —
  // sonst findet der Career-Bot-Hint in der Lobby noch keine active-match-Config.
  try {
    await browser.storage.local.set({
      'career-active-match': config,
      'local:career-active-match': config,
    });
  } catch (e) {
    console.error('[Tournament] Storage-Fehler:', e);
  }

  const sets = config.format === 'sets' ? (config.setsToWin ?? 3) : 1;
  const legs = config.format === 'sets' ? (config.legsPerSet ?? 3) : (config.legsToWin ?? 5);

  console.log('[Tournament] Lobby-Erstellung startet:', { config, sets, legs });

  try {
    const result = await createCareerLobby({
      startScore: 501,
      inMode: config.inMode as 'straight' | 'double' | 'master',
      outMode: config.outMode as 'double' | 'master' | 'straight',
      sets,
      legs,
    });

    console.log('[Tournament] Lobby-Antwort:', result);
    lobbyCreating.value = false;

    if (result.success && result.lobbyUrl) {
      lobbySuccess.value = true;
      console.log('[Tournament] Navigiere zur Lobby:', result.lobbyUrl);
      window.location.href = result.lobbyUrl;
    } else {
      lobbyError.value = result.error ?? 'Unbekannter Fehler';
      console.warn('[Tournament] Lobby-Erstellung fehlgeschlagen:', result.error);
      if (!result.error?.includes('eingeloggt')) {
        window.open('https://play.autodarts.io/', '_blank', 'noopener,noreferrer');
      }
    }
  } catch (err: any) {
    lobbyCreating.value = false;
    lobbyError.value = err?.message ?? 'Unbekannter Fehler';
    console.error('[Tournament] Unerwarteter Fehler:', err);
  }
}

function resetTournament() {
  if (!confirm('Turnier wirklich zurücksetzen? Fortschritt geht verloren.')) return;
  bracket.value = null;
  lastMatchResult.value = null;
  browser.storage.local.remove([TM_BRACKET_KEY, TM_LAST_RESULT_KEY, CAREER_ACTIVE_MATCH_KEY]).catch(() => {});
}

function startNewTournament() {
  bracket.value = null;
  selectedTournament.value = null;
  currentOpponent.value = null;
  browser.storage.local.remove([TM_BRACKET_KEY, CAREER_ACTIVE_MATCH_KEY]).catch(() => {});
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
function formatMoney(amount: number): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount);
}

function finalResultLabel(res: TournamentBracketState['finalResult']): string {
  switch (res) {
    case 'champion': return '🏆 CHAMPION!';
    case 'runner_up': return '🥈 Finalist';
    case 'semi': return '🥉 Halbfinale';
    case 'quarter': return 'Viertelfinale';
    case 'r16': return 'Achtelfinale';
    case 'r32': return 'Runde 2';
    default: return 'Ausgeschieden';
  }
}
</script>

<template>
  <div style="background: #0D1B2A; min-height: 100%; color: #F0F4F8; font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif; padding: 20px;">

    <!-- Header -->
    <div style="margin-bottom: 20px;">
      <div style="font-size: 11px; color: #E8002D; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 4px;">Autodarts Extended Edition</div>
      <div style="font-size: 28px; font-weight: 900; color: #FFFFFF; letter-spacing: 2px; text-transform: uppercase; line-height: 1;">PDC Turnier-Modus</div>
      <div style="font-size: 13px; color: #64748B; margin-top: 4px;">Reale PDC-Gegner · Runden-Progression · 5 Schwierigkeitsstufen</div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!--  MATCH-ERGEBNIS BANNER (nach Rückkehr aus Match)                       -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div v-if="lastMatchResult" :style="{
      background: lastMatchResult === 'won' ? 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(34,197,94,0.1))' : 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.1))',
      border: `1px solid ${lastMatchResult === 'won' ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)'}`,
      borderRadius: '8px',
      padding: '16px 20px',
      marginBottom: '20px',
    }">
      <div style="font-size: 20px; font-weight: 900; color: #FFFFFF;">
        {{ lastMatchResult === 'won' ? '✅ Match gewonnen!' : '❌ Match verloren' }}
      </div>
      <div style="font-size: 12px; color: #94A3B8; margin-top: 4px;">
        {{ lastMatchResult === 'won' ? 'Weiter zur nächsten Runde…' : 'Turnier beendet.' }}
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!--  ABGESCHLOSSENES BRACKET (Finales Ergebnis)                            -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div v-if="bracket && bracket.finished" style="background: rgba(13,27,42,0.98); border: 1px solid rgba(245,200,66,0.3); border-radius: 10px; padding: 30px; margin-bottom: 20px; text-align: center;">
      <div style="font-size: 12px; color: #F5C842; letter-spacing: 5px; text-transform: uppercase; margin-bottom: 8px;">Turnier abgeschlossen</div>
      <div style="font-size: 32px; font-weight: 900; color: #FFFFFF; margin-bottom: 4px;">{{ bracket.tournamentName }}</div>
      <div style="font-size: 42px; font-weight: 900; color: #F5C842; margin: 20px 0; letter-spacing: 3px;">
        {{ finalResultLabel(bracket.finalResult) }}
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 500px; margin: 0 auto 24px auto;">
        <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 12px;">
          <div style="font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 2px;">Gesamt-Preisgeld</div>
          <div style="font-size: 22px; font-weight: 900; color: #34D399; margin-top: 4px;">{{ formatMoney(bracket.totalPrize) }}</div>
        </div>
        <div style="background: rgba(255,255,255,0.05); border-radius: 6px; padding: 12px;">
          <div style="font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 2px;">Matches gespielt</div>
          <div style="font-size: 22px; font-weight: 900; color: #FFFFFF; margin-top: 4px;">{{ bracket.matchesPlayed.length }}</div>
        </div>
      </div>
      <button @click="startNewTournament" style="background: linear-gradient(135deg, #E8002D 0%, #B00020 100%); color: white; border: none; padding: 14px 40px; font-size: 14px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; border-radius: 4px; cursor: pointer;">
        Neues Turnier
      </button>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!--  AKTIVES BRACKET (Turnier läuft) - Progression anzeigen                -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div v-if="bracket && !bracket.finished && bracket.matchesPlayed.length > 0" style="background: rgba(245,200,66,0.06); border: 1px solid rgba(245,200,66,0.25); border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <div>
          <div style="font-size: 10px; color: #F5C842; letter-spacing: 3px; text-transform: uppercase; font-weight: 700;">Turnier läuft</div>
          <div style="font-size: 18px; font-weight: 700; color: #FFFFFF;">{{ bracket.tournamentName }}</div>
        </div>
        <button @click="resetTournament" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #F87171; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; text-transform: uppercase;">Abbrechen</button>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <div v-for="match in bracket.matchesPlayed" :key="match.round" :style="{
          background: match.won ? 'rgba(52,211,153,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${match.won ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)'}`,
          borderRadius: '4px',
          padding: '6px 12px',
          fontSize: '11px',
          color: '#FFFFFF',
        }">
          <b>{{ match.round }}:</b> {{ match.opponentName }} — {{ match.won ? '✓' : '✗' }}
        </div>
      </div>
      <div style="margin-top: 10px; font-size: 12px; color: #34D399;">
        💰 Preisgeld bisher: <b>{{ formatMoney(bracket.totalPrize) }}</b> · Nächste Runde: <b style="color: #F5C842;">{{ bracket.currentRound }}</b>
      </div>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!--  Nur zeigen wenn KEIN abgeschlossenes Bracket                           -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div v-if="!bracket || !bracket.finished">

      <!-- Schwierigkeit auswählen -->
      <div style="background: rgba(13,27,42,0.98); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 14px 16px; margin-bottom: 16px;">
        <div style="font-size: 10px; color: #E8002D; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 10px; font-weight: 700;">Schwierigkeit auswählen</div>
        <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
          <button
            v-for="(diff, key) in DIFFICULTY_CONFIGS"
            :key="key"
            @click="selectedDifficulty = key as CareerDifficulty"
            :disabled="!!(bracket && bracket.matchesPlayed.length > 0)"
            :style="{
              padding: '10px 8px',
              borderRadius: '4px',
              border: selectedDifficulty === key ? '2px solid #E8002D' : '1px solid rgba(255,255,255,0.12)',
              background: selectedDifficulty === key ? 'rgba(232,0,45,0.18)' : 'rgba(255,255,255,0.04)',
              color: selectedDifficulty === key ? '#FFFFFF' : '#94A3B8',
              cursor: (bracket && bracket.matchesPlayed.length > 0) ? 'not-allowed' : 'pointer',
              opacity: (bracket && bracket.matchesPlayed.length > 0 && selectedDifficulty !== key) ? 0.4 : 1,
              fontSize: '11px',
              fontWeight: selectedDifficulty === key ? '700' : '400',
              textAlign: 'center',
            }">
            <div style="font-weight: 900; margin-bottom: 2px;">{{ diff.label.split(' ')[0] }}</div>
            <div style="font-size: 9px; color: #94A3B8;">{{ diff.label.match(/\d+.*Avg/)?.[0] ?? '' }}</div>
          </button>
        </div>
        <div style="font-size: 11px; color: #94A3B8; margin-top: 8px; font-style: italic;">
          {{ DIFFICULTY_CONFIGS[selectedDifficulty].description }}
        </div>
      </div>

      <!-- Filter-Leiste (nur bei neuem Turnier) -->
      <div v-if="!bracket || bracket.matchesPlayed.length === 0" style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
        <button
          v-for="(group, key) in FILTER_GROUPS"
          :key="key"
          @click="activeFilter = key as TournamentFilter; selectedTournament = null; currentOpponent = null"
          :style="{
            padding: '8px 16px',
            borderRadius: '4px',
            border: activeFilter === key ? '2px solid #E8002D' : '1px solid rgba(255,255,255,0.12)',
            background: activeFilter === key ? 'rgba(232,0,45,0.18)' : 'rgba(255,255,255,0.04)',
            color: activeFilter === key ? '#FFFFFF' : '#94A3B8',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: activeFilter === key ? '700' : '400',
            letterSpacing: '1px',
            textTransform: 'uppercase',
          }">
          {{ group.label }}
        </button>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">

        <!-- Linke Spalte: Turnierliste (nur bei neuem Turnier) -->
        <div v-if="!bracket || bracket.matchesPlayed.length === 0">
          <!-- v2.9.90: Season-Fortschritt + Tour-Card-Status oberhalb der Liste -->
          <div data-testid="tm-season-progress" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 10px 12px; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;" :style="{ color: tourCardActive ? '#34D399' : '#F5C842' }" data-testid="tm-tour-card-status">
                  {{ tourCardActive ? '🎫 Tour Card aktiv' : '🎫 Keine Tour Card — Q-School spielen' }}
                </span>
              </div>
              <div style="font-size: 10px; color: #94A3B8; letter-spacing: 1px;" data-testid="tm-season-counter">
                {{ seasonCompleted }}/{{ seasonLength }} Turniere · {{ seasonPrize.toLocaleString('de-DE') }} £
              </div>
            </div>
            <div style="height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
              <div :style="{ width: seasonProgressPercent + '%', height: '100%', background: 'linear-gradient(90deg, #E8002D, #F5C842)', transition: 'width 0.5s ease' }"></div>
            </div>
            <div v-if="tourCardActive" style="font-size: 10px; color: #64748B; margin-top: 4px;">
              Preisgeld-Ziel: {{ seasonThreshold.toLocaleString('de-DE') }} £ zur Verlängerung der Tour Card
            </div>
            <div v-if="seasonReviewMessage" data-testid="tm-season-review" style="margin-top: 8px; padding: 8px 10px; background: rgba(245,200,66,0.10); border-left: 3px solid #F5C842; border-radius: 4px; font-size: 12px; color: #FCD34D;">
              {{ seasonReviewMessage }}
              <button @click="seasonReviewMessage = ''" style="background: transparent; border: none; color: #94A3B8; cursor: pointer; float: right; font-size: 14px; line-height: 1;">✕</button>
            </div>
          </div>

          <div style="font-size: 10px; color: #64748B; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 10px; font-weight: 700;">
            {{ filteredTournaments.length }} Turniere
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px; max-height: 620px; overflow-y: auto; padding-right: 4px;">
            <div v-for="t in filteredTournaments" :key="t.id" @click="selectTournament(t)" :data-testid="`tm-tournament-${t.id}`" :data-locked="isTournamentLocked(t)" :style="{
              background: selectedTournament?.id === t.id ? 'rgba(232,0,45,0.12)' : 'rgba(255,255,255,0.03)',
              border: selectedTournament?.id === t.id ? `2px solid ${tierColor[t.tier]}` : '1px solid rgba(255,255,255,0.07)',
              borderRadius: '6px',
              padding: '12px 14px',
              cursor: isTournamentLocked(t) ? 'not-allowed' : 'pointer',
              opacity: isTournamentLocked(t) ? 0.45 : 1,
              filter: isTournamentLocked(t) ? 'grayscale(0.6)' : 'none',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              position: 'relative',
            }">
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 3px;">
                  <div :style="{ fontSize: '9px', fontWeight: '700', letterSpacing: '2px', color: tierColor[t.tier], textTransform: 'uppercase', flexShrink: 0 }">{{ tierLabel[t.tier] }}</div>
                  <div v-if="t.isTvEvent" style="font-size: 9px; color: #34D399; letter-spacing: 1px; text-transform: uppercase;">📺 TV</div>
                  <div v-if="isTournamentLocked(t)" :data-testid="`tm-lock-${t.id}`" style="font-size: 10px; color: #94A3B8; letter-spacing: 1px; text-transform: uppercase; display: flex; align-items: center; gap: 4px;">🔒 Gesperrt</div>
                </div>
                <div style="font-size: 14px; font-weight: 700; color: #FFFFFF; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">{{ t.name }}</div>
                <div style="font-size: 11px; color: #64748B; margin-top: 2px;">{{ t.venue }}</div>
              </div>
              <div style="text-align: right; flex-shrink: 0;">
                <div style="font-size: 13px; font-weight: 700; color: #34D399;">{{ formatMoney(t.prizeMoneyWinner) }}</div>
                <div style="font-size: 10px; color: #4B5563; margin-top: 1px;">Sieger</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Rechte Spalte: Details + Gegner (bzw. während laufendem Bracket volle Breite) -->
        <div :style="{ gridColumn: (bracket && bracket.matchesPlayed.length > 0) ? '1 / -1' : 'auto' }">
          <!-- Kein Turnier -->
          <div v-if="!selectedTournament" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; padding: 40px 20px; text-align: center; color: #4B5563;">
            <div style="font-size: 32px; margin-bottom: 12px;">🏆</div>
            <div style="font-size: 14px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 2px;">Turnier auswählen</div>
            <div style="font-size: 12px; color: #374151; margin-top: 6px;">Wähle links ein Turnier aus.</div>
          </div>

          <div v-else>
            <!-- Turnier-Header -->
            <div :style="{
              background: 'rgba(13,27,42,0.98)',
              borderLeft: `4px solid ${tierColor[selectedTournament.tier]}`,
              border: '1px solid rgba(255,255,255,0.08)',
              borderLeftWidth: '4px',
              borderLeftColor: tierColor[selectedTournament.tier],
              borderRadius: '6px',
              padding: '14px 18px',
              marginBottom: '12px',
            }">
              <div :style="{ fontSize: '10px', letterSpacing: '3px', textTransform: 'uppercase', color: tierColor[selectedTournament.tier], marginBottom: '4px', fontWeight: '700' }">
                {{ tierLabel[selectedTournament.tier] }}
              </div>
              <div style="font-size: 20px; font-weight: 900; color: #FFFFFF; line-height: 1.1;">{{ selectedTournament.name }}</div>
              <div style="font-size: 11px; color: #64748B; margin-top: 4px;">{{ selectedTournament.venue }}</div>
            </div>

            <!-- Runde -->
            <div style="background: rgba(13,27,42,0.98); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 14px 16px; margin-bottom: 12px;">
              <div style="font-size: 10px; color: #64748B; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px; font-weight: 700;">
                {{ (bracket && bracket.matchesPlayed.length > 0) ? 'Aktuelle Runde' : 'Runde auswählen' }}
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                <button v-for="round in availableRounds" :key="round"
                  @click="selectedRound = round"
                  :disabled="!!(bracket && bracket.matchesPlayed.length > 0)"
                  :style="{
                    padding: '6px 14px',
                    borderRadius: '4px',
                    border: selectedRound === round ? '2px solid #E8002D' : '1px solid rgba(255,255,255,0.12)',
                    background: selectedRound === round ? 'rgba(232,0,45,0.18)' : 'rgba(255,255,255,0.04)',
                    color: selectedRound === round ? '#FFFFFF' : '#94A3B8',
                    cursor: (bracket && bracket.matchesPlayed.length > 0) ? 'not-allowed' : 'pointer',
                    opacity: (bracket && bracket.matchesPlayed.length > 0 && selectedRound !== round) ? 0.4 : 1,
                    fontSize: '12px',
                    fontWeight: selectedRound === round ? '700' : '400',
                  }">{{ round }}</button>
              </div>
            </div>

            <!-- ══════════════════════════════════════════════════════════════ -->
            <!--  DEIN GEGNER — echter PDC-Spieler                              -->
            <!-- ══════════════════════════════════════════════════════════════ -->
            <div v-if="currentOpponent" style="background: linear-gradient(135deg, rgba(232,0,45,0.08) 0%, rgba(232,0,45,0.02) 100%); border: 2px solid rgba(232,0,45,0.4); border-radius: 8px; padding: 18px 20px; margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                <div style="font-size: 10px; color: #E8002D; letter-spacing: 4px; text-transform: uppercase; font-weight: 900;">⚔️ Dein Gegner</div>
                <button @click="rerollOpponent" v-if="!(bracket && bracket.matchesPlayed.length > 0)" style="background: rgba(96,165,250,0.15); border: 1px solid rgba(96,165,250,0.4); color: #60A5FA; padding: 4px 10px; border-radius: 3px; cursor: pointer; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">
                  🔄 Neu würfeln
                </button>
              </div>
              <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 14px;">
                <div style="font-size: 48px;">{{ countryFlag[currentOpponent.country] || '🏳️' }}</div>
                <div style="flex: 1;">
                  <div style="font-size: 26px; font-weight: 900; color: #FFFFFF; line-height: 1;">{{ currentOpponent.name }}</div>
                  <div style="font-size: 12px; color: #94A3B8; margin-top: 4px;">
                    <b style="color: #F5C842;">Weltrangliste #{{ currentOpponent.worldRanking }}</b> · {{ currentOpponent.country }}
                  </div>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                <div style="background: rgba(255,255,255,0.05); border-radius: 4px; padding: 8px 12px;">
                  <div style="font-size: 9px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px;">Erwarteter Avg</div>
                  <div style="font-size: 20px; font-weight: 900; color: #60A5FA;">{{ currentOpponent.averageMin }}–{{ currentOpponent.averageMax }}</div>
                </div>
                <div style="background: rgba(255,255,255,0.05); border-radius: 4px; padding: 8px 12px;">
                  <div style="font-size: 9px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px;">Checkout-Rate</div>
                  <div style="font-size: 20px; font-weight: 900; color: #34D399;">{{ currentOpponent.checkoutRateMin }}–{{ currentOpponent.checkoutRateMax }}%</div>
                </div>
              </div>
              <!-- Hinweis zum Bot-Setup -->
              <div style="background: rgba(245,200,66,0.08); border: 1px solid rgba(245,200,66,0.3); border-radius: 4px; padding: 10px 14px; font-size: 12px; color: #F5C842; line-height: 1.5;">
                💡 <b>So spielst du gegen {{ currentOpponent.name }}:</b><br>
                Nach dem Klick auf „Match starten" wirst du in eine Autodarts-Lobby weitergeleitet.
                Füge dort einen <b>Bot</b> hinzu und nenne ihn <b style="color: #FFFFFF;">"{{ currentOpponent.name }}"</b> —
                die Extension erkennt den Namen und spielt dann Walk-On, Kommentator etc.
                <br><br>
                <b>Empfohlener Bot-Average:</b> ca. <b style="color: #FFFFFF;">{{ Math.round((currentOpponent.averageMin + currentOpponent.averageMax) / 2) }}</b>
              </div>
            </div>

            <!-- v2.9.80 – Marathon-Modus Toggle -->
            <div style="background: linear-gradient(135deg, rgba(245,200,66,0.08), rgba(232,0,45,0.06)); border: 1px solid rgba(245,200,66,0.35); border-radius: 6px; padding: 12px 16px; margin-bottom: 12px;">
              <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                <input
                  type="checkbox"
                  v-model="marathonMode"
                  data-testid="marathon-toggle"
                  style="width: 22px; height: 22px; accent-color: #F5C842; cursor: pointer;" />
                <div style="flex: 1;">
                  <div style="font-size: 13px; font-weight: 800; color: #F5C842; letter-spacing: 1.5px; text-transform: uppercase;">
                    🏁 Marathon-Modus
                  </div>
                  <div style="font-size: 11px; color: #94A3B8; margin-top: 2px;">
                    Alle Runden hintereinander ohne Ergebnis-Overlays. Am Ende: Speedrun-Zusammenfassung mit Gesamtzeit.
                  </div>
                </div>
              </label>
            </div>

            <!-- Match starten -->
            <div style="background: rgba(13,27,42,0.98); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 14px 16px;">
              <button @click="launchMatch" :disabled="lobbyCreating || !currentOpponent"
                :style="{
                  width: '100%',
                  background: (lobbyCreating || !currentOpponent) ? 'rgba(232,0,45,0.35)' : (marathonMode ? 'linear-gradient(135deg, #F5C842 0%, #E8002D 100%)' : 'linear-gradient(135deg, #E8002D 0%, #B00020 100%)'),
                  color: marathonMode ? '#0D1B2A' : 'white',
                  border: 'none',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: '900',
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                  borderRadius: '4px',
                  cursor: (lobbyCreating || !currentOpponent) ? 'not-allowed' : 'pointer',
                }">
                {{ lobbyCreating ? 'LOBBY WIRD ERSTELLT…' : (marathonMode ? '🏁 MARATHON STARTEN' : (bracket && bracket.matchesPlayed.length > 0 ? `${selectedRound} — Match starten` : 'MATCH STARTEN')) }}
              </button>
              <div v-if="lobbySuccess" style="margin-top: 10px; font-size: 11px; color: #34D399; text-align: center; letter-spacing: 2px; text-transform: uppercase;">
                ✓ LOBBY ERSTELLT — WEITERLEITUNG…
              </div>
              <div v-if="lobbyError" style="margin-top: 10px; font-size: 11px; color: #F87171; text-align: center;">
                {{ lobbyError }}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
</template>
