/**
 * tv-stats.ts – Statistik-Overlay (sporadische Einblendung)
 *
 * Zeigt nach jedem Wurf kurz ein TV-ähnliches Statistik-Panel an:
 *  - Average (3-Dart)
 *  - First-9-Average
 *  - Doppelquote %
 *  - Höchstes Finish
 *  - Checkout-Vorschlag für den aktiven Spieler
 *
 * Das Panel erscheint für einige Sekunden und blendet sich dann automatisch aus.
 * Konfigurierbar: Position (bottom / top / side), Opazität, Anzeigedauer.
 */

import { AutodartsToolsConfig } from "@/utils/storage";
import { AutodartsToolsGameData, type IGameData } from "@/utils/game-data-storage";

// v2.9.97 SEC-001: XSS-Schutz. Der `name` wird via WebSocket vom Autodarts-
// Server geliefert — bei manipulierten Datenpaketen (oder wenn Autodarts-User
// später eigene Bots benennen dürfen) könnte er HTML enthalten. `innerHTML`
// interpretiert das → Script-Injection. Immer escapen bevor wir es in Template
// Literals einsetzen, die als innerHTML gerendert werden.
function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Checkout-Tabelle (alle Wege für 2–170 außer Bogey-Numbers) ───────────────
const CHECKOUT_TABLE: Record<number, string> = {
  170: "T20 · T20 · Bull",
  167: "T20 · T19 · Bull",
  164: "T20 · T18 · Bull",
  161: "T20 · T17 · Bull",
  160: "T20 · T20 · D20",
  158: "T20 · T20 · D19",
  157: "T20 · T19 · D20",
  156: "T20 · T20 · D18",
  155: "T20 · T19 · D19",
  154: "T20 · T18 · D20",
  153: "T20 · T19 · D18",
  152: "T20 · T20 · D16",
  151: "T20 · T17 · D20",
  150: "T20 · T18 · D18",
  149: "T20 · T19 · D16",
  148: "T20 · T16 · D20",
  147: "T20 · T17 · D18",
  146: "T20 · T18 · D16",
  145: "T20 · T15 · D20",
  144: "T20 · T20 · D12",
  143: "T20 · T17 · D16",
  142: "T20 · T14 · D20",
  141: "T20 · T19 · D12",
  140: "T20 · T20 · D10",
  139: "T20 · T13 · D20",
  138: "T20 · T18 · D12",
  137: "T20 · T19 · D10",
  136: "T20 · T20 · D8",
  135: "T20 · T17 · D12",
  134: "T20 · T14 · D16",
  133: "T20 · T19 · D8",
  132: "T20 · T16 · D12",
  131: "T20 · T13 · D16",
  130: "T20 · T18 · D8",
  129: "T19 · T16 · D12",
  128: "T20 · T16 · D10",
  127: "T20 · T17 · D8",
  126: "T19 · T19 · D6",
  125: "T20 · T15 · D10",
  124: "T20 · T16 · D8",
  123: "T19 · T16 · D9",
  122: "T18 · T18 · D7",
  121: "T20 · T11 · D14",
  120: "T20 · S20 · D20",
  119: "T19 · T12 · D13",
  118: "T20 · S18 · D20",
  117: "T20 · S17 · D20",
  116: "T20 · S16 · D20",
  115: "T20 · S15 · D20",
  114: "T20 · S14 · D20",
  113: "T20 · S13 · D20",
  112: "T20 · S12 · D20",
  111: "T20 · S11 · D20",
  110: "T20 · S10 · D20",
  109: "T20 · S9 · D20",
  108: "T20 · S8 · D20",
  107: "T19 · S10 · D20",
  106: "T20 · S6 · D20",
  105: "T20 · S5 · D20",
  104: "T18 · S18 · D16",
  103: "T19 · S6 · D20",
  102: "T20 · S2 · D20",
  101: "T17 · S10 · D20",
  100: "T20 · D20",
  99:  "T19 · S10 · D16",
  98:  "T20 · D19",
  97:  "T19 · D20",
  96:  "T20 · D18",
  95:  "T19 · D19",
  94:  "T18 · D20",
  93:  "T19 · D18",
  92:  "T20 · D16",
  91:  "T17 · D20",
  90:  "T18 · D18",
  89:  "T19 · D16",
  88:  "T16 · D20",
  87:  "T17 · D18",
  86:  "T18 · D16",
  85:  "T15 · D20",
  84:  "T20 · D12",
  83:  "T17 · D16",
  82:  "T14 · D20",
  81:  "T19 · D12",
  80:  "T20 · D10",
  79:  "T13 · D20",
  78:  "T18 · D12",
  77:  "T19 · D10",
  76:  "T20 · D8",
  75:  "T17 · D12",
  74:  "T14 · D16",
  73:  "T19 · D8",
  72:  "T16 · D12",
  71:  "T13 · D16",
  70:  "T18 · D8",
  69:  "T19 · D6",
  68:  "T20 · D4",
  67:  "T17 · D8",
  66:  "T10 · D18",
  65:  "T19 · D4",
  64:  "T16 · D8",
  63:  "T13 · D12",
  62:  "T10 · D16",
  61:  "T15 · D8",
  60:  "S20 · D20",
  59:  "S19 · D20",
  58:  "S18 · D20",
  57:  "S17 · D20",
  56:  "T16 · D4",
  55:  "S15 · D20",
  54:  "S14 · D20",
  53:  "S13 · D20",
  52:  "S12 · D20",
  51:  "S11 · D20",
  50:  "Bull",
  49:  "S9 · D20",
  48:  "S8 · D20",
  47:  "S15 · D16",
  46:  "S6 · D20",
  45:  "S13 · D16",
  44:  "S4 · D20",
  43:  "S3 · D20",
  42:  "S10 · D16",
  41:  "S9 · D16",
  40:  "D20",
  38:  "D19",
  36:  "D18",
  34:  "D17",
  32:  "D16",
  30:  "D15",
  28:  "D14",
  26:  "D13",
  24:  "D12",
  22:  "D11",
  20:  "D10",
  18:  "D9",
  16:  "D8",
  14:  "D7",
  12:  "D6",
  10:  "D5",
  8:   "D4",
  6:   "D3",
  4:   "D2",
  2:   "D1",
};

