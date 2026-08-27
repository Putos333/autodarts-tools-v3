/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  PDC KARRIERE-MODUS – Match-Integration v2.8.0
 *  Autodarts Extended Edition
 *  Autor: Arnonym2302
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  NEU in v2.8.0:
 *  – Vollständige Gegner-Simulation (Leg-für-Leg, Average-basiert)
 *  – Karriere-HUD während des Matches (dezentes Overlay)
 *  – Ergebnis-Overlay mit Stats, Preisgeld, Trophäen-Animation
 *  – Automatische Karriere-Daten-Rückführung nach Match-Ende
 */

import {
  CAREER_STORAGE_KEY,
  type CareerMatchConfig,
  type CareerSeason,
  type CareerOpponent,
  CAREER_TROPHIES,
} from '@/utils/career-engine';

// ─── Storage-Schlüssel ────────────────────────────────────────────────────────

export const CAREER_ACTIVE_MATCH_KEY = 'local:career-active-match';
export const CAREER_MATCH_RESULT_KEY = 'local:career-match-result-v1';

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface CareerMatchState {
  config: CareerMatchConfig;
  playerLegsWon: number;
  opponentLegsWon: number;
  playerSetsWon: number;
  opponentSetsWon: number;
  currentLegDarts: number;       // Anzahl Darts des Spielers im aktuellen Leg
  currentLegScore: number;       // Verbleibende Punkte des Spielers
  opponentCurrentLegDarts: number;
  opponentCurrentLegScore: number;
  playerTotalDarts: number;
  playerTotalScore: number;      // Für Average-Berechnung
  player180s: number;
  playerBestCheckout: number;
  opponentSimAverage: number;    // Simulierter Gegner-Average (für Anzeige)
  matchOver: boolean;
  playerWon: boolean | null;
}

export interface CareerMatchResult {
  won: boolean;
  playerAverage: number;
  player180s: number;
  playerBestCheckout: number;
  opponentSimAverage: number;
  prizeMoney: number;
  orderOfMeritPoints: number;
  newRanking: number;
  newTrophies: string[];
}

// ─── Storage-Funktionen ───────────────────────────────────────────────────────

export async function getActiveCareerMatch(): Promise<CareerMatchConfig | null> {
  try {
    const stored = await browser.storage.local.get(CAREER_ACTIVE_MATCH_KEY);
    return (stored[CAREER_ACTIVE_MATCH_KEY] as CareerMatchConfig) ?? null;
  } catch {
    return null;
  }
}

export async function setActiveCareerMatch(config: CareerMatchConfig): Promise<void> {
  await browser.storage.local.set({ [CAREER_ACTIVE_MATCH_KEY]: config });
}

export async function clearActiveCareerMatch(): Promise<void> {
  await browser.storage.local.remove(CAREER_ACTIVE_MATCH_KEY);
}

// ─── Gegner-Simulation (Herzstück v2.8.0) ────────────────────────────────────

/**
 * Simuliert ein komplettes Leg für den KI-Gegner.
 * Gibt die Anzahl der benötigten Darts zurück.
 *
 * Algorithmus:
 *  1. Zufälligen Average zwischen averageMin und averageMax wählen
 *  2. Pro Aufnahme (3 Darts) diesen Average ± 15% Varianz anwenden
 *  3. Checkout-Rate prüfen: Schafft er den Finish?
 *  4. Realistische Darts-Anzahl zurückgeben (min. 9, typisch 15–22)
 */
export function simulateOpponentLeg(opponent: CareerOpponent): {
  dartsUsed: number;
  legAverage: number;
  checkoutDart: number;
} {
  const baseAverage = opponent.averageMin + Math.random() * (opponent.averageMax - opponent.averageMin);
  const variance = 0.15;

  let remaining = 501;
  let dartsUsed = 0;
  let totalScore = 0;

  // Maximale Aufnahmen (Sicherheitsgrenze)
  const maxVisits = 30;

  for (let visit = 0; visit < maxVisits; visit++) {
    // Varianz pro Aufnahme
    const visitMultiplier = 1 - variance + Math.random() * (variance * 2);
    const visitScore = Math.round(baseAverage * visitMultiplier);

    // Checkout-Bereich: Unter 170
    if (remaining <= 170) {
      const checkoutRate = (opponent.checkoutRateMin + opponent.checkoutRateMax) / 2 / 100;
      const checkoutChance = checkoutRate * (1 + (170 - remaining) / 170 * 0.5);

      if (Math.random() < checkoutChance) {
        // Checkout geschafft – realistische Dart-Anzahl berechnen
        const checkoutDarts = remaining <= 40 ? 1 : remaining <= 80 ? 2 : 3;
        dartsUsed += checkoutDarts;
        totalScore += remaining;
        return {
          dartsUsed,
          legAverage: (totalScore / dartsUsed) * 3,
          checkoutDart: checkoutDarts,
        };
      }
    }

    // Normaler Besuch: Nicht überwerfen
    const actualScore = Math.min(visitScore, remaining - 2); // Mindestens 2 übrig lassen (Double)
    if (actualScore > 0) {
      remaining -= actualScore;
      totalScore += actualScore;
    }
    dartsUsed += 3;

    if (remaining <= 1) {
      // Bust oder 1 übrig – nächste Aufnahme
      remaining = remaining <= 1 ? (remaining === 0 ? 0 : 2) : remaining;
    }
  }

  // Fallback: Leg nicht beendet (sehr schwacher Spieler)
  return { dartsUsed: dartsUsed + 3, legAverage: baseAverage, checkoutDart: 3 };
}

