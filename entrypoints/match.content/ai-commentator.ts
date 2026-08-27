/**
 * ai-commentator.ts – KI-gestützter Echtzeit-Kommentator
 *
 * Generiert live und kontextbezogene Kommentare via OpenAI TTS API.
 * Der Kommentator reagiert auf Spielereignisse und spricht echte,
 * abwechslungsreiche Sätze – wie ein echter TV-Kommentator.
 *
 * Unterstützte Ereignisse:
 *  - 180er           → Eskalation ("Einhundertundachtziiig!")
 *  - 140+            → Begeisterung
 *  - Checkout        → Spannung und Anerkennung
 *  - Bust            → Mitgefühl oder Drama
 *  - Matchshot       → Finale Kommentierung
 *  - Bogey-Number    → Hinweis auf die schwierige Situation
 *  - Niedriger Score → Leichte Kritik oder Aufmunterung
 *
 * Die API-Anfragen laufen über den Background-Service-Worker der Erweiterung
 * (CORS-Relay), da direkte Fetch-Calls aus Content-Scripts blockiert werden.
 */

import { AutodartsToolsConfig, type IConfig } from "@/utils/storage";
import type { IGameData } from "@/utils/game-data-storage";
import { speakText, type TTSConfig } from "@/utils/tts-provider";
import { getUserIdFromToken } from "@/utils/helpers";
import { generateAndSpeakDuo, duoIsSpeaking, duoStop, duoResetSession, type DuoEvent } from "@/utils/duo-commentator";

// ─── Kommentar-Bibliothek (Deutsch & Englisch) ────────────────────────────────

