// v2.9.62: Match-Sticker — PDC-Style Trading Cards
// ---------------------------------------------------------------
// Generiert nach jedem beendeten Match ein teilbares 1080x1080 PNG
// mit Spielerfotos, Score, 180ern, Highest Checkout und Best Average.
// Zufällige Farbschemata; seltene "Legendary Gold"-Karten schalten frei
// bei Achievements (9-Darter, 5+ 180er, 100+ Average).
//
// Viraler Trick: kleiner Watermark #autodartstools = kostenloses Marketing
// bei jedem WhatsApp/Discord/Instagram-Share.

import { AutodartsToolsGameData } from '@/utils/game-data-storage';
import type { IMatch, IPlayer, IPlayerStats } from '@/utils/websocket-helpers';

const OVERLAY_ID = 'adt-match-card-overlay';
const GALLERY_KEY = 'adt-match-card-gallery';
const SEEN_MATCHES_KEY = 'adt-match-card-seen';
const CARD_SIZE = 1080;

interface Theme {
  id: string;
  name: string;
  bg1: string; bg2: string;
  accent: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  rarity: 'common' | 'rare' | 'legendary';
  emoji: string;
}

const THEMES: Theme[] = [
  { id: 'pdc-classic',   name: 'PDC Classic',       bg1: '#0D1B2A', bg2: '#1a2e45', accent: '#E8002D', border: 'rgba(255,255,255,0.15)', textPrimary: '#FFFFFF', textSecondary: '#94A3B8', rarity: 'common',    emoji: '🎯' },
  { id: 'champions',     name: 'Champions Blue',    bg1: '#001845', bg2: '#023E7D', accent: '#3B82F6', border: 'rgba(147,197,253,0.25)', textPrimary: '#FFFFFF', textSecondary: '#BFDBFE', rarity: 'common',    emoji: '💎' },
  { id: 'fire',          name: 'Fire Red',          bg1: '#3D0000', bg2: '#7F0000', accent: '#FF6B00', border: 'rgba(255,165,0,0.3)',    textPrimary: '#FFFFFF', textSecondary: '#FCA5A5', rarity: 'common',    emoji: '🔥' },
  { id: 'neon',          name: 'Neon Green',        bg1: '#022c22', bg2: '#064e3b', accent: '#10F5A6', border: 'rgba(16,245,166,0.3)',   textPrimary: '#ECFDF5', textSecondary: '#6EE7B7', rarity: 'common',    emoji: '⚡' },
  { id: 'retro',         name: 'Retro Purple',      bg1: '#2E1065', bg2: '#5B21B6', accent: '#F0ABFC', border: 'rgba(240,171,252,0.3)',  textPrimary: '#FAF5FF', textSecondary: '#DDD6FE', rarity: 'common',    emoji: '🌌' },
  { id: 'gold-legend',   name: 'Legendary Gold',    bg1: '#3B1F00', bg2: '#7C5300', accent: '#FFD700', border: 'rgba(255,215,0,0.6)',    textPrimary: '#FFFDF0', textSecondary: '#FDE68A', rarity: 'legendary', emoji: '👑' },
  { id: 'diamond',       name: 'Diamond Elite',     bg1: '#0F172A', bg2: '#334155', accent: '#38BDF8', border: 'rgba(56,189,248,0.5)',   textPrimary: '#F0F9FF', textSecondary: '#7DD3FC', rarity: 'rare',      emoji: '💠' },
];

interface CardData {
  matchId: string;
  playerA: { name: string; avatar?: string; country?: string; };
  playerB: { name: string; avatar?: string; country?: string; };
  scoreA: number;
  scoreB: number;
  winnerIndex: 0 | 1;
  total180sA: number; total180sB: number;
  highestCheckout: number;
  bestAverage: number;
  bestAverageName: string;
  date: string;
  achievements: string[];
  theme: Theme;
}

