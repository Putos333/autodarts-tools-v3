/**
 * selector-health.ts — v2.9.86
 *
 * Zentrales Frühwarn-System für tote CSS-Selektoren. Autodarts.io ändert
 * regelmäßig die DOM-Struktur (z.B. `<tr>` → `<div>`) und Features wie
 * der Bot-Renamer oder das Auto-Continue können dann stillschweigend
 * scheitern. Bisher gab es nur `console.warn` — der User sah nichts.
 *
 * Jetzt: Content-Scripts rufen `reportSelectorMiss(feature, selector)` auf
 * wenn ihre Selektor-Suche in ALLEN Fallbacks scheitert. Ein Debouncer
 * sammelt die Misses und zeigt nach 3s ein dezentes Toast-Overlay unten
 * rechts:
 *
 *     ⚠️ Autodarts Tools: 2 Features evtl. veraltet
 *     · Bot-Renamer     (Selector .ad-ext-player-name)
 *     · Auto-Continue   (Selector button[data-testid="continue"])
 *     [Details] [Ausblenden]
 *
 * So sieht der User sofort, wenn autodarts.io was umgebaut hat.
 */

interface MissEntry {
  feature: string;
  selector: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

const misses = new Map<string, MissEntry>();
let toastEl: HTMLDivElement | null = null;
let scheduleHandle: number | null = null;
let dismissedUntil = 0;

const DEBOUNCE_MS = 3000;
const DISMISS_MS = 5 * 60_000; // 5 min "später erinnern"

/**
 * Meldet, dass ein CSS-Selektor keine Elemente gefunden hat.
 * Wird nur aufgerufen, wenn ALLE Fallback-Selektoren gescheitert sind
 * (also das Feature tatsächlich blockiert ist).
 */
export function reportSelectorMiss(feature: string, selector: string): void {
  const key = `${feature}::${selector}`;
  const now = Date.now();
  const existing = misses.get(key);
  if (existing) {
    existing.count += 1;
    existing.lastSeen = now;
  } else {
    misses.set(key, { feature, selector, count: 1, firstSeen: now, lastSeen: now });
  }
  console.warn(`[AT-Health] Selector-Miss: feature="${feature}" selector="${selector}"`);
  scheduleToast();
}

/** Nur für Tests / Debug. */
export function getMissedSelectors(): MissEntry[] {
  return Array.from(misses.values());
}

/** Nur für Tests / Debug. Löscht die Miss-Historie und den Toast. */
export function resetSelectorHealth(): void {
  misses.clear();
  toastEl?.remove();
  toastEl = null;
  if (scheduleHandle !== null) {
    clearTimeout(scheduleHandle);
    scheduleHandle = null;
  }
}

function scheduleToast(): void {
  if (Date.now() < dismissedUntil) return;
  if (scheduleHandle !== null) return;
  scheduleHandle = window.setTimeout(() => {
    scheduleHandle = null;
    renderToast();
  }, DEBOUNCE_MS);
}

function renderToast(): void {
  if (Date.now() < dismissedUntil) return;
  if (typeof document === 'undefined' || !document.body) return;
  if (misses.size === 0) return;

  const uniqueFeatures = new Set(Array.from(misses.values()).map(m => m.feature));

  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.id = 'adt-selector-health-toast';
    toastEl.setAttribute('data-testid', 'adt-health-toast');
    toastEl.style.cssText = [
      'position: fixed',
      'bottom: 20px',
      'right: 20px',
      'z-index: 2147483647',
      'background: #1a1a1f',
      'color: #e8eaf0',
      'border: 1px solid #f59f00',
      'border-radius: 6px',
      'padding: 12px 14px',
      'font-family: -apple-system, "Segoe UI", Roboto, sans-serif',
      'font-size: 12px',
      'line-height: 1.5',
      'box-shadow: 0 6px 24px rgba(0,0,0,0.45)',
      'max-width: 340px',
      'min-width: 260px',
    ].join('; ');
    document.body.appendChild(toastEl);
  }

  const rows = Array.from(misses.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(m => `
      <div style="margin-top:4px; opacity:0.9; font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:10.5px;">
        · <b style="color:#f5c842;">${escapeHtml(m.feature)}</b>
        <span style="opacity:0.7;">(${m.count}× · ${escapeHtml(m.selector).slice(0, 44)})</span>
      </div>`).join('');

  toastEl.innerHTML = `
    <div style="display:flex; align-items:center; gap:6px; font-weight:700; color:#f5c842;">
      ⚠️ Autodarts Tools
    </div>
    <div style="margin-top:4px; color:#e8eaf0;">
      ${uniqueFeatures.size} Feature${uniqueFeatures.size === 1 ? '' : 's'} evtl. veraltet — autodarts.io hat vermutlich seine UI umgebaut.
    </div>
    ${rows}
    <div style="margin-top:10px; display:flex; gap:6px; justify-content:flex-end;">
      <button data-testid="adt-health-details" style="background:#2a2a30; color:#e8eaf0; border:1px solid #444; border-radius:4px; padding:4px 10px; cursor:pointer; font-size:11px;">Details in Konsole</button>
      <button data-testid="adt-health-dismiss" style="background:#f59f00; color:#0d1b2a; border:none; border-radius:4px; padding:4px 10px; cursor:pointer; font-size:11px; font-weight:700;">5 min ausblenden</button>
    </div>
  `;

  toastEl.querySelector<HTMLButtonElement>('[data-testid="adt-health-details"]')?.addEventListener('click', () => {
    console.group('[AT-Health] Selektor-Misses (letzte Session)');
    misses.forEach(m => console.info(`${m.feature} · ${m.selector} · ${m.count}×`));
    console.groupEnd();
  });
  toastEl.querySelector<HTMLButtonElement>('[data-testid="adt-health-dismiss"]')?.addEventListener('click', () => {
    dismissedUntil = Date.now() + DISMISS_MS;
    toastEl?.remove();
    toastEl = null;
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
}
