/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PDC KARRIERE-MODUS ENGINE  –  Autodarts Extended Edition
 *  Autor: Arnonym2302
 *  Version: 2.8.3
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Simuliert einen vollständigen PDC-Jahreskalender mit allen echten
 *  Turnierformaten: Q-School → Pro Tour → TV-Majors → WM Alexandra Palace
 *
 *  NEU in v2.7.0:
 *  – Echte PDC Order of Merit (Stand: 24. Juni 2026) als eingebettete Basis
 *  – Live-Qualifikationssystem: Turnier-Felder werden nach echten PDC-Regeln
 *    aus der aktuellen Weltrangliste zusammengestellt
 *  – Automatischer Live-Abruf von dartsrankings.com (24h Cache)
 *  – Fallback auf eingebettete Rangliste bei fehlender Verbindung
 */

// ─── Typen & Interfaces ──────────────────────────────────────────────────────
import type { DartCoinsState } from '@/utils/dart-coins';
import { createInitialCoinsState, awardCoins, COIN_REWARDS } from '@/utils/dart-coins';

export type CareerDifficulty = 'pub' | 'amateur' | 'semipro' | 'pro' | 'elite';
export type TournamentTier = 'qschool' | 'secondary' | 'protour' | 'major' | 'premier_league' | 'world_series' | 'world_cup' | 'world_championship';
export type MatchFormat = 'legs' | 'sets';
export type InMode = 'straight' | 'double' | 'master';
export type OutMode = 'double' | 'master' | 'straight';

export interface CareerMatchConfig {
  tournamentId: string;
  tournamentName: string;
  round: string;
  opponent: CareerOpponent;
  format: MatchFormat;
  legsToWin?: number;       // z.B. 6 für BO11
  setsToWin?: number;       // z.B. 4 für BO7 Sets
  legsPerSet?: number;      // z.B. 3 für WM (BO5 Legs per Set)
  inMode: InMode;
  outMode: OutMode;
  isTvMatch: boolean;       // Aktiviert Walk-On, Crowd, Kommentator
  isWalkOnEnabled: boolean;
  prizeMoneyWin: number;
  prizeMoneyLoss: number;
  orderOfMeritPoints: number;
  // v2.9.47: Turnier-Modus Erweiterung
  isTournament?: boolean;   // true wenn aus TournamentMode, nicht Karriere
  difficulty?: CareerDifficulty; // Auswahl aus TournamentMode
}

export interface CareerOpponent {
  id: string;
  name: string;
  country: string;
  averageMin: number;
  averageMax: number;
  checkoutRateMin: number;  // in %
  checkoutRateMax: number;
  worldRanking: number;
  isNemesis: boolean;
  rivalryWins: number;
  rivalryLosses: number;
  // v2.9.78 – Bot-Skin-Templates
  nickname?: string;        // z.B. "The Nuke", "Snakebite"
  walkOnSong?: string;      // z.B. "Chase the Sun"
  isPdcEurope?: boolean;    // PDC Europe Tour Card Holder
  isFemale?: boolean;       // Frauen-Kategorie-Filter
}

export interface CareerTournament {
  id: string;
  name: string;
  shortName: string;
  tier: TournamentTier;
  month: number;            // 1–12
  week: number;             // Woche im Monat (1–4)
  venue: string;
  format: MatchFormat;
  legsToWinFinal?: number;
  legsToWinEarlyRounds?: number;
  setsToWinFinal?: number;
  setsToWinEarlyRounds?: number;
  legsPerSet?: number;
  inMode: InMode;
  outMode: OutMode;
  isTvEvent: boolean;
  qualificationRank: number | null; // null = offen für alle Tour-Card-Holder
  maxParticipants: number;
  prizeMoneyWinner: number;
  prizeMoneyRunnerUp: number;
  prizeMoneyQuarterFinal: number;
  description: string;
  formatDescription: string;
}

export interface CareerSeason {
  year: number;
  playerName: string;
  difficulty: CareerDifficulty;
  tourCardActive: boolean;
  worldRanking: number;
  totalPrizeMoney: number;
  orderOfMeritPoints: number;
  proTourPoints: number;
  currentWeek: number;      // 1–52
  completedTournaments: CompletedTournament[];
  trophies: Trophy[];
  sponsors: Sponsor[];
  walkOnSongUnlocked: boolean;
  nemesisId: string | null;
  /**
   * v2.9.87 — Detailliertes Log JEDES gespielten Karriere-Matches.
   * Grundlage für CSV-Export im Popup.
   */
  matchLog?: CareerMatchLogEntry[];
  /**
   * v2.9.88 — Dart-Coins (In-Game-Währung). Verdient durch Karriere-
   * Aktionen, ausgegeben in `utils/dart-coins.ts` COIN_SHOP.
   */
  dartCoins?: DartCoinsState;
}

/**
 * v2.9.87 — Ein Match-Datensatz. Wird bei jedem abgeschlossenen Karriere-
 * Match von `career-match.ts` / `career-controller.ts` angehängt.
 */
export interface CareerMatchLogEntry {
  date: string;              // ISO 8601
  tournamentId: string;
  tournamentName: string;
  round: string;
  opponent: string;
  result: 'won' | 'lost';
  legsWon: number;
  legsLost: number;
  playerAverage: number;
  opponentAverage: number;
  checkoutQuotePct: number;
  highCheckout: number;
  player180s: number;
}

export interface CompletedTournament {
  tournamentId: string;
  tournamentName: string;
  result: 'won' | 'runner_up' | 'semi' | 'quarter' | 'r16' | 'r32' | 'r64' | 'eliminated' | 'dns';
  prizeMoneyEarned: number;
  playerAverage: number;
  best180s: number;
  bestCheckout: number;
  week: number;
}