const COMMENTS: Record<string, Record<'de' | 'en', string[]>> = {
  score_180: {
    de: [
      "Einhundertundachtziiig! Was für ein Wurf!",
      "Einhundertachtzig! Das Maximum! Unglaubliche Szenen!",
      "Einhundertachtzig! Drei Triple-20 – perfekter Angriff!",
      "Einhundertachtzig! Das Board brennt heute Abend!",
      "Einhundertachtzig! Das ist Weltklasse-Darts!",
    ],
    en: [
      "One hundred and eighty! What a throw!",
      "One hundred and eighty! The maximum! Incredible scenes!",
      "One hundred and eighty! Three triple twenties – perfect!",
      "One hundred and eighty! The board is on fire tonight!",
    ],
  },
  score_140plus: {
    de: [
      "Starker Angriff! {score} Punkte – das war beeindruckend!",
      "{score}! {player} macht Druck – das war ein Statement-Besuch!",
      "Ausgezeichnet! {score} Punkte – {player} ist heute in Topform!",
      "{score}! Hervorragend gespielt, das war präzise Arbeit!",
    ],
    en: [
      "Strong visit! {score} points – that was impressive!",
      "{score}! {player} is applying pressure – what a visit!",
      "Excellent! {score} points – {player} is in top form tonight!",
    ],
  },
  score_100plus: {
    de: [
      "{score} Punkte – solider Besuch von {player}.",
      "{score}! {player} bleibt im Rhythmus.",
      "Gutes Scoring – {score} Punkte für {player}.",
    ],
    en: [
      "{score} points – solid visit from {player}.",
      "{score}! {player} keeps the rhythm going.",
    ],
  },
  bust: {
    de: [
      "Überworfen! Was für ein Drama – der Sieg war zum Greifen nah!",
      "Überworfen! {player} hat sich leider verzählt – das wird wehtun!",
      "Überworfen! Das darf nicht passieren – jetzt muss {player} wieder von vorne anfangen!",
      "Überworfen! Bitter für {player} – das war eine große Chance!",
    ],
    en: [
      "Bust! What a drama – victory was within reach!",
      "Bust! {player} has gone over – that's going to hurt!",
      "Bust! That cannot happen – {player} has to start again!",
    ],
  },
  checkout_high: {
    de: [
      "Was für ein Finish! {score} ausgecheckt – das ist Weltklasse!",
      "Unglaublich! {score} Checkout – {player} zeigt, was Darts ist!",
      "Spektakuläres Finish! {score} in einem Besuch – das Publikum ist aus dem Häuschen!",
    ],
    en: [
      "What a finish! {score} checkout – that is world class!",
      "Incredible! {score} checkout – {player} shows what darts is about!",
    ],
  },
  checkout_normal: {
    de: [
      "Game Shot! {player} macht es perfekt!",
      "Ausgecheckt! {player} gewinnt das Leg!",
      "Game Shot! Sauber gespielt von {player}!",
      "Und {player} macht den Deckel drauf – Game Shot!",
    ],
    en: [
      "Game Shot! {player} does it perfectly!",
      "Checked out! {player} wins the leg!",
      "Game Shot! Cleanly done by {player}!",
    ],
  },
  matchshot: {
    de: [
      "Game, Set und Match – {player} gewinnt! Was für ein Abend!",
      "Match Shot! {player} ist der Sieger! Fantastische Leistung!",
      "Das war es! {player} gewinnt das Match – herzlichen Glückwunsch!",
      "Match Shot! {player} triumphiert – was für ein Spiel das war!",
    ],
    en: [
      "Game, set and match – {player} wins! What an evening!",
      "Match Shot! {player} is the winner! Fantastic performance!",
      "That's it! {player} wins the match – congratulations!",
    ],
  },
  bogey_number: {
    de: [
      "Achtung – {score} ist eine Bogey-Number! Kein direktes Doppel-Finish möglich!",
      "{score} – das ist eine gefährliche Zahl! {player} muss jetzt taktisch denken!",
      "Bogey-Number {score}! {player} muss den Score erst aufräumen!",
    ],
    en: [
      "Watch out – {score} is a bogey number! No direct double finish possible!",
      "{score} – that's a dangerous number! {player} needs to think tactically!",
    ],
  },
  low_score: {
    de: [
      "Nur {score} Punkte – {player} findet heute nicht den Rhythmus.",
      "Das war nicht {player}s bester Besuch – nur {score} Punkte.",
      "{score} Punkte – {player} muss sich steigern!",
    ],
    en: [
      "Only {score} points – {player} can't find the rhythm today.",
      "That wasn't {player}'s best visit – only {score} points.",
    ],
  },
  gameon: {
    de: [
      "Willkommen zum Spiel! {player1} gegen {player2} – es kann losgehen!",
      "Game On! {player1} trifft auf {player2} – wer wird heute gewinnen?",
      "Die Darts sind gewärmt, die Spieler sind bereit – Game On!",
    ],
    en: [
      "Welcome to the match! {player1} versus {player2} – let's go!",
      "Game On! {player1} takes on {player2} – who will win today?",
    ],
  },
  checkout_suggestion: {
    de: [
      "{score} verbleibend – möglicher Weg: {path}",
      "Checkout-Chance! {score} Punkte – {path}",
      "{score} auf der Scheibe – {player} kann auschecken: {path}",
      "Achtung, Checkout! {score} – {path}",
    ],
    en: [
      "{score} remaining – possible route: {path}",
      "Checkout chance! {score} points – {path}",
      "{score} on the board – {player} can check out: {path}",
      "Checkout alert! {score} – {path}",
    ],
  },
};

const BOGEY_NUMBERS = new Set([159, 162, 163, 165, 166, 168, 169]);

// ─── Checkout-Tabelle (aus bogey-warning.ts) ──────────────────────────────────

