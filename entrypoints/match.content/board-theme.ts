/**
 * board-theme.ts — Injizierender Layer für benutzerdefinierte Board-Themes.
 *
 * v2.9.91: läuft PARALLEL zu `venue-theming.ts`. Wenn der User „Manual"-Mode
 * gewählt hat, überlagert dieser Layer die venue-Farben mit einem eigenen
 * Theme (nur UI-Chrome — Vignette, Border, BG-Gradient, Badge-Farbe).
 *
 * ⚠ WICHTIG:
 *   • Wir setzen NIEMALS filter/opacity/transform auf <video>, <img>, canvas
 *     oder das eigentliche Board-Element. Der Kamera-View der Dartscheibe darf
 *     unter keinen Umständen überdeckt oder eingefärbt werden.
 *   • Alle Selektoren zielen ausschließlich auf `body::before`, `body::after`,
 *     und einen Badge-Div, den wir selbst injizieren.
 */

import { getActiveBoardTheme, BOARD_THEME_MODE_KEY, BOARD_THEME_MANUAL_KEY, type BoardTheme } from '@/utils/board-themes';

const STYLE_ID = 'adt-board-theme-style';
const BADGE_ID = 'adt-board-theme-badge';
const BODY_CLASS = 'adt-board-theme-active';

let styleEl: HTMLStyleElement | null = null;
let badgeEl: HTMLDivElement | null = null;
let storageListener: ((changes: Record<string, any>, area: string) => void) | null = null;

function buildCssFor(theme: BoardTheme): string {
  return `
    /* v2.9.91 Board-Theme: NUR UI-Chrome, niemals das Dartboard-Video. */
    body.${BODY_CLASS} {
      /* subtiler Vollbild-Gradient nur als Overlay */
      background-image: ${theme.bgGradient};
      background-attachment: fixed;
    }
    body.${BODY_CLASS}::before {
      content: '';
      position: fixed; inset: 0; pointer-events: none;
      /* über Autodarts-Content, aber UNTER dem Board-Video (das mit
         eigener Position stacked ist). z-index bewusst niedrig — das
         Video steht bei Autodarts bei z-index auto/isolated. */
      z-index: 40;
      box-shadow: inset 0 0 260px 50px ${theme.vignette},
                  inset 0 -100px 100px -20px ${theme.vignette};
    }
    body.${BODY_CLASS}::after {
      content: '';
      position: fixed; top: 0; left: 0; right: 0; height: 3px;
      pointer-events: none;
      z-index: 999998;
      background: linear-gradient(90deg,
        transparent 0%, ${theme.primary} 25%, ${theme.secondary} 50%,
        ${theme.primary} 75%, transparent 100%);
      box-shadow: 0 0 12px ${theme.glow};
    }
    /* Score-Panels bekommen einen Akzentrand — Kamera-Panels (video/canvas)
       werden explizit AUSGESCHLOSSEN. */
    body.${BODY_CLASS} [class*="score"]:not(script):not(style):not(video):not(canvas) {
      border-top: 2px solid ${theme.primary} !important;
    }
    /* Theme-Badge unten rechts (venue-badge sitzt links, kein Konflikt) */
    #${BADGE_ID} {
      position: fixed; bottom: 14px; right: 88px;
      z-index: 2147483000;
      background: rgba(2,6,15,0.75); backdrop-filter: blur(4px);
      border: 1px solid ${theme.primary};
      color: #FFFFFF;
      padding: 6px 12px; border-radius: 4px;
      font-family: "Barlow Condensed","Arial Narrow",Arial,sans-serif;
      font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
      pointer-events: none; user-select: none;
      display: flex; align-items: center; gap: 8px;
    }
    #${BADGE_ID}::before {
      content: '';
      width: 8px; height: 8px; border-radius: 50%;
      background: ${theme.primary}; box-shadow: 0 0 8px ${theme.glow};
    }
  `;
}

function applyTheme(theme: BoardTheme | null) {
  document.body.classList.remove(BODY_CLASS);

  if (!theme) {
    if (styleEl) { styleEl.remove(); styleEl = null; }
    if (badgeEl) { badgeEl.remove(); badgeEl = null; }
    return;
  }

  document.body.classList.add(BODY_CLASS);

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.setAttribute('data-adt-own', '1');
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildCssFor(theme);

  if (!badgeEl) {
    badgeEl = document.createElement('div');
    badgeEl.id = BADGE_ID;
    badgeEl.setAttribute('data-testid', 'board-theme-badge');
    document.body.appendChild(badgeEl);
  }
  badgeEl.textContent = `${theme.emoji} ${theme.label}`;
}

async function refresh() {
  const theme = await getActiveBoardTheme();
  applyTheme(theme);
}

export async function initBoardTheme() {
  await refresh();
  if (storageListener) return;
  storageListener = (changes: Record<string, any>, area: string) => {
    if (area !== 'local') return;
    if (BOARD_THEME_MODE_KEY in changes || BOARD_THEME_MANUAL_KEY in changes) {
      refresh().catch((e) => console.error('[BoardTheme]', e));
    }
  };
  browser.storage.onChanged.addListener(storageListener);
}

export function cleanupBoardTheme() {
  if (storageListener) {
    browser.storage.onChanged.removeListener(storageListener);
    storageListener = null;
  }
  applyTheme(null);
}