const BOGEY_NUMBERS = new Set([169, 168, 166, 165, 163, 162, 159]);

// ─── Zustand ──────────────────────────────────────────────────────────────────
let overlayEl: HTMLElement | null = null;
let gameDataWatcherUnwatch: (() => void) | null = null;
let hideTimeout: ReturnType<typeof setTimeout> | null = null;
let lastShownScore = -1;
let lastPlayerIdx = -1;

// ─── Initialisierung ──────────────────────────────────────────────────────────
export async function tvStats(): Promise<void> {
  const config = await AutodartsToolsConfig.getValue();
  if (!config.tvStats?.enabled) return;

  createOverlay();

  gameDataWatcherUnwatch = AutodartsToolsGameData.watch((gameData: IGameData, oldGameData: IGameData) => {
    if (!gameData) return;
    processGameData(gameData, oldGameData, config.tvStats);
  });
}

export function tvStatsOnRemove(): void {
  gameDataWatcherUnwatch?.();
  gameDataWatcherUnwatch = null;
  if (hideTimeout) clearTimeout(hideTimeout);
  hideTimeout = null;
  overlayEl?.remove();
  overlayEl = null;
  lastShownScore = -1;
  lastPlayerIdx = -1;
}

// ─── Overlay DOM erstellen ────────────────────────────────────────────────────
function createOverlay(): void {
  overlayEl?.remove();

  const el = document.createElement("div");
  el.id = "ad-tv-stats-overlay";
  el.style.cssText = `
    position: fixed;
    left: 50%;
    bottom: 80px;
    transform: translateX(-50%) translateY(20px);
    z-index: 9998;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.35s ease, transform 0.35s ease;
    font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
  `;

  document.body.appendChild(el);
  overlayEl = el;
}

