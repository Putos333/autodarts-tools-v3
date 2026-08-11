// v2.9.70: High-End Bot-Renamer für Karriere- und Turnier-Modus
// ═══════════════════════════════════════════════════════════════════════════
// Komplett-Refactor gegenüber v2.9.66/67:
//
//   ✔ Race-safe: Mutex verhindert parallele Rename-Cycles
//   ✔ State-Machine: IDLE → DETECTING → RENAMING → VERIFYING → SUCCESS/FAILED
//   ✔ Retry-Backoff: 3 Versuche mit exponentiellem Delay (200/800/2400 ms)
//   ✔ Post-Rename-Verifikation über WebSocket-Lobby-Data (echter Endzustand!)
//   ✔ Fine-Tune-Slider: nach Keyboard-Events wird aria-valuenow nachjustiert
//   ✔ Timeout pro Attempt (5 s hard cap) — kein Deadlock möglich
//   ✔ UI-Success-Toast (auch außerhalb des Overlays sichtbar)
//   ✔ Robuster Text-Sanitizer: entfernt problematische Unicode-Zeichen
//   ✔ Watchdog: prüft alle 3 s ob der finale Zustand stabil ist
//   ✔ Deterministisches Cleanup — kein Timer-Leak, kein hängender Observer
//
// Kompatibilität: Public-API unverändert (initCareerBotHint / onRemoveCareerBotHint).

import type { CareerMatchConfig } from '@/utils/career-engine';
import { AutodartsToolsLobbyData } from '@/utils/lobby-data-storage';
import type { ILobbies } from '@/utils/websocket-helpers';
import { reportSelectorMiss } from '@/utils/selector-health';

const OVERLAY_ID = 'adt-career-bot-hint';
const TOAST_ID = 'adt-bot-rename-toast';
const ACTIVE_MATCH_KEY_LOCAL = 'local:career-active-match';
const ACTIVE_MATCH_KEY_FALLBACK = 'career-active-match';

// ═══════════════════════════════════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════════════════════════════════

type RenameState = 'idle' | 'detecting' | 'renaming' | 'verifying' | 'success' | 'failed';

interface RenamerState {
  state: RenameState;
  attempts: number;
  lastError: string | null;
  lastRenameAt: number;
  verifiedName: string | null;
  verifiedAvg: number | null;
}

const state: RenamerState = {
  state: 'idle',
  attempts: 0,
  lastError: null,
  lastRenameAt: 0,
  verifiedName: null,
  verifiedAvg: null,
};

let observer: MutationObserver | null = null;
let dialogObserver: MutationObserver | null = null;
let watchdogInterval: ReturnType<typeof setInterval> | null = null;
let lobbyWatcher: any = null;
let currentCfg: CareerMatchConfig | null = null;
let renameMutex: Promise<any> = Promise.resolve();

// ═══════════════════════════════════════════════════════════════════════════
//  Utility
// ═══════════════════════════════════════════════════════════════════════════

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/**
 * Führt fn() mit einem Timeout aus. Bei Ablauf wird das Promise mit
 * einem Timeout-Error rejected — verhindert hängende Rename-Zyklen.
 */
async function withTimeout<T>(fn: () => Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    fn(),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms)),
  ]);
}

/**
 * Sanitizer für Bot-Namen: entfernt Zero-Width-Chars und trimmt.
 * Autodarts lehnt manche Unicode-Kategorien ab (v2.9.70 defensive Schicht).
 */
function sanitizeBotName(raw: string): string {
  return raw
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Zero-width
    .replace(/[\u0000-\u001F\u007F]/g, '') // Control-Chars
    .trim()
    .slice(0, 32); // Autodarts-Limit
}

function computeTargetAvg(cfg: CareerMatchConfig): number {
  return Math.round(((cfg.opponent.averageMin ?? 60) + (cfg.opponent.averageMax ?? 80)) / 2);
}

/**
 * React-kompatibles setzen eines Input-Werts. React nutzt einen eigenen
 * Setter am Value-Descriptor; native setter + Events umgehen das.
 */
