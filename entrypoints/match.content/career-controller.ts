/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PDC KARRIERE-MODUS – Match-Controller v2.8.0
 *  Autodarts Extended Edition
 *  Autor: Arnonym2302
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Verbindet den echten Autodarts GameData-Watcher mit der Karriere-Engine.
 *  Reagiert auf:
 *    – match.gameFinished  → Leg-Ende erkennen, Gegner-Leg simulieren
 *    – match.finished      → Match-Ende, Ergebnis-Overlay + Karriere speichern
 *    – match.stats         → Live-Average des Spielers berechnen
 */

import { AutodartsToolsGameData } from '@/utils/game-data-storage';
import {
  getActiveCareerMatch,
  clearActiveCareerMatch,
  showCareerMatchIntro,
  showCareerMatchResult,
  showCareerHud,
  removeCareerHud,
  simulateOpponentLeg,
  type CareerMatchState,
} from './career-match';
import {
  CAREER_STORAGE_KEY,
  CAREER_TROPHIES,
  CAREER_SPONSORS,
  type CareerMatchConfig,
  type CareerSeason,
} from '@/utils/career-engine';

// ─── State ────────────────────────────────────────────────────────────────────

let careerState: CareerMatchState | null = null;
let careerConfig: CareerMatchConfig | null = null;
let gameDataWatcher: (() => void) | null = null;
let lastLegCount = -1;
let lastSetCount = -1;
let matchAlreadyFinished = false;

// ─── Initialisierung ─────────────────────────────────────────────────────────

/**
 * Startet den Karriere-Controller.
 * Wird von index.ts aufgerufen wenn ein Karriere-Match aktiv ist.
 */
export async function initCareerController(): Promise<void> {
  const config = await getActiveCareerMatch();
  if (!config) return;

  careerConfig = config;
  matchAlreadyFinished = false;
  lastLegCount = -1;
  lastSetCount = -1;

  // Intro-Overlay anzeigen (startet auch den HUD nach dem Countdown)
  showCareerMatchIntro(config);

  // Initialen State aufbauen
  careerState = {
    config,
    playerLegsWon: 0,
    opponentLegsWon: 0,
    playerSetsWon: 0,
    opponentSetsWon: 0,
    currentLegDarts: 0,
    currentLegScore: 501,
    opponentCurrentLegDarts: 0,
    opponentCurrentLegScore: 501,
    playerTotalDarts: 0,
    playerTotalScore: 0,
    player180s: 0,
    playerBestCheckout: 0,
    opponentSimAverage: (config.opponent.averageMin + config.opponent.averageMax) / 2,
    matchOver: false,
    playerWon: null,
  };

  // GameData-Watcher starten
  startGameDataWatcher();
}

/**
 * Stoppt den Karriere-Controller und räumt auf.
 */
export function cleanupCareerController(): void {
  if (gameDataWatcher) {
    gameDataWatcher();
    gameDataWatcher = null;
  }
  removeCareerHud();
  careerState = null;
  careerConfig = null;
  lastLegCount = -1;
  lastSetCount = -1;
  matchAlreadyFinished = false;
}

// ─── GameData-Watcher ─────────────────────────────────────────────────────────

