// v2.9.64: Venue-Theming — Match-Bildschirm visuell an aktives Venue anpassen
// ---------------------------------------------------------------------------
// Injiziert eine CSS-Style-Tag ins document.head mit Venue-spezifischen
// Farbakzenten (Vignette, Board-Ring, Score-Highlight). Reagiert live auf
// Venue-Wechsel via storage.onChanged.

import { getActiveVenueId, getVenue, type VenueId, type VenueProfile } from '@/utils/venue';

const STYLE_ID = 'adt-venue-theme-style';
const BODY_CLASS_PREFIX = 'adt-venue-';

// Farbschema pro Venue (Akzent, Sekundär-Ton, Hue-Rotate für Board-Ring)
const VENUE_PALETTE: Record<VenueId, { primary: string; secondary: string; glow: string; vignette: string; label: string; }> = {
  'ally-pally':       { primary: '#E8002D', secondary: '#FFD700', glow: 'rgba(232,0,45,0.35)',   vignette: 'rgba(232,0,45,0.10)',  label: '🏆 Ally Pally · Alexandra Palace' },
  'blackpool':        { primary: '#00A6D6', secondary: '#F5C842', glow: 'rgba(0,166,214,0.35)',  vignette: 'rgba(0,90,180,0.14)',  label: '🌊 Blackpool · Winter Gardens' },
  'butlins-minehead': { primary: '#F59E0B', secondary: '#FDE68A', glow: 'rgba(245,158,11,0.35)', vignette: 'rgba(245,158,11,0.12)', label: "🏖️ Butlin's · Minehead" },
  'utilita-arena':    { primary: '#8B5CF6', secondary: '#F0ABFC', glow: 'rgba(139,92,246,0.35)', vignette: 'rgba(139,92,246,0.14)', label: '🎪 Utilita Arena · Premier League' },
  'tv-studio':        { primary: '#64748B', secondary: '#94A3B8', glow: 'rgba(100,116,139,0.25)', vignette: 'rgba(15,23,42,0.20)',   label: '📺 Sky Sports · TV Studio' },
  'local-pub':        { primary: '#92400E', secondary: '#FCD34D', glow: 'rgba(146,64,14,0.35)',  vignette: 'rgba(146,64,14,0.15)',  label: '🍺 Local Pub Night' },
};

const VENUE_BADGE_ID = 'adt-venue-badge';
let styleEl: HTMLStyleElement | null = null;
let badgeEl: HTMLDivElement | null = null;
let storageListener: ((changes: Record<string, any>, area: string) => void) | null = null;

function buildCssFor(venue: VenueProfile): string {
  const p = VENUE_PALETTE[venue.id];
  if (!p) return '';
  return `
    :root {
      --adt-venue-primary: ${p.primary};
      --adt-venue-secondary: ${p.secondary};
      --adt-venue-glow: ${p.glow};
    }
    /* Vignette + subtiler radialer Rahmen — sichtbar, ohne Autodarts UI zu blockieren */
    body.${BODY_CLASS_PREFIX}${venue.id}::before {
      content: '';
      position: fixed; inset: 0; pointer-events: none;
      z-index: 999999;
      box-shadow: inset 0 0 220px 40px ${p.vignette},
                  inset 0 -80px 80px -20px ${p.vignette};
    }
    body.${BODY_CLASS_PREFIX}${venue.id}::after {
      content: '';
      position: fixed; top: 0; left: 0; right: 0; height: 3px;
      pointer-events: none;
      z-index: 999999;
      background: linear-gradient(90deg, transparent 0%, ${p.primary} 25%, ${p.secondary} 50%, ${p.primary} 75%, transparent 100%);
      box-shadow: 0 0 12px ${p.glow};
    }
    /* Sanfter Board-Glow (targetet größte SVG oder canvas — Autodarts Board-Container) */
    body.${BODY_CLASS_PREFIX}${venue.id} svg[class*="board"],
    body.${BODY_CLASS_PREFIX}${venue.id} canvas[class*="board"] {
      filter: drop-shadow(0 0 24px ${p.glow});
      transition: filter 0.35s ease-in-out;
    }
    /* Score-Panels bekommen einen 2px-Akzentrand oben (falls Autodarts DOM einen Rand zulässt) */
    body.${BODY_CLASS_PREFIX}${venue.id} [class*="score"]:not(script):not(style) {
      border-top: 2px solid ${p.primary} !important;
    }
    /* Venue-Badge unten links */
    #${VENUE_BADGE_ID} {
      position: fixed; bottom: 14px; left: 14px; z-index: 2147483000;
      background: rgba(2,6,15,0.75); backdrop-filter: blur(4px);
      border: 1px solid ${p.primary};
      color: #FFFFFF;
      padding: 6px 12px; border-radius: 4px;
      font-family: "Barlow Condensed","Arial Narrow",Arial,sans-serif;
      font-size: 12px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
      pointer-events: none; user-select: none;
      display: flex; align-items: center; gap: 8px;
    }
    #${VENUE_BADGE_ID}::before {
      content: '';
      width: 8px; height: 8px; border-radius: 50%;
      background: ${p.primary}; box-shadow: 0 0 8px ${p.glow};
      animation: adt-pulse 2s ease-in-out infinite;
    }
    @keyframes adt-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;
}

function removeAllVenueClasses() {
  document.body.classList.forEach((c) => {
    if (c.startsWith(BODY_CLASS_PREFIX)) document.body.classList.remove(c);
  });
}

function applyThemeFor(venue: VenueProfile | null) {
  removeAllVenueClasses();

  if (!venue) {
    if (styleEl) { styleEl.remove(); styleEl = null; }
    if (badgeEl) { badgeEl.remove(); badgeEl = null; }
    return;
  }

  document.body.classList.add(`${BODY_CLASS_PREFIX}${venue.id}`);

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.setAttribute('data-adt-own', '1');
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = buildCssFor(venue);

  // Venue-Badge im Match-Bildschirm
  if (!badgeEl) {
    badgeEl = document.createElement('div');
    badgeEl.id = VENUE_BADGE_ID;
    badgeEl.setAttribute('data-testid', 'venue-badge');
    document.body.appendChild(badgeEl);
  }
  const p = VENUE_PALETTE[venue.id];
  badgeEl.textContent = p?.label ?? venue.name;
}

async function refresh() {
  const id = await getActiveVenueId();
  const venue = id ? (getVenue(id) ?? null) : null;
  applyThemeFor(venue);
}

export async function initVenueTheming() {
  await refresh();
  if (storageListener) return;
  storageListener = (changes: Record<string, any>, area: string) => {
    if (area !== 'local') return;
    if ('adt-venue-active' in changes) {
      refresh().catch((e) => console.error('[VenueTheming]', e));
    }
  };
  browser.storage.onChanged.addListener(storageListener);
}

export function cleanupVenueTheming() {
  if (storageListener) {
    browser.storage.onChanged.removeListener(storageListener);
    storageListener = null;
  }
  applyThemeFor(null);
}