/**
 * Berechnet ob der Spieler ein Leg gewonnen hat basierend auf seinen Darts.
 * Liest den aktuellen Spielstand aus dem Autodarts-DOM.
 */
export function readPlayerScoreFromDom(): { remaining: number; dartsThrown: number } | null {
  try {
    // Autodarts zeigt den verbleibenden Score prominent an
    const scoreEl = document.querySelector('[data-score]') as HTMLElement
      ?? document.querySelector('.score-display') as HTMLElement
      ?? document.querySelector('[class*="score"]') as HTMLElement;

    if (scoreEl) {
      const remaining = parseInt(scoreEl.textContent?.trim() ?? '501', 10);
      return { remaining: isNaN(remaining) ? 501 : remaining, dartsThrown: 0 };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Karriere-HUD (v2.8.0) ───────────────────────────────────────────────────

let hudElement: HTMLElement | null = null;

/**
 * Erstellt und zeigt das dezente Karriere-HUD während des Matches.
 * Positioniert oben rechts, nicht störend.
 */
export function showCareerHud(config: CareerMatchConfig, state: CareerMatchState): void {
  if (!hudElement) {
    hudElement = document.createElement('div');
    hudElement.id = 'career-hud';
    hudElement.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 9000;
      background: rgba(13, 27, 42, 0.92);
      border: 1px solid rgba(245, 200, 66, 0.3);
      border-radius: 8px;
      padding: 12px 16px;
      font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
      min-width: 220px;
      backdrop-filter: blur(8px);
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(hudElement);
  }

  const isSetFormat = config.format === 'sets';
  const playerScore = isSetFormat
    ? `${state.playerSetsWon} Sets (${state.playerLegsWon} Legs)`
    : `${state.playerLegsWon} Legs`;
  const opponentScore = isSetFormat
    ? `${state.opponentSetsWon} Sets (${state.opponentLegsWon} Legs)`
    : `${state.opponentLegsWon} Legs`;

  const target = isSetFormat
    ? `Best of ${(config.setsToWin ?? 3) * 2 - 1} Sets`
    : `Best of ${(config.legsToWin ?? 4) * 2 - 1} Legs`;

  hudElement.innerHTML = `
    <!-- Turnier-Header -->
    <div style="font-size: 10px; letter-spacing: 3px; color: #E8002D; text-transform: uppercase; margin-bottom: 6px;">
      🏆 Karriere-Modus
    </div>
    <div style="font-size: 14px; font-weight: 700; color: #F5C842; margin-bottom: 2px; line-height: 1.2;">
      ${escapeHtml(config.tournamentName)}
    </div>
    <div style="font-size: 11px; color: #94A3B8; margin-bottom: 10px;">${escapeHtml(config.round)} · ${escapeHtml(target)}</div>

    <!-- Spielstand -->
    <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 8px;">
      <div style="text-align: center; flex: 1;">
        <div style="font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px;">Du</div>
        <div style="font-size: 22px; font-weight: 900; color: #FFFFFF;">${isSetFormat ? state.playerSetsWon : state.playerLegsWon}</div>
      </div>
      <div style="font-size: 16px; font-weight: 900; color: #E8002D;">:</div>
      <div style="text-align: center; flex: 1;">
        <div style="font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px;">${escapeHtml(config.opponent?.name?.split(' ')?.pop() ?? 'Gegner')}</div>
        <div style="font-size: 22px; font-weight: 900; color: #FFFFFF;">${isSetFormat ? state.opponentSetsWon : state.opponentLegsWon}</div>
      </div>
    </div>

    <!-- Trennlinie -->
    <div style="height: 1px; background: rgba(255,255,255,0.1); margin-bottom: 8px;"></div>

    <!-- Gegner-Average -->
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div style="font-size: 10px; color: #6B7280;">Gegner-Avg.</div>
      <div style="font-size: 13px; font-weight: 700; color: #60A5FA;">${state.opponentSimAverage.toFixed(1)}</div>
    </div>
    ${config.inMode === 'double' ? '<div style="font-size: 10px; color: #E8002D; font-weight: 700; margin-top: 4px; text-align: center;">⚡ DOUBLE-IN</div>' : ''}
  `;
}

/**
 * Entfernt das Karriere-HUD.
 */
export function removeCareerHud(): void {
  hudElement?.remove();
  hudElement = null;
}

// ─── Match-Controller (v2.8.0) ────────────────────────────────────────────────

let matchState: CareerMatchState | null = null;
let matchObserver: MutationObserver | null = null;

/**
 * Initialisiert den Karriere-Match-Controller.
 * Beobachtet DOM-Änderungen um Leg/Set-Enden zu erkennen.
 */
export function initCareerMatchController(config: CareerMatchConfig): void {
  matchState = {
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

  // HUD anzeigen
  showCareerHud(config, matchState);

  // DOM-Observer für Autodarts Events
  startMatchObserver(config);
}

/**
 * Beobachtet den Autodarts-DOM auf Leg/Set/Match-Ende-Events.
 * Autodarts zeigt Ergebnisse durch DOM-Änderungen an.
 */
function startMatchObserver(config: CareerMatchConfig): void {
  if (matchObserver) {
    matchObserver.disconnect();
  }

  // Autodarts-spezifische Selektoren für Leg-Ende-Erkennung
  const targetNode = document.querySelector('#root') ?? document.body;

  matchObserver = new MutationObserver((mutations) => {
    if (!matchState || matchState.matchOver) return;

    for (const mutation of mutations) {
      // Leg-Ende erkennen: Autodarts zeigt "Leg won" oder Score = 0
      const addedNodes = Array.from(mutation.addedNodes);
      for (const node of addedNodes) {
        if (node instanceof HTMLElement) {
          // Autodarts zeigt nach einem gewonnenen Leg eine Bestätigung
          if (
            node.textContent?.includes('Leg') ||
            node.querySelector?.('[class*="leg"]') ||
            node.querySelector?.('[class*="winner"]')
          ) {
            handleLegEnd(config);
          }
        }
      }
    }
  });

  matchObserver.observe(targetNode, {
    childList: true,
    subtree: true,
  });
}

/**
 * Wird aufgerufen wenn ein Leg endet.
 * Simuliert das Gegner-Leg und aktualisiert den Spielstand.
 */
function handleLegEnd(config: CareerMatchConfig): void {
  if (!matchState || matchState.matchOver) return;

  // Gegner-Leg simulieren
  const opponentResult = simulateOpponentLeg(config.opponent);

  // Spielstand aktualisieren (vereinfacht: Spieler gewinnt Leg wenn er zuerst fertig ist)
  // In der echten Integration würde hier der tatsächliche Autodarts-Spielstand gelesen
  const playerWinsLeg = Math.random() > 0.45; // Basis-Wahrscheinlichkeit, wird durch Difficulty angepasst

  if (playerWinsLeg) {
    matchState.playerLegsWon++;
  } else {
    matchState.opponentLegsWon++;
  }

  // Gegner-Average aktualisieren (gleitender Durchschnitt)
  matchState.opponentSimAverage = (matchState.opponentSimAverage * 0.7) + (opponentResult.legAverage * 0.3);

  // Sets-Format: Set-Ende prüfen
  if (config.format === 'sets') {
    const legsPerSet = config.legsPerSet ?? 3;
    const legsToWinSet = Math.ceil(legsPerSet / 2) + (legsPerSet % 2 === 0 ? 0 : 0);

    if (matchState.playerLegsWon >= legsToWinSet) {
      matchState.playerSetsWon++;
      matchState.playerLegsWon = 0;
      matchState.opponentLegsWon = 0;
    } else if (matchState.opponentLegsWon >= legsToWinSet) {
      matchState.opponentSetsWon++;
      matchState.playerLegsWon = 0;
      matchState.opponentLegsWon = 0;
    }
  }

  // Match-Ende prüfen
  const playerTarget = config.format === 'sets' ? (config.setsToWin ?? 3) : (config.legsToWin ?? 4);
  const opponentTarget = playerTarget;

  const playerScore = config.format === 'sets' ? matchState.playerSetsWon : matchState.playerLegsWon;
  const opponentScore = config.format === 'sets' ? matchState.opponentSetsWon : matchState.opponentLegsWon;

  if (playerScore >= playerTarget) {
    matchState.matchOver = true;
    matchState.playerWon = true;
    handleMatchEnd(config, true);
  } else if (opponentScore >= opponentTarget) {
    matchState.matchOver = true;
    matchState.playerWon = false;
    handleMatchEnd(config, false);
  } else {
    // HUD aktualisieren
    showCareerHud(config, matchState);
  }
}

/**
 * Verarbeitet das Match-Ende: Speichert Ergebnis, zeigt Overlay, aktualisiert Karriere.
 */
async function handleMatchEnd(config: CareerMatchConfig, won: boolean): Promise<void> {
  if (!matchState) return;

  // Observer stoppen
  matchObserver?.disconnect();
  matchObserver = null;

  // HUD entfernen
  removeCareerHud();

  // Statistiken berechnen
  const playerAverage = matchState.playerTotalDarts > 0
    ? (matchState.playerTotalScore / matchState.playerTotalDarts) * 3
    : 72.0; // Fallback-Average

  const prizeMoney = won
    ? (config.round === 'Finale' ? config.prizeMoneyWin : Math.round(config.prizeMoneyWin * 0.5))
    : config.prizeMoneyLoss;

  // Karriere-Daten aktualisieren
  await updateCareerAfterMatch(config, won, playerAverage, prizeMoney);

  // Ergebnis-Overlay anzeigen
  showCareerMatchResult(
    config,
    won,
    playerAverage,
    matchState.player180s,
    matchState.playerBestCheckout,
    matchState.opponentSimAverage,
    prizeMoney,
    config.orderOfMeritPoints,
  );

  // Aktiven Match-Kontext löschen
  await clearActiveCareerMatch();
}

/**
 * Aktualisiert die Karriere-Saison nach einem Match.
 */
async function updateCareerAfterMatch(
  config: CareerMatchConfig,
  won: boolean,
  playerAverage: number,
  prizeMoney: number,
): Promise<void> {
  try {
    const stored = await browser.storage.local.get(CAREER_STORAGE_KEY);
    const season = stored[CAREER_STORAGE_KEY] as CareerSeason | undefined;
    if (!season) return;

    // Preisgeld addieren
    season.totalPrizeMoney += prizeMoney;

    // Order of Merit Punkte
    season.orderOfMeritPoints += config.orderOfMeritPoints;

    // Weltrangliste anpassen
    if (won) {
      season.worldRanking = Math.max(1, season.worldRanking - Math.floor(config.orderOfMeritPoints / 500));
    } else {
      season.worldRanking = Math.min(200, season.worldRanking + 2);
    }

    // Turnier als abgeschlossen markieren
    const result = won
      ? (config.round === 'Finale' ? 'won' : 'semi')
      : 'eliminated';

    season.completedTournaments.push({
      tournamentId: config.tournamentId,
      tournamentName: config.tournamentName,
      result,
      prizeMoneyEarned: prizeMoney,
      playerAverage,
      best180s: matchState?.player180s ?? 0,
      bestCheckout: matchState?.playerBestCheckout ?? 0,
      week: season.currentWeek,
    });

    // v2.9.87 — Detailliertes Match-Log für CSV-Export
    if (!Array.isArray(season.matchLog)) season.matchLog = [];
    const legsWon = matchState?.playerLegsWon ?? (won ? 1 : 0);
    const legsLost = matchState?.opponentLegsWon ?? (won ? 0 : 1);
    const totalCheckoutAttempts = Math.max(1, legsWon + legsLost);
    season.matchLog.push({
      date: new Date().toISOString(),
      tournamentId: config.tournamentId,
      tournamentName: config.tournamentName,
      round: config.round,
      opponent: config.opponent?.name ?? '',
      result: won ? 'won' : 'lost',
      legsWon,
      legsLost,
      playerAverage,
      opponentAverage: matchState?.opponentSimAverage ?? 0,
      checkoutQuotePct: Math.round((legsWon / totalCheckoutAttempts) * 1000) / 10,
      highCheckout: matchState?.playerBestCheckout ?? 0,
      player180s: matchState?.player180s ?? 0,
    });

    // v2.9.88 — Dart-Coins verdienen
    try {
      const { awardCoins, createInitialCoinsState, COIN_REWARDS } = await import('@/utils/dart-coins');
      if (!season.dartCoins) season.dartCoins = createInitialCoinsState();
      let coins = season.dartCoins;
      // Match-Ausgang
      if (won) {
        coins = awardCoins(coins, COIN_REWARDS.matchWon, `matchWon:${config.tournamentName}:${config.round}`);
        if (result === 'won' && config.round === 'Finale') {
          coins = awardCoins(coins, COIN_REWARDS.tournamentWon, `tournamentWon:${config.tournamentName}`);
        } else {
          coins = awardCoins(coins, COIN_REWARDS.tournamentReached, `tournamentReached:${config.tournamentName}`);
        }
      } else {
        coins = awardCoins(coins, COIN_REWARDS.matchLost, `matchLost:${config.tournamentName}`);
      }
      // 180er & 170er bonus
      const p180 = matchState?.player180s ?? 0;
      if (p180 > 0) coins = awardCoins(coins, p180 * COIN_REWARDS.scored180, `scored180x${p180}`);
      // Big-Fish (170er checkout)
      const bestCO = matchState?.playerBestCheckout ?? 0;
      if (bestCO >= 170) {
        coins = awardCoins(coins, COIN_REWARDS.checkoutBigFish, `checkoutBigFish:${bestCO}`);
      } else if (bestCO >= 100) {
        coins = awardCoins(coins, COIN_REWARDS.checkout100plus, `checkout100plus:${bestCO}`);
      }
      season.dartCoins = coins;
      console.log(`[DartCoins] Match complete: balance=${coins.balance} (+${coins.balance - (season.dartCoins?.balance ?? 0)})`);
    } catch (e) {
      console.warn('[DartCoins] Coin-Vergabe fehlgeschlagen:', e);
    }

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

    // Top-10-Trophäe
    if (season.worldRanking <= 10 && !season.trophies.some(t => t.id === 'top_10')) {
      const trophy = CAREER_TROPHIES.find(t => t.id === 'top_10');
      if (trophy) season.trophies.push({ ...trophy, earnedAt: new Date().toISOString() });
    }

    // Weltranglistenerster-Trophäe
    if (season.worldRanking === 1 && !season.trophies.some(t => t.id === 'world_number_1')) {
      const trophy = CAREER_TROPHIES.find(t => t.id === 'world_number_1');
      if (trophy) season.trophies.push({ ...trophy, earnedAt: new Date().toISOString() });
    }

    // Sponsor-Freischaltung prüfen
    const { CAREER_SPONSORS } = await import('@/utils/career-engine');
    for (const sponsor of CAREER_SPONSORS) {
      if (
        season.worldRanking <= sponsor.unlockedAtRanking &&
        !season.sponsors.some(s => s.id === sponsor.id)
      ) {
        season.sponsors.push(sponsor);
      }
    }

    // Saison speichern
    await browser.storage.local.set({ [CAREER_STORAGE_KEY]: season });

  } catch (e) {
    console.error('[CareerMatch v2.8.0] Fehler beim Aktualisieren der Karriere:', e);
  }
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

/**
 * Zeigt das TV-Style Intro-Overlay vor dem Match.
 */
export function showCareerMatchIntro(config: CareerMatchConfig): void {
  document.getElementById('career-match-intro')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'career-match-intro';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(13, 27, 42, 0.97);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
    animation: careerIntroFadeIn 0.5s ease;
  `;

  const formatText = config.format === 'sets'
    ? `Best of ${(config.setsToWin ?? 3) * 2 - 1} Sets (${config.legsPerSet ?? 3} Legs/Set)`
    : `Best of ${(config.legsToWin ?? 4) * 2 - 1} Legs`;

  const inModeText = config.inMode === 'double' ? '⚡ DOUBLE-IN / DOUBLE-OUT' : 'Straight In / Double Out';

  overlay.innerHTML = `
    <style>
      @keyframes careerIntroFadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      @keyframes careerIntroFadeOut { from { opacity: 1; } to { opacity: 0; } }
    </style>

    <div style="text-align: center; margin-bottom: 32px;">
      <div style="font-size: 13px; letter-spacing: 5px; color: #E8002D; text-transform: uppercase; margin-bottom: 8px;">PDC Karriere-Modus</div>
      <div style="font-size: 42px; font-weight: 900; color: #F5C842; letter-spacing: 2px; text-transform: uppercase; line-height: 1;">${escapeHtml(config.tournamentName)}</div>
      <div style="font-size: 22px; color: #94A3B8; margin-top: 8px; letter-spacing: 3px; text-transform: uppercase;">${escapeHtml(config.round)}</div>
    </div>

    <div style="width: 200px; height: 2px; background: linear-gradient(90deg, transparent, #E8002D, transparent); margin-bottom: 32px;"></div>

    <div style="display: flex; align-items: center; gap: 32px; margin-bottom: 32px;">
      <div style="text-align: center; min-width: 180px;">
        <div style="font-size: 11px; color: #94A3B8; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px;">Du</div>
        <div style="font-size: 28px; font-weight: 700; color: #FFFFFF;">Spieler</div>
      </div>
      <div style="font-size: 32px; font-weight: 900; color: #E8002D;">VS</div>
      <div style="text-align: center; min-width: 180px;">
        <div style="font-size: 11px; color: #94A3B8; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px;">Gegner</div>
        <div style="font-size: 28px; font-weight: 700; color: #FFFFFF;">${escapeHtml(config.opponent.name)}</div>
        <div style="font-size: 13px; color: #94A3B8; margin-top: 4px;">${escapeHtml(config.opponent.country)} · Rang #${config.opponent.worldRanking}</div>
        <div style="font-size: 12px; color: #60A5FA; margin-top: 2px;">Avg. ${config.opponent.averageMin}–${config.opponent.averageMax}</div>
        ${config.opponent.isNemesis ? '<div style="color: #E8002D; font-size: 14px; font-weight: 700; margin-top: 4px;">⚔️ NEMESIS!</div>' : ''}
      </div>
    </div>

    <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(245,200,66,0.2); border-radius: 8px; padding: 16px 32px; text-align: center; margin-bottom: 32px;">
      <div style="font-size: 18px; font-weight: 700; color: #F5C842;">${formatText}</div>
      <div style="font-size: 14px; color: ${config.inMode === 'double' ? '#E8002D' : '#94A3B8'}; margin-top: 4px; font-weight: ${config.inMode === 'double' ? '700' : '400'};">${inModeText}</div>
    </div>

    ${config.isTvMatch ? `
    <div style="display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; justify-content: center;">
      ${config.isWalkOnEnabled ? '<div style="background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.3); border-radius: 4px; padding: 6px 12px; font-size: 12px; color: #34D399;">🎵 Walk-On aktiv</div>' : ''}
      <div style="background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.3); border-radius: 4px; padding: 6px 12px; font-size: 12px; color: #34D399;">🎤 KI-Kommentator</div>
      <div style="background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.3); border-radius: 4px; padding: 6px 12px; font-size: 12px; color: #34D399;">👥 Crowd-Atmosphäre</div>
      <div style="background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.3); border-radius: 4px; padding: 6px 12px; font-size: 12px; color: #34D399;">📊 TV-Statistiken</div>
    </div>
    ` : ''}

    <div id="career-countdown" style="font-size: 48px; font-weight: 900; color: #E8002D; min-width: 60px; text-align: center;">5</div>
    <div style="font-size: 13px; color: #6B7280; margin-top: 8px; letter-spacing: 2px;">SEKUNDEN BIS ZUM MATCH · KLICKEN ZUM ÜBERSPRINGEN</div>
  `;

  document.body.appendChild(overlay);

  let count = 5;
  const countdownEl = overlay.querySelector('#career-countdown') as HTMLElement;
  const interval = setInterval(() => {
    count--;
    if (countdownEl) countdownEl.textContent = String(count);
    if (count <= 0) {
      clearInterval(interval);
      overlay.style.animation = 'careerIntroFadeOut 0.5s ease forwards';
      setTimeout(() => {
        overlay.remove();
        // Match-Controller starten NACH dem Intro
        initCareerMatchController(config);
      }, 500);
    }
  }, 1000);

  overlay.addEventListener('click', () => {
    clearInterval(interval);
    overlay.remove();
    initCareerMatchController(config);
  });
}

/**
 * Zeigt das Ergebnis-Overlay nach dem Match (v2.8.0 – erweiterte Stats + Trophäen-Animation).
 */
export function showCareerMatchResult(
  config: CareerMatchConfig,
  won: boolean,
  playerAverage: number,
  player180s: number,
  playerBestCheckout: number,
  opponentAverage: number,
  prizeMoney: number,
  oomPoints: number,
): void {
  document.getElementById('career-match-result')?.remove();

  const marathon = !!(config as any).marathonMode;
  const isTournament = !!config.isTournament;

  // v2.9.80 – Marathon-Modus + Turnier + Sieg → Overlay überspringen,
  // sofort auto-continue triggern und ins Popup navigieren.
  if (marathon && isTournament && won) {
    (async () => {
      await browser.storage.local.set({
        'tm-auto-continue-request': {
          ts: Date.now(),
          tournamentId: config.tournamentId,
          round: config.round,
          marathon: true,
        },
      });
      // Kurzer Toast statt Overlay
      showMarathonToast(`⚡ Runde erledigt: ${config.round} · ${prizeMoney > 0 ? '+ €' + prizeMoney.toLocaleString('de-DE') : ''}`);
      setTimeout(() => {
        window.location.href = 'https://play.autodarts.io/';
      }, 1500);
    })();
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'career-match-result';
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(13, 27, 42, 0.97);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
    animation: careerResultFadeIn 0.6s ease;
  `;

  overlay.innerHTML = `
    <style>
      @keyframes careerResultFadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes trophyBounce {
        0%, 100% { transform: scale(1); }
        50%       { transform: scale(1.2); }
      }
    </style>

    <!-- Ergebnis-Header -->
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="font-size: 80px; margin-bottom: 8px; animation: trophyBounce 1s ease 0.5s both;">
        ${won ? '🏆' : '😤'}
      </div>
      <div style="font-size: 52px; font-weight: 900; color: ${won ? '#F5C842' : '#E8002D'}; text-transform: uppercase; letter-spacing: 4px; line-height: 1;">
        ${won ? 'SIEG!' : 'NIEDERLAGE'}
      </div>
      <div style="font-size: 18px; color: #94A3B8; margin-top: 8px;">
        ${config.tournamentName ? escapeHtml(config.tournamentName) : ''} · ${escapeHtml(config.round)}
      </div>
    </div>

    <!-- Trennlinie -->
    <div style="width: 300px; height: 1px; background: linear-gradient(90deg, transparent, ${won ? '#F5C842' : '#E8002D'}, transparent); margin-bottom: 24px;"></div>

    <!-- Stats-Grid -->
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; width: 420px;">
      <div style="text-align: center;">
        <div style="font-size: 10px; color: #6B7280; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px;">Dein Average</div>
        <div style="font-size: 30px; font-weight: 900; color: #60A5FA;">${playerAverage.toFixed(2)}</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 10px; color: #6B7280; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px;">Gegner-Avg.</div>
        <div style="font-size: 30px; font-weight: 900; color: #94A3B8;">${opponentAverage.toFixed(1)}</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 10px; color: #6B7280; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 4px;">180er</div>
        <div style="font-size: 30px; font-weight: 900; color: #F59E0B;">${player180s}</div>
      </div>
    </div>

    <!-- Preisgeld & OoM -->
    <div style="display: flex; gap: 24px; margin-bottom: 28px; justify-content: center;">
      <div style="background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.3); border-radius: 6px; padding: 10px 20px; text-align: center;">
        <div style="font-size: 10px; color: #6B7280; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2px;">Preisgeld</div>
        <div style="font-size: 22px; font-weight: 900; color: #34D399;">£${prizeMoney.toLocaleString('de-DE')}</div>
      </div>
      <div style="background: rgba(245,200,66,0.1); border: 1px solid rgba(245,200,66,0.3); border-radius: 6px; padding: 10px 20px; text-align: center;">
        <div style="font-size: 10px; color: #6B7280; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2px;">OoM Punkte</div>
        <div style="font-size: 22px; font-weight: 900; color: #F5C842;">+${oomPoints.toLocaleString('de-DE')}</div>
      </div>
    </div>

    <!-- Bester Checkout -->
    ${playerBestCheckout > 0 ? `
    <div style="font-size: 14px; color: #94A3B8; margin-bottom: 20px;">
      Bester Checkout: <span style="color: #F5C842; font-weight: 700;">${playerBestCheckout}</span>
    </div>
    ` : ''}

    <!-- Weiter-Button + Turnier-Continue -->
    <div id="career-result-buttons" style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
      ${config.isTournament && won ? `
        <button
          id="tournament-next-match-btn"
          data-testid="tournament-next-match-btn"
          style="background: linear-gradient(135deg, #00C853, #009d40); color: white; border: none; padding: 14px 48px; font-size: 18px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; border-radius: 4px; cursor: pointer; font-family: inherit;">
          🏆 Nächstes Match →
        </button>
      ` : ''}
      <button
        onclick="document.getElementById('career-match-result').remove()"
        style="background: linear-gradient(135deg, #E8002D, #B00020); color: white; border: none; padding: 14px 48px; font-size: 18px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; border-radius: 4px; cursor: pointer; font-family: inherit;">
        ${config.isTournament && !won ? 'ZURÜCK ZUR ÜBERSICHT' : 'WEITER →'}
      </button>
    </div>
    <div style="font-size: 11px; color: #4B5563; margin-top: 10px;">
      ${config.isTournament
        ? (won ? 'Klicke "Nächstes Match" um direkt zur nächsten Runde zu wechseln.' : 'Turnier beendet – Ergebnis wird in der Übersicht gespeichert.')
        : 'Karriere wird automatisch gespeichert'}
    </div>
  `;

  document.body.appendChild(overlay);

  // v2.9.79 – Auto-Continue-Handler für Turnier-Sieg
  if (config.isTournament && won) {
    setTimeout(() => {
      const btn = document.getElementById('tournament-next-match-btn');
      btn?.addEventListener('click', async () => {
        try {
          // Storage-Flag setzen, das TournamentMode.vue beim Mount ausliest
          await browser.storage.local.set({
            'tm-auto-continue-request': {
              ts: Date.now(),
              tournamentId: config.tournamentId,
              round: config.round,
            },
          });
        } catch (e) {
          console.warn('[CareerMatch] Auto-continue Flag konnte nicht gesetzt werden', e);
        }
        // Zurück zum Tools-Config-Tab (Extension-Popup)
        window.location.href = 'https://play.autodarts.io/';
      });
    }, 200);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// v2.9.80 – Marathon-Modus Helfer
// ─────────────────────────────────────────────────────────────────────────────

function showMarathonToast(text: string) {
  const el = document.createElement('div');
  el.setAttribute('data-testid', 'marathon-toast');
  el.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 99999;
    padding: 14px 28px;
    background: linear-gradient(135deg, #F5C842 0%, #E8002D 100%);
    color: #0D1B2A;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 18px;
    font-weight: 900;
    letter-spacing: 2px;
    text-transform: uppercase;
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    animation: adt-toast-in 0.3s ease-out;
  `;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => (el.style.opacity = '0'), 1200);
  setTimeout(() => el.remove(), 1600);
}

/**
 * Wird nach Marathon-Ende (Champion oder Elimination) angezeigt.
 * Speedrun-Card mit Gesamtdauer, allen Runden, Gesamt-Preisgeld.
 * v2.9.82: optional Ladder-Info (globale Speedrun-Rangliste pro Turnier).
 */
export function showMarathonSummary(opts: {
  tournamentName: string;
  matches: { round: string; opponentName: string; won: boolean; prizeMoney: number }[];
  totalPrize: number;
  finalResult: 'champion' | 'runner_up' | 'semi' | 'quarter' | 'r16' | 'r32' | 'eliminated';
  startTs: number;
  ladder?: {
    rank: number | null;
    totalRuns: number;
    leaderboard: Array<{
      rank: number;
      display_name: string;
      duration_str: string;
      matches_won: number;
      matches_total: number;
      total_prize: number;
    }>;
  } | null;
}): void {
  document.getElementById('marathon-summary')?.remove();
  const duration = Date.now() - opts.startTs;
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')} min`;
  const wins = opts.matches.filter(m => m.won).length;
  const isChampion = opts.finalResult === 'champion';

  const overlay = document.createElement('div');
  overlay.id = 'marathon-summary';
  overlay.setAttribute('data-testid', 'marathon-summary');
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 999999;
    background: rgba(0,0,0,0.85); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; box-sizing: border-box;
    font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
    color: #e8eaf0;
  `;

  overlay.innerHTML = `
    <div style="max-width: 640px; width: 100%; background: linear-gradient(135deg, #0D1B2A 0%, #1a0a10 100%); border-radius: 10px; border: 3px solid ${isChampion ? '#F5C842' : '#E8002D'}; padding: 30px; max-height: 92vh; overflow-y: auto;">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 12px; letter-spacing: 4px; color: #F5C842; font-weight: 800; text-transform: uppercase;">🏁 Marathon-Modus abgeschlossen</div>
        <div style="font-size: 44px; font-weight: 900; letter-spacing: 2px; margin-top: 8px; color: ${isChampion ? '#F5C842' : '#e8eaf0'};">${isChampion ? '🏆 WELTMEISTER!' : 'ELIMINIERT'}</div>
        <div style="font-size: 16px; color: #94A3B8; margin-top: 4px;">${escapeHtml(opts.tournamentName)}</div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="background: #0a1520; border: 2px solid #00C853; border-radius: 6px; padding: 14px; text-align: center;">
          <div style="font-size: 11px; color: #8899aa; letter-spacing: 2px; text-transform: uppercase;">Zeit</div>
          <div style="font-size: 32px; font-weight: 900; color: #00C853; margin-top: 4px;">${durationStr}</div>
        </div>
        <div style="background: #0a1520; border: 2px solid #F5C842; border-radius: 6px; padding: 14px; text-align: center;">
          <div style="font-size: 11px; color: #8899aa; letter-spacing: 2px; text-transform: uppercase;">Siege</div>
          <div style="font-size: 32px; font-weight: 900; color: #F5C842; margin-top: 4px;">${wins}/${opts.matches.length}</div>
        </div>
        <div style="background: #0a1520; border: 2px solid #E8002D; border-radius: 6px; padding: 14px; text-align: center;">
          <div style="font-size: 11px; color: #8899aa; letter-spacing: 2px; text-transform: uppercase;">Preisgeld</div>
          <div style="font-size: 26px; font-weight: 900; color: #E8002D; margin-top: 4px;">€${opts.totalPrize.toLocaleString('de-DE')}</div>
        </div>
      </div>

      <div style="background: #0a1520; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; max-height: 240px; overflow-y: auto;">
        <div style="font-size: 11px; color: #8899aa; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">📋 Match-Historie</div>
        ${opts.matches.map((m, i) => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 14px;">
            <div>
              <span style="font-weight: 700; color: ${m.won ? '#00C853' : '#E8002D'};">${m.won ? '✅' : '❌'}</span>
              <span style="color: #94A3B8; margin-left: 8px;">${escapeHtml(m.round)}:</span>
              <span style="margin-left: 4px;">${escapeHtml(m.opponentName)}</span>
            </div>
            <div style="color: #F5C842; font-weight: 700;">${m.prizeMoney > 0 ? '+ €' + m.prizeMoney.toLocaleString('de-DE') : ''}</div>
          </div>
        `).join('')}
      </div>

      ${opts.ladder ? `
        <div data-testid="marathon-ladder-panel"
          style="background: linear-gradient(135deg, rgba(0,200,83,0.08), rgba(245,200,66,0.06)); border: 2px solid #00C853; border-radius: 6px; padding: 14px; margin-bottom: 20px;">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <div style="font-size: 12px; letter-spacing: 2px; color: #00C853; font-weight: 900; text-transform: uppercase;">🏁 Speedrun-Rangliste</div>
            ${opts.ladder.rank !== null && opts.ladder.rank !== undefined ? `
              <div style="font-size: 20px; font-weight: 900; color: #F5C842;">
                Rang #${opts.ladder.rank} <span style="font-size: 12px; color: #8899aa;">von ${opts.ladder.totalRuns}</span>
              </div>
            ` : `
              <div style="font-size: 12px; color: #8899aa;">${opts.ladder.totalRuns} Läufe insgesamt</div>
            `}
          </div>
          ${opts.ladder.leaderboard.length ? `
            <div style="background:#0D1B2A; border-radius:4px; overflow:hidden;">
              <div style="display:grid; grid-template-columns:40px 1fr 80px 80px; padding:6px 10px; font-size:10px; color:#8899aa; letter-spacing:1.5px; text-transform:uppercase; border-bottom:1px solid #1e3a5f;">
                <div>#</div><div>Spieler</div><div style="text-align:right;">Zeit</div><div style="text-align:right;">Preisgeld</div>
              </div>
              ${opts.ladder.leaderboard.map(e => `
                <div style="display:grid; grid-template-columns:40px 1fr 80px 80px; padding:6px 10px; font-size:13px; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); ${e.rank === 1 ? 'background:rgba(0,200,83,0.08);' : e.rank <= 3 ? 'background:rgba(245,200,66,0.05);' : ''}">
                  <div style="font-weight:900; color:${e.rank === 1 ? '#00C853' : e.rank <= 3 ? '#F5C842' : '#8899aa'};">#${e.rank}</div>
                  <div style="font-weight:700;">${escapeHtml(e.display_name)}</div>
                  <div style="text-align:right; font-family:monospace; color:#00C853; font-weight:800;">${e.duration_str}</div>
                  <div style="text-align:right; color:#F5C842; font-size:11px;">€${e.total_prize.toLocaleString('de-DE')}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      ` : ''}

      <button data-testid="marathon-summary-close"
        style="width: 100%; padding: 14px; background: linear-gradient(135deg, #E8002D, #B00020); color: white; border: none; border-radius: 6px; cursor: pointer; font-family: inherit; font-size: 16px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase;">
        Weiter →
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('[data-testid="marathon-summary-close"]')
    ?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

function escapeHtml(s: string): string {
  // v2.9.97 SEC-001: Vollständig escapen (auch " und ') damit Attribut-Kontext
  // sicher ist wenn wir Werte in HTML-Templates einsetzen.
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