const CHECKOUTS: Record<number, string> = {
  170: "T20 T20 Bull",  168: "T20 T20 T12",  167: "T20 T19 Bull",
  166: "T20 T18 Bull",  165: "T20 T19 T12",  164: "T20 T18 T10",
  163: "T20 T19 T10",   162: "T20 T18 T12",  161: "T20 T17 Bull",
  160: "T20 T20 D20",   159: "T20 T13 Bull",  158: "T20 T20 D19",
  157: "T20 T19 D20",   156: "T20 T20 D18",  155: "T20 T19 D19",
  154: "T20 T18 D20",   153: "T20 T19 D18",  152: "T20 T20 D16",
  151: "T20 T17 D20",   150: "T20 T18 D18",  149: "T20 T19 D16",
  148: "T20 T16 D20",   147: "T20 T17 D18",  146: "T20 T18 D16",
  145: "T20 T15 D20",   144: "T20 T20 D12",  143: "T20 T17 D16",
  142: "T20 T14 D20",   141: "T20 T19 D12",  140: "T20 T16 D16",
  139: "T20 T13 D20",   138: "T20 T18 D12",  137: "T20 T15 D16",
  136: "T20 T20 D8",    135: "T20 T17 D12",  134: "T20 T14 D16",
  133: "T20 T19 D8",    132: "T20 T16 D12",  131: "T20 T13 D16",
  130: "T20 T18 D8",    129: "T19 T16 D12",  128: "T20 T20 D4",
  127: "T20 T17 D8",    126: "T19 T19 D6",   125: "T20 T15 D10",
  124: "T20 T16 D8",    123: "T19 T16 D9",   122: "T18 T18 D7",
  121: "T20 T11 D14",   120: "T20 S20 D20",  119: "T19 T12 D13",
  118: "T20 S18 D20",   117: "T20 S17 D20",  116: "T20 S16 D20",
  115: "T20 S15 D20",   114: "T20 S14 D20",  113: "T20 S13 D20",
  112: "T20 S12 D20",   111: "T20 S11 D20",  110: "T20 S10 D20",
  109: "T20 S9 D20",    108: "T20 S8 D20",   107: "T19 S10 D20",
  106: "T20 S6 D20",    105: "T20 S5 D20",   104: "T20 S4 D20",
  103: "T20 S3 D20",    102: "T20 S2 D20",   101: "T20 S1 D20",
  100: "T20 D20",        99: "T19 S2 D20",    98: "T20 D19",
   97: "T19 D20",        96: "T20 D18",        95: "T19 D19",
   94: "T18 D20",        93: "T19 D18",        92: "T20 D16",
   91: "T17 D20",        90: "T18 D18",        89: "T19 D16",
   88: "T20 D14",        87: "T17 D18",        86: "T18 D16",
   85: "T15 D20",        84: "T20 D12",        83: "T17 D16",
   82: "T14 D20",        81: "T19 D12",        80: "T20 D10",
   79: "T13 D20",        78: "T18 D12",        77: "T19 D10",
   76: "T20 D8",         75: "T17 D12",        74: "T14 D16",
   73: "T19 D8",         72: "T16 D12",        71: "T13 D16",
   70: "T18 D8",         69: "T19 D6",         68: "T20 D4",
   67: "T17 D8",         66: "T10 D18",        65: "T19 D4",
   64: "T16 D8",         63: "T13 D12",        62: "T10 D16",
   61: "T15 D8",         60: "S20 D20",        59: "S19 D20",
   58: "S18 D20",        57: "S17 D20",        56: "T16 D4",
   55: "S15 D20",        54: "S14 D20",        53: "S13 D20",
   52: "S12 D20",        51: "S11 D20",        50: "S10 D20",
   49: "S9 D20",         48: "S16 D16",        47: "S15 D16",
   46: "S6 D20",         45: "S5 D20",         44: "S4 D20",
   43: "S3 D20",         42: "S10 D16",        41: "S9 D16",
   40: "D20",            39: "S7 D16",         38: "D19",
   37: "S5 D16",         36: "D18",            35: "S3 D16",
   34: "D17",            33: "S1 D16",         32: "D16",
   31: "S7 D12",         30: "D15",            29: "S13 D8",
   28: "D14",            27: "S11 D8",         26: "D13",
   25: "S9 D8",          24: "D12",            23: "S7 D8",
   22: "D11",            21: "S5 D8",          20: "D10",
   18: "D9",             16: "D8",             14: "D7",
   12: "D6",             10: "D5",              8: "D4",
    6: "D3",              4: "D2",              2: "D1",
};