// ── Achievement-Erkennung ───────────────────────────────────────────────────
function detectAchievements(m: IMatch): string[] {
  const badges: string[] = [];
  const stats = (m.stats ?? []) as IPlayerStats[];
  const total180s = stats.reduce((sum, s) => sum + (s.matchStats.total180 ?? 0), 0);
  const bestAvg = Math.max(0, ...stats.map(s => s.matchStats.average ?? 0));
  const maxCheckout = Math.max(0, ...stats.map(s => s.matchStats.checkoutPoints ?? 0));
  if (bestAvg >= 100) badges.push('AVG_100');
  if (bestAvg >= 90) badges.push('AVG_90');
  if (total180s >= 5) badges.push('MANY_180');
  if (maxCheckout >= 100) badges.push('HIGH_FINISH');
  if (maxCheckout >= 170) badges.push('BIG_FISH');
  // 9-Darter erkennen: kürzestes Leg mit dartsThrown = 9
  for (const s of stats) {
    if ((s.matchStats.dartsThrown ?? 999) <= 9 && (s.matchStats.checkoutPoints ?? 0) > 0) {
      badges.push('NINE_DARTER'); break;
    }
  }
  return badges;
}

function pickTheme(achievements: string[]): Theme {
  const legendary = achievements.some(a => ['NINE_DARTER', 'AVG_100', 'BIG_FISH'].includes(a));
  const rare = achievements.some(a => ['MANY_180', 'AVG_90'].includes(a));
  const pool = THEMES.filter(t =>
    t.rarity === 'legendary' ? legendary :
    t.rarity === 'rare' ? (legendary || rare) :
    true
  );
  // 5% Chance auf legendary auch ohne Achievement (Panini-Sticker-Feeling)
  if (!legendary && Math.random() < 0.05) return THEMES.find(t => t.id === 'gold-legend')!;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Datenextraktion ─────────────────────────────────────────────────────────
function extractCardData(m: IMatch, forcedTheme?: Theme): CardData | null {
  if (!m.players || m.players.length < 2) return null;
  if (!m.scores || m.scores.length < 2) return null;

  const pA = m.players[0]; const pB = m.players[1];
  const sA = (m.scores[0].sets ?? m.scores[0].legs ?? 0);
  const sB = (m.scores[1].sets ?? m.scores[1].legs ?? 0);
  const winnerIndex: 0 | 1 = (m.winner === 0 || m.winner === 1) ? m.winner : (sA >= sB ? 0 : 1);

  const stats = (m.stats ?? []) as IPlayerStats[];
  const total180sA = stats[0]?.matchStats.total180 ?? 0;
  const total180sB = stats[1]?.matchStats.total180 ?? 0;
  const avgs = stats.map(s => s.matchStats.average ?? 0);
  const bestAvgIdx = avgs[0] >= avgs[1] ? 0 : 1;
  const bestAverage = Math.round((avgs[bestAvgIdx] ?? 0) * 10) / 10;
  const bestAverageName = m.players[bestAvgIdx]?.name ?? '—';
  const highestCheckout = Math.max(0, ...stats.map(s => s.matchStats.checkoutPoints ?? 0));

  const achievements = detectAchievements(m);
  const theme = forcedTheme ?? pickTheme(achievements);

  return {
    matchId: m.id,
    playerA: { name: pA.name || 'Player 1', avatar: pA.user?.avatarUrl, country: pA.user?.country },
    playerB: { name: pB.name || 'Player 2', avatar: pB.user?.avatarUrl, country: pB.user?.country },
    scoreA: sA,
    scoreB: sB,
    winnerIndex,
    total180sA, total180sB,
    highestCheckout,
    bestAverage, bestAverageName,
    date: new Date(m.createdAt ?? Date.now()).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }),
    achievements,
    theme,
  };
}

// ── Canvas-Rendering ────────────────────────────────────────────────────────
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
    setTimeout(() => resolve(null), 2500);
  });
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