export interface Trophy {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

export interface Sponsor {
  id: string;
  name: string;
  bonus: string;
  unlockedAtRanking: number;
}

// ─── Konstanten: Schwierigkeitsstufen ────────────────────────────────────────

export const DIFFICULTY_CONFIGS: Record<CareerDifficulty, {
  label: string;
  description: string;
  opponentAverageMultiplier: number;
  opponentCheckoutMultiplier: number;
  startingRanking: number;
  /**
   * v2.9.84 — Best-of (2n-1) Legs, die dieser Schwierigkeitsgrad in
   * frühen Turnier-Runden bevorzugt. Turnier-FINALS ignorieren diesen Wert
   * und behalten die längere `legsToWinFinal`-Distanz des Turniers.
   * pub: 2 (BO3) · amateur: 2 (BO3) · semipro: 3 (BO5) · pro: 4 (BO7) · elite: 6 (BO11)
   */
  legsToWin: number;
}> = {
  pub: {
    label: 'Freizeitspieler',
    description: 'Gelegentliche Runden zuhause. KI-Gegner: 28–38 Average. Ideal für den Einstieg.',
    opponentAverageMultiplier: 0.38,
    opponentCheckoutMultiplier: 0.30,
    startingRanking: 200,
    legsToWin: 2,
  },
  amateur: {
    label: 'Hobbyspieler (35–45 Avg)',
    description: 'Regelmäßige Kneipen- und Vereinsspieler. KI-Gegner: 35–48 Average. Empfohlen für 35–45 Average.',
    opponentAverageMultiplier: 0.48,
    opponentCheckoutMultiplier: 0.38,
    startingRanking: 180,
    legsToWin: 2,
  },
  semipro: {
    label: 'Vereinsspieler (45–65 Avg)',
    description: 'Erfahrene Liga-Spieler. KI-Gegner: 48–68 Average. Für Spieler mit 45–65 Average.',
    opponentAverageMultiplier: 0.65,
    opponentCheckoutMultiplier: 0.55,
    startingRanking: 130,
    legsToWin: 3,
  },
  pro: {
    label: 'Fortgeschrittener (65–85 Avg)',
    description: 'Ambitionierte Turnierspieler. KI-Gegner: 68–88 Average. Für Spieler mit 65–85 Average.',
    opponentAverageMultiplier: 0.88,
    opponentCheckoutMultiplier: 0.78,
    startingRanking: 80,
    legsToWin: 4,
  },
  elite: {
    label: 'PDC-Niveau (85+ Avg)',
    description: 'Tour Card Holder Niveau. KI-Gegner spielen mit echten PDC-Averages (85–115). Für Spieler mit 85+ Average.',
    opponentAverageMultiplier: 1.0,
    opponentCheckoutMultiplier: 0.95,
    startingRanking: 50,
    legsToWin: 6,
  },
};

// ─── Konstanten: Vollständiger PDC-Turnierkalender ───────────────────────────

/**
 * Filtert den PDC-Turnierkalender nach Freischaltungs-Status.
 *
 * v2.9.90: Aus `CareerEngine.getAvailableTournaments()` extrahiert, damit
 * der freie Turnier-Modus (`components/Settings/TournamentMode.vue`)
 * dieselbe Sperrlogik wiederverwenden kann — mit einem eigenen, komplett
 * unabhängigen `tourCardActive`-Zustand (persistiert in `browser.storage.local`
 * unter dem Key `tm-tour-card-active`), losgelöst vom Karriere-Modus.
 *
 * Regeln:
 *   • Ohne Tour-Card:  Q-School + Secondary Tours zugänglich
 *   • Mit Tour-Card:   Pro Tour + Majors + WM zugänglich (nach Ranking-Cap)
 */
export function filterUnlockedTournaments(
  tournaments: CareerTournament[],
  tourCardActive: boolean,
  worldRanking: number = 999,
): CareerTournament[] {
  return tournaments.filter((t) => {
    if (t.tier === 'qschool') return !tourCardActive;
    if (t.tier === 'secondary') return !tourCardActive;
    if (!tourCardActive) return false;
    if (t.qualificationRank !== null && worldRanking > t.qualificationRank) return false;
    return true;
  });
}

/**
 * Ist ein einzelnes Turnier bei gegebenem Status freigeschaltet?
 * Wrapper um `filterUnlockedTournaments()` für Einzelabfragen (z.B. Kachel-
 * Sperr-Overlays in der UI).
 */
export function isTournamentUnlocked(
  tournament: CareerTournament,
  tourCardActive: boolean,
  worldRanking: number = 999,
): boolean {
  return filterUnlockedTournaments([tournament], tourCardActive, worldRanking).length === 1;
}

export const PDC_TOURNAMENT_CALENDAR: CareerTournament[] = [
  // ═══ JANUAR ═══
  {
    id: 'qschool',
    name: 'Q-School',
    shortName: 'Q-School',
    tier: 'qschool',
    month: 1,
    week: 1,
    venue: 'Barnsley, England / Niederlande',
    format: 'legs',
    legsToWinFinal: 4,
    legsToWinEarlyRounds: 3,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: false,
    qualificationRank: null,
    maxParticipants: 256,
    prizeMoneyWinner: 0,
    prizeMoneyRunnerUp: 0,
    prizeMoneyQuarterFinal: 0,
    description: 'Die Q-School ist das Qualifikationsturnier für die PDC Tour Card. Nur die Tagessieger und die besten Spieler der Order of Merit erhalten eine Tour Card für zwei Jahre.',
    formatDescription: 'Best of 7 Legs (Tagesformat) – 4 Tage, je ein Tagessieger erhält Tour Card',
  },
  {
    id: 'world_masters',
    name: 'PDC World Masters',
    shortName: 'World Masters',
    tier: 'major',
    month: 1,
    week: 4,
    venue: 'Marshall Arena, Milton Keynes',
    format: 'sets',
    setsToWinFinal: 6,
    setsToWinEarlyRounds: 3,
    legsPerSet: 3,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: true,
    qualificationRank: 24,
    maxParticipants: 32,
    prizeMoneyWinner: 100000,
    prizeMoneyRunnerUp: 50000,
    prizeMoneyQuarterFinal: 15000,
    description: 'Das World Masters ist ein neues Premier Event im Sets-Format (Best of 3 Legs pro Set). Die Top 24 der Weltrangliste qualifizieren sich automatisch.',
    formatDescription: 'Sets-Format – Best of 3 Legs pro Set. Finale: Best of 11 Sets',
  },
  // ═══ FEBRUAR / MÄRZ ═══
  {
    id: 'uk_open',
    name: 'UK Open',
    shortName: 'UK Open',
    tier: 'major',
    month: 3,
    week: 1,
    venue: "Butlin's Minehead, Somerset",
    format: 'legs',
    legsToWinFinal: 11,
    legsToWinEarlyRounds: 6,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: true,
    qualificationRank: null, // Offene Auslosung (FA-Cup des Darts)
    maxParticipants: 96,
    prizeMoneyWinner: 120000,
    prizeMoneyRunnerUp: 60000,
    prizeMoneyQuarterFinal: 20000,
    description: 'Das UK Open ist das "FA-Cup des Darts" – eine offene Auslosung ohne Setzliste. Jeder Tour-Card-Holder kann sich qualifizieren. Das Format ist reine Legs-Spiele.',
    formatDescription: 'Offene Auslosung – Best of 11 Legs (Runde 1–5), Finale: Best of 21 Legs',
  },
  // ═══ FEBRUAR–MAI (Premier League) ═══
  {
    id: 'premier_league',
    name: 'Premier League Darts',
    shortName: 'Premier League',
    tier: 'premier_league',
    month: 2,
    week: 1,
    venue: 'Verschiedene Arenen (UK & Europa)',
    format: 'legs',
    legsToWinFinal: 11,
    legsToWinEarlyRounds: 6,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: true,
    qualificationRank: 4, // Top 4 + 4 Wildcards
    maxParticipants: 8,
    prizeMoneyWinner: 350000,
    prizeMoneyRunnerUp: 175000,
    prizeMoneyQuarterFinal: 50000,
    description: 'Die Premier League ist das prestigeträchtigste Einladungsturnier. Nur die Top 4 der Welt + 4 Wildcards nehmen teil. 16 Spieltage (Round Robin) + Play-offs.',
    formatDescription: 'Round Robin (16 Spieltage) + Halbfinale + Finale – Best of 11 Legs pro Spiel',
  },
  // ═══ APRIL–NOVEMBER (Pro Tour) ═══
  {
    id: 'players_championship_1',
    name: 'Players Championship 1',
    shortName: 'PC 1',
    tier: 'protour',
    month: 2,
    week: 2,
    venue: 'Barnsley Metrodome, England',
    format: 'legs',
    legsToWinFinal: 6,
    legsToWinEarlyRounds: 4,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: false,
    qualificationRank: null,
    maxParticipants: 128,
    prizeMoneyWinner: 10000,
    prizeMoneyRunnerUp: 5000,
    prizeMoneyQuarterFinal: 2000,
    description: 'Players Championship Floor Events – die wöchentlichen Pro Tour Turniere ohne TV-Übertragung.',
    formatDescription: 'Best of 11 Legs (Finale: Best of 11)',
  },
  {
    id: 'european_tour_1',
    name: 'European Tour 1',
    shortName: 'ET 1',
    tier: 'protour',
    month: 3,
    week: 3,
    venue: 'Verschiedene Städte in Europa',
    format: 'legs',
    legsToWinFinal: 8,
    legsToWinEarlyRounds: 5,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: true,
    qualificationRank: null,
    maxParticipants: 64,
    prizeMoneyWinner: 25000,
    prizeMoneyRunnerUp: 12500,
    prizeMoneyQuarterFinal: 5000,
    description: 'European Tour Events – Pro Tour Turniere mit TV-Übertragung und Crowd-Atmosphäre.',
    formatDescription: 'Best of 11 Legs (Finale: Best of 15)',
  },
  // ═══ JUNI ═══
  {
    id: 'world_cup',
    name: 'World Cup of Darts',
    shortName: 'World Cup',
    tier: 'world_cup',
    month: 6,
    week: 2,
    venue: 'Frankfurt, Deutschland',
    format: 'legs',
    legsToWinFinal: 10,
    legsToWinEarlyRounds: 5,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: true,
    qualificationRank: null,
    maxParticipants: 32, // 16 Länder, je 2 Spieler
    prizeMoneyWinner: 50000,
    prizeMoneyRunnerUp: 25000,
    prizeMoneyQuarterFinal: 10000,
    description: 'Der World Cup ist ein Länderwettbewerb. Je zwei Spieler vertreten ihr Land. Einzel- und Doppelspiele.',
    formatDescription: 'Einzel: Best of 9 Legs, Doppel: Best of 9 Legs, Finale: Best of 21 Legs',
  },
  // ═══ JULI ═══
  {
    id: 'world_matchplay',
    name: 'World Matchplay',
    shortName: 'Matchplay',
    tier: 'major',
    month: 7,
    week: 3,
    venue: 'Winter Gardens, Blackpool',
    format: 'legs',
    legsToWinFinal: 18,
    legsToWinEarlyRounds: 8,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: true,
    qualificationRank: 16,
    maxParticipants: 32,
    prizeMoneyWinner: 200000,
    prizeMoneyRunnerUp: 100000,
    prizeMoneyQuarterFinal: 30000,
    description: 'Das World Matchplay in Blackpool ist eines der traditionsreichsten Turniere. Es wird ausschließlich in Legs gespielt – kein Sets-Format. Das Finale geht über 35 Legs.',
    formatDescription: 'Nur Legs – Finale: Best of 35 Legs (Win by 2 Rule)',
  },
  // ═══ AUGUST (World Series) ═══
  {
    id: 'australian_masters',
    name: 'Australian Masters',
    shortName: 'Aus Masters',
    tier: 'world_series',
    month: 8,
    week: 1,
    venue: 'WIN Entertainment Centre, Wollongong',
    format: 'legs',
    legsToWinFinal: 5,
    legsToWinEarlyRounds: 4,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: true,
    qualificationRank: 16,
    maxParticipants: 24,
    prizeMoneyWinner: 30000,
    prizeMoneyRunnerUp: 15000,
    prizeMoneyQuarterFinal: 7500,
    description: 'Das Australian Masters ist Teil der World Series of Darts – internationale Events auf der ganzen Welt.',
    formatDescription: 'Best of 9 Legs (Finale: Best of 11)',
  },
  {
    id: 'nz_masters',
    name: 'New Zealand Masters',
    shortName: 'NZ Masters',
    tier: 'world_series',
    month: 8,
    week: 2,
    venue: 'Spark Arena, Auckland',
    format: 'legs',
    legsToWinFinal: 5,
    legsToWinEarlyRounds: 4,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: true,
    qualificationRank: 16,
    maxParticipants: 24,
    prizeMoneyWinner: 30000,
    prizeMoneyRunnerUp: 15000,
    prizeMoneyQuarterFinal: 7500,
    description: 'Das New Zealand Masters – Teil der World Series of Darts.',
    formatDescription: 'Best of 9 Legs (Finale: Best of 11)',
  },
  // ═══ SEPTEMBER ═══
  {
    id: 'world_series_finals',
    name: 'World Series of Darts Finals',
    shortName: 'WS Finals',
    tier: 'world_series',
    month: 9,
    week: 2,
    venue: 'AFAS Live, Amsterdam',
    format: 'legs',
    legsToWinFinal: 6,
    legsToWinEarlyRounds: 5,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: true,
    qualificationRank: 16,
    maxParticipants: 16,
    prizeMoneyWinner: 75000,
    prizeMoneyRunnerUp: 37500,
    prizeMoneyQuarterFinal: 15000,
    description: 'Das Finale der World Series – die besten Spieler der internationalen Events treffen aufeinander.',
    formatDescription: 'Best of 11 Legs (Finale: Best of 11)',
  },
  // ═══ OKTOBER ═══
  {
    id: 'world_grand_prix',
    name: 'World Grand Prix',
    shortName: 'Grand Prix',
    tier: 'major',
    month: 10,
    week: 1,
    venue: 'Mattioli Arena, Leicester',
    format: 'sets',
    setsToWinFinal: 5,
    setsToWinEarlyRounds: 2,
    legsPerSet: 3,
    inMode: 'double',   // ← DOUBLE-IN! Das Besondere dieses Turniers
    outMode: 'double',
    isTvEvent: true,
    qualificationRank: 32,
    maxParticipants: 32,
    prizeMoneyWinner: 200000,
    prizeMoneyRunnerUp: 100000,
    prizeMoneyQuarterFinal: 30000,
    description: 'Das World Grand Prix hat eine einzigartige Regel: DOUBLE-IN! Jedes Leg muss mit einem Doppelfeld begonnen werden. Das macht es zum taktisch anspruchsvollsten Major.',
    formatDescription: '⚡ DOUBLE-IN / DOUBLE-OUT – Sets-Format. Finale: Best of 9 Sets',
  },
  {
    id: 'european_championship',
    name: 'European Championship',
    shortName: 'European Champ.',
    tier: 'major',
    month: 10,
    week: 3,
    venue: 'Westfalenhallen, Dortmund',
    format: 'legs',
    legsToWinFinal: 11,
    legsToWinEarlyRounds: 6,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: true,
    qualificationRank: 32,
    maxParticipants: 32,
    prizeMoneyWinner: 150000,
    prizeMoneyRunnerUp: 75000,
    prizeMoneyQuarterFinal: 25000,
    description: 'Die European Championship in Dortmund – das größte Darts-Event auf dem europäischen Festland.',
    formatDescription: 'Best of 11 Legs (Finale: Best of 21 Legs)',
  },
  // ═══ NOVEMBER ═══
  {
    id: 'grand_slam',
    name: 'Grand Slam of Darts',
    shortName: 'Grand Slam',
    tier: 'major',
    month: 11,
    week: 1,
    venue: 'WV Active Aldersley, Wolverhampton',
    format: 'legs',
    legsToWinFinal: 16,
    legsToWinEarlyRounds: 5,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: true,
    qualificationRank: 16,
    maxParticipants: 32,
    prizeMoneyWinner: 175000,
    prizeMoneyRunnerUp: 87500,
    prizeMoneyQuarterFinal: 30000,
    description: 'Der Grand Slam of Darts vereint PDC- und BDO/WDF-Spieler. Gruppenphase (Round Robin) + K.O.-Runden. Das Finale geht über 31 Legs.',
    formatDescription: 'Gruppenphase (Round Robin) + K.O. – Finale: Best of 31 Legs',
  },
  {
    id: 'players_championship_finals',
    name: 'Players Championship Finals',
    shortName: 'PC Finals',
    tier: 'major',
    month: 11,
    week: 3,
    venue: "Butlin's Minehead, Somerset",
    format: 'legs',
    legsToWinFinal: 11,
    legsToWinEarlyRounds: 6,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: true,
    qualificationRank: 64, // Top 64 der Pro Tour Order of Merit
    maxParticipants: 64,
    prizeMoneyWinner: 150000,
    prizeMoneyRunnerUp: 75000,
    prizeMoneyQuarterFinal: 25000,
    description: 'Das Players Championship Finals krönt die Pro Tour Saison. Die Top 64 der Pro Tour Order of Merit qualifizieren sich.',
    formatDescription: 'Best of 11 Legs (Finale: Best of 21 Legs)',
  },
  // ═══ DEZEMBER / JANUAR (WM) ═══
  {
    id: 'world_championship',
    name: 'PDC World Darts Championship',
    shortName: 'WM',
    tier: 'world_championship',
    month: 12,
    week: 2,
    venue: 'Alexandra Palace, London',
    format: 'sets',
    setsToWinFinal: 7,
    setsToWinEarlyRounds: 3,
    legsPerSet: 5,
    inMode: 'straight',
    outMode: 'double',
    isTvEvent: true,
    qualificationRank: 32,
    maxParticipants: 96,
    prizeMoneyWinner: 500000,
    prizeMoneyRunnerUp: 200000,
    prizeMoneyQuarterFinal: 50000,
    description: 'DIE Weltmeisterschaft – das Highlight jeder Darts-Karriere. Im Alexandra Palace in London kämpfen 96 Spieler um den Sid Waddell Trophy. Das Finale geht über 13 Sets.',
    formatDescription: '🏆 Sets-Format – Best of 5 Legs pro Set. Finale: Best of 13 Sets',
  },
];

// ─── Echte PDC Order of Merit (Stand: 24. Juni 2026) ───────────────────────
// Quelle: darts1.de / PDC Official Rankings (Stand: 24.06.2026)
// Wird als Fallback genutzt, wenn kein Live-Abruf möglich ist.

export interface PdcRankingEntry {
  rank: number;
  name: string;
  country: string;
  earnings: number; // in £
}

export const PDC_ORDER_OF_MERIT_2026: PdcRankingEntry[] = [
  { rank: 1,  name: 'Luke Littler',           country: 'ENG', earnings: 2929500 },
  { rank: 2,  name: 'Luke Humphries',          country: 'ENG', earnings: 1198000 },
  { rank: 3,  name: 'Gian van Veen',           country: 'NED', earnings: 933000  },
  { rank: 4,  name: 'Michael van Gerwen',      country: 'NED', earnings: 714250  },
  { rank: 5,  name: 'Jonny Clayton',           country: 'WAL', earnings: 690500  },
  { rank: 6,  name: 'James Wade',              country: 'ENG', earnings: 667250  },
  { rank: 7,  name: 'Gerwyn Price',            country: 'WAL', earnings: 617500  },
  { rank: 8,  name: 'Josh Rock',               country: 'NIR', earnings: 613000  },
  { rank: 9,  name: 'Stephen Bunting',         country: 'ENG', earnings: 612250  },
  { rank: 10, name: 'Danny Noppert',           country: 'NED', earnings: 597500  },
  { rank: 11, name: 'Ryan Searle',             country: 'ENG', earnings: 588250  },
  { rank: 12, name: 'Gary Anderson',           country: 'SCO', earnings: 577000  },
  { rank: 13, name: 'Chris Dobey',             country: 'ENG', earnings: 567000  },
  { rank: 14, name: 'Wessel Nijman',           country: 'NED', earnings: 550250  },
  { rank: 15, name: 'Ross Smith',              country: 'ENG', earnings: 539250  },
  { rank: 16, name: 'Nathan Aspinall',         country: 'ENG', earnings: 520250  },
  { rank: 17, name: 'Jermaine Wattimena',      country: 'NED', earnings: 479500  },
  { rank: 18, name: 'Luke Woodhouse',          country: 'ENG', earnings: 471250  },
  { rank: 19, name: 'Martin Schindler',        country: 'GER', earnings: 449750  },
  { rank: 20, name: 'Rob Cross',               country: 'ENG', earnings: 426500  },
  { rank: 21, name: 'Mike De Decker',          country: 'BEL', earnings: 426000  },
  { rank: 22, name: 'Damon Heta',              country: 'AUS', earnings: 417250  },
  { rank: 23, name: 'Krzysztof Ratajski',      country: 'POL', earnings: 398500  },
  { rank: 24, name: 'Ryan Joyce',              country: 'ENG', earnings: 391250  },
  { rank: 25, name: 'Andrew Gilding',          country: 'ENG', earnings: 383250  },
  { rank: 26, name: 'Daryl Gurney',            country: 'NIR', earnings: 364500  },
  { rank: 27, name: 'Dave Chisnall',           country: 'ENG', earnings: 354000  },
  { rank: 28, name: 'Cameron Menzies',         country: 'SCO', earnings: 352750  },
  { rank: 29, name: 'Dirk van Duijvenbode',    country: 'NED', earnings: 352500  },
  { rank: 30, name: 'Kevin Doets',             country: 'NED', earnings: 324250  },
  { rank: 31, name: 'Joe Cullen',              country: 'ENG', earnings: 311750  },
  { rank: 32, name: 'Ritchie Edhouse',         country: 'ENG', earnings: 309750  },
  { rank: 33, name: 'Michael Smith',           country: 'ENG', earnings: 304500  },
  { rank: 34, name: 'Peter Wright',            country: 'SCO', earnings: 292750  },
  { rank: 35, name: 'Ricardo Pietreczko',      country: 'GER', earnings: 287250  },
  { rank: 36, name: 'Niels Zonneveld',         country: 'NED', earnings: 235500  },
  { rank: 37, name: "William O'Connor",        country: 'IRL', earnings: 232500  },
  { rank: 38, name: 'Martin Lukeman',          country: 'ENG', earnings: 214250  },
  { rank: 39, name: 'Dimitri Van den Bergh',   country: 'BEL', earnings: 213500  },
  { rank: 40, name: 'Raymond van Barneveld',   country: 'NED', earnings: 209750  },
  { rank: 41, name: 'Callan Rydz',             country: 'ENG', earnings: 201750  },
  { rank: 42, name: 'Niko Springer',           country: 'GER', earnings: 193250  },
  { rank: 43, name: 'Madars Razma',            country: 'LAT', earnings: 187250  },
  { rank: 44, name: 'Connor Scutt',            country: 'ENG', earnings: 183000  },
  { rank: 45, name: 'Mickey Mansell',          country: 'NIR', earnings: 181250  },
  { rank: 46, name: 'Justin Hood',             country: 'ENG', earnings: 175500  },
  { rank: 47, name: 'Gabriel Clemens',         country: 'GER', earnings: 174750  },
  { rank: 48, name: 'Ricky Evans',             country: 'ENG', earnings: 173500  },
  { rank: 49, name: 'Scott Williams',          country: 'ENG', earnings: 170000  },
  { rank: 50, name: 'Jeffrey De Graaf',        country: 'NED', earnings: 168750  },
  { rank: 51, name: 'James Hurrell',           country: 'ENG', earnings: 166250  },
  { rank: 52, name: 'Brendan Dolan',           country: 'NIR', earnings: 160750  },
  { rank: 53, name: 'Kim Huybrechts',          country: 'BEL', earnings: 158750  },
  { rank: 54, name: 'Mensur Suljovic',         country: 'SRB', earnings: 158000  },
  { rank: 55, name: 'Ian White',               country: 'ENG', earnings: 154750  },
  { rank: 56, name: 'Keane Barry',             country: 'IRL', earnings: 146000  },
  { rank: 57, name: 'Alan Soutar',             country: 'SCO', earnings: 141250  },
  { rank: 58, name: 'Richard Veenstra',        country: 'NED', earnings: 138250  },
  { rank: 59, name: 'Karel Sedlacek',          country: 'CZE', earnings: 133750  },
  { rank: 60, name: 'Rob Owen',               country: 'WAL', earnings: 126000  },
  { rank: 61, name: 'Ryan Meikle',             country: 'ENG', earnings: 125750  },
  { rank: 62, name: 'Nick Kenny',              country: 'WAL', earnings: 122500  },
  { rank: 63, name: 'Lukas Wenig',             country: 'GER', earnings: 121500  },
  { rank: 64, name: 'Thibault Tricole',        country: 'FRA', earnings: 117000  },
  // Ränge 65–100 (Stand: 24.06.2026)
  { rank: 65, name: 'Sebastian Bialecki',      country: 'POL', earnings: 116750  },
  { rank: 66, name: 'Mario Vandenbogaerde',    country: 'BEL', earnings: 102500  },
  { rank: 67, name: 'Max Hopp',                country: 'GER', earnings: 99000   },
  { rank: 68, name: 'Bradley Brooks',          country: 'ENG', earnings: 96000   },
  { rank: 69, name: 'Cam Crabtree',            country: 'ENG', earnings: 95500   },
  { rank: 70, name: 'Wesley Plaisier',         country: 'NED', earnings: 87250   },
  { rank: 71, name: 'Adam Lipscombe',          country: 'ENG', earnings: 78750   },
  { rank: 72, name: 'Maik Kuivenhoven',        country: 'NED', earnings: 70000   },
  { rank: 73, name: 'Tom Bissell',             country: 'ENG', earnings: 66250   },
  { rank: 74, name: 'Cor Dekker',              country: 'NED', earnings: 62500   },
  { rank: 75, name: 'Darryl Pilgrim',          country: 'ENG', earnings: 60750   },
  { rank: 76, name: 'Cristo Reyes',            country: 'ESP', earnings: 59750   },
  { rank: 77, name: 'Dominik Gruellich',       country: 'GER', earnings: 59000   },
  { rank: 78, name: 'Beau Greaves',            country: 'ENG', earnings: 57500   },
  { rank: 79, name: 'Christian Kist',          country: 'NED', earnings: 50000   },
  { rank: 80, name: 'Andy Boulton',            country: 'ENG', earnings: 49750   },
  { rank: 81, name: 'Jim Long',                country: 'ENG', earnings: 45500   },
  { rank: 82, name: 'Tom Sykes',               country: 'ENG', earnings: 41750   },
  { rank: 83, name: 'Leon Weber',              country: 'GER', earnings: 40000   },
  { rank: 84, name: 'Thomas Lovely',           country: 'ENG', earnings: 38500   },
  { rank: 85, name: 'Oskar Lukasiak',          country: 'POL', earnings: 37500   },
  { rank: 86, name: 'Tavis Dudeney',           country: 'ENG', earnings: 36000   },
  { rank: 87, name: 'Charlie Manby',           country: 'ENG', earnings: 34000   },
  { rank: 88, name: 'Joe Hunt',                country: 'ENG', earnings: 33500   },
  { rank: 89, name: 'Jimmy van Schie',         country: 'NED', earnings: 33250   },
  { rank: 90, name: 'Marvin van Velzen',       country: 'NED', earnings: 32750   },
  { rank: 91, name: 'Darius Labanauskas',      country: 'LTU', earnings: 31750   },
  { rank: 92, name: 'Viktor Tingstrom',        country: 'SWE', earnings: 29250   },
  { rank: 93, name: 'Alexander Merkx',         country: 'NED', earnings: 29000   },
  { rank: 94, name: 'Shane McGuirk',           country: 'IRL', earnings: 28500   },
  { rank: 95, name: 'Kai Gotthardt',           country: 'GER', earnings: 27250   },
  { rank: 96, name: 'Greg Ritchie',            country: 'SCO', earnings: 26750   },
  { rank: 97, name: 'Dennie Olde Kalter',      country: 'NED', earnings: 26250   },
  { rank: 98, name: 'Adam Paxton',             country: 'ENG', earnings: 25750   },
  { rank: 99, name: 'Mervyn King',             country: 'ENG', earnings: 25000   },
  { rank: 100, name: 'Adam Gawlas',            country: 'CZE', earnings: 24500   },
];

// ─── Live-Ranglisten-Abruf (v2.7.0) ─────────────────────────────────────────

const RANKINGS_CACHE_KEY = 'local:pdc-oom-live-cache-v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 Stunden

interface RankingsCache {
  rankings: PdcRankingEntry[];
  fetchedAt: number;
}

/**
 * Gibt den Zeitstempel des letzten Live-Abrufs zurück (oder null).
 */
export async function getLastRankingsFetchTime(): Promise<Date | null> {
  try {
    const stored = await browser.storage.local.get(RANKINGS_CACHE_KEY) as Record<string, RankingsCache>;
    const cache = stored[RANKINGS_CACHE_KEY];
    return cache ? new Date(cache.fetchedAt) : null;
  } catch { return null; }
}

/**
 * Versucht die aktuelle PDC Order of Merit von dartsrankings.com zu laden.
 * Nutzt einen 24h-Cache. Fällt bei Fehler auf die eingebettete Rangliste zurück.
 */
export async function fetchLiveRankings(forceRefresh = false): Promise<{ rankings: PdcRankingEntry[]; isLive: boolean }> {
  try {
    const stored = await browser.storage.local.get(RANKINGS_CACHE_KEY) as Record<string, RankingsCache>;
    const cache = stored[RANKINGS_CACHE_KEY];
    // Cache nutzen wenn nicht abgelaufen UND kein Force-Refresh
    if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
      return { rankings: cache.rankings, isLive: true };
    }

    const response = await fetch('https://www.dartsrankings.com/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AutodartsTools/2.8.2)' },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const rankings = parseDartsRankingsHtml(html);

    if (rankings.length >= 32) {
      await browser.storage.local.set({
        [RANKINGS_CACHE_KEY]: { rankings, fetchedAt: Date.now() } satisfies RankingsCache,
      });
      return { rankings, isLive: true };
    }
    throw new Error('Zu wenige Einträge geparst');
  } catch (err) {
    console.warn('[CareerEngine v2.8.1] Live-Abruf fehlgeschlagen, nutze eingebettete Rangliste (Stand: 24.06.2026):', err);
    return { rankings: PDC_ORDER_OF_MERIT_2026, isLive: false };
  }
}

