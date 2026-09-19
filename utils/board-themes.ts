/**
 * board-themes.ts — Board-Theme-Katalog + Storage-Helper (v2.9.91).
 *
 * Der Turnier-/Match-Bildschirm wird von `venue-theming.ts` bereits mit einer
 * venue-abhängigen Farb-Palette (Vignette, Border-Streifen, Badge) versehen.
 * Für Nutzer, die eine feste ästhetische Präferenz haben (z.B. „ich will immer
 * Neon-Feeling, egal welches Venue"), erweitern wir das um ein zweites,
 * unabhängig wählbares Board-Theme.
 *
 * Zwei Modi:
 *   • auto   — kein zusätzliches Theme, venue-theming übernimmt komplett.
 *   • manual — das gewählte Theme wird ZUSÄTZLICH injiziert und überschreibt
 *              die venue-Farben auf UI-Chrome-Ebene (Border, Vignette, Badge-
 *              Farbe). Der Kamera-View / das eigentliche Autodarts-Board-Video
 *              bleibt IMMER unangetastet — wir setzen niemals filter/opacity/
 *              transform auf <video>, <img[src*="stream"]> oder canvas-Elemente.
 */

export type BoardThemeId =
  | 'neon'
  | 'midnight'
  | 'firebrand'
  | 'arctic'
  | 'oche-classic'
  | 'golden'
  | 'esports';

export type BoardThemeMode = 'auto' | 'manual';

export interface BoardTheme {
  id: BoardThemeId;
  label: string;
  emoji: string;
  primary: string;      // Akzentfarbe (Border, Highlight)
  secondary: string;    // Sekundär-Akzent
  glow: string;         // Glow-Farbe mit Alpha
  vignette: string;     // Radialer Randschatten
  bgGradient: string;   // Body-Background-Overlay-Gradient
  description: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'neon',
    label: 'Neon Arcade',
    emoji: '🎮',
    primary: '#00E5FF',
    secondary: '#FF00E5',
    glow: 'rgba(0,229,255,0.55)',
    vignette: 'rgba(0,229,255,0.14)',
    bgGradient: 'radial-gradient(ellipse at top, rgba(255,0,229,0.08) 0%, rgba(0,229,255,0.05) 60%, transparent 100%)',
    description: 'Cyan-Magenta Neon-Vibes, laut und leuchtend.',
  },
  {
    id: 'midnight',
    label: 'Midnight Oche',
    emoji: '🌙',
    primary: '#5B8CFF',
    secondary: '#8B5CF6',
    glow: 'rgba(91,140,255,0.35)',
    vignette: 'rgba(15,23,42,0.30)',
    bgGradient: 'radial-gradient(ellipse at top, rgba(91,140,255,0.10) 0%, rgba(15,23,42,0.25) 100%)',
    description: 'Kühles Nachtblau, konzentriert und ruhig.',
  },
  {
    id: 'firebrand',
    label: 'Firebrand',
    emoji: '🔥',
    primary: '#FF3B30',
    secondary: '#FFD60A',
    glow: 'rgba(255,59,48,0.45)',
    vignette: 'rgba(255,59,48,0.12)',
    bgGradient: 'radial-gradient(ellipse at top, rgba(255,214,10,0.08) 0%, rgba(255,59,48,0.05) 60%, transparent 100%)',
    description: 'Rot-Gelbe PDC-Klassik — Feuer und Gold.',
  },
  {
    id: 'arctic',
    label: 'Arctic Frost',
    emoji: '❄️',
    primary: '#7DD3FC',
    secondary: '#E0F2FE',
    glow: 'rgba(125,211,252,0.35)',
    vignette: 'rgba(125,211,252,0.10)',
    bgGradient: 'radial-gradient(ellipse at top, rgba(125,211,252,0.08) 0%, rgba(224,242,254,0.03) 100%)',
    description: 'Eisiges Hellblau, klar und minimal.',
  },
  {
    id: 'oche-classic',
    label: 'Oche Classic',
    emoji: '🎯',
    primary: '#E8002D',
    secondary: '#F5C842',
    glow: 'rgba(232,0,45,0.35)',
    vignette: 'rgba(232,0,45,0.10)',
    bgGradient: 'radial-gradient(ellipse at top, rgba(245,200,66,0.05) 0%, rgba(232,0,45,0.04) 100%)',
    description: 'Klassisches Autodarts-Tools-Rot mit Gold-Kante.',
  },
  {
    id: 'golden',
    label: 'Gold Standard',
    emoji: '🏆',
    primary: '#F5C842',
    secondary: '#FCD34D',
    glow: 'rgba(245,200,66,0.45)',
    vignette: 'rgba(245,200,66,0.12)',
    bgGradient: 'radial-gradient(ellipse at top, rgba(245,200,66,0.10) 0%, rgba(146,64,14,0.05) 100%)',
    description: 'Sikinger-Gold für WM-Finale-Feeling.',
  },
  {
    id: 'esports',
    label: 'Esports Green',
    emoji: '🕹️',
    primary: '#22C55E',
    secondary: '#84CC16',
    glow: 'rgba(34,197,94,0.4)',
    vignette: 'rgba(34,197,94,0.10)',
    bgGradient: 'radial-gradient(ellipse at top, rgba(34,197,94,0.08) 0%, rgba(15,42,26,0.20) 100%)',
    description: 'Neon-Grün für Streamer und Turnier-Nights.',
  },
];

export const BOARD_THEME_MODE_KEY = 'adt-board-theme-mode';
export const BOARD_THEME_MANUAL_KEY = 'adt-board-theme-manual';

/**
 * Liefert das aktuell konfigurierte Board-Theme.
 *
 *   • Modus `auto`    → null (kein Override, venue-theming allein).
 *   • Modus `manual`  → das gewählte Theme oder `oche-classic` als Fallback.
 */
export async function getActiveBoardTheme(): Promise<BoardTheme | null> {
  try {
    const res = await browser.storage.local.get([BOARD_THEME_MODE_KEY, BOARD_THEME_MANUAL_KEY]);
    const mode: BoardThemeMode = (res[BOARD_THEME_MODE_KEY] as BoardThemeMode) || 'auto';
    if (mode !== 'manual') return null;
    const manualId = (res[BOARD_THEME_MANUAL_KEY] as BoardThemeId) || 'oche-classic';
    return BOARD_THEMES.find(t => t.id === manualId) ?? BOARD_THEMES[4]; // oche-classic
  } catch (_) {
    return null;
  }
}

export async function setBoardThemeMode(mode: BoardThemeMode): Promise<void> {
  await browser.storage.local.set({ [BOARD_THEME_MODE_KEY]: mode });
}

export async function setBoardThemeManual(id: BoardThemeId): Promise<void> {
  await browser.storage.local.set({ [BOARD_THEME_MANUAL_KEY]: id });
}

export function getBoardTheme(id: BoardThemeId): BoardTheme | undefined {
  return BOARD_THEMES.find(t => t.id === id);
}