function startGameDataWatcher(): void {
  if (gameDataWatcher) {
    gameDataWatcher();
  }

  gameDataWatcher = AutodartsToolsGameData.watch(async (gameData) => {
    if (!careerState || !careerConfig || matchAlreadyFinished) return;
    const match = gameData?.match;
    if (!match) return;

    // ── Live-Stats des Spielers aktualisieren ──────────────────────────────
    const playerStats = match.stats?.[0];
    if (playerStats?.matchStats) {
      const dartsThrown = playerStats.matchStats.dartsThrown ?? 0;
      const avg = playerStats.matchStats.average ?? 0;
      if (dartsThrown > 0) {
        careerState.playerTotalDarts = dartsThrown;
        careerState.playerTotalScore = Math.round((avg / 3) * dartsThrown);
      }

      // 180er zählen
      const scores = match.scores;
      if (scores) {
        careerState.player180s = scores.filter((s: any) =>
          s.score === 180 && s.player === 0
        ).length;
      }
    }

    // ── Leg-Ende erkennen (leg-Zähler hat sich erhöht) ────────────────────
    const currentLeg = match.leg ?? 0;
    const currentSet = match.set ?? 0;

    if (lastLegCount === -1) {
      lastLegCount = currentLeg;
      lastSetCount = currentSet;
      return;
    }

    const legChanged = currentLeg !== lastLegCount || currentSet !== lastSetCount;

    if (legChanged && !match.finished) {
      // Wer hat das Leg gewonnen? Autodarts zeigt gameScores
      const gameScores = match.gameScores ?? [];
      const playerLegs = gameScores[0] ?? 0;
      const opponentLegs = gameScores[1] ?? 0;

      // Gegner-Leg simulieren
      const opponentResult = simulateOpponentLeg(careerConfig.opponent);
      careerState.opponentSimAverage = (careerState.opponentSimAverage * 0.7) + (opponentResult.legAverage * 0.3);

      // Spielstand aus echten Autodarts-Daten übernehmen
      if (careerConfig.format === 'sets') {
        careerState.playerSetsWon = match.sets ?? 0;
        careerState.opponentSetsWon = 0; // Gegner-Sets werden simuliert
        careerState.playerLegsWon = playerLegs;
        careerState.opponentLegsWon = opponentLegs;
      } else {
        careerState.playerLegsWon = playerLegs;
        careerState.opponentLegsWon = opponentLegs;
      }

      lastLegCount = currentLeg;
      lastSetCount = currentSet;

      // HUD aktualisieren
      showCareerHud(careerConfig, careerState);
    }

    // ── Match-Ende ────────────────────────────────────────────────────────
    if (match.finished && !matchAlreadyFinished) {
      matchAlreadyFinished = true;

      // Wer hat gewonnen? winner === 0 bedeutet Spieler 1 (= der Karriere-Spieler)
      const playerWon = match.winner === 0;

      // Besten Checkout ermitteln
      const checkouts = match.scores?.filter((s: any) =>
        s.player === 0 && s.checkout === true
      ) ?? [];
      careerState.playerBestCheckout = checkouts.reduce(
        (max: number, s: any) => Math.max(max, s.score ?? 0), 0
      );

      // Average aus echten Stats
      const finalAvg = match.stats?.[0]?.matchStats?.average ?? 0;

      // HUD entfernen
      removeCareerHud();

      // v2.9.47: Turnier-Modus? Dann NICHT die Karriere-Daten anfassen,
      // stattdessen das lastMatchResult für TournamentMode.vue speichern.
      if (careerConfig.isTournament) {
        await browser.storage.local.set({
          'tm-last-match-result': playerWon ? 'won' : 'lost',
        });
        // Ergebnis-Overlay minimalistisch: nur "Match beendet" (kein Karriere-Kontext)
        showCareerMatchResult(
          careerConfig,
          playerWon,
          finalAvg,
          careerState.player180s,
          careerState.playerBestCheckout,
          careerState.opponentSimAverage,
          playerWon ? careerConfig.prizeMoneyWin : careerConfig.prizeMoneyLoss,
          0,
        );
      } else {
        // Karriere-Daten speichern
        await saveCareerResult(careerConfig, playerWon, finalAvg, playerWon
          ? (careerConfig.round === 'Finale' ? careerConfig.prizeMoneyWin : Math.round(careerConfig.prizeMoneyWin * 0.5))
          : careerConfig.prizeMoneyLoss);

        // Ergebnis-Overlay anzeigen
        showCareerMatchResult(
          careerConfig,
          playerWon,
          finalAvg,
          careerState.player180s,
          careerState.playerBestCheckout,
          careerState.opponentSimAverage,
          playerWon
            ? (careerConfig.round === 'Finale' ? careerConfig.prizeMoneyWin : Math.round(careerConfig.prizeMoneyWin * 0.5))
            : careerConfig.prizeMoneyLoss,
          careerConfig.orderOfMeritPoints,
        );
      }

      // Aktiven Match-Kontext löschen
      await clearActiveCareerMatch();

      // Watcher stoppen
      if (gameDataWatcher) {
        gameDataWatcher();
        gameDataWatcher = null;
      }
    }
  });
}

