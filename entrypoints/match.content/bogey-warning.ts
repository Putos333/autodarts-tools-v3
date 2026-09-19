/**
 * bogey-warning.ts – Bogey-Number Warnung & Checkout-Vorschläge
 *
 * Zeigt ein TV-Style Overlay an, wenn der aktuelle Spieler auf einer
 * Bogey-Number steht (Scores, die sich nicht mit einem Dart auf Doppel
 * auschecken lassen) oder einen erreichbaren Checkout hat.
 *
 * Bogey-Numbers: 169, 168, 166, 165, 163, 162, 159
 *
 * Das Overlay blendet sich automatisch ein und nach 4 Sekunden wieder aus.
 * Bei einem Checkout-Score wird der optimale Weg angezeigt.
 */

import { AutodartsToolsConfig, type IConfig } from "@/utils/storage";
import type { IGameData } from "@/utils/game-data-storage";

// ─── Bogey-Numbers ────────────────────────────────────────────────────────────

const BOGEY_NUMBERS = new Set([159, 162, 163, 165, 166, 168, 169]);

// ─── Checkout-Tabelle (Double Out, häufigste Wege) ────────────────────────────

export const CHECKOUTS: Record<number, string> = {
  170: "T20 T20 Bull",  168: "T20 T20 T12",  167: "T20 T19 Bull",
  166: "T20 T18 Bull",  165: "T20 T19 T12",  164: "T20 T18 T10",
  163: "T20 T19 T10",   162: "T20 T18 T12",  161: "T20 T17 Bull",
  160: "T20 T20 D20",   159: "T20 T13 Bull",  158: "T20 T20 D19",
  157: "T20 T19 D20",   156: "T20 T20 D18",  155: "T20 T19 D19",
  154: "T20 T18 D20",   153: "T20 T19 D18",  152: "T20 T20 D16",
  151: "T20 T17 D20",   150: "T20 T18 D18",  149: "T20 T19 D16",
  148: "T20 T16 D20",   147: "T20 T17 D18",  146: "T20 T18 D16",
  145: "T20 T15 D20",   144: "T20 T20 D12",  143: "T20 T17 D16",
  142: "T20 T14 D20",   141: "T20 T19 D12",  140: "T20 T16 D16",
  139: "T20 T13 D20",   138: "T20 T18 D12",  137: "T20 T15 D16",
  136: "T20 T20 D8",    135: "T20 T17 D12",  134: "T20 T14 D16",
  133: "T20 T19 D8",    132: "T20 T16 D12",  131: "T20 T13 D16",
  130: "T20 T18 D8",    129: "T19 T16 D12",  128: "T20 T20 D4",
  127: "T20 T17 D8",    126: "T19 T19 D6",   125: "T20 T15 D10",
  124: "T20 T16 D8",    123: "T19 T16 D9",   122: "T18 T18 D7",
  121: "T20 T11 D14",   120: "T20 S20 D20",  119: "T19 T12 D13",
  118: "T20 S18 D20",   117: "T20 S17 D20",  116: "T20 S16 D20",
  115: "T20 S15 D20",   114: "T20 S14 D20",  113: "T20 S13 D20",
  112: "T20 S12 D20",   111: "T20 S11 D20",  110: "T20 S10 D20",
  109: "T20 S9 D20",    108: "T20 S8 D20",   107: "T19 S10 D20",
  106: "T20 S6 D20",    105: "T20 S5 D20",   104: "T20 S4 D20",
  103: "T20 S3 D20",    102: "T20 S2 D20",   101: "T20 S1 D20",
  100: "T20 D20",        99: "T19 S2 D20",    98: "T20 D19",
   97: "T19 D20",        96: "T20 D18",        95: "T19 D19",
   94: "T18 D20",        93: "T19 D18",        92: "T20 D16",
   91: "T17 D20",        90: "T18 D18",        89: "T19 D16",
   88: "T20 D14",        87: "T17 D18",        86: "T18 D16",
   85: "T15 D20",        84: "T20 D12",        83: "T17 D16",
   82: "T14 D20",        81: "T19 D12",        80: "T20 D10",
   79: "T13 D20",        78: "T18 D12",        77: "T19 D10",
   76: "T20 D8",         75: "T17 D12",        74: "T14 D16",
   73: "T19 D8",         72: "T16 D12",        71: "T13 D16",
   70: "T18 D8",         69: "T19 D6",         68: "T20 D4",
   67: "T17 D8",         66: "T10 D18",        65: "T19 D4",
   64: "T16 D8",         63: "T13 D12",        62: "T10 D16",
   61: "T15 D8",         60: "S20 D20",        59: "S19 D20",
   58: "S18 D20",        57: "S17 D20",        56: "T16 D4",
   55: "S15 D20",        54: "S14 D20",        53: "S13 D20",
   52: "S12 D20",        51: "S11 D20",        50: "S10 D20",
   49: "S9 D20",         48: "S16 D16",        47: "S15 D16",
   46: "S6 D20",         45: "S5 D20",         44: "S4 D20",
   43: "S3 D20",         42: "S10 D16",        41: "S9 D16",
   40: "D20",            39: "S7 D16",         38: "D19",
   37: "S5 D16",         36: "D18",            35: "S3 D16",
   34: "D17",            33: "S1 D16",         32: "D16",
   31: "S7 D12",         30: "D15",            29: "S13 D8",
   28: "D14",            27: "S11 D8",         26: "D13",
   25: "S9 D8",          24: "D12",            23: "S7 D8",
   22: "D11",            21: "S5 D8",          20: "D10",
   18: "D9",             16: "D8",             14: "D7",
   12: "D6",             10: "D5",              8: "D4",
    6: "D3",              4: "D2",              2: "D1",
};

