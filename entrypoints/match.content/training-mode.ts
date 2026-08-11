/**
 * training-mode.ts – Trainings-Modus mit Zielvorgaben
 *
 * Überwacht das laufende Match und vergleicht die Leistung des Spielers
 * mit den konfigurierten Zielen. Zeigt:
 *
 *  - Live-Fortschrittsbalken für jedes Ziel während des Matches
 *  - Zusammenfassung nach dem Match (Ziele erreicht / nicht erreicht)
 *  - Verlaufsspeicherung in localStorage für Langzeittracking
 *
 * Ziele:
 *  - Mindest-Average (z.B. ≥ 60)
 *  - Mindest-Anzahl 140+ Würfe
 *  - Mindest-Anzahl 180er
 *  - Maximale Checkout-Fehlversuche
 *  - Mindest-Checkout-Rate in %
 */

import { AutodartsToolsConfig } from "@/utils/storage";
import { AutodartsToolsGameData } from "@/utils/game-data-storage";

interface TrainingSession {
  date: string;
  average: number;
  count140Plus: number;
  count180s: number;
  checkoutMisses: number;
  checkoutRate: number;
  goalsReached: number;
  totalGoals: number;
}

let overlayEl: HTMLElement | null = null;
let summaryEl: HTMLElement | null = null;
let gameDataWatcherUnwatch: (() => void) | null = null;
let matchFinished = false;

// Live-Statistiken
let liveAvg = 0;
let live140Plus = 0;
let live180s = 0;
let liveCheckoutMisses = 0;
let liveCheckoutRate = 0;

export async function trainingMode(): Promise<void> {
  const config = await AutodartsToolsConfig.getValue();
  if (!config.training?.enabled) return;

  matchFinished = false;
  liveAvg = 0; live140Plus = 0; live180s = 0;
  liveCheckoutMisses = 0; liveCheckoutRate = 0;

  if (config.training.showLiveProgress) {
    createLiveOverlay(config.training);
  }

  gameDataWatcherUnwatch = AutodartsToolsGameData.watch(async (gameData: any) => {
    if (!gameData) return;

    const players = gameData?.players || [];
    const myPlayer = players[0]; // Heimspieler
    if (!myPlayer) return;

    // Statistiken aktualisieren
    liveAvg = parseFloat(myPlayer.stats?.average || '0');
    live140Plus = parseInt(myPlayer.stats?.scores140Plus || myPlayer.stats?.count140 || '0', 10);
    live180s = parseInt(myPlayer.stats?.scores180 || myPlayer.stats?.count180 || '0', 10);
    liveCheckoutRate = parseFloat(myPlayer.stats?.checkoutRate || '0') * 100;
    liveCheckoutMisses = parseInt(myPlayer.stats?.checkoutMisses || '0', 10);

    // Live-Overlay aktualisieren
    if (config.training.showLiveProgress) {
      updateLiveOverlay(config.training);
    }

    // Match beendet?
    const isFinished = gameData?.gameState === 'finished' || gameData?.status === 'finished';
    if (isFinished && !matchFinished) {
      matchFinished = true;

      if (config.training.showSummaryAfterMatch) {
        showSummary(config.training);
      }

      if (config.training.trackHistory) {
        saveToHistory(config.training);
      }
    }
  });
}

export function trainingModeOnRemove(): void {
  gameDataWatcherUnwatch?.();
  gameDataWatcherUnwatch = null;
  overlayEl?.remove();
  overlayEl = null;
  summaryEl?.remove();
  summaryEl = null;
  matchFinished = false;
}

// ─── Live-Overlay ─────────────────────────────────────────────────────────────
function createLiveOverlay(cfg: any): void {
  overlayEl?.remove();
  const el = document.createElement('div');
  el.id = 'ad-training-overlay';
  el.style.cssText = `
    position: fixed;
    top: 12px;
    right: 12px;
    width: 220px;
    background: rgba(13,27,42,0.95);
    border: 1px solid #1e3050;
    border-left: 3px solid #F5C842;
    border-radius: 6px;
    padding: 10px 12px;
    z-index: 9997;
    font-family: 'Barlow Condensed', Arial, sans-serif;
    pointer-events: none;
  `;
  el.innerHTML = buildLiveHTML(cfg);
  document.body.appendChild(el);
  overlayEl = el;
}