// ─── Karriere-Daten speichern ─────────────────────────────────────────────────

async function saveCareerResult(
  config: CareerMatchConfig,
  won: boolean,
  playerAverage: number,
  prizeMoney: number,
): Promise<void> {
  try {
    const stored = await browser.storage.local.get(CAREER_STORAGE_KEY);
    const season = stored[CAREER_STORAGE_KEY] as CareerSeason | undefined;
    if (!season) return;

    // Preisgeld & Punkte
    season.totalPrizeMoney += prizeMoney;
    season.orderOfMeritPoints += config.orderOfMeritPoints;

    // Weltrangliste anpassen
    if (won) {
      season.worldRanking = Math.max(1, season.worldRanking - Math.floor(config.orderOfMeritPoints / 500));
    } else {
      season.worldRanking = Math.min(200, season.worldRanking + 2);
    }

    // Turnier-Ergebnis speichern
    const result = won
      ? (config.round === 'Finale' ? 'won' : 'semi')
      : 'eliminated';

    season.completedTournaments.push({
      tournamentId: config.tournamentId,
      tournamentName: config.tournamentName,
      result,
      prizeMoneyEarned: prizeMoney,
      playerAverage,
      best180s: careerState?.player180s ?? 0,
      bestCheckout: careerState?.playerBestCheckout ?? 0,
      week: season.currentWeek,
    });

    // Trophäen prüfen
    if (won && config.round === 'Finale') {
      const trophyMap: Record<string, string> = {
        world_championship: 'world_champion',
        world_matchplay: 'matchplay_winner',
        world_grand_prix: 'grand_prix_winner',
        uk_open: 'uk_open_winner',
        grand_slam: 'grand_slam_winner',
        premier_league: 'premier_league',
      };
      const trophyId = trophyMap[config.tournamentId];
      if (trophyId && !season.trophies.some(t => t.id === trophyId)) {
        const trophy = CAREER_TROPHIES.find(t => t.id === trophyId);
        if (trophy) season.trophies.push({ ...trophy, earnedAt: new Date().toISOString() });
      }
    }

    // Erster Sieg
    if (won && !season.trophies.some(t => t.id === 'first_win')) {
      const trophy = CAREER_TROPHIES.find(t => t.id === 'first_win');
      if (trophy) season.trophies.push({ ...trophy, earnedAt: new Date().toISOString() });
    }

    // Top-10
    if (season.worldRanking <= 10 && !season.trophies.some(t => t.id === 'top_10')) {
      const trophy = CAREER_TROPHIES.find(t => t.id === 'top_10');
      if (trophy) season.trophies.push({ ...trophy, earnedAt: new Date().toISOString() });
    }

    // Weltranglistenerster
    if (season.worldRanking === 1 && !season.trophies.some(t => t.id === 'world_number_1')) {
      const trophy = CAREER_TROPHIES.find(t => t.id === 'world_number_1');
      if (trophy) season.trophies.push({ ...trophy, earnedAt: new Date().toISOString() });
    }

    // Sponsoren freischalten
    for (const sponsor of CAREER_SPONSORS) {
      if (
        season.worldRanking <= sponsor.unlockedAtRanking &&
        !season.sponsors.some(s => s.id === sponsor.id)
      ) {
        season.sponsors.push(sponsor);
      }
    }

    // Speichern
    await browser.storage.local.set({ [CAREER_STORAGE_KEY]: season });
    console.log('[CareerController v2.8.0] Karriere gespeichert – Rang:', season.worldRanking, '| Preisgeld gesamt: £', season.totalPrizeMoney);

  } catch (e) {
    console.error('[CareerController v2.8.0] Fehler beim Speichern:', e);
  }
}
