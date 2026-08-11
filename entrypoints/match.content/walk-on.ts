/**
 * walk-on.ts – Walk-On Song Modul für tools-for-autodarts
 *
 * Ablauf beim Match-Start:
 *  1. Erkennt den ersten Wurf von Spieler 0 in Runde 1 (identisch mit dem
 *     bestehenden "gameon"-Trigger in caller.ts)
 *  2. Spielt den Walk-On Song des Heimspielers (Spieler 0) ab
 *  3. Wartet bis der Song endet (oder die konfigurierte Dauer abläuft)
 *  4. Spielt dann den Walk-On Song des Gastspielers (Spieler 1) ab
 *  5. Gibt danach die Kontrolle an den normalen Caller zurück
 *
 * Das Modul folgt dem Standard-Muster der anderen Match-Module:
 *  - Exportiert walkOn() zum Starten
 *  - Exportiert walkOnOnRemove() zum sauberen Aufräumen
 */

import { AutodartsToolsConfig, type IConfig, type IWalkonPlayer } from "@/utils/storage";
import type { IGameData } from "@/utils/game-data-storage";

// ─── Modul-Zustand ────────────────────────────────────────────────────────────

let config: IConfig;
let gameDataWatcherUnwatch: (() => void) | null = null;
let walkonPlayed = false;          // Verhindert doppeltes Abspielen pro Match
let currentAudio: HTMLAudioElement | null = null;
let walkonActive = false;          // Blockiert den Caller während des Walk-Ons

// ─── Öffentliche API ──────────────────────────────────────────────────────────

/**
 * Startet das Walk-On Modul. Wird von index.ts aufgerufen wenn ein Match beginnt.
 */
export async function walkOn(): Promise<void> {
  console.log("Autodarts Tools: Walk-On Modul gestartet");
  config = await AutodartsToolsConfig.getValue();

  if (!config.walkon?.enabled) return;

  walkonPlayed = false;
  walkonActive = false;

  // Auf Game-Data-Änderungen hören (identisch mit caller.ts / sound-fx.ts)
  gameDataWatcherUnwatch = AutodartsToolsGameData.watch(
    async (gameData: IGameData, oldGameData: IGameData) => {
      await processGameData(gameData, oldGameData);
    },
  );
}

/**
 * Räumt alle Ressourcen auf. Wird von clearMatch() in index.ts aufgerufen.
 */
export function walkOnOnRemove(): void {
  console.log("Autodarts Tools: Walk-On Modul entfernt");
  gameDataWatcherUnwatch?.();
  gameDataWatcherUnwatch = null;
  stopCurrentAudio();
  walkonPlayed = false;
  walkonActive = false;
}

/**
 * Gibt zurück ob der Walk-On gerade aktiv ist.
 * Kann vom Caller genutzt werden um das "gameon" zu verzögern.
 */
export function isWalkOnActive(): boolean {
  return walkonActive;
}

// ─── Interne Logik ────────────────────────────────────────────────────────────

async function processGameData(gameData: IGameData, _oldGameData: IGameData): Promise<void> {
  if (!gameData?.match || !gameData.match.turns?.length) return;

  // Edit-Modus ignorieren
  const editMode = gameData.match.activated !== undefined && gameData.match.activated >= 0;
  if (editMode) return;

  // Bull-off ignorieren
  if (gameData.match.variant === "Bull-off") return;

  // Nur beim allerersten Moment des Matches auslösen:
  // Runde 1, kein Wurf noch geworfen, Spieler 0 ist dran
  const isMatchStart = (
    gameData.match.round === 1
    && gameData.match.turns[0].throws.length === 0
    && gameData.match.player === 0
    && !walkonPlayed
  );

  if (!isMatchStart) return;

  walkonPlayed = true;
  walkonActive = true;

  const players = config.walkon.players ?? [];
  const volume = (config.walkon.volume ?? 75) / 100;
  const duration = (config.walkon.duration ?? 15) * 1000; // in ms

  // Spielernamen aus den Match-Daten holen
  const matchPlayers = gameData.match.players ?? [];

  // ── Heimspieler (Index 0) ────────────────────────────────────────────────
  const homeConfig = players.find(p => p.playerId === 'home') ?? players[0];
  if (homeConfig && (homeConfig.base64 || homeConfig.url)) {
    const homeName = matchPlayers[0]?.name ?? homeConfig.playerName ?? 'Spieler 1';
    await playWalkOnSong(homeConfig, homeName, volume, duration);
  }

  // ── Gastspieler (Index 1) ────────────────────────────────────────────────
  const guestConfig = players.find(p => p.playerId === 'guest') ?? players[1];
  if (guestConfig && (guestConfig.base64 || guestConfig.url)) {
    const guestName = matchPlayers[1]?.name ?? guestConfig.playerName ?? 'Spieler 2';
    await playWalkOnSong(guestConfig, guestName, volume, duration);
  }

  walkonActive = false;
  console.log("Autodarts Tools: Walk-On abgeschlossen, Caller kann starten");
}

