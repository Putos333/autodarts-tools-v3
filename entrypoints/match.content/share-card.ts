/**
 * share-card.ts – Generiert nach Match-Ende eine 1080x1920 Share-Card (v2.9.74).
 *
 * Enthält: Match-Score, Sets/Legs, First-9, 180-Count, Best-Leg-Average,
 * Duo-Kommentator-Signatur, Precision-Map-Miniatur.
 * Nutzer kann per Web-Share-API oder Download teilen.
 */

import { AutodartsToolsConfig } from "@/utils/storage";
import { AutodartsToolsGameData, type IGameData } from "@/utils/game-data-storage";
import { getUserIdFromToken } from "@/utils/helpers";
import { getThrows, computeStats } from "@/utils/heatmap-storage";
import { submitMatch, getIdentity, type EloSubmitResponse } from "@/utils/elo-client";
import { didMatchJustFinish } from "@/utils/match-finish";

let unwatch: (() => void) | null = null;
let alreadyShown = false;
let ownUserId: string | null = null;
let cardEl: HTMLDivElement | null = null;

export async function shareCard(): Promise<void> {
  const cfg = await AutodartsToolsConfig.getValue();
  if (!cfg.precisionMap?.shareCardEnabled) return;
  alreadyShown = false;
  ownUserId = await getUserIdFromToken();
  unwatch = AutodartsToolsGameData.watch((gd: IGameData, old: IGameData) => onGameData(gd, old).catch(() => {}));
}

export function shareCardOnRemove(): void {
  unwatch?.();
  unwatch = null;
  removeCard();
  alreadyShown = false;
}

async function onGameData(gd: IGameData, old: IGameData): Promise<void> {
  if (alreadyShown) return;
  const match = gd?.match;
  if (!match) return;
  // Match hat gerade geendet.
  if (!didMatchJustFinish(old?.match?.winner, match.winner)) return;

  alreadyShown = true;
  await renderCard(match).catch(err => console.warn("ShareCard: Fehler", err));
}