function buildLiveHTML(cfg: any): string {
  const goals = cfg.goals;
  return `
    <style>
      #ad-training-overlay .tr-title {
        font-size: 10px; font-weight: 700; letter-spacing: 2px;
        color: #F5C842; text-transform: uppercase; margin-bottom: 8px;
      }
      #ad-training-overlay .tr-goal {
        margin-bottom: 6px;
      }
      #ad-training-overlay .tr-goal-row {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 12px; color: #c0ccd8; margin-bottom: 2px;
      }
      #ad-training-overlay .tr-goal-label { font-weight: 700; }
      #ad-training-overlay .tr-goal-val { color: #F5C842; font-weight: 900; }
      #ad-training-overlay .tr-bar-bg {
        height: 4px; background: #1e3050; border-radius: 2px; overflow: hidden;
      }
      #ad-training-overlay .tr-bar-fill {
        height: 100%; border-radius: 2px; transition: width 0.4s;
        background: #E8002D;
      }
      #ad-training-overlay .tr-bar-fill.done { background: #00C853; }
    </style>
    <div class="tr-title">🎯 Training</div>
    ${goals.minAverage > 0 ? `
    <div class="tr-goal">
      <div class="tr-goal-row">
        <span class="tr-goal-label">Average</span>
        <span class="tr-goal-val" id="tr-avg-val">0 / ${goals.minAverage}</span>
      </div>
      <div class="tr-bar-bg"><div class="tr-bar-fill" id="tr-avg-bar" style="width:0%"></div></div>
    </div>` : ''}
    ${goals.min140Plus > 0 ? `
    <div class="tr-goal">
      <div class="tr-goal-row">
        <span class="tr-goal-label">140+</span>
        <span class="tr-goal-val" id="tr-140-val">0 / ${goals.min140Plus}</span>
      </div>
      <div class="tr-bar-bg"><div class="tr-bar-fill" id="tr-140-bar" style="width:0%"></div></div>
    </div>` : ''}
    ${goals.min180s > 0 ? `
    <div class="tr-goal">
      <div class="tr-goal-row">
        <span class="tr-goal-label">180er</span>
        <span class="tr-goal-val" id="tr-180-val">0 / ${goals.min180s}</span>
      </div>
      <div class="tr-bar-bg"><div class="tr-bar-fill" id="tr-180-bar" style="width:0%"></div></div>
    </div>` : ''}
    ${goals.minCheckoutRate > 0 ? `
    <div class="tr-goal">
      <div class="tr-goal-row">
        <span class="tr-goal-label">Checkout %</span>
        <span class="tr-goal-val" id="tr-co-val">0 / ${goals.minCheckoutRate}%</span>
      </div>
      <div class="tr-bar-bg"><div class="tr-bar-fill" id="tr-co-bar" style="width:0%"></div></div>
    </div>` : ''}
  `;
}

function updateLiveOverlay(cfg: any): void {
  if (!overlayEl) return;
  const goals = cfg.goals;

  const setBar = (id: string, valId: string, current: number, target: number, label: string) => {
    const bar = overlayEl!.querySelector(`#${id}`) as HTMLElement;
    const val = overlayEl!.querySelector(`#${valId}`) as HTMLElement;
    if (!bar || !val) return;
    const pct = Math.min(100, (current / target) * 100);
    bar.style.width = `${pct}%`;
    if (pct >= 100) bar.classList.add('done');
    else bar.classList.remove('done');
    val.textContent = `${current.toFixed(current % 1 === 0 ? 0 : 1)} / ${label}`;
  };

  if (goals.minAverage > 0) setBar('tr-avg-bar', 'tr-avg-val', liveAvg, goals.minAverage, `${goals.minAverage}`);
  if (goals.min140Plus > 0) setBar('tr-140-bar', 'tr-140-val', live140Plus, goals.min140Plus, `${goals.min140Plus}`);
  if (goals.min180s > 0) setBar('tr-180-bar', 'tr-180-val', live180s, goals.min180s, `${goals.min180s}`);
  if (goals.minCheckoutRate > 0) setBar('tr-co-bar', 'tr-co-val', liveCheckoutRate, goals.minCheckoutRate, `${goals.minCheckoutRate}%`);
}

