// v2.9.58: Auto-Ergebnis-Erkennung für Freunde-Turnier
// ---------------------------------------------------
// Beobachtet den Match-State via `AutodartsToolsGameData`. Sobald ein Match
// beendet ist (match.winner gesetzt), prüft es ob dieses Match zu einem
// laufenden Freunde-Turnier-Bracket gehört (Lookup per lobbyId oder matchId)
// und speichert den Winner in `local:ft-pending-results` als Map:
//     { [lobbyId oder matchId]: participantId }
// FriendsTournament.vue liest diesen Store beim Mount + reagiert auf
// storage.onChanged, und trägt das Ergebnis automatisch ins Bracket ein.

import { AutodartsToolsGameData } from '@/utils/game-data-storage';
import type { IMatch } from '@/utils/websocket-helpers';

const FT_STORAGE_KEY = 'ft-active-tournament';
const FT_PENDING_KEY = 'local:ft-pending-results';

interface FTParticipant { id: string; name: string; isMe: boolean }
interface FTMatch {
  id: string;
  round: number;
  slotA?: FTParticipant;
  slotB?: FTParticipant;
  winnerId?: string;
  lobbyId?: string;
  played: boolean;
}
interface FTState {
  matches: FTMatch[];
  currentRound: number;
  phase: string;
}

let matchWatcher: any = null;
let lastResolvedMatchId: string | null = null;

async function readTournament(): Promise<FTState | null> {
  try {
    const r = await browser.storage.local.get(FT_STORAGE_KEY);
    const raw = r[FT_STORAGE_KEY];
    if (!raw) return null;
    if (typeof raw === 'string') return JSON.parse(raw);
    // Check if raw has the required properties of FTState
    if (raw && typeof raw === 'object' && 'matches' in raw && 'currentRound' in raw && 'phase' in raw) {
      return raw as FTState;
    }
    return null;
  } catch (_) { return null; }
}

async function readPending(): Promise<Record<string, string>> {
  try {
    const r = await browser.storage.local.get(FT_PENDING_KEY);
    return (r[FT_PENDING_KEY] as Record<string, string>) ?? {};
  } catch (_) { return {}; }
}

async function writePending(map: Record<string, string>) {
  await browser.storage.local.set({ [FT_PENDING_KEY]: map });
}

/**
 * Sucht in einem laufenden Freunde-Turnier das offene Match, das entweder
 * über lobbyId (bevorzugt) oder über die Spieler-Namen zum gerade beendeten
 * IMatch passt.
 */
function findBracketMatch(state: FTState, match: IMatch, lobbyIdFromUrl: string | null): FTMatch | null {
  const openMatches = state.matches.filter(m => !m.played && m.slotA && m.slotB);
  if (openMatches.length === 0) return null;

  // 1) Match per lobbyId (nur wenn im Bracket beim Launch gespeichert wurde)
  if (lobbyIdFromUrl) {
    const byLobby = openMatches.find(m => m.lobbyId === lobbyIdFromUrl);
    if (byLobby) return byLobby;
  }

  // 2) Match per User-IDs (zuverlässigster Weg — friend.id === IPlayer.userId)
  const playerUserIds = new Set(
    match.players
      .map(p => (p.userId ?? p.user?.id ?? '').trim())
      .filter(Boolean),
  );
  if (playerUserIds.size >= 2) {
    const byUserId = openMatches.find((m) => {
      const aId = m.slotA?.id ?? '';
      const bId = m.slotB?.id ?? '';
      const aIsMe = !!m.slotA?.isMe;
      const bIsMe = !!m.slotB?.isMe;
      // "me" muss NICHT über userId gematcht werden — reicht wenn der Nicht-Me-Slot passt
      if (aIsMe) return playerUserIds.has(bId);
      if (bIsMe) return playerUserIds.has(aId);
      return playerUserIds.has(aId) && playerUserIds.has(bId);
    });
    if (byUserId) return byUserId;
  }

  // 3) Match per Spieler-Namen (case-insensitive) als letzter Fallback
  const matchPlayerNames = match.players.map(p => (p.name ?? '').trim().toLowerCase()).filter(Boolean);
  if (matchPlayerNames.length < 2) return null;

  return openMatches.find((m) => {
    const a = (m.slotA?.name ?? '').trim().toLowerCase();
    const b = (m.slotB?.name ?? '').trim().toLowerCase();
    return matchPlayerNames.includes(a) && matchPlayerNames.includes(b);
  }) ?? null;
}