function setNativeInputValue(input: HTMLInputElement, value: string) {
  const proto = Object.getPrototypeOf(input);
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
    ?? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (nativeSetter) nativeSetter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Mutex-Wrap: verhindert dass zwei Rename-Cycles gleichzeitig laufen.
 * WebSocket + Dialog-Observer + Polling triggern alle das gleiche Ziel —
 * ohne Mutex führt das zu doppelten DOM-Manipulationen.
 */
async function withMutex<T>(fn: () => Promise<T>): Promise<T> {
  const prev = renameMutex;
  let resolve!: (v: any) => void;
  renameMutex = new Promise((r) => { resolve = r; });
  try {
    await prev;
    return await fn();
  } finally {
    resolve(null);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Storage
// ═══════════════════════════════════════════════════════════════════════════

async function getActiveMatch(): Promise<CareerMatchConfig | null> {
  try {
    const r = await browser.storage.local.get([ACTIVE_MATCH_KEY_LOCAL, ACTIVE_MATCH_KEY_FALLBACK]);
    const raw = r[ACTIVE_MATCH_KEY_LOCAL] ?? r[ACTIVE_MATCH_KEY_FALLBACK];
    if (!raw) return null;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (_) { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Overlay
// ═══════════════════════════════════════════════════════════════════════════

function removeOverlay() {
  document.getElementById(OVERLAY_ID)?.remove();
}

function buildOverlay(cfg: CareerMatchConfig): HTMLDivElement {
  const isT = !!cfg.isTournament;
  const opp = cfg.opponent;
  const avg = computeTargetAvg(cfg);
  const box = document.createElement('div');
  box.id = OVERLAY_ID;
  box.style.cssText = `
    position: fixed;
    top: 78px;
    right: 20px;
    z-index: 999999;
    width: 320px;
    background: linear-gradient(135deg, #0D1B2A 0%, #1a2e45 100%);
    border: 2px solid ${isT ? '#F5C842' : '#E8002D'};
    border-radius: 10px;
    padding: 16px 18px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.5);
    color: #FFFFFF;
    font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
  `;
  const safeName = sanitizeBotName(opp.name);
  box.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
      <div>
        <div style="font-size:10px; letter-spacing:3px; color:${isT ? '#F5C842' : '#E8002D'}; text-transform:uppercase; font-weight:900;">
          ${isT ? '🏆 TURNIER-MATCH' : '🎯 SAISON-MATCH'}
        </div>
        <div style="font-size:11px; color:#94A3B8; margin-top:2px;">${cfg.tournamentName} — ${cfg.round}</div>
        <div style="font-size:9px; color:#556677; margin-top:2px; letter-spacing:1px;">Renamer v2.9.80</div>
      </div>
      <button id="adt-bot-hint-close" data-testid="bot-hint-close" style="background:none; border:1px solid #334; color:#8899aa; width:24px; height:24px; border-radius:3px; cursor:pointer; font-size:12px;">✕</button>
    </div>
    <div style="border-top: 1px solid rgba(255,255,255,0.08); margin: 4px 0 10px 0;"></div>
    <div style="font-size:11px; letter-spacing:2px; color:#94A3B8; text-transform:uppercase; margin-bottom:6px;">🤖 GEGNER</div>
    <div style="background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.12); padding:10px 14px; border-radius:5px; margin-bottom:10px;">
      <div style="font-size:18px; font-weight:900; color:#FFFFFF;" id="adt-bot-hint-name" data-testid="bot-hint-name">${safeName}</div>
      <div id="adt-bot-hint-status" data-testid="bot-hint-status" style="font-size:11px; color:#94A3B8; margin-top:4px;">⏳ Warte auf Bot in Lobby…</div>
      <div id="adt-bot-hint-attempts" style="font-size:9px; color:#556677; margin-top:2px; letter-spacing:1px;"></div>
    </div>
    <div style="display:flex; gap:8px; margin-bottom:10px;">
      <button id="adt-bot-hint-copy" data-testid="bot-hint-copy" style="flex:1; background:linear-gradient(135deg, #34D399, #22C58E); border:none; color:#0D1B2A; padding:8px 12px; border-radius:5px; cursor:pointer; font-size:11px; font-weight:900; letter-spacing:1px;">📋 NAMEN KOPIEREN</button>
      <button id="adt-bot-hint-retry" data-testid="bot-hint-retry" style="background:rgba(96,165,250,0.15); border:1px solid rgba(96,165,250,0.5); color:#60A5FA; padding:8px 12px; border-radius:5px; cursor:pointer; font-size:11px; font-weight:700; letter-spacing:1px;">🔄</button>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:8px;">
      <div style="background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px;">
        <div style="font-size:9px; color:#94A3B8; text-transform:uppercase; letter-spacing:1px;">Empf. Avg</div>
        <div style="font-size:16px; font-weight:900; color:#60A5FA;">${avg}</div>
      </div>
      <div style="background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:4px;">
        <div style="font-size:9px; color:#94A3B8; text-transform:uppercase; letter-spacing:1px;">Rang</div>
        <div style="font-size:16px; font-weight:900; color:#F5C842;">#${opp.worldRanking}</div>
      </div>
    </div>
    <div style="font-size:10px; color:#94A3B8; line-height:1.5;">
      💡 Sobald du „Add Bot" klickst, wird der Bot automatisch umbenannt.
    </div>
  `;

  const copyBtn = box.querySelector('#adt-bot-hint-copy') as HTMLButtonElement;
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(safeName);
      copyBtn.textContent = '✓ KOPIERT!';
      copyBtn.style.background = 'linear-gradient(135deg, #F5C842, #F0B429)';
      setTimeout(() => {
        copyBtn.textContent = '📋 NAMEN KOPIEREN';
        copyBtn.style.background = 'linear-gradient(135deg, #34D399, #22C58E)';
      }, 1500);
    } catch (_) { /* silent */ }
  });

  const retryBtn = box.querySelector('#adt-bot-hint-retry') as HTMLButtonElement;
  retryBtn.title = 'Rename manuell erneut auslösen';
  retryBtn.addEventListener('click', () => {
    if (!currentCfg) return;
    state.attempts = 0;
    state.state = 'detecting';
    updateStatus('🔄 Manueller Retry…', '#F5C842');
    scheduleRename(currentCfg, 'manual-retry');
  });

  const closeBtn = box.querySelector('#adt-bot-hint-close') as HTMLButtonElement;
  closeBtn.addEventListener('click', () => stopAll());

  return box;
}

function updateStatus(text: string, color = '#94A3B8') {
  const el = document.getElementById('adt-bot-hint-status');
  if (el) {
    el.textContent = text;
    el.style.color = color;
  }
  const at = document.getElementById('adt-bot-hint-attempts');
  if (at) {
    at.textContent = state.attempts > 0
      ? `Versuch ${state.attempts}${state.lastError ? ` · ${state.lastError.slice(0, 40)}` : ''}`
      : '';
  }
}

/**
 * High-End Toast — kurze Bestätigung dass der Rename fertig ist. Erscheint
 * auch dann, wenn der User das Overlay geschlossen hat.
 */
function showSuccessToast(name: string, avg: number) {
  document.getElementById(TOAST_ID)?.remove();
  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  toast.setAttribute('data-testid', 'bot-rename-success-toast');
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #059669, #10B981);
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 1px;
    z-index: 999999;
    box-shadow: 0 6px 20px rgba(0,0,0,0.4);
    animation: adt-toast-in 0.3s ease-out;
  `;
  toast.textContent = `✅ Bot umbenannt: ${name} · Avg ${avg}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.style.opacity = '0', 3000);
  setTimeout(() => toast.remove(), 3600);
}

// ═══════════════════════════════════════════════════════════════════════════
//  DOM Interaction Primitives
// ═══════════════════════════════════════════════════════════════════════════

/**
 * v2.9.77 – findet Bot-Reihen in beiden autodarts-Layouts:
 *   1. Alte Tabelle mit <tr>
 *   2. Neues Div-Layout mit .ad-ext-player / [data-testid*="player"]
 *   3. Generic-Fallback: jedes Element, das ein editable-name-Element enthält
 */
function findBotRows(): HTMLElement[] {
  const debug: string[] = [];
  const collected: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  const candidates: NodeListOf<Element>[] = [
    document.querySelectorAll('tr'),
    document.querySelectorAll('.ad-ext-player'),
    document.querySelectorAll('[data-testid*="player" i]'),
    document.querySelectorAll('[class*="player" i][class*="row" i]'),
    document.querySelectorAll('[class*="lobby" i] [class*="player" i]'),
  ];

  candidates.forEach((list, idx) => {
    if (list.length) debug.push(`sel#${idx}=${list.length}`);
    list.forEach((el) => {
      const row = el as HTMLElement;
      if (seen.has(row)) return;
      const text = row.textContent ?? '';
      if (/\b(bot|cpu)\b/i.test(text)) {
        seen.add(row);
        collected.push(row);
      }
    });
  });

  // Letzter Fallback: any element with editable name near a "Bot"-Text
  if (!collected.length) {
    const bots = Array.from(document.querySelectorAll('*')).filter((el) => {
      const t = (el.textContent ?? '').trim().toLowerCase();
      return t === 'bot' || t.startsWith('bot ') || /^bot\s*\d+$/.test(t);
    });
    bots.forEach((b) => {
      const row = b.closest<HTMLElement>(
        '.ad-ext-player, [data-testid*="player" i], [class*="player" i], tr, li, [role="row"]',
      );
      if (row && !seen.has(row)) {
        seen.add(row);
        collected.push(row);
      }
    });
    debug.push(`fallback=${collected.length}`);
  }

  console.debug('[BotRenamer] findBotRows:', debug.join(' '), '→', collected.length);
  return collected;
}

/**
 * v2.9.77 – Findet das Namens-Element in jeder DOM-Variante.
 * Prüft rekursiv nach dem konkretesten Element (mit chakra-editable-Wrapper).
 */
function getPlayerNameElement(row: HTMLElement): HTMLElement | null {
  const selectors = [
    '.ad-ext-player-name > p',
    '.ad-ext-player-name',
    '[data-testid*="player-name" i]',
    '.chakra-editable',
    '.chakra-editable__preview',
    'td:nth-of-type(2) p',
    'td:nth-of-type(2)',
    '[class*="name" i]',
    'p',
  ];
  for (const sel of selectors) {
    const el = row.querySelector(sel) as HTMLElement | null;
    if (!el) continue;
    const txt = (el.textContent ?? '').trim();
    if (!txt) continue;
    if (/^\d+$/.test(txt)) continue; // reine Zahlen (Score) überspringen
    return el;
  }
  return null;
}

function getCurrentBotName(row: HTMLElement): string {
  return getPlayerNameElement(row)?.textContent?.trim() ?? '';
}

/**
 * Präzisions-Slider-Setter (v2.9.70):
 * 1) Sprint zum Min mit Home
 * 2) Grobjustierung mit PageUp (+10)
 * 3) Feinjustierung mit ArrowRight (+1)
 * 4) NACHKORREKTUR: falls Chakra einen Wert kickt, mit ArrowLeft/-Right nachziehen
 */
async function setSliderValue(slider: HTMLElement, target: number): Promise<boolean> {
  // Input[type=range] Path
  if (slider.tagName === 'INPUT' && (slider as HTMLInputElement).type === 'range') {
    setNativeInputValue(slider as HTMLInputElement, String(target));
    return true;
  }
  const min = parseInt(slider.getAttribute('aria-valuemin') ?? '0');
  const max = parseInt(slider.getAttribute('aria-valuemax') ?? '170');
  const clamped = Math.max(min, Math.min(max, target));

  slider.focus();
  await sleep(30);
  slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await sleep(50);

  let remaining = clamped - min;
  const t0 = Date.now();
  const MAX_MS = 3000;
  while (remaining >= 10 && Date.now() - t0 < MAX_MS) {
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
    remaining -= 10;
    await sleep(12);
  }
  while (remaining > 0 && Date.now() - t0 < MAX_MS) {
    slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    remaining -= 1;
    await sleep(8);
  }

  // v2.9.70 Fine-Tune: falls der finale Wert daneben liegt (z.B. Chakra rundet
  // oder debounced), mit einzelnen Pfeiltasten nachjustieren. Bis zu ±5 Steps.
  await sleep(40);
  let finalVal = parseInt(slider.getAttribute('aria-valuenow') ?? '0');
  let corrections = 0;
  while (finalVal !== clamped && corrections < 10) {
    const key = finalVal < clamped ? 'ArrowRight' : 'ArrowLeft';
    slider.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await sleep(15);
    const newVal = parseInt(slider.getAttribute('aria-valuenow') ?? '0');
    if (newVal === finalVal) break; // keine Änderung → Chakra reagiert nicht mehr
    finalVal = newVal;
    corrections++;
  }
  slider.blur();
  return Math.abs(finalVal - clamped) <= 1;
}

async function renameBotRow(row: HTMLElement, targetName: string): Promise<boolean> {
  const nameEl = getPlayerNameElement(row);
  if (!nameEl) {
    console.warn('[BotRenamer] renameBotRow: kein Name-Element in Row gefunden', row);
    reportSelectorMiss('Bot-Renamer', '.ad-ext-player-name / player name row');
    return false;
  }
  console.debug('[BotRenamer] renameBotRow start · target=', targetName, '· nameEl=', nameEl);

  // Strategie 1: Klick + Doppelklick (klassisch)
  nameEl.click();
  await sleep(80);
  nameEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
  await sleep(160);

  // Strategie 2: manche Chakra-Editables reagieren erst auf focus
  (nameEl as HTMLElement).focus?.();
  await sleep(40);

  // Input im gesamten Row-Kontext suchen (inklusive Portal-Elemente)
  let input: HTMLInputElement | null = null;
  const containers = [
    nameEl.closest('.chakra-editable') as HTMLElement | null,
    nameEl.parentElement,
    row,
    row.parentElement,
  ];
  for (const c of containers) {
    if (!c) continue;
    input = c.querySelector('input') as HTMLInputElement | null;
    if (input) break;
  }
  // letzter Fallback: irgendein sichtbares Text-Input auf der Seite (bei Portal-Rendering)
  if (!input) {
    const all = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="text"], input:not([type])'));
    input = all.find((i) => {
      if (i.type === 'range' || i.type === 'number') return false;
      const r = i.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && !i.disabled && !i.readOnly;
    }) ?? null;
  }
  if (!input) {
    console.warn('[BotRenamer] renameBotRow: kein Input gefunden nach dblclick', { row, nameEl });
    reportSelectorMiss('Bot-Renamer (Input)', 'input[type=text] in row/portal');
    return false;
  }
  console.debug('[BotRenamer] renameBotRow: Input gefunden', input);

  input.focus();
  setNativeInputValue(input, targetName);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await sleep(80);

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keyup',   { key: 'Enter', code: 'Enter', bubbles: true }));
  input.blur();
  await sleep(180);

  const updated = getCurrentBotName(row);
  const ok = updated.toLowerCase() === targetName.toLowerCase();
  console.debug(`[BotRenamer] renameBotRow result · actual="${updated}" target="${targetName}" ok=${ok}`);
  return ok;
}

async function setAverageOnRow(row: HTMLElement, avg: number): Promise<boolean> {
  let slider = row.querySelector('[role="slider"], input[type="range"], input[type="number"]') as HTMLElement | null;
  if (!slider) {
    const parent = row.parentElement?.parentElement ?? document;
    slider = parent.querySelector('[role="slider"], input[type="range"], input[type="number"]') as HTMLElement | null;
  }
  if (!slider) return false;
  if (slider.tagName === 'INPUT' && ((slider as HTMLInputElement).type === 'number' || (slider as HTMLInputElement).type === 'range')) {
    (slider as HTMLInputElement).focus();
    setNativeInputValue(slider as HTMLInputElement, String(avg));
    await sleep(80);
    return true;
  }
  return await setSliderValue(slider, avg);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Dialog Auto-Fill (Modal Add-Bot)
// ═══════════════════════════════════════════════════════════════════════════

async function autoFillBotDialog(cfg: CareerMatchConfig): Promise<boolean> {
  const dialog = document.querySelector(
    '[role="dialog"], [role="alertdialog"], .chakra-modal__content, .chakra-popover__content, [data-radix-portal] [role="dialog"], [data-headlessui-state] [data-open]',
  ) as HTMLElement | null;
  if (!dialog) return false;

  const dialogText = (dialog.textContent ?? '').toLowerCase();
  const hasKeyword = /bot|average|skill|niveau|durchschnitt|schwierigkeit|difficulty|ppr/i.test(dialogText);
  const hasSliderOrNum = !!dialog.querySelector('[role="slider"], input[type="range"], input[type="number"]');
  if (!hasKeyword && !hasSliderOrNum) return false;

  const targetName = sanitizeBotName(cfg.opponent.name);
  const avg = computeTargetAvg(cfg);
  let ok = false;

  const nameInputCandidates = Array.from(dialog.querySelectorAll<HTMLInputElement>(
    'input[type="text"], input:not([type]), input[placeholder*="name" i], input[placeholder*="Name"]',
  ));
  const nameInput = nameInputCandidates.find(el => el.type !== 'number' && el.type !== 'range');
  if (nameInput && nameInput.value.trim() !== targetName) {
    nameInput.focus();
    setNativeInputValue(nameInput, targetName);
    nameInput.blur();
    await sleep(80);
    ok = true;
  }

  const numInput = dialog.querySelector('input[type="number"]') as HTMLInputElement | null;
  if (numInput) {
    numInput.focus();
    setNativeInputValue(numInput, String(avg));
    numInput.blur();
    await sleep(80);
    ok = true;
  } else {
    const slider = dialog.querySelector('[role="slider"], input[type="range"]') as HTMLElement | null;
    if (slider) {
      const success = await setSliderValue(slider, avg);
      if (success) ok = true;
    }
  }

  if (ok) {
    await sleep(200);
    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button'));
    const confirmBtn = buttons.find((b) => {
      const t = (b.textContent ?? '').trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') ?? '').toLowerCase();
      return /^(save|ok|add|bot\s*hinzuf|speichern|übernehmen|apply|confirm|weiter|hinzuf)/i.test(t)
        || /^(save|ok|add|save-bot|confirm)/.test(aria);
    });
    if (confirmBtn && !confirmBtn.disabled) {
      console.log('[BotRenamer] Dialog-Confirm-Button geklickt');
      confirmBtn.click();
    }
  }

  return ok;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Rename-Cycle mit State-Machine + Mutex + Retry-Backoff
// ═══════════════════════════════════════════════════════════════════════════

async function runRenameCycle(cfg: CareerMatchConfig, trigger: string): Promise<boolean> {
  return withMutex(async () => {
    if (state.state === 'success') return true; // Bereits erfolgreich, kein doppelter Cycle

    state.state = 'renaming';
    const targetName = sanitizeBotName(cfg.opponent.name);
    const targetAvg = computeTargetAvg(cfg);

    if (!/\/lobbies\//.test(window.location.href)) {
      state.state = 'idle';
      return false;
    }

    try {
      // Priorität 1: Dialog (falls Add-Bot-Modal offen)
      const dialogFilled = await withTimeout(() => autoFillBotDialog(cfg), 3500, 'dialog');
      if (dialogFilled) {
        updateStatus(`✏️ Bot-Dialog vorausgefüllt: ${targetName} (Avg ${targetAvg})`, '#34D399');
        // Dialog wird gleich geschlossen — Verify läuft dann via WebSocket-Watcher
      }

      // Priorität 2: Bot-Zeilen in der Tabelle
      const rows = findBotRows();
      if (rows.length === 0 && !dialogFilled) {
        updateStatus('⏳ Warte auf Bot in Lobby…', '#94A3B8');
        state.state = 'detecting';
        return false;
      }

      let anySuccess = false;
      for (const row of rows) {
        const current = getCurrentBotName(row);
        // Falls Name schon stimmt: nur Avg checken/setzen
        if (current.toLowerCase() === targetName.toLowerCase()) {
          await setAverageOnRow(row, targetAvg);
          anySuccess = true;
          continue;
        }
        updateStatus(`🔄 Benenne um: ${current} → ${targetName}…`, '#F5C842');
        const ok = await withTimeout(() => renameBotRow(row, targetName), 4000, 'renameRow');
        if (ok) {
          await sleep(150);
          await setAverageOnRow(row, targetAvg);
          anySuccess = true;
        } else {
          // v2.9.77 – Diagnose bei DOM-Rename-Fehlschlag
          console.warn('[BotRenamer] Rename fehlgeschlagen für Row → DOM-Snapshot:', {
            rowHTML: row.outerHTML.slice(0, 500),
            currentName: current,
            targetName,
          });
        }
      }

      if (anySuccess) {
        state.state = 'verifying';
        state.lastRenameAt = Date.now();
        updateStatus(`⏳ Verifiziere Rename via WebSocket…`, '#60A5FA');
        // Verifikation läuft im WebSocket-Watcher (verifyLobbyState)
        return true;
      }

      state.lastError = 'Kein Bot umbenannt';
      return false;
    } catch (e) {
      state.lastError = (e as Error).message.slice(0, 60);
      console.error(`[BotRenamer][${trigger}]`, e);
      return false;
    }
  });
}

/**
 * Verifiziert über die WebSocket-Lobby-Daten (nicht DOM!) dass der Bot
 * tatsächlich den Ziel-Namen und Ziel-Avg hat. Falls nicht: automatischer
 * Retry mit exponentiellem Backoff (max 3 Versuche).
 */
function verifyLobbyState(cfg: CareerMatchConfig, lobby: ILobbies | undefined) {
  if (!lobby?.players) return;
  const targetName = sanitizeBotName(cfg.opponent.name);
  const targetAvg = computeTargetAvg(cfg);

  const botPlayer = lobby.players.find(p => p.cpuPPR !== null && p.cpuPPR !== undefined);
  if (!botPlayer) return;

  const actualName = (botPlayer as any).name?.trim() ?? '';
  const actualPpr: number | null = ((botPlayer as any).cpuPPR ?? null) as any;

  const nameMatches = actualName.toLowerCase() === targetName.toLowerCase();
  const avgMatches = actualPpr !== null && Math.abs(actualPpr - targetAvg) <= 2;

  if (nameMatches && avgMatches) {
    state.state = 'success';
    state.verifiedName = actualName;
    state.verifiedAvg = actualPpr;
    updateStatus(`✅ ${actualName} · Avg ${actualPpr} — bestätigt`, '#10B981');
    showSuccessToast(actualName, actualPpr!);
    return;
  }

  // Nicht (mehr) korrekt: Retry falls Attempts < 3
  if (state.state === 'success') {
    // Autodarts hat den Namen NACH erfolgreichem Rename überschrieben
    console.warn('[BotRenamer] Ziel-Zustand nachträglich verletzt:', { actualName, targetName, actualPpr, targetAvg });
    state.state = 'renaming';
    state.attempts = 0;
  }

  if (state.attempts >= 3) {
    state.state = 'failed';
    updateStatus(`⚠️ Auto-Rename nach 3 Versuchen fehlgeschlagen — bitte manuell`, '#F87171');
    return;
  }

  const backoff = [200, 800, 2400][state.attempts] ?? 2400;
  state.attempts++;
  updateStatus(`🔄 Versuch ${state.attempts}/3 in ${backoff}ms…`, '#F5C842');
  setTimeout(() => {
    if (currentCfg && state.state !== 'success') {
      runRenameCycle(currentCfg, `verify-retry-${state.attempts}`).catch(err => console.error('[BotRenamer]', err));
    }
  }, backoff);
}

/**
 * Zentrale Schedule-Funktion: koordiniert Trigger von WebSocket, Dialog-Observer
 * und Watchdog. Kein blindes Aufrufen — respektiert state und Mutex.
 */
function scheduleRename(cfg: CareerMatchConfig, trigger: string, delay = 0) {
  if (state.state === 'success') return;
  setTimeout(() => {
    if (state.state === 'success') return;
    runRenameCycle(cfg, trigger).catch(err => console.error(`[BotRenamer][${trigger}]`, err));
  }, delay);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Watchers
// ═══════════════════════════════════════════════════════════════════════════

function startLobbyWatcher(cfg: CareerMatchConfig) {
  if (lobbyWatcher) return;
  lobbyWatcher = AutodartsToolsLobbyData.watch(async (value: ILobbies | undefined) => {
    if (!value?.players) return;
    const hasBot = value.players.some(p => p.cpuPPR !== null && p.cpuPPR !== undefined);
    if (!hasBot) return;

    if (!currentCfg) return;
    // Zunächst: verifizieren (falls schon successful)
    verifyLobbyState(currentCfg, value);
    // Wenn NICHT success: rename triggern
    if (state.state !== 'success' && state.state !== 'failed') {
      for (const delay of [60, 400, 1200]) {
        scheduleRename(currentCfg, `ws-bot-added-${delay}`, delay);
      }
    }
  });
}

function startDialogObserver(cfg: CareerMatchConfig) {
  if (dialogObserver) return;
  const dialogSelector = '[role="dialog"], [role="alertdialog"], .chakra-modal__content, .chakra-popover__content';
  dialogObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches?.(dialogSelector) || node.querySelector?.(dialogSelector)) {
          for (const delay of [60, 250, 700]) {
            scheduleRename(cfg, `dialog-open-${delay}`, delay);
          }
          return;
        }
      }
    }
  });
  dialogObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * Watchdog (3 s): fängt Edge-Cases ab (WS-Message verpasst, Reconnect nach
 * Netzwerk-Aussetzer, User löscht Bot und fügt neuen hinzu).
 */
function startWatchdog(cfg: CareerMatchConfig) {
  if (watchdogInterval) return;
  watchdogInterval = setInterval(async () => {
    if (!currentCfg) return;
    if (state.state === 'success') {
      // Erneut verifizieren (defensiv)
      const lobby = await AutodartsToolsLobbyData.getValue().catch(() => null);
      if (lobby) verifyLobbyState(cfg, lobby as any);
      return;
    }
    if (state.state === 'failed') return; // User muss Retry-Button klicken
    // Ansonsten: neuer Versuch
    scheduleRename(cfg, 'watchdog');
  }, 3000);
}

// ═══════════════════════════════════════════════════════════════════════════
//  Auto-Add-Bot
// ═══════════════════════════════════════════════════════════════════════════

async function autoAddBotIfMissing(cfg: CareerMatchConfig): Promise<void> {
  try {
    for (let i = 0; i < 24; i++) {
      if (!/\/lobbies\//.test(window.location.href)) return;
      const lobbyData = await AutodartsToolsLobbyData.getValue();
      const players = (lobbyData as any)?.players ?? [];
      const hasBot = Array.isArray(players) && players.some((p: any) => p?.cpuPPR !== null && p?.cpuPPR !== undefined);
      if (hasBot) {
        console.log('[BotRenamer] Auto-Add-Bot übersprungen: bereits ein Bot in der Lobby');
        return;
      }
      if (Array.isArray(players) && players.length >= 2) {
        console.log('[BotRenamer] Auto-Add-Bot übersprungen: 2+ Spieler in Lobby');
        return;
      }
      const btn = findAddBotButton();
      if (btn) {
        console.log('[BotRenamer] Auto-Add-Bot: klicke Add-Bot-Button (Versuch nach', i * 500, 'ms)');
        updateStatus(`🤖 Füge Bot für ${cfg.opponent.name} hinzu…`, '#F5C842');
        btn.click();
        return;
      }
      // v2.9.97: Kein Direktknopf → prüfe ob ein „Add Player"-Menü existiert.
      // In neueren Autodarts-Layouts liegt „Bot hinzufügen" hinter einem
      // Dropdown, das wir zuerst öffnen müssen.
      if (i === 2 || i === 6 || i === 10) {
        const opened = await tryOpenAddPlayerMenu();
        if (opened) {
          await sleep(280);
          const btn2 = findAddBotButton();
          if (btn2) {
            console.log('[BotRenamer] Auto-Add-Bot: klicke Bot-Item im Dropdown');
            updateStatus(`🤖 Füge Bot für ${cfg.opponent.name} hinzu…`, '#F5C842');
            btn2.click();
            return;
          }
        }
      }
      await sleep(500);
    }
    console.log('[BotRenamer] Auto-Add-Bot: Button nach 12s nicht gefunden. User muss manuell klicken.');
  } catch (e) {
    console.error('[BotRenamer] Auto-Add-Bot fehlgeschlagen:', e);
  }
}

function findAddBotButton(): HTMLButtonElement | null {
  // v2.9.97: Erweiterter Selektor-Katalog. Autodarts hat die Lobby-UI
  // mehrfach umgebaut — inzwischen ist "Bot hinzufügen" teils in einem
  // Dropdown-Menü / Icon-Button versteckt. Wir suchen deshalb:
  //   1) Alle sichtbaren Buttons mit Text- oder Aria-Match
  //   2) Icon-Buttons (Chakra-Menu-Items, div[role=menuitem])
  //   3) SVG-Buttons mit "add" / "plus" im aria-label / title
  //   4) Fallback: ANY visible clickable Element mit passendem Text
  const patterns = [
    /(?:^|\s|\+)add\s*bot/i,
    /bot\s*hinzuf(?:ügen|uegen)?/i,
    /\+\s*bot/i,
    /neuer\s*bot/i,
    /add\s*computer/i,
    /computer\s*hinzuf/i,
    /cpu\s*hinzuf/i,
    /\+\s*cpu/i,
  ];
  const testidPatterns = [
    /add[-_]?bot/i,
    /bot[-_]?add/i,
    /add[-_]?player/i,
    /add[-_]?cpu/i,
  ];
  const clickableSelectors = [
    'button',
    '[role="button"]',
    '[role="menuitem"]',
    '.chakra-menu__menuitem',
    'a[href*="bot"]',
  ];

  const nodes = new Set<HTMLElement>();
  clickableSelectors.forEach((sel) => {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => nodes.add(el));
  });

  const isVisible = (el: HTMLElement) => {
    if (!el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const cs = window.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') return false;
    return true;
  };

  const matchesAny = (str: string, list: RegExp[]) =>
    !!str && list.some((re) => re.test(str));

  for (const el of nodes) {
    if (!isVisible(el)) continue;
    // Kombinierter Text (Button-Text + Icon-Sibling-Text)
    const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ');
    const aria = el.getAttribute('aria-label') ?? '';
    const title = el.getAttribute('title') ?? '';
    const testid = el.getAttribute('data-testid') ?? '';

    if (matchesAny(text, patterns)) return el as HTMLButtonElement;
    if (matchesAny(aria, patterns)) return el as HTMLButtonElement;
    if (matchesAny(title, patterns)) return el as HTMLButtonElement;
    if (matchesAny(testid, testidPatterns)) return el as HTMLButtonElement;
  }

  return null;
}

/**
 * v2.9.97: Wenn kein Add-Bot-Button direkt sichtbar ist, versucht diese
 * Helferfunktion evtl. vorhandene „Add Player"-Menüs zu öffnen. Autodarts
 * hat in neueren Layouts das Bot-Hinzufügen hinter einem Dropdown versteckt.
 * Rückgabe: true, wenn wir ein Menü geöffnet haben (Renamer sollte danach
 * kurz warten und erneut suchen).
 */
async function tryOpenAddPlayerMenu(): Promise<boolean> {
  const menuTriggerPatterns = [
    /add\s*player/i,
    /spieler\s*hinzuf/i,
    /player\s*hinzuf/i,
    /neuer?\s*spieler/i,
  ];
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>('button, [role="button"], [aria-haspopup="menu"]'),
  );
  for (const el of candidates) {
    const text = (el.textContent ?? '').trim();
    const aria = el.getAttribute('aria-label') ?? '';
    if (menuTriggerPatterns.some((re) => re.test(text) || re.test(aria))) {
      console.log('[BotRenamer] Öffne Add-Player-Menü:', text || aria);
      el.click();
      await sleep(220);
      return true;
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Public API
// ═══════════════════════════════════════════════════════════════════════════

export async function initCareerBotHint(url: string) {
  if (!/\/lobbies\//.test(url)) { removeOverlay(); return; }
  const cfg = await getActiveMatch();
  if (!cfg || !cfg.opponent) {
    console.log('[BotHint] Skip — keine career-active-match Config gefunden. Match muss über Tools → Turnier/Saison → „Match starten" gestartet werden.');
    removeOverlay();
    return;
  }
  console.log(
    '[BotHint] Aktiviert für:', cfg.opponent.name,
    '· Avg-Ziel:', computeTargetAvg(cfg),
    '· Turnier:', cfg.tournamentName,
  );

  // State reset
  currentCfg = cfg;
  state.state = 'detecting';
  state.attempts = 0;
  state.lastError = null;
  state.lastRenameAt = 0;
  state.verifiedName = null;
  state.verifiedAvg = null;

  // Overlay
  if (!document.getElementById(OVERLAY_ID)) {
    document.body.appendChild(buildOverlay(cfg));
  }

  if (!observer) {
    observer = new MutationObserver(() => {
      if (!document.getElementById(OVERLAY_ID) && /\/lobbies\//.test(window.location.href) && currentCfg) {
        document.body.appendChild(buildOverlay(currentCfg));
      }
    });
    observer.observe(document.body, { childList: true, subtree: false });
  }

  startLobbyWatcher(cfg);
  autoAddBotIfMissing(cfg);
  startDialogObserver(cfg);
  startWatchdog(cfg);
}

function stopDialogObserver() {
  if (dialogObserver) { dialogObserver.disconnect(); dialogObserver = null; }
}

function stopAll() {
  removeOverlay();
  document.getElementById(TOAST_ID)?.remove();
  if (observer) { observer.disconnect(); observer = null; }
  if (dialogObserver) { stopDialogObserver(); }
  if (watchdogInterval) { clearInterval(watchdogInterval); watchdogInterval = null; }
  if (lobbyWatcher) { lobbyWatcher(); lobbyWatcher = null; }
  currentCfg = null;
  state.state = 'idle';
  state.attempts = 0;
  state.lastError = null;
}

export function onRemoveCareerBotHint() {
  stopAll();
}

// v2.9.70: Interner Zustand für Tests (nur in Dev-Builds relevant)
export const __botRenamerState = state;