// ─── Zusammenfassung nach Match ───────────────────────────────────────────────
function showSummary(cfg: any): void {
  summaryEl?.remove();
  const goals = cfg.goals;

  const checks = [
    { label: 'Average', reached: liveAvg >= goals.minAverage, current: liveAvg.toFixed(1), target: goals.minAverage, enabled: goals.minAverage > 0 },
    { label: '140+ Würfe', reached: live140Plus >= goals.min140Plus, current: live140Plus, target: goals.min140Plus, enabled: goals.min140Plus > 0 },
    { label: '180er', reached: live180s >= goals.min180s, current: live180s, target: goals.min180s, enabled: goals.min180s > 0 },
    { label: 'Checkout-Rate', reached: liveCheckoutRate >= goals.minCheckoutRate, current: `${liveCheckoutRate.toFixed(0)}%`, target: `${goals.minCheckoutRate}%`, enabled: goals.minCheckoutRate > 0 },
    { label: 'Max. Fehlversuche', reached: liveCheckoutMisses <= goals.maxCheckoutMisses, current: liveCheckoutMisses, target: goals.maxCheckoutMisses, enabled: goals.maxCheckoutMisses > 0 },
  ].filter(c => c.enabled);

  const reached = checks.filter(c => c.reached).length;
  const allReached = reached === checks.length;

  const el = document.createElement('div');
  el.id = 'ad-training-summary';
  el.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: #0D1B2A; border: 2px solid ${allReached ? '#00C853' : '#E8002D'};
    border-radius: 10px; padding: 24px 28px; z-index: 99999;
    font-family: 'Barlow Condensed', Arial, sans-serif;
    min-width: 320px; box-shadow: 0 8px 40px rgba(0,0,0,0.7);
    pointer-events: all;
  `;

  el.innerHTML = `
    <div style="font-size:32px;text-align:center;margin-bottom:8px">${allReached ? '🏆' : '🎯'}</div>
    <div style="font-size:22px;font-weight:900;color:#fff;text-align:center;letter-spacing:1px;margin-bottom:4px">
      TRAINING BEENDET
    </div>
    <div style="font-size:14px;color:${allReached ? '#00C853' : '#F5C842'};text-align:center;font-weight:700;margin-bottom:16px">
      ${reached} von ${checks.length} Zielen erreicht
    </div>
    ${checks.map(c => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #1e3050;">
        <span style="font-size:18px">${c.reached ? '✅' : '❌'}</span>
        <span style="flex:1;font-size:15px;font-weight:700;color:#c0ccd8">${c.label}</span>
        <span style="font-size:15px;font-weight:900;color:${c.reached ? '#00C853' : '#E8002D'}">${c.current}</span>
        <span style="font-size:12px;color:#556677">/ ${c.target}</span>
      </div>
    `).join('')}
    <button id="ad-training-close" style="
      margin-top:16px; width:100%; padding:10px;
      background:#E8002D; border:none; border-radius:4px;
      color:#fff; font-size:16px; font-weight:900; cursor:pointer;
      letter-spacing:1px;
    ">SCHLIESSEN</button>
  `;

  document.body.appendChild(el);
  summaryEl = el;

  document.getElementById('ad-training-close')?.addEventListener('click', () => {
    el.remove();
    summaryEl = null;
  });

  // Automatisch nach 15 Sekunden schließen
  setTimeout(() => {
    el.remove();
    summaryEl = null;
  }, 15000);
}

// ─── Verlaufsspeicherung ──────────────────────────────────────────────────────
function saveToHistory(cfg: any): void {
  try {
    const goals = cfg.goals;
    const checks = [
      goals.minAverage > 0 && liveAvg >= goals.minAverage,
      goals.min140Plus > 0 && live140Plus >= goals.min140Plus,
      goals.min180s > 0 && live180s >= goals.min180s,
      goals.minCheckoutRate > 0 && liveCheckoutRate >= goals.minCheckoutRate,
      goals.maxCheckoutMisses > 0 && liveCheckoutMisses <= goals.maxCheckoutMisses,
    ].filter(Boolean);

    const totalGoals = [
      goals.minAverage > 0,
      goals.min140Plus > 0,
      goals.min180s > 0,
      goals.minCheckoutRate > 0,
      goals.maxCheckoutMisses > 0,
    ].filter(Boolean).length;

    const session: TrainingSession = {
      date: new Date().toISOString(),
      average: liveAvg,
      count140Plus: live140Plus,
      count180s: live180s,
      checkoutMisses: liveCheckoutMisses,
      checkoutRate: liveCheckoutRate,
      goalsReached: checks.length,
      totalGoals,
    };

    const history: TrainingSession[] = JSON.parse(
      localStorage.getItem('ad-training-history') || '[]'
    );
    history.unshift(session);
    // Maximal 50 Einträge speichern
    if (history.length > 50) history.splice(50);
    localStorage.setItem('ad-training-history', JSON.stringify(history));
  } catch (e) {
    // Stille Fehlerbehandlung
  }
}

// ─── Verlauf abrufen (für Vue-Komponente) ─────────────────────────────────────
export function getTrainingHistory(): TrainingSession[] {
  try {
    return JSON.parse(localStorage.getItem('ad-training-history') || '[]');
  } catch {
    return [];
  }
}

export function clearTrainingHistory(): void {
  localStorage.removeItem('ad-training-history');
}
