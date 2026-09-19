/**
 * dart-coins.ts — v2.9.88
 *
 * In-Game-Währung, verdient durch Karriere-Aktionen und einlösbar für
 * kosmetische Freischaltungen (Bot-Skins jenseits der Startauswahl,
 * Walk-On-Song-Slots, Chant-Packs, Titel).
 *
 * Rein virtuell — kein Bezug zu echtem Geld. Zukünftige Monetarisierung
 * (z.B. Coin-Packs via Stripe) würde separate `dartCoinsPurchased`-Felder
 * bekommen und wäre klar getrennt von `dartCoinsTotal` (verdient).
 */

/** Alle Karriere-Ereignisse, die Coins abwerfen. */
export const COIN_REWARDS = {
  matchWon:            50,   // Jeder Match-Sieg im Karriere-Modus
  matchLost:           10,   // Trostpreis für vollständig gespieltes Match
  scored180:           25,   // Pro 180er
  scored170:           15,   // Pro 170er
  scored140plus:        5,   // Pro 140-169
  checkout100plus:     10,   // Pro Finish ≥100
  checkoutBigFish:     50,   // 170er Bigfish-Checkout
  tournamentWon:      500,   // Turnier-Finale gewonnen
  tournamentReached:  100,   // Turnier-Runde erreicht (early rounds)
  achievementUnlock:  100,   // Achievement freigeschaltet
  speedrunRecord:     250,   // Neuer Marathon-Personal-Best
  nineDarter:        1000,   // Der weiße Wal
} as const;

export type CoinRewardKey = keyof typeof COIN_REWARDS;

/** Kosmetische Freischaltungen, die für Coins gekauft werden können. */
export interface CoinShopItem {
  id: string;
  category: 'skin' | 'audio' | 'title' | 'venue';
  labelDe: string;
  labelEn: string;
  descriptionDe: string;
  price: number;
  icon: string;
}

export const COIN_SHOP: CoinShopItem[] = [
  {
    id: 'skin-premium-bundle',
    category: 'skin',
    labelDe: 'Premium Bot-Skin-Bundle',
    labelEn: 'Premium Bot Skin Bundle',
    descriptionDe: 'Schaltet 20 zusätzliche PDC-Bot-Skins frei (jenseits der 20 Standard-Skins).',
    price: 300,
    icon: '🎭',
  },
  {
    id: 'walkon-song-slot',
    category: 'audio',
    labelDe: 'Zweiter Walk-On-Song-Slot',
    labelEn: 'Second Walk-On Song Slot',
    descriptionDe: 'Nutze verschiedene Walk-On-Songs für unterschiedliche Turniere.',
    price: 200,
    icon: '🎵',
  },
  {
    id: 'chant-pack-arena',
    category: 'audio',
    labelDe: 'Chant-Pack „Arena Wall of Sound"',
    labelEn: 'Chant Pack "Arena Wall of Sound"',
    descriptionDe: '12 Community-Chants für Deciding-Legs und Matchbälle.',
    price: 500,
    icon: '📣',
  },
  {
    id: 'title-legend',
    category: 'title',
    labelDe: 'Titel „Legende"',
    labelEn: 'Title "Legend"',
    descriptionDe: 'Ehrentitel neben deinem Namen in ELO- und Marathon-Leaderboards.',
    price: 1000,
    icon: '👑',
  },
  {
    id: 'venue-arena-boost',
    category: 'venue',
    labelDe: 'Venue-Boost „Deciding-Leg Escalation"',
    labelEn: 'Venue Boost "Deciding-Leg Escalation"',
    descriptionDe: 'Aktiviert dramatische Crowd-Steigerung in jeder Match-Winner-Situation.',
    price: 400,
    icon: '⚡',
  },
];

/** Coin-Zustand einer Karriere. Wird an CareerSeason angehängt. */
export interface DartCoinsState {
  /** Aktuell verfügbares Guthaben. */
  balance: number;
  /** Lifetime verdient (kann Balance übersteigen, wenn ausgegeben). */
  totalEarned: number;
  /** IDs freigeschalteter COIN_SHOP items. */
  unlockedItemIds: string[];
  /** Verdient-History (für Statistik/CSV). */
  history: CoinTransaction[];
}

export interface CoinTransaction {
  date: string;     // ISO 8601
  amount: number;   // positiv = verdient, negativ = ausgegeben
  reason: string;   // z.B. "matchWon:tournamentName" oder "shop:skin-premium-bundle"
  balance: number;  // Balance NACH dieser Transaktion
}

/** Initialisiert eine leere Coin-Kasse. Wird von CareerEngine.createNewSeason() aufgerufen. */
export function createInitialCoinsState(): DartCoinsState {
  return {
    balance: 0,
    totalEarned: 0,
    unlockedItemIds: [],
    history: [],
  };
}

/** Vergibt Coins und schreibt sie in die History. */
export function awardCoins(
  state: DartCoinsState,
  amount: number,
  reason: string,
): DartCoinsState {
  if (amount <= 0) return state;
  const balance = state.balance + amount;
  return {
    ...state,
    balance,
    totalEarned: state.totalEarned + amount,
    history: [
      ...(state.history ?? []),
      { date: new Date().toISOString(), amount, reason, balance },
    ].slice(-500),  // max 500 Einträge (Anti-Bloat)
  };
}

/** Gibt Coins aus, wenn Balance reicht. */
export function spendCoins(
  state: DartCoinsState,
  price: number,
  itemId: string,
): { ok: boolean; state: DartCoinsState; reason?: string } {
  if (state.unlockedItemIds.includes(itemId)) {
    return { ok: false, state, reason: 'already-unlocked' };
  }
  if (state.balance < price) {
    return { ok: false, state, reason: 'insufficient-balance' };
  }
  const balance = state.balance - price;
  return {
    ok: true,
    state: {
      ...state,
      balance,
      unlockedItemIds: [...state.unlockedItemIds, itemId],
      history: [
        ...(state.history ?? []),
        { date: new Date().toISOString(), amount: -price, reason: `shop:${itemId}`, balance },
      ].slice(-500),
    },
  };
}

/** Convenience: Coins pro Score. */
export function coinsForScore(score: number): number {
  if (score === 180) return COIN_REWARDS.scored180;
  if (score >= 170) return COIN_REWARDS.scored170;
  if (score >= 140) return COIN_REWARDS.scored140plus;
  return 0;
}