/**
 * Spielt einen einzelnen Walk-On Song ab und wartet bis er endet.
 */
async function playWalkOnSong(
  player: IWalkonPlayer,
  playerName: string,
  volume: number,
  maxDurationMs: number,
): Promise<void> {
  return new Promise<void>((resolve) => {
    console.log(`Autodarts Tools: Walk-On für "${playerName}" – Song: "${player.songName}"`);

    stopCurrentAudio();

    const audio = new Audio();
    currentAudio = audio;
    audio.volume = Math.min(1, Math.max(0, volume));

    // Quelle setzen: eigene Base64-Datei hat Vorrang vor URL
    if (player.base64) {
      audio.src = player.base64;
    } else if (player.url) {
      audio.src = player.url;
    } else {
      resolve();
      return;
    }

    // Overlay-Banner anzeigen (PDC-Style)
    const banner = showWalkOnBanner(playerName, player.songName, player.songArtist);

    // Timeout: Song nach konfigurierter Dauer abbrechen
    const timeout = setTimeout(() => {
      audio.pause();
      audio.src = '';
      banner.remove();
      resolve();
    }, maxDurationMs);

    audio.addEventListener('ended', () => {
      clearTimeout(timeout);
      banner.remove();
      resolve();
    });

    audio.addEventListener('error', (e) => {
      console.error("Autodarts Tools: Walk-On Audio Fehler", e);
      clearTimeout(timeout);
      banner.remove();
      resolve();
    });

    audio.play().catch((error) => {
      console.error("Autodarts Tools: Walk-On konnte nicht abgespielt werden", error);
      clearTimeout(timeout);
      banner.remove();
      resolve();
    });
  });
}

function stopCurrentAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
}

// ─── Walk-On Banner (PDC-Style Overlay) ──────────────────────────────────────

/**
 * Zeigt ein PDC-Style Overlay-Banner mit Spielername und Song-Info an.
 * Wird automatisch entfernt wenn der Song endet.
 */
function showWalkOnBanner(playerName: string, songName: string, songArtist: string): HTMLElement {
  // Vorhandenes Banner entfernen
  document.getElementById('adt-walkon-banner')?.remove();

  const banner = document.createElement('div');
  banner.id = 'adt-walkon-banner';
  banner.innerHTML = `
    <div class="adt-walkon-inner">
      <div class="adt-walkon-label">WALK-ON</div>
      <div class="adt-walkon-player">${escapeHtml(playerName)}</div>
      <div class="adt-walkon-song">
        <span class="adt-walkon-note">♪</span>
        ${escapeHtml(songName)}${songArtist ? ` – ${escapeHtml(songArtist)}` : ''}
      </div>
      <div class="adt-walkon-bar"></div>
    </div>
  `;

  // Styles direkt einbetten (kein externes CSS nötig)
  const style = document.createElement('style');
  style.id = 'adt-walkon-style';
  style.textContent = `
    #adt-walkon-banner {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 99999;
      pointer-events: none;
      font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
      animation: adt-walkon-slide-in 0.4s ease-out;
    }
    @keyframes adt-walkon-slide-in {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    .adt-walkon-inner {
      background: linear-gradient(135deg, #0D1B2A 0%, #1a2d42 50%, #0D1B2A 100%);
      border-top: 4px solid #E8002D;
      padding: 16px 32px 20px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .adt-walkon-label {
      font-size: 13px;
      font-weight: 900;
      letter-spacing: 4px;
      color: #E8002D;
      text-transform: uppercase;
    }
    .adt-walkon-player {
      font-size: 42px;
      font-weight: 900;
      color: #FFFFFF;
      text-transform: uppercase;
      letter-spacing: 2px;
      line-height: 1;
      text-shadow: 0 2px 12px rgba(232,0,45,0.4);
    }
    .adt-walkon-song {
      font-size: 20px;
      font-weight: 600;
      color: #F5C842;
      letter-spacing: 1px;
    }
    .adt-walkon-note {
      margin-right: 6px;
      font-size: 22px;
    }
    .adt-walkon-bar {
      margin-top: 10px;
      height: 3px;
      background: linear-gradient(90deg, #E8002D, #F5C842, #E8002D);
      border-radius: 2px;
      animation: adt-walkon-shimmer 2s linear infinite;
      background-size: 200% 100%;
    }
    @keyframes adt-walkon-shimmer {
      0%   { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `;

  // Alten Style entfernen falls vorhanden
  document.getElementById('adt-walkon-style')?.remove();
  document.head.appendChild(style);
  document.body.appendChild(banner);

  return banner;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