async function renderCard(match: any): Promise<void> {
  const cfg = await AutodartsToolsConfig.getValue();
  const players = match.players ?? [];
  const winner = players[match.winner];
  const winnerName = winner?.name ?? "Sieger";
  const ownIndex = ownUserId ? players.findIndex((p: any) => p.userId === ownUserId) : -1;
  if (ownIndex < 0) return; // Identity not resolved — don't render share card
  const own = players[ownIndex];
  const ownName = own?.name ?? "Du";
  const stats = match.stats?.[ownIndex] ?? {};
  const avg = (stats.matchStats?.average ?? stats.legStats?.average ?? 0);
  const first9 = (stats.matchStats?.first9Average ?? 0);
  const t180 = stats.matchStats?.total180 ?? 0;
  const bestLeg = (stats.matchStats?.bestLegAverage ?? 0);
  const isOwnWinner = match.winner === ownIndex;

  const throws = await getThrows({ sinceTs: Date.now() - 4 * 60 * 60 * 1000, limit: 300 });
  const hstats = computeStats(throws);

  // ── v2.9.75 – ELO-Submit (anonym) ─────────────────────────────────────
  let eloBadge: EloSubmitResponse | null = null;
  if (cfg.elo?.enabled && cfg.elo?.submitEnabled) {
    try {
      const identity = await getIdentity();
      const dn = (cfg.elo?.displayName || identity.displayName || ownName || "Anonymous").slice(0, 24);
      eloBadge = await submitMatch(cfg.elo?.backendUrl ?? "", {
        displayName: dn,
        result: isOwnWinner ? 1 : 0,
        matchAvg: avg,
        total180: t180,
        highFinish: stats.matchStats?.highFinish ?? undefined,
      });
    } catch (e) {
      console.warn("ELO submit failed", e);
    }
  }

  // Canvas rendering
  const c = document.createElement("canvas");
  c.width = 1080;
  c.height = 1920;
  const ctx = c.getContext("2d")!;
  drawGradient(ctx, 1080, 1920);

  // Header
  ctx.fillStyle = "#F5C842";
  ctx.font = "bold 44px 'Barlow Condensed', sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("🎯 TOOLS FÜR AUTODARTS", 80, 110);

  ctx.font = "900 96px 'Barlow Condensed', sans-serif";
  ctx.fillStyle = "#e8eaf0";
  ctx.fillText("MATCH REPORT", 80, 210);

  ctx.font = "bold 46px 'Barlow Condensed', sans-serif";
  ctx.fillStyle = "#8899aa";
  ctx.fillText(new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }), 80, 270);

  // Winner Banner
  ctx.fillStyle = "#E8002D";
  ctx.fillRect(60, 320, 960, 160);
  ctx.font = "900 72px 'Barlow Condensed', sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText("🏆  " + winnerName.toUpperCase(), 540, 420);
  ctx.font = "bold 32px 'Barlow Condensed', sans-serif";
  ctx.fillText("SIEGER  ·  " + (own?.name ? `Dein Match: ${ownName}` : "Match-Report"), 540, 465);

  // Stat-Kacheln
  const fmt = (n: number) => n.toFixed(1).replace(".", ",");
  const statTiles: { label: string; value: string; color: string }[] = [
    { label: "AVERAGE", value: fmt(avg), color: "#F5C842" },
    { label: "FIRST-9", value: fmt(first9), color: "#00C853" },
    { label: "180er", value: String(t180), color: "#E8002D" },
    { label: "BEST LEG", value: fmt(bestLeg), color: "#F5A742" },
  ];
  statTiles.forEach((s, i) => {
    const x = 80 + (i % 2) * 480;
    const y = 550 + Math.floor(i / 2) * 220;
    ctx.fillStyle = "#0a1520";
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 4;
    ctx.fillRect(x, y, 440, 190);
    ctx.strokeRect(x, y, 440, 190);
    ctx.font = "bold 24px 'Barlow Condensed', sans-serif";
    ctx.fillStyle = "#8899aa";
    ctx.textAlign = "left";
    ctx.fillText(s.label, x + 30, y + 50);
    ctx.font = "900 110px 'Barlow Condensed', sans-serif";
    ctx.fillStyle = s.color;
    ctx.fillText(s.value, x + 30, y + 160);
  });

  // Heatmap-Sektion
  const hmY = 1020;
  ctx.fillStyle = "#F5C842";
  ctx.textAlign = "left";
  ctx.font = "bold 40px 'Barlow Condensed', sans-serif";
  ctx.fillText("🎯 PRECISION MAP", 80, hmY);
  ctx.font = "24px 'Barlow Condensed', sans-serif";
  ctx.fillStyle = "#8899aa";
  ctx.fillText(`${hstats.total} Würfe · Ø-Streuung T20: ${hstats.avgOffsetMm} mm`, 80, hmY + 40);
  drawMiniBoard(ctx, 540, hmY + 350, 260, throws);

  // Zone Stats unter Board
  const zoneY = hmY + 660;
  const zones = [
    { label: "T20", v: hstats.t20Hits, c: "#E8002D" },
    { label: "T19", v: hstats.t19Hits, c: "#F5A742" },
    { label: "BULL", v: hstats.bullHits + hstats.bullseyeHits, c: "#00C853" },
    { label: "D-HIT", v: hstats.totalDoubles, c: "#F5C842" },
  ];
  zones.forEach((z, i) => {
    const x = 80 + i * 240;
    ctx.fillStyle = "#0a1520";
    ctx.strokeStyle = z.c;
    ctx.lineWidth = 3;
    ctx.fillRect(x, zoneY, 220, 130);
    ctx.strokeRect(x, zoneY, 220, 130);
    ctx.textAlign = "center";
    ctx.font = "bold 22px 'Barlow Condensed', sans-serif";
    ctx.fillStyle = "#8899aa";
    ctx.fillText(z.label, x + 110, zoneY + 40);
    ctx.font = "900 62px 'Barlow Condensed', sans-serif";
    ctx.fillStyle = z.c;
    ctx.fillText(String(z.v), x + 110, zoneY + 110);
  });

  // Footer
  ctx.font = "bold 28px 'Barlow Condensed', sans-serif";
  ctx.fillStyle = "#F5C842";
  ctx.textAlign = "center";
  ctx.fillText("Powered by TOOLS FÜR AUTODARTS · v2.9.76", 540, 1830);
  ctx.font = "24px 'Barlow Condensed', sans-serif";
  ctx.fillStyle = "#8899aa";
  ctx.fillText("Duo-Kommentator · KI-Coach · Precision Map · ELO", 540, 1870);

  // ─── ELO-Badge (falls Submit erfolgreich) ─────────────────────────────
  if (eloBadge) {
    const bx = 540 - 340;
    const by = 830;
    ctx.fillStyle = "#0a1520";
    ctx.strokeStyle = eloBadge.delta >= 0 ? "#00C853" : "#E8002D";
    ctx.lineWidth = 4;
    ctx.fillRect(bx, by, 680, 130);
    ctx.strokeRect(bx, by, 680, 130);
    ctx.textAlign = "left";
    ctx.font = "bold 22px 'Barlow Condensed', sans-serif";
    ctx.fillStyle = "#8899aa";
    ctx.fillText("🌍 GLOBAL ELO-LADDER", bx + 24, by + 32);
    ctx.font = "900 62px 'Barlow Condensed', sans-serif";
    ctx.fillStyle = eloBadge.delta >= 0 ? "#00C853" : "#E8002D";
    ctx.fillText(String(eloBadge.new_rating), bx + 24, by + 100);
    ctx.font = "bold 30px 'Barlow Condensed', sans-serif";
    ctx.fillStyle = "#F5C842";
    ctx.textAlign = "right";
    ctx.fillText(`RANG #${eloBadge.rank}`, bx + 656, by + 60);
    ctx.font = "bold 22px 'Barlow Condensed', sans-serif";
    ctx.fillStyle = "#8899aa";
    ctx.fillText(`von ${eloBadge.total_players} Spielern`, bx + 656, by + 92);
    ctx.font = "bold 26px 'Barlow Condensed', sans-serif";
    ctx.fillStyle = eloBadge.delta >= 0 ? "#00C853" : "#E8002D";
    ctx.fillText((eloBadge.delta >= 0 ? "+" : "") + String(eloBadge.delta), bx + 656, by + 125);
    ctx.textAlign = "left";
  }

  const dataUrl = c.toDataURL("image/png");
  const shareText = buildShareText({
    winnerName: isOwnWinner ? ownName : winnerName,
    won: isOwnWinner,
    avg,
    total180: t180,
    highFinish: stats.matchStats?.highFinish,
    eloBadge,
    language: (cfg.aiCommentator?.language ?? "de"),
  });
  showCardModal(dataUrl, shareText);
  // Zusätzlich zum Config-Auto-Show
  void cfg;
}