/**
 * Parst die HTML-Tabelle von dartsrankings.com.
 */
function parseDartsRankingsHtml(html: string): PdcRankingEntry[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = doc.querySelectorAll('table tr');
  const entries: PdcRankingEntry[] = [];

  rows.forEach((row) => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 4) return;
    const rank = parseInt(cells[0]?.textContent?.trim() ?? '0', 10);
    const name = cells[2]?.textContent?.trim() ?? '';
    const earningsRaw = cells[3]?.textContent?.trim().replace(/[^0-9.]/g, '') ?? '0';
    const earnings = Math.round(parseFloat(earningsRaw) * 1000);
    if (rank > 0 && name.length > 2) {
      entries.push({ rank, name, country: guessCountry(name), earnings });
    }
  });

  return entries.sort((a, b) => a.rank - b.rank);
}

/**
 * Gibt das Land eines bekannten PDC-Spielers zurück.
 */
function guessCountry(name: string): string {
  const map: Record<string, string> = {
    'Luke Littler': 'ENG', 'Luke Humphries': 'ENG', 'Gian van Veen': 'NED',
    'Michael van Gerwen': 'NED', 'Jonny Clayton': 'WAL', 'James Wade': 'ENG',
    'Gerwyn Price': 'WAL', 'Josh Rock': 'NIR', 'Stephen Bunting': 'ENG',
    'Danny Noppert': 'NED', 'Ryan Searle': 'ENG', 'Gary Anderson': 'SCO',
    'Chris Dobey': 'ENG', 'Wessel Nijman': 'NED', 'Ross Smith': 'ENG',
    'Nathan Aspinall': 'ENG', 'Jermaine Wattimena': 'NED', 'Luke Woodhouse': 'ENG',
    'Martin Schindler': 'GER', 'Rob Cross': 'ENG', 'Mike De Decker': 'BEL',
    'Damon Heta': 'AUS', 'Krzysztof Ratajski': 'POL', 'Ryan Joyce': 'ENG',
    'Andrew Gilding': 'ENG', 'Daryl Gurney': 'NIR', 'Dave Chisnall': 'ENG',
    'Cameron Menzies': 'SCO', 'Dirk van Duijvenbode': 'NED', 'Kevin Doets': 'NED',
    'Joe Cullen': 'ENG', 'Ritchie Edhouse': 'ENG', 'Michael Smith': 'ENG',
    'Peter Wright': 'SCO', 'Ricardo Pietreczko': 'GER', 'Niels Zonneveld': 'NED',
    "William O'Connor": 'IRL', 'Martin Lukeman': 'ENG', 'Dimitri Van den Bergh': 'BEL',
    'Raymond van Barneveld': 'NED', 'Callan Rydz': 'ENG', 'Niko Springer': 'GER',
    'Madars Razma': 'LAT', 'Gabriel Clemens': 'GER', 'Mensur Suljovic': 'SRB',
    'Ian White': 'ENG', 'Keane Barry': 'IRL', 'Thibault Tricole': 'FRA',
    'Lukas Wenig': 'GER', 'Max Hopp': 'GER', 'Kim Huybrechts': 'BEL',
    'Florian Hempel': 'GER',
  };
  return map[name] ?? 'INT';
}

