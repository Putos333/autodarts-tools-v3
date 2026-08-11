/**
 * handicap.ts – Dynamisches Handicap-System
 *
 * Berechnet automatisch ein faires Handicap basierend auf den
 * historischen Averages beider Spieler und zeigt es als Overlay an.
 *
 * Handicap-Typen:
 * 1. Punkte-Handicap: Stärkerer Spieler startet bei 601, Schwächerer bei 301
 * 2. Leg-Handicap: Stärkerer Spieler muss mehr Legs gewinnen
 * 3. Kein Handicap: Averages liegen nah beieinander (< 10 Punkte Differenz)
 */

import { AutodartsToolsConfig } from "@/utils/storage";

export interface IHandicapResult {
  type: "points" | "legs" | "none";
  strongerPlayer: string;
  weakerPlayer: string;
  strongerStart: number;   // Startpunkte des stärkeren Spielers
  weakerStart: number;     // Startpunkte des schwächeren Spielers
  legDiff: number;         // Zusätzliche Legs die der Stärkere gewinnen muss
  avgDiff: number;         // Average-Differenz
  description: string;     // Erklärung für das UI
}

// ─── Handicap-Berechnung ──────────────────────────────────────────────────────

export function calculateHandicap(params: {
  player1Name: string;
  player1Avg: number;
  player2Name: string;
  player2Avg: number;
  baseScore?: number; // Standard: 501
}): IHandicapResult {
  const { player1Name, player1Avg, player2Name, player2Avg, baseScore = 501 } = params;
  const avgDiff = Math.abs(player1Avg - player2Avg);

  const strongerName = player1Avg >= player2Avg ? player1Name : player2Name;
  const weakerName = player1Avg >= player2Avg ? player2Name : player1Name;
  const strongerAvg = Math.max(player1Avg, player2Avg);
  const weakerAvg = Math.min(player1Avg, player2Avg);

  // Kein Handicap bei geringer Differenz
  if (avgDiff < 8) {
    return {
      type: "none",
      strongerPlayer: strongerName,
      weakerPlayer: weakerName,
      strongerStart: baseScore,
      weakerStart: baseScore,
      legDiff: 0,
      avgDiff,
      description: `Ausgeglichenes Match – kein Handicap nötig (Differenz: ${avgDiff.toFixed(1)})`,
    };
  }

  // Punkte-Handicap: Stärkerer startet höher
  if (avgDiff >= 8 && avgDiff < 25) {
    // Pro 5 Punkte Differenz: 100 Punkte mehr für den Stärkeren
    const extraPoints = Math.floor(avgDiff / 5) * 100;
    const strongerStart = baseScore + extraPoints;

    return {
      type: "points",
      strongerPlayer: strongerName,
      weakerPlayer: weakerName,
      strongerStart,
      weakerStart: baseScore,
      legDiff: 0,
      avgDiff,
      description: `${strongerName} startet bei ${strongerStart}, ${weakerName} bei ${baseScore} (Avg-Differenz: ${avgDiff.toFixed(1)})`,
    };
  }

  // Leg-Handicap bei großer Differenz (>= 25 Punkte)
  const legDiff = Math.floor(avgDiff / 15);
  return {
    type: "legs",
    strongerPlayer: strongerName,
    weakerPlayer: weakerName,
    strongerStart: baseScore,
    weakerStart: baseScore,
    legDiff,
    avgDiff,
    description: `${strongerName} muss ${legDiff} Leg(s) mehr gewinnen (Avg-Differenz: ${avgDiff.toFixed(1)})`,
  };
}

// ─── UI-Overlay ───────────────────────────────────────────────────────────────

export function showHandicapBanner(handicap: IHandicapResult) {
  if (handicap.type === "none") return;

  const existing = document.getElementById("adt-handicap-banner");
  if (existing) existing.remove();

  const banner = document.createElement("div");
  banner.id = "adt-handicap-banner";
  banner.style.cssText = `
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 99985;
    background: linear-gradient(135deg, #0D1B2A, #0a1520);
    border: 2px solid #F5C842;
    border-radius: 6px;
    padding: 14px 24px;
    text-align: center;
    font-family: 'Barlow Condensed', sans-serif;
    min-width: 320px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  `;

  const icon = handicap.type === "points" ? "⚖️" : "🏆";
  const typeLabel = handicap.type === "points" ? "PUNKTE-HANDICAP" : "LEG-HANDICAP";

  // v2.9.97 SEC-001: XSS-Schutz. Player-Namen und description kommen aus User-
  // Konfiguration und werden gleich als innerHTML gerendert.
  const esc = (s: unknown) => String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  let detailHtml = "";
  if (handicap.type === "points") {
    detailHtml = `
      <div style="display:flex; gap:20px; justify-content:center; margin-top:8px;">
        <div>
          <div style="font-size:11px; color:#8899aa;">${esc(handicap.strongerPlayer)}</div>
          <div style="font-size:20px; font-weight:700; color:#E8002D;">${handicap.strongerStart}</div>
        </div>
        <div style="font-size:20px; color:#556677; align-self:center;">vs</div>
        <div>
          <div style="font-size:11px; color:#8899aa;">${esc(handicap.weakerPlayer)}</div>
          <div style="font-size:20px; font-weight:700; color:#00C853;">${handicap.weakerStart}</div>
        </div>
      </div>
    `;
  } else {
    detailHtml = `
      <div style="font-size:13px; color:#c8d4e0; margin-top:8px;">
        ${esc(handicap.strongerPlayer)} muss <strong style="color:#E8002D;">${handicap.legDiff} Leg(s) mehr</strong> gewinnen
      </div>
    `;
  }

  banner.innerHTML = `
    <div style="font-size:11px; color:#F5C842; letter-spacing:2px; text-transform:uppercase; margin-bottom:4px;">
      ${icon} ${typeLabel} AKTIV
    </div>
    ${detailHtml}
    <div style="font-size:11px; color:#556677; margin-top:8px;">${esc(handicap.description)}</div>
    <button onclick="this.parentElement.remove()"
      style="margin-top:10px; background:#E8002D; color:#fff; border:none; padding:6px 16px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:700; letter-spacing:1px;">
      VERSTANDEN
    </button>
  `;

  document.body.appendChild(banner);

  // Auto-ausblenden nach 12 Sekunden
  setTimeout(() => {
    if (banner.parentElement) {
      banner.style.transition = "opacity 1s";
      banner.style.opacity = "0";
      setTimeout(() => banner.remove(), 1100);
    }
  }, 12000);
}

export function hideHandicapBanner() {
  document.getElementById("adt-handicap-banner")?.remove();
}

// ─── Handicap-Scoreboard Anpassung ───────────────────────────────────────────

let handicapActive = false;
let currentHandicap: IHandicapResult | null = null;

export function initHandicap(handicap: IHandicapResult) {
  currentHandicap = handicap;
  handicapActive = handicap.type !== "none";

  if (handicapActive) {
    showHandicapBanner(handicap);
    console.log(`[Handicap] Aktiv: ${handicap.description}`);
  }
}

export function getActiveHandicap(): IHandicapResult | null {
  return handicapActive ? currentHandicap : null;
}

export function cleanupHandicap() {
  handicapActive = false;
  currentHandicap = null;
  hideHandicapBanner();
}