/**
 * Baut den vorgefertigten Share-Text für Social-Media-Posts.
 * Länge < 240 Zeichen (X-Limit auch bei mehreren Handles).
 */
function buildShareText(opts: {
  winnerName: string;
  won: boolean;
  avg: number;
  total180: number;
  highFinish?: number;
  eloBadge: EloSubmitResponse | null;
  language: "de" | "en";
}): string {
  const parts: string[] = [];
  const emoji = opts.won ? "🏆" : "🎯";
  const de = opts.language === "de";
  if (opts.eloBadge) {
    const sign = opts.eloBadge.delta >= 0 ? "+" : "";
    const line = de
      ? `${emoji} ${sign}${opts.eloBadge.delta} ELO → Rang #${opts.eloBadge.rank} von ${opts.eloBadge.total_players}`
      : `${emoji} ${sign}${opts.eloBadge.delta} ELO → Rank #${opts.eloBadge.rank} of ${opts.eloBadge.total_players}`;
    parts.push(line);
  } else if (opts.won) {
    parts.push(de ? `🏆 Match gewonnen!` : `🏆 Match won!`);
  }
  const avgStr = opts.avg.toFixed(1).replace(".", ",");
  parts.push(de
    ? `⚡ Ø ${avgStr} · ${opts.total180}× 180${opts.highFinish ? ` · High-Finish ${opts.highFinish}` : ""}`
    : `⚡ Avg ${avgStr} · ${opts.total180}× 180${opts.highFinish ? ` · High Finish ${opts.highFinish}` : ""}`);
  parts.push(de
    ? `Live-Ladder: autodarts-tools.emergent.host  #Darts #Autodarts`
    : `Live ladder: autodarts-tools.emergent.host  #Darts #Autodarts`);
  return parts.join("\n");
}