/**
 * Baut das Turnier-Teilnehmerfeld nach echten PDC-Qualifikationsregeln (v2.7.0).
 *
 * Qualifikationsregeln (PDC-authentisch):
 *  – Premier League:            Top 4 OoM + 4 Wildcards (Einladung)
 *  – Weltmeisterschaft:         Top 32 OoM (Runde 2) + Top 32 Pro Tour + 32 Qualifier
 *  – World Matchplay:           Top 16 OoM + Top 16 Pro Tour OoM
 *  – World Grand Prix:          Top 32 OoM
 *  – Grand Slam:                Top 24 OoM + 8 Qualifier
 *  – European Championship:     Top 16 OoM + 16 europäische Qualifier
 *  – UK Open:                   Alle Tour-Card-Holder (offene Auslosung)
 *  – Pro Tour Events:           Alle Tour-Card-Holder
 */
export function buildTournamentField(
  tournamentId: string,
  rankings: PdcRankingEntry[],
  playerRank: number,
  playerName: string,
): PdcRankingEntry[] {
  const rules: Record<string, { oomSlots: number; maxField: number }> = {
    premier_league:              { oomSlots: 4,  maxField: 8   },
    world_championship:          { oomSlots: 32, maxField: 96  },
    world_matchplay:             { oomSlots: 16, maxField: 32  },
    world_grand_prix:            { oomSlots: 32, maxField: 32  },
    grand_slam:                  { oomSlots: 24, maxField: 32  },
    european_championship:       { oomSlots: 16, maxField: 32  },
    uk_open:                     { oomSlots: 64, maxField: 96  },
    players_championship_finals: { oomSlots: 64, maxField: 64  },
    world_masters:               { oomSlots: 24, maxField: 32  },
    world_series_finals:         { oomSlots: 16, maxField: 16  },
    players_championship_1:      { oomSlots: 64, maxField: 128 },
    european_tour_1:             { oomSlots: 32, maxField: 64  },
    australian_masters:          { oomSlots: 16, maxField: 24  },
    nz_masters:                  { oomSlots: 16, maxField: 24  },
    world_cup:                   { oomSlots: 32, maxField: 32  },
    qschool:                     { oomSlots: 0,  maxField: 256 },
  };

  const rule = rules[tournamentId] ?? { oomSlots: 32, maxField: 32 };

  const field: PdcRankingEntry[] = rankings
    .filter(p => p.rank <= rule.oomSlots)
    .slice(0, rule.oomSlots);

  const playerQualified = playerRank <= rule.maxField;
  if (playerQualified && !field.some(p => p.name === playerName)) {
    field.push({ rank: playerRank, name: playerName, country: 'DU', earnings: 0 });
  }

  return field
    .sort((a, b) => a.rank - b.rank)
    .slice(0, rule.maxField);
}