// ─── Spielereignisse verarbeiten ──────────────────────────────────────────────
function processGameData(gameData: IGameData, oldGameData: IGameData, cfg: any): void {
  if (!gameData?.match || !gameData.match.turns?.length) return;
  if (gameData.match.variant === "Bull-off") return;
  if (gameData.match.gameWinner >= 0) { hideOverlay(); return; }

  const currentPlayerIdx = gameData.match.player;
  const gameScores: number[] = gameData.match.gameScores ?? [];
  const currentScore = gameScores[currentPlayerIdx];
  if (currentScore === undefined) return;

  // Nur anzeigen wenn sich Spieler oder Score geändert hat
  const playerChanged = oldGameData?.match?.player !== gameData.match.player;
  const scoreChanged = oldGameData?.match?.gameScores?.[currentPlayerIdx] !== currentScore;
  if (!playerChanged && !scoreChanged) return;
  if (currentScore === lastShownScore && currentPlayerIdx === lastPlayerIdx) return;

  lastShownScore = currentScore;
  lastPlayerIdx = currentPlayerIdx;

  // Statistiken des aktiven Spielers holen
  const players = gameData.match.players ?? [];
  const activePlayer = players[currentPlayerIdx];
  if (!activePlayer) return;

  // Checkout-Info
  let checkoutHtml = '';
  if (cfg.showCheckoutSuggestion && currentScore >= 2 && currentScore <= 170) {
    if (BOGEY_NUMBERS.has(currentScore)) {
      checkoutHtml = buildBogeyHtml(currentScore);
    } else if (CHECKOUT_TABLE[currentScore]) {
      checkoutHtml = buildCheckoutHtml(currentScore, CHECKOUT_TABLE[currentScore]);
    }
  }

  // Stats-Panel
  const statsHtml = buildStatsHtml(activePlayer, currentScore, cfg);

  showOverlay(statsHtml + checkoutHtml, cfg.displayDuration ?? 5000);
}

// ─── HTML-Bausteine ───────────────────────────────────────────────────────────
function buildStatsHtml(player: any, score: number, cfg: any): string {
  const name = player.name || 'Spieler';
  const avg = parseFloat(player.stats?.average ?? player.stats?.avg ?? '0');
  const f9 = parseFloat(player.stats?.first9Average ?? player.stats?.f9avg ?? '0');
  const dblRate = parseFloat(player.stats?.checkoutRate ?? player.stats?.doubleRate ?? '0');
  const bestLeg = player.stats?.bestLeg ?? player.stats?.bestLegDarts ?? 0;

  const avgColor = avg >= 90 ? '#00C853' : avg >= 70 ? '#F5C842' : '#c0ccd8';
  const f9Color = f9 >= 100 ? '#00C853' : f9 >= 80 ? '#F5C842' : '#c0ccd8';
  const dblColor = dblRate >= 0.45 ? '#00C853' : dblRate >= 0.25 ? '#F5C842' : '#c0ccd8';

  let statsItems = `
    <div style="display:flex; gap:20px; align-items:center; justify-content:center; flex-wrap:wrap;">
      <div style="text-align:center;">
        <div style="font-size:9px; font-weight:700; letter-spacing:2px; color:#556677; text-transform:uppercase;">REST</div>
        <div style="font-size:28px; font-weight:900; color:#fff; line-height:1;">${score}</div>
      </div>
  `;

  if (cfg.showFirst9Avg !== false) {
    statsItems += `
      <div style="text-align:center;">
        <div style="font-size:9px; font-weight:700; letter-spacing:2px; color:#556677; text-transform:uppercase;">AVG</div>
        <div style="font-size:22px; font-weight:900; color:${avgColor}; line-height:1;">${avg > 0 ? avg.toFixed(1) : '–'}</div>
      </div>
      <div style="text-align:center;">
        <div style="font-size:9px; font-weight:700; letter-spacing:2px; color:#556677; text-transform:uppercase;">F9 AVG</div>
        <div style="font-size:22px; font-weight:900; color:${f9Color}; line-height:1;">${f9 > 0 ? f9.toFixed(1) : '–'}</div>
      </div>
    `;
  }

  if (cfg.showDoubleQuote !== false) {
    statsItems += `
      <div style="text-align:center;">
        <div style="font-size:9px; font-weight:700; letter-spacing:2px; color:#556677; text-transform:uppercase;">DOPPEL</div>
        <div style="font-size:22px; font-weight:900; color:${dblColor}; line-height:1;">${dblRate > 0 ? `${(dblRate * 100).toFixed(0)}%` : '–'}</div>
      </div>
    `;
  }

  if (cfg.showBestLeg !== false) {
    statsItems += `
      <div style="text-align:center;">
        <div style="font-size:9px; font-weight:700; letter-spacing:2px; color:#556677; text-transform:uppercase;">BEST LEG</div>
        <div style="font-size:22px; font-weight:900; color:#00C853; line-height:1;">${bestLeg > 0 ? bestLeg : '–'}</div>
      </div>
    `;
  }

  statsItems += `</div>`;

  return `
    <div style="
      background: rgba(13,27,42,0.95);
      border: 2px solid #1a3a5c;
      border-top: 4px solid #E8002D;
      border-radius: 8px;
      padding: 10px 20px 12px;
      box-shadow: 0 4px 30px rgba(0,0,0,0.7);
      margin-bottom: 8px;
      min-width: 280px;
    ">
      <div style="
        font-size: 11px;
        font-weight: 900;
        letter-spacing: 3px;
        color: #E8002D;
        text-transform: uppercase;
        margin-bottom: 8px;
        text-align: center;
      ">${escapeHtml(name.toUpperCase())}</div>
      ${statsItems}
    </div>
  `;
}

