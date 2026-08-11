/**
 * clutch-moments.ts – Herzschlag-Modus bei kritischen Match-Situationen
 *
 * Erkennt automatisch, wenn ein Spieler auf einem Doppel zum Matchgewinn steht
 * (Decider Leg, Rest <= 50 und Doppel möglich) und verändert die Atmosphäre:
 *
 * 1. Crowd-Sounds werden auf "angespanntes Flüstern" gedimmt
 * 2. Ein pochendes Herzschlag-Geräusch wird eingespielt
 * 3. Eine dunkle Vignette erscheint am Bildschirmrand ("Tunnelblick")
 * 4. Bei Treffer: Jubel-Explosion
 * 5. Bei Verfehlen: Aufstöhnen + Vignette verschwindet
 */

import { AutodartsToolsConfig } from "@/utils/storage";

// Doppel-Felder (alle auscheckbaren Scores <= 50 auf Doppel)
const DOUBLE_FINISH_SCORES = new Set([
  2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40,
  50, // Bull
]);

let isClutchActive = false;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let vignetteEl: HTMLDivElement | null = null;
let heartbeatAudio: AudioContext | null = null;
let heartbeatGain: GainNode | null = null;
let cleanupFn: (() => void) | null = null;

// ─── Herzschlag-Sound via Web Audio API ──────────────────────────────────────

function createHeartbeat(): { start: () => void; stop: () => void } {
  const ctx = new AudioContext();
  heartbeatAudio = ctx;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(ctx.destination);
  heartbeatGain = gain;

  let running = false;

  function beat() {
    if (!running) return;
    // Erster Schlag
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.connect(g1);
    g1.connect(gain);
    osc1.frequency.value = 55;
    g1.gain.setValueAtTime(0.8, ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.12);

    // Zweiter Schlag (leicht verzögert – "lub-dub")
    setTimeout(() => {
      if (!running) return;
      const osc2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc2.connect(g2);
      g2.connect(gain);
      osc2.frequency.value = 45;
      g2.gain.setValueAtTime(0.5, ctx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.1);
    }, 150);
  }

  return {
    start() {
      running = true;
      gain.gain.value = 0.6;
      beat();
      heartbeatInterval = setInterval(beat, 900); // ~67 BPM
    },
    stop() {
      running = false;
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    },
  };
}

// ─── Vignette (Tunnelblick) ───────────────────────────────────────────────────

function showVignette(intensity: number = 0.6) {
  if (!vignetteEl) {
    vignetteEl = document.createElement("div");
    vignetteEl.id = "adt-clutch-vignette";
    vignetteEl.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 99990;
      transition: opacity 1.5s ease;
      background: radial-gradient(ellipse at center,
        transparent 40%,
        rgba(0,0,0,${intensity}) 100%
      );
      opacity: 0;
    `;
    document.body.appendChild(vignetteEl);
  }
  requestAnimationFrame(() => {
    if (vignetteEl) vignetteEl.style.opacity = "1";
  });
}

function hideVignette() {
  if (vignetteEl) {
    vignetteEl.style.opacity = "0";
    setTimeout(() => {
      vignetteEl?.remove();
      vignetteEl = null;
    }, 1600);
  }
}

// ─── Clutch Banner ────────────────────────────────────────────────────────────

function showClutchBanner(playerName: string, rest: number) {
  const existing = document.getElementById("adt-clutch-banner");
  if (existing) existing.remove();

  // v2.9.97 SEC-001: XSS-Schutz. playerName kommt aus WebSocket-Daten und
  // wird gleich als innerHTML gerendert — muss escaped werden. rest ist ein
  // number, safe.
  const safeName = String(playerName ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const banner = document.createElement("div");
  banner.id = "adt-clutch-banner";
  banner.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 99991;
    background: linear-gradient(135deg, #0D1B2A, #1a0a10);
    border: 2px solid #E8002D;
    border-radius: 6px;
    padding: 12px 28px;
    text-align: center;
    font-family: 'Barlow Condensed', sans-serif;
    animation: clutchPulse 0.9s ease-in-out infinite;
  `;
  banner.innerHTML = `
    <style>
      @keyframes clutchPulse {
        0%, 100% { box-shadow: 0 0 8px rgba(232,0,45,0.4); }
        50% { box-shadow: 0 0 24px rgba(232,0,45,0.9); }
      }
    </style>
    <div style="font-size:11px; color:#8899aa; letter-spacing:2px; text-transform:uppercase; margin-bottom:4px;">
      ❤️ MATCH DART
    </div>
    <div style="font-size:18px; font-weight:700; color:#F5C842; letter-spacing:1px;">
      ${safeName}
    </div>
    <div style="font-size:13px; color:#E8002D; font-weight:700; margin-top:2px;">
      Rest: ${rest} – Doppel zum Sieg!
    </div>
  `;
  document.body.appendChild(banner);
}

function hideClutchBanner() {
  const banner = document.getElementById("adt-clutch-banner");
  if (banner) {
    banner.style.transition = "opacity 0.8s";
    banner.style.opacity = "0";
    setTimeout(() => banner.remove(), 900);
  }
}

// ─── Haupt-Logik ──────────────────────────────────────────────────────────────

let heartbeat: ReturnType<typeof createHeartbeat> | null = null;

export function checkClutchMoment(params: {
  rest: number;
  playerName: string;
  isMatchDart: boolean; // Spieler kann mit diesem Wurf das Match gewinnen
  isDeciderLeg: boolean;
}) {
  const { rest, playerName, isMatchDart, isDeciderLeg } = params;

  const isClutchSituation =
    isMatchDart &&
    isDeciderLeg &&
    DOUBLE_FINISH_SCORES.has(rest);

  if (isClutchSituation && !isClutchActive) {
    isClutchActive = true;

    // Herzschlag starten
    heartbeat = createHeartbeat();
    heartbeat.start();

    // Vignette einblenden
    showVignette(0.65);

    // Banner anzeigen
    showClutchBanner(playerName, rest);

    console.log(`[ClutchMoments] Aktiviert für ${playerName} – Rest: ${rest}`);
  }
}

export function resolveClutch(success: boolean) {
  if (!isClutchActive) return;
  isClutchActive = false;

  // Herzschlag stoppen
  heartbeat?.stop();
  heartbeat = null;

  // Vignette ausblenden
  hideVignette();

  // Banner ausblenden
  hideClutchBanner();

  if (success) {
    // Kurze Explosion: Vignette kurz aufleuchten lassen
    const flash = document.createElement("div");
    flash.style.cssText = `
      position: fixed; top:0; left:0; right:0; bottom:0;
      background: rgba(245,200,66,0.15);
      pointer-events: none; z-index:99992;
      transition: opacity 0.6s;
    `;
    document.body.appendChild(flash);
    setTimeout(() => {
      flash.style.opacity = "0";
      setTimeout(() => flash.remove(), 700);
    }, 300);
  }

  console.log(`[ClutchMoments] Aufgelöst – Erfolg: ${success}`);
}

export function initClutchMoments() {
  console.log("[ClutchMoments] Bereit.");
  cleanupFn = () => {
    resolveClutch(false);
    heartbeatAudio?.close();
  };
}

export function cleanupClutchMoments() {
  cleanupFn?.();
  cleanupFn = null;
}