// ─── KI-Gegner Datenbank (echte PDC-Spieler als Vorbilder) ──────────────────

/**
 * KI-Gegner Datenbank – Echte PDC-Statistiken (Stand: 24.06.2026)
 *
 * Quellen:
 *  – Darts Orakel (dartsorakel.com): Averages letzte 12 Monate, Checkout %
 *  – PDC Players Championship 2026 Wikipedia: Match-Averages
 *  – darts1.de / whichdarts.com: Order of Merit Rang
 *  – Sky Sports / BBC Sport: Aktuelle Form & Turnierergebnisse
 *
 * Average-Bereiche: Min = schlechter Tag / Formtief, Max = Hochform / TV-Abend
 * Checkout-Rate: Basiert auf echten PDC-Statistiken (Darts Orakel)
 * Aktuelle Form 2026 (in Kommentaren): Turnierergebnisse Jan–Jun 2026
 */
export const PDC_OPPONENTS: CareerOpponent[] = [

  // ═══════════════════════════════════════════════════════════════════
  // WELTKLASSE – TOP 5 (Stand: 24.06.2026)
  // ═══════════════════════════════════════════════════════════════════

  // #1 Luke Littler (ENG) – Avg 101.21 (letzte 12 Mo.), Checkout 43.49%
  // Form 2026: Premier League Sieger, WM-Finalist, 2x PC-Sieger
  // Höchstes Match-Average: 111.05 (PL Semis vs Price)
  { id: 'llittler',    name: 'Luke Littler',          country: 'ENG', averageMin: 95,  averageMax: 111, checkoutRateMin: 40, checkoutRateMax: 50, worldRanking: 1,  isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #2 Luke Humphries (ENG) – Avg ~99, Checkout ~44–46%
  // Form 2026: PC4-Sieger (108.53 Avg), konstant Top-4
  { id: 'lhumphreys',  name: 'Luke Humphries',         country: 'ENG', averageMin: 91,  averageMax: 108, checkoutRateMin: 41, checkoutRateMax: 49, worldRanking: 2,  isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #3 Gian van Veen (NED) – Avg ~95–98, Checkout ~40–44%
  // Form 2026: ET9-Finalist (98.72 Avg), starke PC-Ergebnisse
  { id: 'gvv',         name: 'Gian van Veen',          country: 'NED', averageMin: 88,  averageMax: 103, checkoutRateMin: 38, checkoutRateMax: 47, worldRanking: 3,  isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #4 Michael van Gerwen (NED) – Avg 122.34 (Höchstes 2026!), Checkout ~47–52%
  // Form 2026: Höchstes Average aller Spieler 2026 (122.34), PC1-QF (96.90)
  // Legende: Trotz Rang 4 statistisch gefährlichster Spieler bei Hochform
  { id: 'mvg',         name: 'Michael van Gerwen',     country: 'NED', averageMin: 90,  averageMax: 122, checkoutRateMin: 44, checkoutRateMax: 55, worldRanking: 4,  isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #5 Jonny Clayton (WAL) – Avg ~88–95, Checkout ~38–44%
  // Form 2026: Premier League Stammgast, PC3-QF (92.20)
  { id: 'jclayton',    name: 'Jonny Clayton',          country: 'WAL', averageMin: 84,  averageMax: 97,  checkoutRateMin: 36, checkoutRateMax: 46, worldRanking: 5,  isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // ═══════════════════════════════════════════════════════════════════
  // TOP 6–16
  // ═══════════════════════════════════════════════════════════════════

  // #6 James Wade (ENG) – Avg ~88–95, Checkout ~38–44%
  // Form 2026: PC1-Sieger (93.69 Final-Avg), 1000 PC-Siege Meilenstein (PC7)
  { id: 'jwade',       name: 'James Wade',             country: 'ENG', averageMin: 85,  averageMax: 98,  checkoutRateMin: 37, checkoutRateMax: 46, worldRanking: 6,  isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #7 Gerwyn Price (WAL) – Avg 98.57 (Darts Orakel), Checkout ~40–46%
  // Form 2026: PC2-Finalist (107.41 SF-Avg!), PC6-Sieger (108.59 QF), sehr in Form
  // Höchstes Single-Match Avg 2026: 117.12
  { id: 'gprice',      name: 'Gerwyn Price',           country: 'WAL', averageMin: 88,  averageMax: 117, checkoutRateMin: 38, checkoutRateMax: 49, worldRanking: 7,  isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #8 Josh Rock (NIR) – Avg ~88–97, Checkout ~40–48%
  // Form 2026: Regelmäßige Top-16 Ergebnisse, starke Aufschläge
  { id: 'jrock',       name: 'Josh Rock',              country: 'NIR', averageMin: 84,  averageMax: 100, checkoutRateMin: 38, checkoutRateMax: 49, worldRanking: 8,  isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #9 Stephen Bunting (ENG) – Avg ~86–97, Checkout ~36–44%
  // Form 2026: PC3-Finalist (101.85 SF-Avg), konstant Top-8
  { id: 'sbunting',    name: 'Stephen Bunting',        country: 'ENG', averageMin: 83,  averageMax: 101, checkoutRateMin: 35, checkoutRateMax: 45, worldRanking: 9,  isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #10 Danny Noppert (NED) – Avg ~84–96, Checkout ~36–44%
  // Form 2026: PC2-QF (96.80), solide Ergebnisse
  { id: 'dnoppert',    name: 'Danny Noppert',          country: 'NED', averageMin: 81,  averageMax: 97,  checkoutRateMin: 34, checkoutRateMax: 44, worldRanking: 10, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #11 Ryan Searle (ENG) – Avg ~90–99, Checkout ~36–44%
  // Form 2026: PC7-Sieger (99.41 QF, 96.52 SF, 95.65 Final), sehr in Form!
  { id: 'rsearle',     name: 'Ryan Searle',            country: 'ENG', averageMin: 85,  averageMax: 99,  checkoutRateMin: 35, checkoutRateMax: 45, worldRanking: 11, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #12 Gary Anderson (SCO) – Avg ~82–103, Checkout ~34–42%
  // Form 2026: PC7-QF (103.97!), inkonsistent aber gefährlich in Hochform
  { id: 'ganderson',   name: 'Gary Anderson',          country: 'SCO', averageMin: 78,  averageMax: 104, checkoutRateMin: 32, checkoutRateMax: 43, worldRanking: 12, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #13 Chris Dobey (ENG) – Avg ~91–105, Checkout ~38–46%
  // Form 2026: PC3-Sieger (95.37), PC9-Sieger (105.28 QF!), PC5-Finalist – TOP-FORM!
  { id: 'cdobey',      name: 'Chris Dobey',            country: 'ENG', averageMin: 87,  averageMax: 105, checkoutRateMin: 37, checkoutRateMax: 48, worldRanking: 13, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #14 Wessel Nijman (NED) – Avg ~94–109, Checkout ~40–48%
  // Form 2026: PC8-Sieger (105.11 QF), PC10-Sieger (109.71 QF!), ET9-SIEGER (103.80)!
  // Heißester Spieler 2026 – 4 Ranking-Titel in 2026!
  { id: 'wnijman',     name: 'Wessel Nijman',          country: 'NED', averageMin: 88,  averageMax: 110, checkoutRateMin: 40, checkoutRateMax: 50, worldRanking: 14, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #15 Ross Smith (ENG) – Avg ~88–104, Checkout ~36–45%
  // Form 2026: PC5-Sieger (104.24 SF-Avg!), sehr in Form
  { id: 'rsmith',      name: 'Ross Smith',             country: 'ENG', averageMin: 83,  averageMax: 104, checkoutRateMin: 35, checkoutRateMax: 46, worldRanking: 15, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #16 Nathan Aspinall (ENG) – Avg ~87–97, Checkout ~36–44%
  // Form 2026: PC1-Finalist (95.26 SF), konstant Top-8
  { id: 'naspinall',   name: 'Nathan Aspinall',        country: 'ENG', averageMin: 83,  averageMax: 97,  checkoutRateMin: 35, checkoutRateMax: 45, worldRanking: 16, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // ═══════════════════════════════════════════════════════════════════
  // TOP 17–32 (Major-Qualifikanten)
  // ═══════════════════════════════════════════════════════════════════

  // #17 Jermaine Wattimena (NED) – Avg ~78–92, Checkout ~30–40%
  { id: 'jwattimena',  name: 'Jermaine Wattimena',     country: 'NED', averageMin: 76,  averageMax: 93,  checkoutRateMin: 29, checkoutRateMax: 41, worldRanking: 17, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #18 Martin Schindler (GER) – Avg 120.69 (Höchstes 2026 #2!), Checkout ~38–46%
  // Form 2026: 9-Darter in PC2, höchstes Single-Match Avg 120.69!
  // Europäischer Spieler – sehr gefährlich in Hochform
  { id: 'mschindler',  name: 'Martin Schindler',       country: 'GER', averageMin: 80,  averageMax: 121, checkoutRateMin: 36, checkoutRateMax: 48, worldRanking: 18, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #19 Mike De Decker (BEL) – Avg ~78–90, Checkout ~30–40%
  // Form 2026: PC4-QF (80.32), schwächere Saison bisher
  { id: 'mde_decker',  name: 'Mike De Decker',         country: 'BEL', averageMin: 75,  averageMax: 92,  checkoutRateMin: 29, checkoutRateMax: 40, worldRanking: 19, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #20 Luke Woodhouse (ENG) – Avg ~85–100, Checkout ~34–42%
  // Form 2026: PC10-SF (100.46), PC9-SF, aufsteigend
  { id: 'lwoodhouse',  name: 'Luke Woodhouse',         country: 'ENG', averageMin: 80,  averageMax: 101, checkoutRateMin: 32, checkoutRateMax: 43, worldRanking: 20, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #21 Damon Heta (AUS) – Avg ~78–92, Checkout ~30–40%
  { id: 'dheta',       name: 'Damon Heta',             country: 'AUS', averageMin: 75,  averageMax: 93,  checkoutRateMin: 29, checkoutRateMax: 41, worldRanking: 21, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #22 Krzysztof Ratajski (POL) – Avg ~82–101, Checkout ~32–42%
  // Form 2026: PC2-SF (101.45!), Europäischer Spieler
  { id: 'kratajski',   name: 'Krzysztof Ratajski',     country: 'POL', averageMin: 78,  averageMax: 102, checkoutRateMin: 31, checkoutRateMax: 43, worldRanking: 22, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #23 Rob Cross (ENG) – Avg ~82–98, Checkout ~34–44%
  // Form 2026: ET9-Finalist (98.55 Final-Avg)
  { id: 'rcross',      name: 'Rob Cross',              country: 'ENG', averageMin: 79,  averageMax: 99,  checkoutRateMin: 33, checkoutRateMax: 44, worldRanking: 23, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #24 Daryl Gurney (NIR) – Avg ~76–90, Checkout ~28–38%
  // Form 2026: PC4-SF (87.45), solide
  { id: 'dgurney',     name: 'Daryl Gurney',           country: 'NIR', averageMin: 73,  averageMax: 91,  checkoutRateMin: 27, checkoutRateMax: 39, worldRanking: 24, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #25 Dave Chisnall (ENG) – Avg ~80–103, Checkout ~30–40%
  // Form 2026: PC8-QF (103.68!), inkonsistent aber gefährlich
  { id: 'dchisnall',   name: 'Dave Chisnall',          country: 'ENG', averageMin: 76,  averageMax: 104, checkoutRateMin: 28, checkoutRateMax: 40, worldRanking: 25, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #26 Ryan Joyce (ENG) – Avg ~76–90, Checkout ~28–38%
  { id: 'rjoyce',      name: 'Ryan Joyce',             country: 'ENG', averageMin: 73,  averageMax: 91,  checkoutRateMin: 27, checkoutRateMax: 38, worldRanking: 26, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #27 Dirk van Duijvenbode (NED) – Avg ~74–90, Checkout ~28–38%
  { id: 'dvduvij',     name: 'Dirk van Duijvenbode',   country: 'NED', averageMin: 72,  averageMax: 91,  checkoutRateMin: 27, checkoutRateMax: 38, worldRanking: 27, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #28 Andrew Gilding (ENG) – Avg 118.66 (Höchstes 2026 #4!), Checkout ~36–46%
  // Form 2026: PC6-Finalist (94.67), PC9-SF (98.26), Höchstes Avg 118.66!
  { id: 'agilding',    name: 'Andrew Gilding',         country: 'ENG', averageMin: 78,  averageMax: 119, checkoutRateMin: 34, checkoutRateMax: 47, worldRanking: 28, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #29 Cameron Menzies (SCO) – Avg ~74–88, Checkout ~26–36%
  { id: 'cmenzies',    name: 'Cameron Menzies',        country: 'SCO', averageMin: 71,  averageMax: 89,  checkoutRateMin: 25, checkoutRateMax: 37, worldRanking: 29, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #30 Ritchie Edhouse (ENG) – Avg ~72–88, Checkout ~26–36%
  { id: 'redhouse',    name: 'Ritchie Edhouse',        country: 'ENG', averageMin: 70,  averageMax: 89,  checkoutRateMin: 25, checkoutRateMax: 37, worldRanking: 30, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #31 Michael Smith (ENG) – Avg ~78–95, Checkout ~32–44%
  // Form 2026: Unter seinen Möglichkeiten, ehemaliger Weltmeister
  { id: 'msmith',      name: 'Michael Smith',          country: 'ENG', averageMin: 75,  averageMax: 96,  checkoutRateMin: 31, checkoutRateMax: 44, worldRanking: 31, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #32 Peter Wright (SCO) – Avg ~72–90, Checkout ~28–38%
  // Form 2026: PC7-QF (77.77 – schlechter Tag), inkonsistent
  { id: 'pwright',     name: 'Peter Wright',           country: 'SCO', averageMin: 70,  averageMax: 92,  checkoutRateMin: 27, checkoutRateMax: 39, worldRanking: 32, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // ═══════════════════════════════════════════════════════════════════
  // RANG 33–64 (Tour Card Holder – mittleres Feld)
  // ═══════════════════════════════════════════════════════════════════

  // #33 Kevin Doets (NED) – Avg 117.12 (Höchstes 2026 #8!), Checkout ~36–46%
  // Form 2026: PC8-SF (97.55), PC6-QF (101.76), Höchstes Avg 117.12!
  { id: 'kdoets',      name: 'Kevin Doets',            country: 'NED', averageMin: 78,  averageMax: 117, checkoutRateMin: 34, checkoutRateMax: 47, worldRanking: 33, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #34 Joe Cullen (ENG) – Avg ~85–98, Checkout ~32–42%
  // Form 2026: PC8-Finalist (98.98 SF), PC5-QF (95.60), gut in Form
  { id: 'jcullen',     name: 'Joe Cullen',             country: 'ENG', averageMin: 80,  averageMax: 99,  checkoutRateMin: 31, checkoutRateMax: 43, worldRanking: 34, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #35 Ricardo Pietreczko (GER) – Avg ~80–100, Checkout ~32–42%
  // Form 2026: PC2-SF (97.55), Europäischer Spieler, aufsteigend
  { id: 'rpietreczko', name: 'Ricardo Pietreczko',     country: 'GER', averageMin: 76,  averageMax: 101, checkoutRateMin: 30, checkoutRateMax: 42, worldRanking: 35, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #37 Dimitri Van den Bergh (BEL) – Avg ~76–92, Checkout ~30–40%
  { id: 'dvdbergh',    name: 'Dimitri Van den Bergh',  country: 'BEL', averageMin: 73,  averageMax: 93,  checkoutRateMin: 28, checkoutRateMax: 40, worldRanking: 37, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #38 Raymond van Barneveld (NED) – Avg ~72–88, Checkout ~28–38%
  // Legende – Erfahrung kompensiert nachlassendes Niveau
  { id: 'rvbarneveld', name: 'Raymond van Barneveld',  country: 'NED', averageMin: 70,  averageMax: 89,  checkoutRateMin: 27, checkoutRateMax: 38, worldRanking: 38, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #47 Gabriel Clemens (GER) – Avg ~76–92, Checkout ~30–40%
  // Europäischer Spieler – PC1-QF (88.22), PC2-QF (88.22)
  { id: 'gclemens',    name: 'Gabriel Clemens',        country: 'GER', averageMin: 73,  averageMax: 93,  checkoutRateMin: 28, checkoutRateMax: 40, worldRanking: 47, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #52 Mensur Suljovic (SRB) – Avg ~72–88, Checkout ~28–38%
  // Europäischer Spieler – Erfahrener Veteran
  { id: 'msuljovic',   name: 'Mensur Suljovic',        country: 'SRB', averageMin: 70,  averageMax: 89,  checkoutRateMin: 26, checkoutRateMax: 38, worldRanking: 52, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #65 Mario Vandenbogaerde (BEL) – Avg ~72–86, Checkout ~26–36%
  // Europäischer Spieler – Belgischer Nachwuchs
  { id: 'mvandenbog',  name: 'Mario Vandenbogaerde',   country: 'BEL', averageMin: 69,  averageMax: 87,  checkoutRateMin: 24, checkoutRateMax: 36, worldRanking: 65, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #67 Max Hopp (GER) – Avg ~70–86, Checkout ~24–34%
  // Europäischer Spieler – Erfahrener Deutscher
  { id: 'mhopp',       name: 'Max Hopp',               country: 'GER', averageMin: 67,  averageMax: 87,  checkoutRateMin: 22, checkoutRateMax: 34, worldRanking: 67, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #68 Bradley Brooks (ENG) – Avg ~68–82, Checkout ~20–30%
  { id: 'bbrooks',     name: 'Bradley Brooks',         country: 'ENG', averageMin: 65,  averageMax: 83,  checkoutRateMin: 18, checkoutRateMax: 30, worldRanking: 68, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #71 Adam Lipscombe (ENG) – Avg ~64–78, Checkout ~18–28%
  { id: 'alipscombe',  name: 'Adam Lipscombe',         country: 'ENG', averageMin: 61,  averageMax: 79,  checkoutRateMin: 16, checkoutRateMax: 28, worldRanking: 71, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #73 Dominik Gruellich (GER) – Avg ~66–80, Checkout ~20–30%
  // Europäischer Spieler – Deutscher Tour Card Holder
  { id: 'dgruellich',  name: 'Dominik Gruellich',      country: 'GER', averageMin: 63,  averageMax: 81,  checkoutRateMin: 18, checkoutRateMax: 30, worldRanking: 73, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #95 Kai Gotthardt (GER) – Avg ~62–76, Checkout ~16–26%
  // Europäischer Spieler – Junger Deutscher
  { id: 'kgotthardt',  name: 'Kai Gotthardt',          country: 'GER', averageMin: 59,  averageMax: 77,  checkoutRateMin: 14, checkoutRateMax: 26, worldRanking: 95, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // #96 Greg Ritchie (SCO) – Avg ~58–72, Checkout ~14–24%
  { id: 'gritchie',    name: 'Greg Ritchie',           country: 'SCO', averageMin: 55,  averageMax: 73,  checkoutRateMin: 12, checkoutRateMax: 24, worldRanking: 96, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // ═══════════════════════════════════════════════════════════════════
  // WEIBLICHE SPIELERINNEN (PDC Tour Card Holder / Grand Slam Qualifier)
  // ═══════════════════════════════════════════════════════════════════

  // Beau Greaves (ENG) – Avg 82–107 (Women's Series), Checkout ~38–48%
  // Form 2026: Erste Frau mit PDC Ranking-Titel (PC11-Siegerin, 96.49 Avg)!
  // Höchstes Avg 2026: 117.88 (Darts Orakel #5 aller Spieler!)
  // WM-Rang: 78 (PDC OoM, 21.06.2026), Grand Slam Qualifier
  // Spielt ab und zu in gemischten Events – sehr gefährlich!
  { id: 'bgreaves',    name: 'Beau Greaves',           country: 'ENG', averageMin: 82,  averageMax: 118, checkoutRateMin: 38, checkoutRateMax: 50, worldRanking: 78, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // Lisa Ashton (ENG) – Avg ~72–84, Checkout ~28–38%
  // Form 2026: Women's Series 15-Siegerin (82.04), Women's Series 16-Finalistin
  // Erfahrene Veteranin – 4-fache BDO-Weltmeisterin
  // PDC Tour Card Holder (erste Frau überhaupt auf Merit)
  { id: 'lashton',     name: 'Lisa Ashton',            country: 'ENG', averageMin: 70,  averageMax: 85,  checkoutRateMin: 26, checkoutRateMax: 38, worldRanking: 131, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },

  // Fallon Sherrock (ENG) – Avg ~80–102, Checkout ~32–44%
  // Form 2026: Pause angekündigt, aber Women's Series aktiv
  // Legende: Erste Frau mit 9-Darter (2023), Viertelfinale Grand Slam 2021
  // Avg 102.12 beim Sieg gegen Beau Greaves (März 2026)
  { id: 'fsherrock',   name: 'Fallon Sherrock',        country: 'ENG', averageMin: 76,  averageMax: 102, checkoutRateMin: 30, checkoutRateMax: 44, worldRanking: 144, isNemesis: false, rivalryWins: 0, rivalryLosses: 0 },
];

// ─── Trophäen-Definitionen ───────────────────────────────────────────────────

export const CAREER_TROPHIES: Trophy[] = [
  { id: 'first_win', name: 'Erster Sieg', description: 'Gewinne dein erstes Match in der Karriere.', icon: '🎯', earnedAt: '' },
  { id: 'tour_card', name: 'Tour Card Holder', description: 'Qualifiziere dich für die PDC Tour Card bei der Q-School.', icon: '🎫', earnedAt: '' },
  { id: 'first_major', name: 'Major-Debüt', description: 'Nimm erstmals an einem TV-Major teil.', icon: '📺', earnedAt: '' },
  { id: 'first_major_win', name: 'Major-Champion', description: 'Gewinne dein erstes Major-Turnier.', icon: '🏆', earnedAt: '' },
  { id: 'uk_open_winner', name: 'UK Open Champion', description: "Gewinne das 'FA-Cup des Darts'.", icon: '🦁', earnedAt: '' },
  { id: 'matchplay_winner', name: 'Blackpool-Sieger', description: 'Gewinne das World Matchplay in Blackpool.', icon: '🌊', earnedAt: '' },
  { id: 'grand_prix_winner', name: 'Double-In Meister', description: 'Gewinne das World Grand Prix (Double-In Format).', icon: '⚡', earnedAt: '' },
  { id: 'grand_slam_winner', name: 'Grand Slam Champion', description: 'Gewinne den Grand Slam of Darts.', icon: '🌍', earnedAt: '' },
  { id: 'premier_league', name: 'Premier League Sieger', description: 'Gewinne die Premier League Darts.', icon: '👑', earnedAt: '' },
  { id: 'world_champion', name: '🏆 WELTMEISTER', description: 'Gewinne die PDC World Darts Championship im Alexandra Palace!', icon: '🏆', earnedAt: '' },
  { id: 'nine_darter', name: 'Perfektes Leg', description: 'Wirf ein 9-Darter-Leg in einem Karriere-Match.', icon: '💎', earnedAt: '' },
  { id: 'top_10', name: 'Top 10 der Welt', description: 'Erreiche die Top 10 der PDC Order of Merit.', icon: '⭐', earnedAt: '' },
  { id: 'world_number_1', name: 'Weltranglistenerster', description: 'Erreiche Platz 1 der PDC Order of Merit.', icon: '👑', earnedAt: '' },
  { id: 'nemesis_slayer', name: 'Nemesis besiegt', description: 'Besiege deinen Nemesis in einem entscheidenden Match.', icon: '⚔️', earnedAt: '' },
];

// ─── Sponsor-Definitionen ────────────────────────────────────────────────────

export const CAREER_SPONSORS: Sponsor[] = [
  { id: 'local_pub', name: 'Lokales Pub', bonus: 'Standard-Darts freigeschaltet', unlockedAtRanking: 200 },
  { id: 'darts_shop', name: 'Darts-Fachhandel', bonus: 'Eigener Walk-On Song freigeschaltet!', unlockedAtRanking: 100 },
  { id: 'regional_sponsor', name: 'Regionaler Sponsor', bonus: 'Goldene TV-Stats Anzeige', unlockedAtRanking: 50 },
  { id: 'national_sponsor', name: 'Nationaler Sponsor', bonus: 'Exklusives Kommentator-Paket', unlockedAtRanking: 20 },
  { id: 'pdc_partner', name: 'PDC Hauptsponsor', bonus: 'Alle Features freigeschaltet + Sonder-Kommentare', unlockedAtRanking: 5 },
];

// ─── Karriere-Engine Klasse ──────────────────────────────────────────────────

export class CareerEngine {
  private season: CareerSeason;

  constructor(season: CareerSeason) {
    this.season = season;
  }

  /**
   * Gibt alle Turniere zurück, für die der Spieler in der aktuellen Saison qualifiziert ist.
   */
  getAvailableTournaments(): CareerTournament[] {
    const { worldRanking, tourCardActive } = this.season;
    // v2.9.90: Delegiert an die frei stehende, wiederverwendbare Filter-Funktion.
    return filterUnlockedTournaments(PDC_TOURNAMENT_CALENDAR, tourCardActive, worldRanking);
  }

  /**
   * Generiert einen zufälligen KI-Gegner passend zur Turnier-Runde und Schwierigkeit.
   */
  generateOpponent(tournament: CareerTournament, round: string): CareerOpponent {
    const difficulty = DIFFICULTY_CONFIGS[this.season.difficulty];
    const config = difficulty;

    // Gegner-Pool basierend auf Turnier-Tier
    let pool: CareerOpponent[];
    if (tournament.tier === 'world_championship' || tournament.tier === 'major') {
      pool = PDC_OPPONENTS.filter(o => o.worldRanking <= 32);
    } else if (tournament.tier === 'protour') {
      pool = PDC_OPPONENTS.filter(o => o.worldRanking <= 64);
    } else {
      pool = PDC_OPPONENTS;
    }

    // Zufälligen Gegner auswählen
    const base = pool[Math.floor(Math.random() * pool.length)];

    // Average an Schwierigkeit anpassen
    const adjustedOpponent: CareerOpponent = {
      ...base,
      averageMin: Math.round(base.averageMin * config.opponentAverageMultiplier),
      averageMax: Math.round(base.averageMax * config.opponentAverageMultiplier),
      checkoutRateMin: Math.round(base.checkoutRateMin * config.opponentCheckoutMultiplier),
      checkoutRateMax: Math.round(base.checkoutRateMax * config.opponentCheckoutMultiplier),
      isNemesis: this.season.nemesisId === base.id,
      rivalryWins: 0,
      rivalryLosses: 0,
    };

    return adjustedOpponent;
  }

  /**
   * Erstellt die vollständige Match-Konfiguration für ein Karriere-Match.
   */
  buildMatchConfig(tournament: CareerTournament, round: string): CareerMatchConfig {
    const opponent = this.generateOpponent(tournament, round);

    // Runden-spezifische Distanz berechnen.
    // v2.9.84: In allen Runden AUSSER dem Finale wird die Schwierigkeitsgrad-
    // spezifische Distanz genutzt (pub/amateur: 2, semipro: 3, pro: 4, elite: 6).
    // Im Finale bleibt die reguläre, längere Turnier-Distanz erhalten.
    const isFinal = round === 'Finale';
    const difficultyLegs = DIFFICULTY_CONFIGS[this.season.difficulty]?.legsToWin;
    const legsToWin = isFinal
      ? (tournament.legsToWinFinal ?? 6)
      : (difficultyLegs ?? tournament.legsToWinEarlyRounds ?? 4);
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
      isWalkOnEnabled: tournament.isTvEvent && this.season.walkOnSongUnlocked,
      prizeMoneyWin: isFinal ? tournament.prizeMoneyWinner : tournament.prizeMoneyQuarterFinal,
      prizeMoneyLoss: Math.round(tournament.prizeMoneyQuarterFinal * 0.5),
      orderOfMeritPoints: this.calculateOrderOfMeritPoints(tournament, round, true),
    };
  }

  /**
   * Berechnet Order of Merit Punkte basierend auf Turnier und Runde.
   */
  private calculateOrderOfMeritPoints(tournament: CareerTournament, round: string, won: boolean): number {
    const basePoints: Record<TournamentTier, number> = {
      qschool: 0,
      secondary: 500,
      protour: 1000,
      major: 5000,
      premier_league: 10000,
      world_series: 3000,
      world_cup: 5000,
      world_championship: 20000,
    };

    const roundMultiplier: Record<string, number> = {
      'Vorrunde': 0.1,
      'Runde 1': 0.15,
      'Runde 2': 0.25,
      'Runde 3': 0.35,
      'Achtelfinale': 0.4,
      'Viertelfinale': 0.5,
      'Halbfinale': 0.7,
      'Finale': won ? 1.0 : 0.85,
    };

    return Math.round((basePoints[tournament.tier] ?? 1000) * (roundMultiplier[round] ?? 0.5));
  }

  /**
   * Verarbeitet das Ergebnis eines Karriere-Matches.
   */
  processMatchResult(
    tournament: CareerTournament,
    round: string,
    won: boolean,
    playerAverage: number,
    best180s: number,
    bestCheckout: number,
  ): { prizeMoney: number; orderOfMeritPoints: number; newTrophies: Trophy[]; rankingChange: number } {
    const prizeMoney = won
      ? (round === 'Finale' ? tournament.prizeMoneyWinner : tournament.prizeMoneyQuarterFinal)
      : Math.round(tournament.prizeMoneyQuarterFinal * 0.5);

    const oomPoints = this.calculateOrderOfMeritPoints(tournament, round, won);

    // Trophäen prüfen
    const newTrophies: Trophy[] = [];
    if (won && round === 'Finale') {
      const trophy = CAREER_TROPHIES.find(t => t.id === `${tournament.id}_winner`);
      if (trophy) newTrophies.push({ ...trophy, earnedAt: new Date().toISOString() });

      if (tournament.tier === 'world_championship') {
        const wmTrophy = CAREER_TROPHIES.find(t => t.id === 'world_champion');
        if (wmTrophy) newTrophies.push({ ...wmTrophy, earnedAt: new Date().toISOString() });
      }
    }

    // Ranking-Änderung simulieren
    const rankingChange = won ? -Math.floor(oomPoints / 500) : Math.floor(oomPoints / 1000);

    return { prizeMoney, orderOfMeritPoints: oomPoints, newTrophies, rankingChange };
  }

  /**
   * Erstellt eine neue Karriere-Saison.
   */
  static createNewSeason(playerName: string, difficulty: CareerDifficulty): CareerSeason {
    const config = DIFFICULTY_CONFIGS[difficulty];
    return {
      year: new Date().getFullYear(),
      playerName,
      difficulty,
      tourCardActive: difficulty === 'pro' || difficulty === 'elite',
      worldRanking: config.startingRanking,
      totalPrizeMoney: 0,
      orderOfMeritPoints: 0,
      proTourPoints: 0,
      currentWeek: 1,
      completedTournaments: [],
      trophies: [],
      sponsors: [CAREER_SPONSORS[0]], // Lokales Pub als Startsponsor
      walkOnSongUnlocked: difficulty === 'elite',
      nemesisId: null,
      matchLog: [],  // v2.9.87
      dartCoins: createInitialCoinsState(),  // v2.9.88
    };
  }

  getSeason(): CareerSeason { return this.season; }
}

// ─── Storage-Schlüssel für Karriere-Daten ────────────────────────────────────

export const CAREER_STORAGE_KEY = 'career-season-v1';