// Ergänze Kommentare für Leg-Statistiken
const LEG_STAT_COMMENTS: Record<'de' | 'en', {
  normal: string[];
  good: string[];
  excellent: string[];
  personal_best: string[];
  first9: string[];
  checkout_rate: string[];
}> = {
  de: {
    normal: [
      "Leg-Durchschnitt: {avg}. Solide Arbeit, da ist noch Luft nach oben.",
      "Leg-Average von {avg} – {player} bleibt im Spiel.",
      "{avg} Punkte im Durchschnitt dieses Leg – weiter so, {player}!",
    ],
    good: [
      "Starkes Leg! Durchschnitt: {avg} – das war beeindruckend!",
      "{avg} Average – {player} zeigt heute eine gute Leistung!",
      "Leg-Durchschnitt {avg} – das war ein richtig gutes Leg von {player}!",
    ],
    excellent: [
      "Hervorragendes Leg! Durchschnitt {avg} – Weltklasse-Darts von {player}!",
      "{avg} Average – {player} spielt heute auf absolutem Topniveau!",
      "Was für ein Leg! {avg} Punkte im Schnitt – das war spektakulär!",
    ],
    personal_best: [
      "Persönliche Bestleistung! {avg} Average – {player} übertrifft sich selbst!",
      "Neuer persönlicher Rekord: {avg}! {player} ist heute in Bestform!",
      "{avg} – das ist ein neuer Bestwert für {player}! Fantastisch!",
    ],
    first9: [
      "First-9-Average von {f9} – {player} hat stark begonnen!",
      "Die ersten neun Darts: {f9} Average – ein vielversprechender Start!",
    ],
    checkout_rate: [
      "Checkout-Quote: {pct}% – {player} ist effizient auf den Doubles!",
      "{pct}% Checkout-Rate – {player} nutzt seine Chancen gut!",
    ],
  },
  en: {
    normal: [
      "Leg average: {avg}. Solid work, there's room for improvement.",
      "Average of {avg} this leg – {player} stays in the game.",
    ],
    good: [
      "Strong leg! Average: {avg} – that was impressive!",
      "{avg} average – {player} is showing a good performance today!",
    ],
    excellent: [
      "Outstanding leg! Average {avg} – world-class darts from {player}!",
      "{avg} average – {player} is playing at the absolute top level!",
    ],
    personal_best: [
      "Personal best! {avg} average – {player} surpasses themselves!",
      "New personal record: {avg}! {player} is in top form today!",
    ],
    first9: [
      "First-9 average of {f9} – {player} started strong!",
      "The first nine darts: {f9} average – a promising start!",
    ],
    checkout_rate: [
      "Checkout rate: {pct}% – {player} is efficient on the doubles!",
      "{pct}% checkout rate – {player} is taking their chances well!",
    ],
  },
};

// ─── Modul-Zustand ─────────────────────────────────────────────────────────────────────────────────

let config: IConfig;
let gameDataWatcherUnwatch: (() => void) | null = null;
let currentAudio: HTMLAudioElement | null = null;
let isGenerating = false;
let lastEventKey = '';
let lastEventTime = 0;
const COOLDOWN_MS = 3000;

// Leg-Ende-Erkennung (analog zu career-controller.ts)
let lastLegCount = -1;
let lastSetCount = -1;
let ownUserId: string | null = null;
let bestLegAverage = 0; // persönliche Bestleistung im laufenden Match
let lastCheckoutScore = -1; // Verhindert mehrfaches Ansagen desselben Checkouts

// ─── Öffentliche API ──────────────────────────────────────────────────────────

export async function aiCommentator(): Promise<void> {
  console.log("Autodarts Tools: KI-Kommentator gestartet");
  config = await AutodartsToolsConfig.getValue();

  if (!config.aiCommentator?.enabled) {
    console.log("Autodarts Tools: KI-Kommentator deaktiviert");
    return;
  }

  // Zustände zurücksetzen
  lastLegCount = -1;
  lastSetCount = -1;
  bestLegAverage = 0;
  lastCheckoutScore = -1;

  gameDataWatcherUnwatch = AutodartsToolsGameData.watch(
    async (gameData: IGameData, oldGameData: IGameData) => {
      await processGameData(gameData, oldGameData);
    },
  );
}

export function aiCommentatorOnRemove(): void {
  gameDataWatcherUnwatch?.();
  gameDataWatcherUnwatch = null;
  lastLegCount = -1;
  lastSetCount = -1;
  bestLegAverage = 0;
  lastCheckoutScore = -1;
  ownUserId = null;
  stopAudio();
  duoStop();
  duoResetSession();
}

// ─── Spielereignis-Verarbeitung ───────────────────────────────────────────────

