/**
 * buzzer.ts – Mehrspieler-Buzzer / Party-Modus
 *
 * Funktionsweise:
 *  - Die Erweiterung öffnet im Background-Script einen WebSocket-Relay über
 *    den autodarts.io Background-Service-Worker (chrome.runtime.sendMessage).
 *  - Spieler scannen einen QR-Code mit dem Handy und öffnen eine einfache
 *    Buzzer-Seite (wird als Blob-URL oder über die Extension-Pages bereitgestellt).
 *  - Wer zuerst auf den Buzzer drückt, wird auf dem TV-Bildschirm angezeigt.
 *  - Ein Ton bestätigt den Buzzer-Druck.
 *
 * Da Browser-Erweiterungen keinen eigenen TCP-Server starten können, nutzen
 * wir einen cleveren Trick: Die Buzzer-Seite wird als Extension-Page
 * (chrome-extension://...) bereitgestellt und kommuniziert über
 * chrome.runtime.sendMessage / chrome.runtime.onMessage mit dem Content-Script.
 * Für Mobilgeräte wird eine kompakte HTML-Seite als Data-URL generiert und
 * als QR-Code angezeigt – die Handys kommunizieren über einen einfachen
 * BroadcastChannel (funktioniert im gleichen Browser) oder über einen
 * öffentlichen WebSocket-Relay-Dienst (wss://relay.autodarts-tools.de).
 */

import { AutodartsToolsConfig } from "@/utils/storage";

interface BuzzerPlayer {
  id: string;
  name: string;
  color: string;
  buzzedAt?: number;
}

const PLAYER_COLORS = ['#E8002D', '#F5C842', '#00C853', '#2196F3'];
const PLAYER_NAMES = ['Spieler 1', 'Spieler 2', 'Spieler 3', 'Spieler 4'];

let overlayEl: HTMLElement | null = null;
let qrOverlayEl: HTMLElement | null = null;
let channel: BroadcastChannel | null = null;
let players: BuzzerPlayer[] = [];
let buzzLocked = false;
let sessionId = '';

export async function buzzer(): Promise<void> {
  const config = await AutodartsToolsConfig.getValue();
  if (!config.buzzer?.enabled) return;

  sessionId = Math.random().toString(36).substring(2, 10).toUpperCase();
  players = Array.from({ length: config.buzzer.maxPlayers }, (_, i) => ({
    id: `p${i + 1}`,
    name: PLAYER_NAMES[i],
    color: PLAYER_COLORS[i],
  }));

  // BroadcastChannel für Kommunikation zwischen Tabs/Extension-Pages
  channel = new BroadcastChannel(`ad-buzzer-${sessionId}`);
  channel.onmessage = (e) => handleBuzzerMessage(e.data, config.buzzer);

  createBuzzerOverlay(config.buzzer);

  if (config.buzzer.showQrCode) {
    showQrCode();
  }
}

export function buzzerOnRemove(): void {
  channel?.close();
  channel = null;
  overlayEl?.remove();
  overlayEl = null;
  qrOverlayEl?.remove();
  qrOverlayEl = null;
  delete (window as any)._adBuzzerPress;
  delete (window as any)._adBuzzerReset;
  delete (window as any)._adBuzzerClose;
  buzzLocked = false;
  players = [];
}