async function renderCard(d: CardData): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas');
  c.width = CARD_SIZE; c.height = CARD_SIZE;
  const ctx = c.getContext('2d')!;
  const t = d.theme;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, CARD_SIZE, CARD_SIZE);
  grad.addColorStop(0, t.bg1);
  grad.addColorStop(1, t.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);

  // Grain overlay (noise)
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? '#FFFFFF' : '#000000';
    ctx.fillRect(Math.random() * CARD_SIZE, Math.random() * CARD_SIZE, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Outer border
  ctx.strokeStyle = t.border;
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, 20, 20, CARD_SIZE - 40, CARD_SIZE - 40, 24);
  ctx.stroke();

  // Top-Ribbon: MATCH RESULT
  ctx.fillStyle = t.accent;
  ctx.font = '900 32px "Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${t.emoji}  MATCH RESULT  ${t.emoji}`, CARD_SIZE / 2, 90);

  ctx.fillStyle = t.textSecondary;
  ctx.font = '700 22px "Barlow Condensed", sans-serif';
  const rarityLabel = t.rarity === 'legendary' ? '★  LEGENDARY  ★' : t.rarity === 'rare' ? '◆ RARE ◆' : t.name.toUpperCase();
  ctx.fillText(rarityLabel, CARD_SIZE / 2, 130);

  // Datum
  ctx.font = '600 20px "Barlow Condensed", sans-serif';
  ctx.fillText(d.date, CARD_SIZE / 2, 165);

  // Player Avatare + Namen (nebeneinander)
  const [imgA, imgB] = await Promise.all([
    d.playerA.avatar ? loadImage(d.playerA.avatar) : Promise.resolve(null),
    d.playerB.avatar ? loadImage(d.playerB.avatar) : Promise.resolve(null),
  ]);

  const avatarSize = 200;
  const avatarY = 220;
  const leftX = 130; const rightX = CARD_SIZE - 130 - avatarSize;

  // Avatar A
  ctx.save();
  ctx.beginPath();
  ctx.arc(leftX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath(); ctx.clip();
  if (imgA) {
    ctx.drawImage(imgA, leftX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(leftX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = t.textSecondary;
    ctx.font = '900 96px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.playerA.name.charAt(0).toUpperCase(), leftX + avatarSize / 2, avatarY + avatarSize / 2 + 34);
  }
  ctx.restore();
  ctx.strokeStyle = d.winnerIndex === 0 ? t.accent : t.border;
  ctx.lineWidth = d.winnerIndex === 0 ? 8 : 3;
  ctx.beginPath();
  ctx.arc(leftX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
  ctx.stroke();

  // Avatar B
  ctx.save();
  ctx.beginPath();
  ctx.arc(rightX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.closePath(); ctx.clip();
  if (imgB) {
    ctx.drawImage(imgB, rightX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(rightX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = t.textSecondary;
    ctx.font = '900 96px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(d.playerB.name.charAt(0).toUpperCase(), rightX + avatarSize / 2, avatarY + avatarSize / 2 + 34);
  }
  ctx.restore();
  ctx.strokeStyle = d.winnerIndex === 1 ? t.accent : t.border;
  ctx.lineWidth = d.winnerIndex === 1 ? 8 : 3;
  ctx.beginPath();
  ctx.arc(rightX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
  ctx.stroke();

  // Krone auf Winner
  ctx.font = '700 68px sans-serif';
  ctx.textAlign = 'center';
  const winnerCenterX = d.winnerIndex === 0 ? leftX + avatarSize / 2 : rightX + avatarSize / 2;
  ctx.fillStyle = '#FFD700';
  ctx.fillText('👑', winnerCenterX, avatarY - 10);

  // Spielernamen
  ctx.fillStyle = t.textPrimary;
  ctx.font = '900 32px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  const nameA = d.playerA.name.length > 14 ? d.playerA.name.slice(0, 13) + '…' : d.playerA.name;
  const nameB = d.playerB.name.length > 14 ? d.playerB.name.slice(0, 13) + '…' : d.playerB.name;
  ctx.fillText(nameA.toUpperCase(), leftX + avatarSize / 2, avatarY + avatarSize + 45);
  ctx.fillText(nameB.toUpperCase(), rightX + avatarSize / 2, avatarY + avatarSize + 45);

  // Score in der Mitte
  ctx.font = '900 130px "Barlow Condensed", sans-serif';
  ctx.fillStyle = t.accent;
  ctx.textAlign = 'center';
  ctx.fillText(`${d.scoreA} : ${d.scoreB}`, CARD_SIZE / 2, avatarY + avatarSize / 2 + 40);

  ctx.font = '700 20px "Barlow Condensed", sans-serif';
  ctx.fillStyle = t.textSecondary;
  ctx.fillText('LEGS / SETS', CARD_SIZE / 2, avatarY + avatarSize / 2 + 68);

  // Stats-Kacheln (3 in einer Reihe)
  const statsY = 610;
  const statBoxW = 280; const statBoxH = 130;
  const statSpacing = (CARD_SIZE - 3 * statBoxW - 80) / 4 + 20;

  const stats = [
    { label: '180er', value: `${d.total180sA + d.total180sB}`, sub: `${d.playerA.name.slice(0, 8)} ${d.total180sA} · ${d.playerB.name.slice(0, 8)} ${d.total180sB}` },
    { label: 'Highest Checkout', value: `${d.highestCheckout}`, sub: d.highestCheckout >= 100 ? 'HIGH FINISH!' : '' },
    { label: 'Best Average', value: `${d.bestAverage}`, sub: d.bestAverageName.slice(0, 16) },
  ];

  stats.forEach((s, i) => {
    const x = statSpacing + i * (statBoxW + statSpacing);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    drawRoundedRect(ctx, x, statsY, statBoxW, statBoxH, 12);
    ctx.fill();
    ctx.strokeStyle = t.border; ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = t.textSecondary;
    ctx.font = '700 16px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.label.toUpperCase(), x + statBoxW / 2, statsY + 30);

    ctx.fillStyle = t.textPrimary;
    ctx.font = '900 56px "Barlow Condensed", sans-serif';
    ctx.fillText(s.value, x + statBoxW / 2, statsY + 88);

    if (s.sub) {
      ctx.fillStyle = t.accent;
      ctx.font = '700 14px "Barlow Condensed", sans-serif';
      ctx.fillText(s.sub, x + statBoxW / 2, statsY + 115);
    }
  });

  // Achievement-Badges
  if (d.achievements.length > 0) {
    const badgeMap: Record<string, string> = {
      NINE_DARTER: '🎯 9-DARTER',
      AVG_100:     '💯 100+ AVG',
      AVG_90:      '⭐ 90+ AVG',
      MANY_180:    '💥 5+ 180er',
      BIG_FISH:    '🐋 170+ CHECKOUT',
      HIGH_FINISH: '🎪 HIGH FINISH',
    };
    const badges = d.achievements.map(a => badgeMap[a]).filter(Boolean);
    if (badges.length > 0) {
      ctx.font = '900 22px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = t.accent;
      const badgeText = badges.slice(0, 3).join('   ·   ');
      ctx.fillText(badgeText, CARD_SIZE / 2, 800);
    }
  }

  // Footer: Watermark (VIRAL!)
  ctx.fillStyle = t.textSecondary;
  ctx.font = '700 18px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('#autodartstools', 60, CARD_SIZE - 50);

  ctx.textAlign = 'right';
  ctx.fillStyle = t.accent;
  ctx.font = '900 20px "Barlow Condensed", sans-serif';
  ctx.fillText('AUTODARTS TOOLS', CARD_SIZE - 60, CARD_SIZE - 50);

  return c;
}

// ── Aktionen (Download / Copy / Discord) ────────────────────────────────────
async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', 0.95);
  });
}

async function downloadCard(canvas: HTMLCanvasElement, filename: string) {
  const blob = await canvasToBlob(canvas);
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyCard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await canvasToBlob(canvas);
    if (!blob) return false;
    if ('clipboard' in navigator && 'write' in navigator.clipboard) {
      await (navigator.clipboard as any).write([new (window as any).ClipboardItem({ 'image/png': blob })]);
      return true;
    }
  } catch (e) { console.warn('[MatchCard] copy failed', e); }
  return false;
}

async function sendToDiscord(canvas: HTMLCanvasElement, d: CardData): Promise<boolean> {
  try {
    const cfg: any = (await browser.storage.local.get('config'))?.config ?? {};
    const webhookUrl = cfg?.discord?.webhookUrl ?? cfg?.discord?.url;
    if (!webhookUrl) return false;
    const blob = await canvasToBlob(canvas);
    if (!blob) return false;
    const form = new FormData();
    const content = `**${d.playerA.name}** ${d.scoreA} : ${d.scoreB} **${d.playerB.name}** — ${d.date}`;
    form.append('content', content);
    form.append('file', blob, `autodarts-match-${d.matchId.slice(0, 8)}.png`);
    const res = await fetch(webhookUrl, { method: 'POST', body: form });
    return res.ok;
  } catch (e) { console.error('[MatchCard] discord', e); return false; }
}

// ── Overlay-UI ──────────────────────────────────────────────────────────────
async function showOverlay(canvas: HTMLCanvasElement, d: CardData) {
  document.getElementById(OVERLAY_ID)?.remove();
  const back = document.createElement('div');
  back.id = OVERLAY_ID;
  back.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483000;
    background: rgba(2,6,15,0.85); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    font-family: "Barlow Condensed", "Arial Narrow", Arial, sans-serif;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    max-width: 92vw; max-height: 94vh; text-align: center;
    display: flex; flex-direction: column; align-items: center; gap: 18px;
  `;
  back.appendChild(box);

  const title = document.createElement('div');
  title.style.cssText = 'color:#E8002D; font-size:12px; letter-spacing:4px; font-weight:900; text-transform:uppercase;';
  title.textContent = `MATCH-STICKER — ${d.theme.rarity === 'legendary' ? '★ LEGENDARY ★' : d.theme.name}`;
  box.appendChild(title);

  const preview = document.createElement('img');
  preview.style.cssText = 'max-width: min(520px, 88vw); max-height: min(520px, 68vh); border-radius: 16px; box-shadow: 0 24px 80px rgba(0,0,0,0.7);';
  preview.setAttribute('data-testid', 'match-card-preview');
  canvas.toBlob((b) => { if (b) preview.src = URL.createObjectURL(b); }, 'image/png');
  box.appendChild(preview);

  const actions = document.createElement('div');
  actions.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap; justify-content: center;';
  box.appendChild(actions);

  const mkBtn = (label: string, bg: string, testid: string, handler: () => void) => {
    const b = document.createElement('button');
    b.setAttribute('data-testid', testid);
    b.style.cssText = `background:${bg}; border:none; color:white; padding:12px 22px; border-radius:6px; cursor:pointer; font-family:inherit; font-size:12px; font-weight:900; letter-spacing:2px; text-transform:uppercase;`;
    b.textContent = label;
    b.addEventListener('click', handler);
    return b;
  };

  actions.appendChild(mkBtn('📥 Download PNG', 'linear-gradient(135deg,#E8002D,#B00020)', 'match-card-download-btn', () => {
    downloadCard(canvas, `autodarts-match-${d.matchId.slice(0, 8)}.png`);
  }));
  actions.appendChild(mkBtn('📋 Kopieren', 'linear-gradient(135deg,#3B82F6,#1D4ED8)', 'match-card-copy-btn', async () => {
    const ok = await copyCard(canvas);
    toast(ok ? '✓ In Zwischenablage kopiert!' : '⚠️ Clipboard-API im Browser blockiert', ok ? '#34D399' : '#F87171');
  }));
  actions.appendChild(mkBtn('🎲 Farbe würfeln', 'linear-gradient(135deg,#8B5CF6,#6D28D9)', 'match-card-shuffle-btn', async () => {
    const newTheme = pickTheme(d.achievements);
    d.theme = newTheme;
    title.textContent = `MATCH-STICKER — ${newTheme.rarity === 'legendary' ? '★ LEGENDARY ★' : newTheme.name}`;
    const newCanvas = await renderCard(d);
    canvas.width = newCanvas.width; canvas.height = newCanvas.height;
    canvas.getContext('2d')!.drawImage(newCanvas, 0, 0);
    newCanvas.toBlob((b) => { if (b) preview.src = URL.createObjectURL(b); }, 'image/png');
  }));
  actions.appendChild(mkBtn('💬 An Discord', 'linear-gradient(135deg,#5865F2,#4752C4)', 'match-card-discord-btn', async () => {
    const ok = await sendToDiscord(canvas, d);
    toast(ok ? '✓ An Discord gesendet' : '⚠️ Kein Discord-Webhook konfiguriert (Tools → Lobby → Discord Webhooks)', ok ? '#34D399' : '#F87171');
  }));

  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('data-testid', 'match-card-close-btn');
  closeBtn.textContent = '✕ Schließen';
  closeBtn.style.cssText = 'background:transparent; border:1px solid rgba(255,255,255,0.2); color:#94A3B8; padding:10px 20px; border-radius:5px; cursor:pointer; font-family:inherit; font-size:11px; letter-spacing:2px; text-transform:uppercase;';
  closeBtn.addEventListener('click', () => back.remove());
  box.appendChild(closeBtn);

  const share = document.createElement('div');
  share.style.cssText = 'color:#64748B; font-size:11px; letter-spacing:1px; max-width:520px; line-height:1.6;';
  share.innerHTML = '💡 Teile den Sticker via WhatsApp/Instagram/Twitter — der <b style="color:#E8002D;">#autodartstools</b>-Watermark bringt neue Spieler in die Community.';
  box.appendChild(share);

  document.body.appendChild(back);

  // Persist in Gallery
  try {
    const stored = await browser.storage.local.get(GALLERY_KEY);
    const gallery = (stored[GALLERY_KEY] as any[]) ?? [];
    const dataUrl = canvas.toDataURL('image/png', 0.85);
    gallery.unshift({ matchId: d.matchId, date: d.date, dataUrl, themeId: d.theme.id, rarity: d.theme.rarity });
    while (gallery.length > 30) gallery.pop();
    await browser.storage.local.set({ [GALLERY_KEY]: gallery });
  } catch (_) { /* ignore */ }
}

function toast(msg: string, color: string) {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed; bottom:40px; left:50%; transform:translateX(-50%); z-index:2147483001; background:${color}; color:#0D1B2A; padding:12px 22px; border-radius:6px; font-family:"Barlow Condensed",sans-serif; font-weight:900; letter-spacing:1px; box-shadow:0 8px 24px rgba(0,0,0,0.5);`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ── Watcher ─────────────────────────────────────────────────────────────────
let matchWatcher: any = null;
let processedMatchId: string | null = null;

async function alreadySeen(matchId: string): Promise<boolean> {
  try {
    const stored = await browser.storage.local.get(SEEN_MATCHES_KEY);
    const seen = (stored[SEEN_MATCHES_KEY] as string[]) ?? [];
    return Array.isArray(seen) && seen.includes(matchId);
  } catch (_) { return false; }
}

async function markSeen(matchId: string) {
  try {
    const stored = await browser.storage.local.get(SEEN_MATCHES_KEY);
    const seen = (stored[SEEN_MATCHES_KEY] as string[]) ?? [];
    if (!seen.includes(matchId)) seen.unshift(matchId);
    while (seen.length > 60) seen.pop();
    await browser.storage.local.set({ [SEEN_MATCHES_KEY]: seen });
  } catch (_) { /* ignore */ }
}

async function handleFinishedMatch(m: IMatch) {
  if (!m || processedMatchId === m.id) return;
  if (await alreadySeen(m.id)) return;
  processedMatchId = m.id;

  const data = extractCardData(m);
  if (!data) return;
  const canvas = await renderCard(data);
  await markSeen(m.id);
  await showOverlay(canvas, data);
}

export function initMatchCard() {
  if (matchWatcher) return;
  matchWatcher = AutodartsToolsGameData.watch(async (value, oldValue) => {
    const cur = value?.match; const prev = oldValue?.match;
    if (!cur) return;
    const wasFinished = prev?.finished === true;
    const isFinished = cur.finished === true;
    const winnerBecameSet = (cur.winner !== undefined && cur.winner !== null && cur.winner >= 0)
      && (prev?.winner === undefined || prev?.winner === null || prev?.winner < 0);
    if ((!wasFinished && isFinished) || winnerBecameSet) {
      try { await handleFinishedMatch(cur); } catch (e) { console.error('[MatchCard]', e); }
    }
  });
}

export function cleanupMatchCard() {
  if (matchWatcher) { matchWatcher(); matchWatcher = null; }
  document.getElementById(OVERLAY_ID)?.remove();
  processedMatchId = null;
}

/** Manuell aufrufbar (z.B. aus Settings): letztes Match neu rendern. */
export async function showLastMatchCard(): Promise<boolean> {
  const gd = await AutodartsToolsGameData.getValue();
  const m = gd?.match;
  if (!m) return false;
  const data = extractCardData(m);
  if (!data) return false;
  const canvas = await renderCard(data);
  await showOverlay(canvas, data);
  return true;
}