function buildCheckoutHtml(score: number, checkout: string): string {
  const darts = checkout.split(' · ');
  const dartsHtml = darts.map(dart => {
    let color = '#e8eaf0';
    if (dart.startsWith('T')) color = '#F5C842';
    else if (dart.startsWith('D')) color = '#00C853';
    else if (dart === 'Bull') color = '#E8002D';
    return `<span style="color:${color}; font-weight:900;">${dart}</span>`;
  }).join(' <span style="color:#334; font-weight:400;">·</span> ');

  const isHigh = score >= 100;
  const borderColor = isHigh ? '#F5C842' : '#00C853';
  const label = isHigh ? '🎯 HIGH CHECKOUT' : '✅ CHECKOUT MÖGLICH';

  return `
    <div style="
      background: rgba(13,27,42,0.95);
      border: 2px solid ${borderColor};
      border-top: 4px solid ${borderColor};
      border-radius: 8px;
      padding: 10px 24px 12px;
      box-shadow: 0 4px 30px rgba(0,0,0,0.7);
      text-align: center;
    ">
      <div style="font-size:9px; font-weight:900; letter-spacing:3px; color:${borderColor}; text-transform:uppercase; margin-bottom:4px;">${label}</div>
      <div style="font-size:36px; font-weight:900; color:#fff; line-height:1; letter-spacing:2px;">${score}</div>
      <div style="font-size:20px; margin-top:6px; letter-spacing:1px;">${dartsHtml}</div>
    </div>
  `;
}

function buildBogeyHtml(score: number): string {
  return `
    <div style="
      background: rgba(13,27,42,0.95);
      border: 2px solid #E8002D;
      border-top: 4px solid #E8002D;
      border-radius: 8px;
      padding: 10px 24px 12px;
      box-shadow: 0 4px 30px rgba(0,0,0,0.7), 0 0 20px rgba(232,0,45,0.3);
      text-align: center;
    ">
      <div style="font-size:9px; font-weight:900; letter-spacing:3px; color:#E8002D; text-transform:uppercase; margin-bottom:4px;">⚠ BOGEY NUMBER</div>
      <div style="font-size:36px; font-weight:900; color:#fff; line-height:1; letter-spacing:2px;">${score}</div>
      <div style="font-size:13px; color:#8899aa; margin-top:4px;">Kein Doppel-Finish möglich!</div>
    </div>
  `;
}

// ─── Overlay ein-/ausblenden ──────────────────────────────────────────────────
function showOverlay(html: string, duration: number): void {
  if (!overlayEl) return;

  overlayEl.innerHTML = html;

  if (hideTimeout) clearTimeout(hideTimeout);

  requestAnimationFrame(() => {
    if (!overlayEl) return;
    overlayEl.style.opacity = '1';
    overlayEl.style.transform = 'translateX(-50%) translateY(0)';
  });

  hideTimeout = setTimeout(() => hideOverlay(), duration);
}

function hideOverlay(): void {
  if (!overlayEl) return;
  overlayEl.style.opacity = '0';
  overlayEl.style.transform = 'translateX(-50%) translateY(20px)';
  if (hideTimeout) { clearTimeout(hideTimeout); hideTimeout = null; }
}