async function processGameData(gameData: IGameData, oldGameData: IGameData): Promise<void> {
  if (!gameData?.match || !gameData.match.turns?.length) return;
  if (gameData.match.variant === "Bull-off") return;
  if (isGenerating) return;

  const match = gameData.match;
  const now = Date.now();

  // ─── Leg-Ende-Erkennung (einmal pro Leg, nach Leg-Zähler-Wechsel) ────────────
  const currentLeg = match.leg ?? 0;
  const currentSet = match.set ?? 0;

  if (lastLegCount === -1) {
    // Initialisierung beim ersten Aufruf
    lastLegCount = currentLeg;
    lastSetCount = currentSet;
  } else {
    const legChanged = currentLeg !== lastLegCount || currentSet !== lastSetCount;

    if (legChanged && !match.finished) {
      // Leg-Zähler MÜSSEN unabhängig davon fortgeschrieben werden, ob die
      // eigene Identität auflösbar ist — sonst bleibt `legChanged` dauerhaft
      // true und dieser Zweig (inkl. seines `return`) blockiert ab hier jeden
      // weiteren Kommentar für den Rest des Matches (Bug H1, PR #16 Review).
      lastLegCount = currentLeg;
      lastSetCount = currentSet;

      // Leg ist gerade beendet worden – Statistiken des eigenen Spielers ansagen
      if (!ownUserId) ownUserId = await getUserIdFromToken();
      const players = match.players ?? [];
      const ownIndex = ownUserId
        ? players.findIndex(p => p.userId === ownUserId)
        : -1;
      if (ownIndex < 0) return; // Identity not resolved — skip leg stats announcement only
      const legPlayerIndex = ownIndex;
      const playerStats = match.stats?.[legPlayerIndex];
      const legStats = playerStats?.legStats;
      const playerName = players[legPlayerIndex]?.name ?? config.aiCommentator?.playerName1 ?? 'Spieler';

      if (legStats && config.aiCommentator?.legStatsEnabled !== false) {
        await speakLegStats(legStats, playerName);
      }

      return; // Kein weiterer Kommentar in diesem Zyklus
    }
  }

  if (now - lastEventTime < COOLDOWN_MS) return;

  const currentPlayerIdx = match.player;
  const players = match.players ?? [];
  const currentPlayer = players[currentPlayerIdx];
  const playerName = currentPlayer?.name ?? config.aiCommentator?.playerName1 ?? 'Spieler';

  const busted: boolean = gameData.match.turns[0].busted;
  const points: number = gameData.match.turns[0].points;
  const winner: boolean = gameData.match.gameWinner >= 0;
  const winnerMatch: boolean = gameData.match.winner >= 0;
  const isLastThrow: boolean = gameData.match.turns[0].throws.length >= 3;
  const gameScores: number[] = gameData.match.gameScores ?? [];
  const currentScore = gameScores[currentPlayerIdx];

  // ── Match-Start ────────────────────────────────────────────────────────────
  if (gameData.match.round === 1
    && gameData.match.turns[0].throws.length === 0
    && currentPlayerIdx === 0) {
    const p1 = players[0]?.name ?? config.aiCommentator?.playerName1 ?? 'Spieler 1';
    const p2 = players[1]?.name ?? config.aiCommentator?.playerName2 ?? 'Spieler 2';
    await speak('gameon', { player1: p1, player2: p2 });
    return;
  }

  // ── Checkout-Suggestion (am Turn-Beginn, vor dem ersten Dart) ─────────────
  if (gameData.match.turns[0].throws.length === 0
    && config.aiCommentator?.checkoutSpeechEnabled !== false
    && currentScore > 1 && currentScore <= 170
    && !BOGEY_NUMBERS.has(currentScore)
    && CHECKOUTS[currentScore]
    && currentScore !== lastCheckoutScore) {
    lastCheckoutScore = currentScore;
    const path = formatCheckoutPath(CHECKOUTS[currentScore], config.aiCommentator?.language ?? 'de');
    await speak('checkout_suggestion', { player: playerName, score: String(currentScore), path });
    return;
  }

  // Score hat sich geändert → lastCheckoutScore zurücksetzen
  if (currentScore !== lastCheckoutScore && gameData.match.turns[0].throws.length > 0) {
    lastCheckoutScore = -1;
  }

  const currentThrow = gameData.match.turns[0].throws[gameData.match.turns[0].throws.length - 1];
  if (!currentThrow) return;

  // ── Matchshot ─────────────────────────────────────────────────────────────
  if (winnerMatch) {
    const winnerName = players[gameData.match.winner]?.name ?? playerName;
    await speak('matchshot', { player: winnerName, score: String(points) });
    return;
  }

  // ── Gameshot / Checkout ───────────────────────────────────────────────────
  if (winner) {
    const winnerName = players[gameData.match.gameWinner]?.name ?? playerName;
    const key = points >= 100 ? 'checkout_high' : 'checkout_normal';
    await speak(key, { player: winnerName, score: String(points) });
    return;
  }

  // ── Bust ──────────────────────────────────────────────────────────────────
  if (busted) {
    await speak('bust', { player: playerName, score: String(points) });
    return;
  }

  if (!isLastThrow) return;

  // ── 180 ───────────────────────────────────────────────────────────────────
  if (points === 180) {
    await speak('score_180', { player: playerName, score: '180' });
    return;
  }

  // ── 140+ ──────────────────────────────────────────────────────────────────
  if (points >= 140) {
    await speak('score_140plus', { player: playerName, score: String(points) });
    return;
  }

  // ── 100+ ──────────────────────────────────────────────────────────────────
  if (points >= 100) {
    await speak('score_100plus', { player: playerName, score: String(points) });
    return;
  }

  // ── Bogey-Number ──────────────────────────────────────────────────────────
  if (BOGEY_NUMBERS.has(currentScore)) {
    await speak('bogey_number', { player: playerName, score: String(currentScore) });
    return;
  }

  // ── Niedriger Score ───────────────────────────────────────────────────────
  if (points <= 5 && Math.random() < 0.5) { // Nur 50% der Zeit kommentieren
    await speak('low_score', { player: playerName, score: String(points) });
    return;
  }
}