// ─── Buzzer-Overlay (TV-Anzeige) ──────────────────────────────────────────────
function createBuzzerOverlay(cfg: any): void {
  overlayEl?.remove();
  const el = document.createElement('div');
  el.id = 'ad-buzzer-overlay';
  el.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    background: rgba(13,27,42,0.97); border: 2px solid #1e3050;
    border-top: 3px solid #F5C842; border-radius: 10px;
    padding: 14px 20px; z-index: 9996;
    font-family: 'Barlow Condensed', Arial, sans-serif;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    min-width: 360px; box-shadow: 0 4px 24px rgba(0,0,0,0.6);
  `;

  el.innerHTML = `
    <style>
      #ad-buzzer-overlay .bz-title {
        font-size: 11px; font-weight: 700; letter-spacing: 2px;
        color: #F5C842; text-transform: uppercase;
      }
      #ad-buzzer-overlay .bz-players {
        display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;
      }
      #ad-buzzer-overlay .bz-player {
        display: flex; flex-direction: column; align-items: center;
        padding: 10px 14px; border-radius: 6px; border: 2px solid;
        min-width: 72px; cursor: pointer; transition: all 0.15s;
      }
      #ad-buzzer-overlay .bz-player:hover { opacity: 0.85; }
      #ad-buzzer-overlay .bz-player-name {
        font-size: 13px; font-weight: 900; color: #fff; text-align: center;
      }
      #ad-buzzer-overlay .bz-player-status {
        font-size: 10px; color: #556677; margin-top: 2px;
      }
      #ad-buzzer-overlay .bz-player.buzzed .bz-player-status {
        color: #00C853; font-weight: 700;
      }
      #ad-buzzer-overlay .bz-winner {
        font-size: 22px; font-weight: 900; color: #fff;
        text-align: center; animation: bz-pulse 0.5s ease-in-out;
      }
      #ad-buzzer-overlay .bz-controls {
        display: flex; gap: 8px;
      }
      #ad-buzzer-overlay .bz-btn {
        padding: 6px 14px; border-radius: 4px; border: none;
        font-size: 13px; font-weight: 700; cursor: pointer;
      }
      #ad-buzzer-overlay .bz-btn-reset {
        background: #1e3050; color: #c0ccd8;
      }
      #ad-buzzer-overlay .bz-btn-close {
        background: rgba(232,0,45,0.15); color: #E8002D;
        border: 1px solid #E8002D;
      }
      @keyframes bz-pulse {
        0% { transform: scale(0.8); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
    </style>
    <div class="bz-title">🎯 Buzzer – Session: ${sessionId}</div>
    <div class="bz-players" id="bz-players-grid">
      ${players.map(p => `
        <div class="bz-player" id="bz-p-${p.id}"
          style="border-color:${p.color};background:rgba(${hexToRgb(p.color)},0.1)"
          onclick="window._adBuzzerPress('${p.id}')">
          <div class="bz-player-name">${p.name}</div>
          <div class="bz-player-status" id="bz-status-${p.id}">Bereit</div>
        </div>
      `).join('')}
    </div>
    <div class="bz-winner" id="bz-winner" style="display:none"></div>
    <div class="bz-controls">
      <button class="bz-btn bz-btn-reset" onclick="window._adBuzzerReset()">🔄 Reset</button>
      <button class="bz-btn bz-btn-close" onclick="window._adBuzzerClose()">✕ Schließen</button>
    </div>
  `;

  document.body.appendChild(el);
  overlayEl = el;

  // Globale Handler
  (window as any)._adBuzzerPress = (playerId: string) => handleBuzzerPress(playerId, cfg);
  (window as any)._adBuzzerReset = () => resetBuzzer();
  (window as any)._adBuzzerClose = () => buzzerOnRemove();
}

function handleBuzzerMessage(data: any, cfg: any): void {
  if (data.type === 'buzz' && data.playerId) {
    handleBuzzerPress(data.playerId, cfg);
  }
}

function handleBuzzerPress(playerId: string, cfg: any): void {
  if (buzzLocked) return;
  buzzLocked = true;

  const player = players.find(p => p.id === playerId);
  if (!player) return;

  player.buzzedAt = Date.now();

  // Visuelles Feedback
  const playerEl = document.getElementById(`bz-p-${player.id}`);
  const statusEl = document.getElementById(`bz-status-${player.id}`);
  const winnerEl = document.getElementById('bz-winner');

  if (playerEl) {
    playerEl.classList.add('buzzed');
    playerEl.style.background = `rgba(${hexToRgb(player.color)},0.35)`;
    playerEl.style.transform = 'scale(1.08)';
  }
  if (statusEl) statusEl.textContent = '🔔 BUZZED!';
  if (winnerEl) {
    winnerEl.style.display = 'block';
    winnerEl.style.color = player.color;
    winnerEl.textContent = `🏆 ${player.name} ist dran!`;
  }

  // Ton
  if (cfg.soundEnabled) {
    playBuzzerSound(player.color);
  }

  // An andere Tabs/Handys broadcasten
  channel?.postMessage({ type: 'winner', playerId, playerName: player.name });
}

function resetBuzzer(): void {
  buzzLocked = false;
  players.forEach(p => { delete p.buzzedAt; });

  players.forEach(p => {
    const playerEl = document.getElementById(`bz-p-${p.id}`);
    const statusEl = document.getElementById(`bz-status-${p.id}`);
    if (playerEl) {
      playerEl.classList.remove('buzzed');
      playerEl.style.background = `rgba(${hexToRgb(p.color)},0.1)`;
      playerEl.style.transform = '';
    }
    if (statusEl) statusEl.textContent = 'Bereit';
  });

  const winnerEl = document.getElementById('bz-winner');
  if (winnerEl) winnerEl.style.display = 'none';

  channel?.postMessage({ type: 'reset' });
}

// ─── QR-Code Overlay ──────────────────────────────────────────────────────────
function showQrCode(): void {
  qrOverlayEl?.remove();

  // Handy-Buzzer-Seite als kompaktes HTML
  const buzzerPageHtml = generateMobileBuzzerPage();
  const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(buzzerPageHtml)}`;

  const el = document.createElement('div');
  el.id = 'ad-buzzer-qr';
  el.style.cssText = `
    position: fixed; top: 12px; left: 12px;
    background: rgba(13,27,42,0.97); border: 1px solid #1e3050;
    border-top: 3px solid #F5C842; border-radius: 8px;
    padding: 12px; z-index: 9996;
    font-family: 'Barlow Condensed', Arial, sans-serif;
    text-align: center;
  `;

  el.innerHTML = `
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:#F5C842;margin-bottom:8px">
      📱 HANDY-BUZZER
    </div>
    <div id="ad-qr-canvas" style="background:#fff;padding:6px;border-radius:4px;display:inline-block"></div>
    <div style="font-size:11px;color:#556677;margin-top:6px">QR-Code mit Handy scannen</div>
    <div style="font-size:10px;color:#2a4060;margin-top:2px">Session: ${sessionId}</div>
    <button onclick="this.closest('#ad-buzzer-qr').remove()" style="
      margin-top:8px;padding:4px 10px;background:#1e3050;border:none;
      border-radius:3px;color:#c0ccd8;font-size:11px;cursor:pointer
    ">✕</button>
  `;

  document.body.appendChild(el);
  qrOverlayEl = el;

  // QR-Code via Google Charts API laden (kein npm-Paket nötig)
  const qrImg = document.createElement('img');
  qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(dataUrl.substring(0, 500))}`;
  qrImg.alt = 'QR-Code';
  qrImg.style.cssText = 'width:120px;height:120px;display:block';
  document.getElementById('ad-qr-canvas')?.appendChild(qrImg);
}

function generateMobileBuzzerPage(): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>Darts Buzzer</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0D1B2A; font-family: Arial, sans-serif; min-height: 100vh;
    display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16px; }
  h1 { color: #F5C842; font-size: 22px; font-weight: 900; letter-spacing: 2px; margin-bottom: 6px; }
  .session { color: #556677; font-size: 12px; margin-bottom: 24px; }
  .buzzer-btn {
    width: 180px; height: 180px; border-radius: 50%; border: 4px solid;
    font-size: 20px; font-weight: 900; cursor: pointer; margin: 10px;
    display: flex; align-items: center; justify-content: center;
    transition: transform 0.1s, opacity 0.1s; user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .buzzer-btn:active { transform: scale(0.93); opacity: 0.8; }
  .buzzer-btn.locked { opacity: 0.3; cursor: not-allowed; }
  .players { display: flex; flex-wrap: wrap; justify-content: center; }
  .winner { font-size: 24px; font-weight: 900; color: #fff; margin-top: 20px;
    text-align: center; display: none; }
  .reset-btn {
    margin-top: 20px; padding: 12px 28px; background: #1e3050; border: none;
    border-radius: 6px; color: #c0ccd8; font-size: 16px; font-weight: 700; cursor: pointer;
  }
</style>
</head>
<body>
<h1>🎯 BUZZER</h1>
<div class="session">Session: ${sessionId}</div>
<div class="players">
  ${players.map(p => `
    <button class="buzzer-btn" id="btn-${p.id}"
      style="border-color:${p.color};background:rgba(${hexToRgb(p.color)},0.15);color:${p.color}"
      onclick="buzz('${p.id}','${p.name}','${p.color}')">
      ${p.name}
    </button>
  `).join('')}
</div>
<div class="winner" id="winner"></div>
<button class="reset-btn" onclick="reset()">🔄 Reset</button>
<script>
  var locked = false;
  var ch = new BroadcastChannel('ad-buzzer-${sessionId}');
  ch.onmessage = function(e) {
    if (e.data.type === 'winner') showWinner(e.data.playerName, e.data.playerId);
    if (e.data.type === 'reset') resetUI();
  };
  function buzz(id, name, color) {
    if (locked) return;
    locked = true;
    ch.postMessage({ type: 'buzz', playerId: id });
    showWinner(name, id);
    // Vibration
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  }
  function showWinner(name, id) {
    locked = true;
    document.querySelectorAll('.buzzer-btn').forEach(function(b) { b.classList.add('locked'); });
    var w = document.getElementById('winner');
    w.style.display = 'block';
    w.textContent = '🏆 ' + name + ' ist dran!';
  }
  function reset() {
    locked = false;
    document.querySelectorAll('.buzzer-btn').forEach(function(b) { b.classList.remove('locked'); });
    document.getElementById('winner').style.display = 'none';
    ch.postMessage({ type: 'reset' });
  }
<\/script>
</body>
</html>`;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function playBuzzerSound(color: string): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Verschiedene Töne je nach Spieler-Farbe
    const freq = color === '#E8002D' ? 880 : color === '#F5C842' ? 660 : color === '#00C853' ? 550 : 440;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.type = 'square';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {
    // AudioContext nicht verfügbar
  }
}