function resolveWinnerParticipant(bracket: FTMatch, match: IMatch): string | null {
  if (match.winner === undefined || match.winner === null || match.winner < 0) return null;
  const winnerPlayer = match.players[match.winner];
  if (!winnerPlayer) return null;

  const winnerName = (winnerPlayer.name ?? '').trim().toLowerCase();
  const winnerUserId = (winnerPlayer.userId ?? winnerPlayer.user?.id ?? '').trim();

  // 1) User-ID-Match (zuverlässig, funktioniert auch bei Namens-Änderungen)
  if (winnerUserId) {
    if (bracket.slotA?.id === winnerUserId) return bracket.slotA.id;
    if (bracket.slotB?.id === winnerUserId) return bracket.slotB.id;
    // "me" ist ein spezieller Bracket-Slot — der User selbst
    if (winnerUserId && bracket.slotA?.isMe) return bracket.slotA.id;
    if (winnerUserId && bracket.slotB?.isMe) return bracket.slotB.id;
  }

  // 2) Namens-Match als Fallback
  if (winnerName) {
    const aName = (bracket.slotA?.name ?? '').trim().toLowerCase();
    const bName = (bracket.slotB?.name ?? '').trim().toLowerCase();
    if (aName === winnerName) return bracket.slotA!.id;
    if (bName === winnerName) return bracket.slotB!.id;
  }

  return null;
}

async function handleFinishedMatch(match: IMatch) {
  // Doppelte Trigger für dasselbe Match vermeiden
  if (lastResolvedMatchId === match.id) return;

  const state = await readTournament();
  if (!state || state.phase !== 'running') return;

  const url = window.location.href;
  const lobbyIdFromUrl = url.match(/\/lobbies\/([0-9a-f-]+)/)?.[1] ?? null;

  const bracket = findBracketMatch(state, match, lobbyIdFromUrl);
  if (!bracket) return;

  const winnerId = resolveWinnerParticipant(bracket, match);
  if (!winnerId) return;

  const pending = await readPending();
  pending[bracket.id] = winnerId;
  await writePending(pending);

  lastResolvedMatchId = match.id;
  console.log('[FT-AutoResult] Winner erkannt:', {
    bracketMatchId: bracket.id,
    winnerId,
    matchId: match.id,
  });
}

export function initFriendsTournamentAutoResult() {
  if (matchWatcher) return;
  matchWatcher = AutodartsToolsGameData.watch(async (value, oldValue) => {
    const cur = value?.match;
    const prev = oldValue?.match;
    if (!cur) return;

    // Auslösen wenn:
    // - match.winner ist gesetzt und wechselt von "nicht gesetzt" auf einen Wert
    // - ODER match.finished ist neu true
    const wasFinished = prev?.finished === true;
    const isFinished = cur.finished === true;
    const winnerBecameSet = (cur.winner !== undefined && cur.winner !== null && cur.winner >= 0)
      && (prev?.winner === undefined || prev?.winner === null || prev?.winner < 0);

    if ((!wasFinished && isFinished) || winnerBecameSet) {
      try { await handleFinishedMatch(cur); } catch (e) { console.error('[FT-AutoResult]', e); }
    }
  });
}

export function cleanupFriendsTournamentAutoResult() {
  if (matchWatcher) { matchWatcher(); matchWatcher = null; }
  lastResolvedMatchId = null;
}