// ─── Checkout-Pfad für TTS formatieren ───────────────────────────────────────

function formatCheckoutPath(path: string, lang: string): string {
  // Konvertiert "T20 T19 D12" in sprachliche Form
  // DE: "Triple 20, Triple 19, Doppel 12"
  // EN: "Triple 20, Triple 19, Double 12"
  const parts = path.split(' ');
  return parts.map(part => {
    if (part === 'Bull') return lang === 'de' ? 'Bull' : 'Bull';
    const prefix = part[0];
    const num = part.slice(1);
    if (prefix === 'T') return lang === 'de' ? `Triple ${num}` : `Triple ${num}`;
    if (prefix === 'D') return lang === 'de' ? `Doppel ${num}` : `Double ${num}`;
    if (prefix === 'S') return lang === 'de' ? `Single ${num}` : `Single ${num}`;
    return part;
  }).join(', ');
}

// ─── Leg-Statistiken ansagen ─────────────────────────────────────────────────

async function speakLegStats(legStats: any, playerName: string): Promise<void> {
  const lang = (config.aiCommentator?.language ?? 'de') as 'de' | 'en';
  const comments = LEG_STAT_COMMENTS[lang] ?? LEG_STAT_COMMENTS['de'];

  const avg = legStats.average ?? 0;
  if (avg <= 0) return; // Keine sinnvollen Statistiken vorhanden

  const avgStr = avg.toFixed(1).replace('.', ',');
  const f9 = legStats.first9Average ?? 0;
  const checkoutPct = legStats.checkoutPercent ?? 0;

  let category: keyof typeof comments;
  let isPersonalBest = false;

  // Persönliche Bestleistung prüfen
  if (avg > bestLegAverage) {
    isPersonalBest = bestLegAverage > 0; // Nur als Bestleistung melden wenn nicht erstes Leg
    bestLegAverage = avg;
  }

  // Kategorie bestimmen
  if (isPersonalBest) {
    category = 'personal_best';
  } else if (avg >= 100) {
    category = 'excellent';
  } else if (avg >= 75) {
    category = 'good';
  } else {
    category = 'normal';
  }

  const pool = comments[category];
  const template = pool[Math.floor(Math.random() * pool.length)];
  const text = fillTemplate(template, { avg: avgStr, player: playerName });

  lastEventKey = 'leg_stats';
  lastEventTime = Date.now();

  await generateAndPlayTTS(text);

  // Optional: First-9-Average ansagen wenn bemerkenswert (>= 90)
  if (f9 >= 90 && Math.random() < 0.6) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    const f9Str = f9.toFixed(1).replace('.', ',');
    const f9Pool = comments.first9;
    const f9Template = f9Pool[Math.floor(Math.random() * f9Pool.length)];
    const f9Text = fillTemplate(f9Template, { f9: f9Str, player: playerName });
    await generateAndPlayTTS(f9Text);
  }

  // Optional: Checkout-Rate ansagen wenn bemerkenswert (>= 50%)
  if (checkoutPct >= 50 && Math.random() < 0.5) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    const pctStr = Math.round(checkoutPct).toString();
    const pctPool = comments.checkout_rate;
    const pctTemplate = pctPool[Math.floor(Math.random() * pctPool.length)];
    const pctText = fillTemplate(pctTemplate, { pct: pctStr, player: playerName });
    await generateAndPlayTTS(pctText);
  }
}