function drawGradient(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#0D1B2A");
  g.addColorStop(1, "#000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function drawMiniBoard(ctx: CanvasRenderingContext2D, cx: number, cy: number, radiusPx: number, throws: any[]) {
  const R_DOUBLE_OUT = 170;
  const scale = radiusPx / R_DOUBLE_OUT;
  ctx.save();
  // Doppel
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.arc(cx, cy, 170 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2a2a2a";
  ctx.beginPath(); ctx.arc(cx, cy, 162 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#1e3a5f";
  ctx.beginPath(); ctx.arc(cx, cy, 107 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2a2a2a";
  ctx.beginPath(); ctx.arc(cx, cy, 99 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#00C853";
  ctx.beginPath(); ctx.arc(cx, cy, 15.9 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#E8002D";
  ctx.beginPath(); ctx.arc(cx, cy, 6.35 * scale, 0, Math.PI * 2); ctx.fill();

  // Throws
  for (const t of throws) {
    if (typeof t.x !== "number") continue;
    const color =
      t.multiplier === 3 ? "#E8002D"
      : t.multiplier === 2 ? "#F5C842"
      : t.points === 0 ? "#3a5a8a"
      : "#F5A742";
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(cx + t.x * scale, cy + t.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function showCardModal(dataUrl: string, shareText: string) {
  removeCard();
  cardEl = document.createElement("div");
  cardEl.setAttribute("data-testid", "share-card-modal");
  cardEl.style.cssText = `
    position: fixed; inset: 0; z-index: 999999;
    background: rgba(0,0,0,0.85); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; box-sizing: border-box;
  `;
  const shareUrl = "https://autodarts-tools.emergent.host";
  const encText = encodeURIComponent(shareText);
  const encUrl = encodeURIComponent(shareUrl);
  const socialLinks = {
    twitter: `https://twitter.com/intent/tweet?text=${encText}`,
    bluesky: `https://bsky.app/intent/compose?text=${encText}`,
    whatsapp: `https://wa.me/?text=${encText}`,
    telegram: `https://t.me/share/url?url=${encUrl}&text=${encText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}&quote=${encText}`,
    reddit: `https://www.reddit.com/submit?title=${encodeURIComponent("Mein Autodarts-Match")}&text=${encText}`,
  };

  cardEl.innerHTML = `
    <div style="max-width: 560px; width: 100%; background: #0D1B2A; border-radius: 8px; padding: 20px; border: 2px solid #E8002D; display: flex; flex-direction: column; gap: 12px; color: #e8eaf0; font-family: 'Barlow Condensed', sans-serif; max-height: 92vh; overflow-y: auto;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <div style="font-size:20px; font-weight:800; letter-spacing:2px; text-transform:uppercase; color:#F5C842;">🎯 Match Report bereit!</div>
        <button data-testid="share-card-close" style="background:none;border:none;color:#8899aa;font-size:24px;cursor:pointer;">×</button>
      </div>
      <img src="${dataUrl}" alt="Match Report" style="max-height: 48vh; width: auto; margin: 0 auto; border-radius: 4px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);" />
      <div data-testid="share-card-text" style="background:#0a1520; border:1px solid #1e3a5f; border-left:3px solid #F5C842; border-radius:0 4px 4px 0; padding:10px 12px; font-size:13px; color:#c8d4e0; line-height:1.6; white-space:pre-wrap;">${escapeHtml(shareText)}</div>
      <div style="display:grid; grid-template-columns:repeat(6, 1fr); gap:6px;">
        <a data-testid="share-x" href="${socialLinks.twitter}" target="_blank" rel="noopener" title="Auf X (Twitter) teilen"
          style="text-align:center; padding:12px 0; background:#000; color:#fff; border-radius:4px; text-decoration:none; font-size:18px;">𝕏</a>
        <a data-testid="share-bluesky" href="${socialLinks.bluesky}" target="_blank" rel="noopener" title="Auf Bluesky teilen"
          style="text-align:center; padding:12px 0; background:#0085FF; color:#fff; border-radius:4px; text-decoration:none; font-size:18px;">☁</a>
        <a data-testid="share-whatsapp" href="${socialLinks.whatsapp}" target="_blank" rel="noopener" title="Auf WhatsApp teilen"
          style="text-align:center; padding:12px 0; background:#25D366; color:#fff; border-radius:4px; text-decoration:none; font-size:18px;">💬</a>
        <a data-testid="share-telegram" href="${socialLinks.telegram}" target="_blank" rel="noopener" title="Auf Telegram teilen"
          style="text-align:center; padding:12px 0; background:#26A5E4; color:#fff; border-radius:4px; text-decoration:none; font-size:18px;">✈</a>
        <a data-testid="share-facebook" href="${socialLinks.facebook}" target="_blank" rel="noopener" title="Auf Facebook teilen"
          style="text-align:center; padding:12px 0; background:#1877F2; color:#fff; border-radius:4px; text-decoration:none; font-size:18px;">f</a>
        <a data-testid="share-reddit" href="${socialLinks.reddit}" target="_blank" rel="noopener" title="Auf Reddit teilen"
          style="text-align:center; padding:12px 0; background:#FF4500; color:#fff; border-radius:4px; text-decoration:none; font-size:18px;">R</a>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button data-testid="share-card-copy-text" style="flex:1; padding:10px; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; border-radius:4px; font-weight:700; letter-spacing:1px; text-transform:uppercase; cursor:pointer; font-size:12px;">📋 Text kopieren</button>
        <button data-testid="share-card-download" style="flex:1; padding:10px; background:#E8002D; color:#fff; border:none; border-radius:4px; font-weight:800; letter-spacing:1px; text-transform:uppercase; cursor:pointer; font-size:12px;">⬇️ Bild-Download</button>
        <button data-testid="share-card-share" style="flex:1; padding:10px; background:#00C853; color:#fff; border:none; border-radius:4px; font-weight:800; letter-spacing:1px; text-transform:uppercase; cursor:pointer; font-size:12px;">📤 System-Teilen</button>
      </div>
      <div style="font-size:11px; color:#8899aa; text-align:center;">Powered by KI-Coach · Precision Map · ELO-Ladder</div>
    </div>
  `;
  document.body.appendChild(cardEl);
  cardEl.querySelector('[data-testid="share-card-close"]')?.addEventListener("click", removeCard);
  cardEl.querySelector('[data-testid="share-card-download"]')?.addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `autodarts-match-report-${Date.now()}.png`;
    a.click();
  });
  cardEl.querySelector('[data-testid="share-card-copy-text"]')?.addEventListener("click", async (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    try {
      await navigator.clipboard.writeText(shareText);
      const original = btn.innerHTML;
      btn.innerHTML = "✅ Kopiert!";
      setTimeout(() => { btn.innerHTML = original; }, 2000);
    } catch (e) { console.warn("Clipboard denied", e); }
  });
  cardEl.querySelector('[data-testid="share-card-share"]')?.addEventListener("click", async () => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "match-report.png", { type: "image/png" });
      if ((navigator as any).canShare?.({ files: [file] })) {
        await (navigator as any).share({
          files: [file],
          title: "Autodarts Match Report",
          text: shareText,
        });
      } else {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = "match-report.png";
        a.click();
      }
    } catch (e) { console.warn("Share failed", e); }
  });
  cardEl.addEventListener("click", (e) => {
    if (e.target === cardEl) removeCard();
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function removeCard() {
  cardEl?.remove();
  cardEl = null;
}