// ─── Modul-Zustand ────────────────────────────────────────────────────────────

let config: IConfig;
let gameDataWatcherUnwatch: (() => void) | null = null;
let overlayEl: HTMLElement | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;
let lastShownScore = -1;

// ─── Öffentliche API ──────────────────────────────────────────────────────────

export async function bogeyWarning(): Promise<void> {
  console.log("Autodarts Tools: Bogey-Warning Modul gestartet");
  config = await AutodartsToolsConfig.getValue();

  if (!config.bogeyWarning?.enabled) return;

  createOverlayElement();

  gameDataWatcherUnwatch = AutodartsToolsGameData.watch(
    async (gameData: IGameData, oldGameData: IGameData) => {
      await processGameData(gameData, oldGameData);
    },
  );
}

export function bogeyWarningOnRemove(): void {
  gameDataWatcherUnwatch?.();
  gameDataWatcherUnwatch = null;
  removeOverlay();
  lastShownScore = -1;
}

// ─── Overlay-Element erstellen ────────────────────────────────────────────────

function createOverlayElement(): void {
  if (overlayEl) return;

  overlayEl = document.createElement("div");
  overlayEl.id = "ad-ext-bogey-warning";
  overlayEl.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(20px);
    z-index: 99990;
    opacity: 0;
    transition: opacity 0.3s ease, transform 0.3s ease;
    pointer-events: none;
    font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
    min-width: 340px;
    max-width: 500px;
    text-align: center;
  `;

  document.body.appendChild(overlayEl);
}

function removeOverlay(): void {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
  if (hideTimeout) {
    clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

// ─── Spielereignis-Verarbeitung ───────────────────────────────────────────────

async function processGameData(gameData: IGameData, oldGameData: IGameData): Promise<void> {
  if (!gameData?.match || !gameData.match.turns?.length) return;
  if (gameData.match.variant === "Bull-off") return;
  if (gameData.match.gameWinner >= 0) { hideOverlay(); return; }

  const currentPlayerIdx = gameData.match.player;
  const gameScores: number[] = gameData.match.gameScores ?? [];
  const currentScore = gameScores[currentPlayerIdx];

  if (currentScore === undefined || currentScore === lastShownScore) return;

  // Nur anzeigen wenn sich der Spieler geändert hat oder Score sich geändert hat
  const playerChanged = oldGameData?.match?.player !== gameData.match.player;
  const scoreChanged = oldGameData?.match?.gameScores?.[currentPlayerIdx] !== currentScore;

  if (!playerChanged && !scoreChanged) return;

  lastShownScore = currentScore;

  if (BOGEY_NUMBERS.has(currentScore)) {
    // Bogey-Number: Kein Checkout möglich
    showBogeyWarning(currentScore);
  } else if (currentScore <= 170 && currentScore >= 2 && CHECKOUTS[currentScore]) {
    // Checkout möglich
    if (config.bogeyWarning?.showCheckoutSuggestion) {
      showCheckoutSuggestion(currentScore, CHECKOUTS[currentScore]);
    }
  } else {
    hideOverlay();
  }
}

// ─── Bogey-Number Warnung anzeigen ────────────────────────────────────────────

function showBogeyWarning(score: number): void {
  if (!overlayEl) return;

  // v2.9.97 SEC-001: XSS-Schutz. `highlightColor` kommt aus User-Config und
  // wird direkt in style-Attribute eingesetzt — Angreifer könnte via
  // `red; } </style><script>...</script>` ausbrechen. Nur valide Hex-Codes
  // erlauben, sonst Fallback.
  const rawColor = config.bogeyWarning?.highlightColor ?? '#E8002D';
  const color = /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ? rawColor : '#E8002D';

  overlayEl.innerHTML = `
    <div style="
      background: rgba(13,27,42,0.95);
      border: 2px solid ${color};
      border-top: 4px solid ${color};
      border-radius: 8px;
      padding: 12px 24px;
      box-shadow: 0 4px 30px rgba(0,0,0,0.7), 0 0 20px ${color}44;
    ">
      <div style="
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 3px;
        color: ${color};
        text-transform: uppercase;
        margin-bottom: 4px;
      ">⚠ BOGEY NUMBER</div>
      <div style="
        font-size: 42px;
        font-weight: 900;
        color: #ffffff;
        line-height: 1;
        letter-spacing: 2px;
      ">${score}</div>
      <div style="
        font-size: 14px;
        color: #8899aa;
        margin-top: 4px;
        letter-spacing: 0.5px;
      ">Kein Doppel-Finish möglich!</div>
    </div>
  `;

  showOverlay(5000);
}

// ─── Checkout-Vorschlag anzeigen ──────────────────────────────────────────────

function showCheckoutSuggestion(score: number, checkout: string): void {
  if (!overlayEl) return;

  // Darts aufteilen und farblich hervorheben
  const darts = checkout.split(" ");
  const dartsHtml = darts.map(dart => {
    let color = '#e8eaf0';
    if (dart.startsWith('T')) color = '#F5C842';       // Triple → Gold
    else if (dart.startsWith('D')) color = '#00C853';  // Double → Grün
    else if (dart === 'Bull') color = '#E8002D';       // Bull → Rot
    return `<span style="color:${color}; font-weight:900;">${dart}</span>`;
  }).join(' <span style="color:#334;">·</span> ');

  const isHighCheckout = score >= 100;
  const borderColor = isHighCheckout ? '#F5C842' : '#00C853';

  overlayEl.innerHTML = `
    <div style="
      background: rgba(13,27,42,0.95);
      border: 2px solid ${borderColor};
      border-top: 4px solid ${borderColor};
      border-radius: 8px;
      padding: 12px 24px;
      box-shadow: 0 4px 30px rgba(0,0,0,0.7);
    ">
      <div style="
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 3px;
        color: ${borderColor};
        text-transform: uppercase;
        margin-bottom: 4px;
      ">${isHighCheckout ? '🎯 HIGH CHECKOUT' : '✅ CHECKOUT MÖGLICH'}</div>
      <div style="
        font-size: 38px;
        font-weight: 900;
        color: #ffffff;
        line-height: 1;
        letter-spacing: 2px;
      ">${score}</div>
      <div style="
        font-size: 20px;
        margin-top: 8px;
        letter-spacing: 1px;
      ">${dartsHtml}</div>
    </div>
  `;

  showOverlay(4000);
}

// ─── Overlay ein-/ausblenden ──────────────────────────────────────────────────

function showOverlay(duration: number): void {
  if (!overlayEl) return;

  if (hideTimeout) clearTimeout(hideTimeout);

  // Einblenden
  requestAnimationFrame(() => {
    if (!overlayEl) return;
    overlayEl.style.opacity = '1';
    overlayEl.style.transform = 'translateX(-50%) translateY(0)';
  });

  // Automatisch ausblenden
  hideTimeout = setTimeout(() => hideOverlay(), duration);
}

function hideOverlay(): void {
  if (!overlayEl) return;
  overlayEl.style.opacity = '0';
  overlayEl.style.transform = 'translateX(-50%) translateY(20px)';
  if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
}