// ─── Kommentar sprechen ─────────────────────────────────────────────────────────────────────────────────

async function speak(eventKey: string, vars: Record<string, string>): Promise<void> {
  const lang = config.aiCommentator?.language ?? 'de';

  // ── v2.9.73 – LLM Duo-Kommentator hat Vorrang bei "wichtigen" Events ─────
  if (config.aiCommentator?.duoMode && isDuoEvent(eventKey)) {
    if (duoIsSpeaking()) return;
    if (eventKey === lastEventKey && Date.now() - lastEventTime < 5000) return;
    lastEventKey = eventKey;
    lastEventTime = Date.now();

    await generateAndSpeakDuo({
      enabled: true,
      backendUrl: config.aiCommentator?.backendUrl ?? '',
      language: lang,
      intensity: config.aiCommentator?.intensity ?? 'normal',
      ttsProvider: (config.aiCommentator?.ttsProvider ?? 'browser') as any,
      ttsApiKey: config.aiCommentator?.apiKey ?? '',
      analystVoice: config.aiCommentator?.analystVoice || config.aiCommentator?.voice || '',
      entertainerVoice: config.aiCommentator?.entertainerVoice || config.aiCommentator?.voice || '',
      volume: config.aiCommentator?.volume ?? 80,
    }, {
      event: (eventKey === 'gameon' ? 'match_start' : eventKey) as DuoEvent,
      player: vars.player1 || vars.player || 'Spieler',
      opponent: vars.player2,
      score: vars.score ? Number(vars.score) : undefined,
      remaining: vars.score ? Number(vars.score) : undefined,
      checkout_path: vars.path,
    });
    return;
  }

  const comments = COMMENTS[eventKey]?.[lang] ?? COMMENTS[eventKey]?.['de'] ?? [];
  if (!comments.length) return;

  // Gleiche Ereignisse nicht direkt hintereinander
  if (eventKey === lastEventKey && Date.now() - lastEventTime < 5000) return;

  // Zufälligen Kommentar wählen
  const template = comments[Math.floor(Math.random() * comments.length)];
  const text = fillTemplate(template, vars);

  lastEventKey = eventKey;
  lastEventTime = Date.now();

  await generateAndPlayTTS(text);
}

function isDuoEvent(key: string): boolean {
  return key === 'score_180'
    || key === 'checkout_high'
    || key === 'checkout_normal'
    || key === 'matchshot'
    || key === 'bust'
    || key === 'score_140plus'
    || key === 'gameon'
    || key === 'bogey_number';
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? key);
}

// ─── Multi-Provider TTS ──────────────────────────────────────────────────────

async function generateAndPlayTTS(text: string): Promise<void> {
  if (isGenerating) return;
  isGenerating = true;
  try {
    console.log(`Autodarts Tools: KI-Kommentator spricht: "${text}"`);
    const ttsConfig: TTSConfig = {
      provider: (config.aiCommentator?.ttsProvider ?? 'browser') as any,
      apiKey:   config.aiCommentator?.apiKey ?? '',
      voice:    config.aiCommentator?.voice ?? '',
      language: config.aiCommentator?.language === 'de' ? 'de-DE' : 'en-GB',
      speed:    1.1,
    };
    const result = await speakText(text, ttsConfig);
    if (!result.ok) {
      console.warn('Autodarts Tools: TTS Fehler:', result.error);
    }
  } catch (e) {
    console.error('Autodarts Tools: KI-Kommentator Fehler:', e);
  } finally {
    isGenerating = false;
  }
}

function playBase64Audio(base64: string): Promise<void> {
  return new Promise<void>((resolve) => {
    stopAudio();
    currentAudio = new Audio(base64);
    currentAudio.volume = (config.aiCommentator?.volume ?? 80) / 100;
    currentAudio.addEventListener('ended', () => resolve());
    currentAudio.addEventListener('error', () => resolve());
    currentAudio.play().catch(() => resolve());
  });
}

function stopAudio(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = '';
    currentAudio = null;
  }
}
