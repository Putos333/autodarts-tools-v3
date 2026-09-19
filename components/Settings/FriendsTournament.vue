<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { getFriends, quickPlay, type IFriend, type ILobbySettings } from '@/utils/friends-api';
import { fetchWithAuth } from '@/utils/helpers';

// ─── Setup / State ────────────────────────────────────────────────────────────
type BracketSize = 4 | 8 | 16;
type Phase = 'setup' | 'running' | 'finished';

interface Participant {
  id: string;                        // 'me' oder friendId
  name: string;
  isMe: boolean;
  online?: boolean;
  eliminated: boolean;
}

interface BracketMatch {
  id: string;                        // z.B. r1-m1
  round: number;                     // 0 = R1, 1 = Halbfinale, ...
  slotA?: Participant;
  slotB?: Participant;
  winnerId?: string;                 // id des Gewinners
  lobbyId?: string;
  lobbyUrl?: string;
  played: boolean;
}

interface FriendsTournamentState {
  name: string;
  size: BracketSize;
  legs: number;
  sets: number;
  participants: Participant[];
  matches: BracketMatch[];
  currentRound: number;
  phase: Phase;
  createdAt: string;
  finalWinnerId?: string;
}

const STORAGE_KEY = 'ft-active-tournament';
const FT_PENDING_KEY = 'ft-pending-results';
const FT_AUTO_DETECTED = ref<Set<string>>(new Set()); // bracketMatch-ids mit Auto-Erkennung

// ─── Setup Inputs ─────────────────────────────────────────────────────────────
const tournamentName = ref('Freunde-Turnier');
const size = ref<BracketSize>(4);
const legs = ref(3);
const sets = ref(1);
const friends = ref<IFriend[]>([]);
const selectedFriendIds = ref<Set<string>>(new Set());
const loading = ref(false);
const errorMsg = ref('');
const myUserName = ref('Ich');
const myUserId = ref('me');

// ─── Aktives Turnier ──────────────────────────────────────────────────────────
const tournament = ref<FriendsTournamentState | null>(null);

// ─── Persistenz ────────────────────────────────────────────────────────────────
async function loadState() {
  try {
    const r = await browser.storage.local.get(STORAGE_KEY);
    const raw = r[STORAGE_KEY];
    if (typeof raw === 'string') tournament.value = JSON.parse(raw);
  } catch (e) { /* ignore */ }
}
async function saveState() {
  try {
    await browser.storage.local.set({ [STORAGE_KEY]: JSON.stringify(tournament.value) });
  } catch (e) { /* ignore */ }
}
watch(tournament, saveState, { deep: true });

// ─── Init ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadState();
  await loadFriendsAndMe();
  await consumePendingResults();

  // Reagiert wenn das Match-Content-Script ein Ergebnis gemeldet hat
  browser.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (FT_PENDING_KEY in changes) {
      await consumePendingResults();
    }
  });
});

async function consumePendingResults() {
  if (!tournament.value || tournament.value.phase !== 'running') return;
  try {
    const r = await browser.storage.local.get(FT_PENDING_KEY);
    const pending = (r[FT_PENDING_KEY] ?? {}) as Record<string, string>;
    if (!Object.keys(pending).length) return;

    let applied = 0;
    for (const [bracketMatchId, winnerId] of Object.entries(pending)) {
      const bracketMatch = tournament.value.matches.find(m => m.id === bracketMatchId);
      if (!bracketMatch || bracketMatch.played) continue;
      if (!bracketMatch.slotA || !bracketMatch.slotB) continue;
      // Sicherheits-Check: winnerId muss einer der beiden Slots sein
      if (winnerId !== bracketMatch.slotA.id && winnerId !== bracketMatch.slotB.id) continue;
      setWinner(bracketMatch, winnerId);
      FT_AUTO_DETECTED.value.add(bracketMatchId);
      applied++;
    }
    if (applied > 0) {
      // Verbraucht — Storage leeren
      await browser.storage.local.remove(FT_PENDING_KEY);
      console.log(`[FT] ${applied} Ergebnis(se) automatisch übernommen`);
    }
  } catch (e) {
    console.error('[FT] consumePendingResults:', e);
  }
}

async function loadFriendsAndMe() {
  loading.value = true;
  try {
    friends.value = await getFriends();
    // Eigenen Namen holen
    try {
      const r = await fetchWithAuth('https://api.autodarts.io/us/v0/users/me');
      if (r.ok) {
        const data = await r.json();
        myUserName.value = data.name ?? data.displayName ?? 'Ich';
        myUserId.value = data.id ?? 'me';
      }
    } catch (_) { /* fallback ok */ }
  } finally {
    loading.value = false;
  }
}

// ─── Auswahl-Logik ────────────────────────────────────────────────────────────
function toggleFriend(f: IFriend) {
  const need = size.value - 1; // -1 weil "Ich" immer teilnimmt
  if (selectedFriendIds.value.has(f.id)) {
    selectedFriendIds.value.delete(f.id);
  } else if (selectedFriendIds.value.size < need) {
    selectedFriendIds.value.add(f.id);
  }
  // Reactivity
  selectedFriendIds.value = new Set(selectedFriendIds.value);
}

const requiredFriendCount = computed(() => size.value - 1);
const isReadyToStart = computed(() => selectedFriendIds.value.size === requiredFriendCount.value);

// ─── Bracket-Erstellung ────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function generateBracket(participants: Participant[], sizeVal: BracketSize): BracketMatch[] {
  const shuffled = shuffle(participants);
  const totalRounds = Math.log2(sizeVal); // 4→2, 8→3, 16→4
  const matches: BracketMatch[] = [];
  // Runde 0 (Runde 1) mit tatsächlichen Teilnehmern
  const r0Count = sizeVal / 2;
  for (let i = 0; i < r0Count; i++) {
    matches.push({
      id: `r0-m${i}`,
      round: 0,
      slotA: shuffled[i * 2],
      slotB: shuffled[i * 2 + 1],
      played: false,
    });
  }
  // Folge-Runden ohne Slots (füllen sich nach Matches)
  let prevRoundCount = r0Count;
  for (let r = 1; r < totalRounds; r++) {
    const count = prevRoundCount / 2;
    for (let i = 0; i < count; i++) {
      matches.push({ id: `r${r}-m${i}`, round: r, played: false });
    }
    prevRoundCount = count;
  }
  return matches;
}

async function startTournament() {
  if (!isReadyToStart.value) return;
  const me: Participant = { id: myUserId.value, name: myUserName.value, isMe: true, online: true, eliminated: false };
  const selectedFriends = friends.value.filter(f => selectedFriendIds.value.has(f.id));
  const participants: Participant[] = [
    me,
    ...selectedFriends.map(f => ({ id: f.id, name: f.name, isMe: false, online: f.online, eliminated: false })),
  ];
  const matches = generateBracket(participants, size.value);
  tournament.value = {
    name: tournamentName.value.trim() || 'Freunde-Turnier',
    size: size.value,
    legs: legs.value,
    sets: sets.value,
    participants,
    matches,
    currentRound: 0,
    phase: 'running',
    createdAt: new Date().toISOString(),
  };
  await saveState();
}

// ─── Match-Progression ────────────────────────────────────────────────────────
const currentRoundMatches = computed(() => {
  return tournament.value?.matches.filter(m => m.round === tournament.value!.currentRound) ?? [];
});

const totalRounds = computed(() => {
  if (!tournament.value) return 0;
  return Math.log2(tournament.value.size);
});

function roundLabel(r: number): string {
  if (!tournament.value) return `Runde ${r + 1}`;
  const remaining = totalRounds.value - r;
  if (remaining === 1) return 'Finale';
  if (remaining === 2) return 'Halbfinale';
  if (remaining === 3) return 'Viertelfinale';
  if (remaining === 4) return 'Achtelfinale';
  return `Runde ${r + 1}`;
}

// Für ein Match: entweder Freund einladen (wenn ich beteiligt) oder nur Lobby anlegen
async function launchMatch(match: BracketMatch) {
  if (!tournament.value) return;
  if (!match.slotA || !match.slotB) {
    errorMsg.value = 'Match noch nicht bereit — vorherige Runde muss abgeschlossen sein.';
    return;
  }
  const lobbySettings: ILobbySettings = {
    variant: 'X01',
    x01Settings: {
      startScore: 501, inMode: 'straight', outMode: 'double',
      sets: tournament.value.sets, legs: tournament.value.legs,
    },
  };
  const opponent = match.slotA.isMe ? match.slotB : (match.slotB.isMe ? match.slotA : null);
  if (!opponent) {
    // Beides Freunde – ich spiele nicht mit. Nur Info anzeigen, Ergebnis manuell erfassen.
    errorMsg.value = `${match.slotA.name} vs ${match.slotB.name} — Ergebnis nach dem Match manuell eintragen.`;
    return;
  }
  errorMsg.value = '';
  const result = await quickPlay(opponent.id, lobbySettings);
  if (result.success && result.lobbyUrl) {
    match.lobbyId = result.lobbyId;
    match.lobbyUrl = result.lobbyUrl;
    await saveState();
    window.location.href = result.lobbyUrl;
  } else {
    errorMsg.value = result.error ?? 'Lobby konnte nicht erstellt werden';
  }
}

function setWinner(match: BracketMatch, winnerId: string) {
  if (!tournament.value) return;
  if (!match.slotA || !match.slotB) return;
  match.winnerId = winnerId;
  match.played = true;
  const loserId = match.slotA.id === winnerId ? match.slotB.id : match.slotA.id;
  const loser = tournament.value.participants.find(p => p.id === loserId);
  if (loser) loser.eliminated = true;

  // Winner in nächste Runde übertragen
  const currentRoundMatchesArr = tournament.value.matches.filter(m => m.round === match.round);
  const matchIndex = currentRoundMatchesArr.indexOf(match);
  const nextRoundMatches = tournament.value.matches.filter(m => m.round === match.round + 1);
  if (nextRoundMatches.length > 0) {
    const nextMatch = nextRoundMatches[Math.floor(matchIndex / 2)];
    const winnerParticipant = tournament.value.participants.find(p => p.id === winnerId)!;
    if (matchIndex % 2 === 0) nextMatch.slotA = winnerParticipant;
    else nextMatch.slotB = winnerParticipant;
  }

  // Prüfen ob Runde beendet
  const allPlayed = currentRoundMatchesArr.every(m => m.played);
  if (allPlayed) {
    if (match.round + 1 >= totalRounds.value) {
      tournament.value.phase = 'finished';
      tournament.value.finalWinnerId = winnerId;
    } else {
      tournament.value.currentRound = match.round + 1;
    }
  }
  saveState();
}

function resetTournament() {
  if (!confirm('Freunde-Turnier wirklich abbrechen? Fortschritt geht verloren.')) return;
  tournament.value = null;
  browser.storage.local.remove(STORAGE_KEY).catch(() => {});
}

function backToSetup() {
  tournament.value = null;
  browser.storage.local.remove(STORAGE_KEY).catch(() => {});
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────
const finalWinner = computed(() => {
  if (!tournament.value?.finalWinnerId) return null;
  return tournament.value.participants.find(p => p.id === tournament.value!.finalWinnerId) ?? null;
});
</script>

<template>
  <div style="padding: 20px;">
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!--  SETUP-PHASE                                                            -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div v-if="!tournament">
      <div style="margin-bottom: 20px;">
        <div style="font-size: 11px; color: #E8002D; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 4px;">Multiplayer-Bracket</div>
        <div style="font-size: 28px; font-weight: 900; color: #FFFFFF; letter-spacing: 2px; text-transform: uppercase; line-height: 1;">Freunde-Turnier</div>
        <div style="font-size: 13px; color: #64748B; margin-top: 4px;">Bracket-Turnier mit 4, 8 oder 16 Spielern aus deiner Freundesliste</div>
      </div>

      <!-- Turnier-Konfiguration -->
      <div style="background: rgba(13,27,42,0.98); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 16px; margin-bottom: 16px;">
        <div style="font-size: 10px; color: #E8002D; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 12px; font-weight: 700;">Turnier-Einstellungen</div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <label style="font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">Turnier-Name</label>
            <input v-model="tournamentName" style="width: 100%; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15); color: #FFFFFF; padding: 8px 10px; border-radius: 4px; font-size: 13px;" />
          </div>
          <div>
            <label style="font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">Größe</label>
            <select v-model.number="size" style="width: 100%; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15); color: #FFFFFF; padding: 8px 10px; border-radius: 4px; font-size: 13px;">
              <option :value="4">4 Spieler</option>
              <option :value="8">8 Spieler</option>
              <option :value="16">16 Spieler</option>
            </select>
          </div>
          <div>
            <label style="font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">Legs (pro Match)</label>
            <select v-model.number="legs" style="width: 100%; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15); color: #FFFFFF; padding: 8px 10px; border-radius: 4px; font-size: 13px;">
              <option v-for="n in [1,3,5,7,9]" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>
          <div>
            <label style="font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px;">Sets</label>
            <select v-model.number="sets" style="width: 100%; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.15); color: #FFFFFF; padding: 8px 10px; border-radius: 4px; font-size: 13px;">
              <option v-for="n in [1,2,3,5]" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Freundes-Auswahl -->
      <div style="background: rgba(13,27,42,0.98); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="font-size: 10px; color: #E8002D; letter-spacing: 3px; text-transform: uppercase; font-weight: 700;">
            Freunde auswählen ({{ selectedFriendIds.size }} / {{ requiredFriendCount }})
          </div>
          <button @click="loadFriendsAndMe" :disabled="loading" style="background: rgba(96,165,250,0.15); border: 1px solid rgba(96,165,250,0.4); color: #60A5FA; padding: 4px 10px; border-radius: 3px; cursor: pointer; font-size: 10px; text-transform: uppercase;">
            ↻ Aktualisieren
          </button>
        </div>

        <div style="font-size: 12px; color: #94A3B8; margin-bottom: 12px;">
          Du (<b style="color: #F5C842;">{{ myUserName }}</b>) bist automatisch dabei. Wähle {{ requiredFriendCount }} weitere Spieler aus.
        </div>

        <div v-if="loading" style="text-align: center; padding: 30px; color: #94A3B8;">Freunde werden geladen…</div>

        <div v-else-if="friends.length === 0" style="text-align: center; padding: 30px; color: #94A3B8;">
          Keine Freunde gefunden. Füge Freunde auf autodarts.io hinzu.
        </div>

        <div v-else style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; max-height: 320px; overflow-y: auto;">
          <div v-for="f in friends" :key="f.id" @click="toggleFriend(f)" :style="{
            background: selectedFriendIds.has(f.id) ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.03)',
            border: selectedFriendIds.has(f.id) ? '2px solid #34D399' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: '6px',
            padding: '10px 12px',
            cursor: 'pointer',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
            opacity: (!selectedFriendIds.has(f.id) && selectedFriendIds.size >= requiredFriendCount) ? 0.4 : 1,
          }">
            <div :style="{ width: '10px', height: '10px', borderRadius: '50%', background: f.online ? '#34D399' : '#64748B', flexShrink: 0 }"></div>
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 13px; font-weight: 700; color: #FFFFFF; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{ f.name }}</div>
              <div style="font-size: 10px; color: #94A3B8;">{{ f.online ? (f.inMatch ? '🎯 Im Spiel' : 'Online') : 'Offline' }}<span v-if="f.stats"> · Ø {{ f.stats.average.toFixed(1) }}</span></div>
            </div>
            <div v-if="selectedFriendIds.has(f.id)" style="color: #34D399; font-size: 16px;">✓</div>
          </div>
        </div>
      </div>

      <div v-if="errorMsg" style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #F87171; padding: 10px 14px; border-radius: 4px; margin-top: 12px; font-size: 12px;">
        {{ errorMsg }}
      </div>

      <button
        @click="startTournament"
        :disabled="!isReadyToStart"
        :style="{
          width: '100%',
          background: isReadyToStart ? 'linear-gradient(135deg, #E8002D 0%, #B00020 100%)' : 'rgba(232,0,45,0.3)',
          color: 'white',
          border: 'none',
          padding: '14px',
          fontSize: '16px',
          fontWeight: '900',
          letterSpacing: '3px',
          textTransform: 'uppercase',
          borderRadius: '4px',
          cursor: isReadyToStart ? 'pointer' : 'not-allowed',
          marginTop: '16px',
        }"
      >
        {{ isReadyToStart ? 'BRACKET STARTEN' : `Noch ${requiredFriendCount - selectedFriendIds.size} Spieler wählen` }}
      </button>
    </div>

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!--  TURNIER LÄUFT — BRACKET                                                -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <div v-else>
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
        <div>
          <div style="font-size: 11px; color: #E8002D; letter-spacing: 4px; text-transform: uppercase;">Freunde-Turnier {{ tournament.size }}er-Bracket</div>
          <div style="font-size: 26px; font-weight: 900; color: #FFFFFF; letter-spacing: 1px; text-transform: uppercase; line-height: 1; margin-top: 2px;">{{ tournament.name }}</div>
          <div style="font-size: 12px; color: #94A3B8; margin-top: 4px;">
            Best-of-{{ tournament.legs }} Legs<span v-if="tournament.sets > 1"> · {{ tournament.sets }} Sets</span>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button v-if="tournament.phase === 'finished'" @click="backToSetup" style="background: linear-gradient(135deg, #E8002D 0%, #B00020 100%); color: white; border: none; padding: 10px 20px; font-size: 12px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; border-radius: 4px; cursor: pointer;">Neues Turnier</button>
          <button v-else @click="resetTournament" style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #F87171; padding: 8px 14px; border-radius: 4px; cursor: pointer; font-size: 11px; text-transform: uppercase;">Turnier abbrechen</button>
        </div>
      </div>

      <!-- Champion Banner -->
      <div v-if="tournament.phase === 'finished' && finalWinner" style="background: linear-gradient(135deg, rgba(245,200,66,0.2), rgba(245,200,66,0.05)); border: 2px solid rgba(245,200,66,0.5); border-radius: 10px; padding: 30px; text-align: center; margin-bottom: 20px;">
        <div style="font-size: 14px; color: #F5C842; letter-spacing: 5px; text-transform: uppercase; margin-bottom: 8px;">🏆 Champion</div>
        <div style="font-size: 48px; font-weight: 900; color: #FFFFFF; letter-spacing: 2px;">{{ finalWinner.name }}</div>
        <div v-if="finalWinner.isMe" style="font-size: 14px; color: #F5C842; margin-top: 12px; letter-spacing: 2px; text-transform: uppercase;">🎯 Du hast das Turnier gewonnen!</div>
      </div>

      <div v-if="errorMsg" style="background: rgba(245,200,66,0.1); border: 1px solid rgba(245,200,66,0.3); color: #F5C842; padding: 10px 14px; border-radius: 4px; margin-bottom: 12px; font-size: 12px;">
        {{ errorMsg }}
      </div>

      <!-- Bracket-Anzeige nach Runden -->
      <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 10px;">
        <div v-for="r in totalRounds" :key="r" style="flex: 1; min-width: 220px;">
          <div :style="{
            fontSize: '11px',
            color: (tournament.currentRound === r - 1 && tournament.phase === 'running') ? '#E8002D' : '#64748B',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            fontWeight: '700',
            marginBottom: '10px',
            padding: '4px 8px',
            background: (tournament.currentRound === r - 1 && tournament.phase === 'running') ? 'rgba(232,0,45,0.12)' : 'transparent',
            borderRadius: '3px',
            textAlign: 'center',
          }">
            {{ roundLabel(r - 1) }}
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div
              v-for="match in tournament.matches.filter(m => m.round === r - 1)"
              :key="match.id"
              :style="{
                background: match.played ? 'rgba(255,255,255,0.02)' : 'rgba(13,27,42,0.98)',
                border: (tournament.currentRound === r - 1 && !match.played) ? '2px solid #E8002D' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                padding: '10px 12px',
                opacity: (r - 1 > tournament.currentRound) ? 0.6 : 1,
              }"
            >
              <!-- Slot A -->
              <div :style="{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 8px',
                borderRadius: '3px',
                background: match.winnerId === match.slotA?.id ? 'rgba(52,211,153,0.15)' : (match.played && match.winnerId ? 'rgba(239,68,68,0.08)' : 'transparent'),
                marginBottom: '4px',
              }">
                <span :style="{
                  fontSize: '13px',
                  fontWeight: match.slotA?.isMe ? '800' : '600',
                  color: match.slotA ? (match.slotA.isMe ? '#F5C842' : '#FFFFFF') : '#64748B',
                  textDecoration: (match.played && match.winnerId && match.winnerId !== match.slotA?.id) ? 'line-through' : 'none',
                }">
                  {{ match.slotA?.name ?? '– TBD –' }}
                  <span v-if="match.slotA?.isMe" style="font-size: 9px; letter-spacing: 1px; color: #F5C842;">(DU)</span>
                </span>
                <span v-if="match.winnerId === match.slotA?.id" style="color: #34D399; font-weight: 900;">✓</span>
              </div>
              <div style="text-align: center; font-size: 9px; color: #64748B; letter-spacing: 2px; margin: 2px 0;">VS</div>
              <!-- Slot B -->
              <div :style="{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 8px',
                borderRadius: '3px',
                background: match.winnerId === match.slotB?.id ? 'rgba(52,211,153,0.15)' : (match.played && match.winnerId ? 'rgba(239,68,68,0.08)' : 'transparent'),
              }">
                <span :style="{
                  fontSize: '13px',
                  fontWeight: match.slotB?.isMe ? '800' : '600',
                  color: match.slotB ? (match.slotB.isMe ? '#F5C842' : '#FFFFFF') : '#64748B',
                  textDecoration: (match.played && match.winnerId && match.winnerId !== match.slotB?.id) ? 'line-through' : 'none',
                }">
                  {{ match.slotB?.name ?? '– TBD –' }}
                  <span v-if="match.slotB?.isMe" style="font-size: 9px; letter-spacing: 1px; color: #F5C842;">(DU)</span>
                </span>
                <span v-if="match.winnerId === match.slotB?.id" style="color: #34D399; font-weight: 900;">✓</span>
              </div>

              <!-- Auto-Erkennungs-Badge -->
              <div v-if="match.played && FT_AUTO_DETECTED.has(match.id)" style="margin-top: 6px; font-size: 9px; color: #34D399; letter-spacing: 2px; text-transform: uppercase; font-weight: 900; text-align: right;">
                🤖 AUTO-ERKANNT
              </div>

              <!-- Match-Aktionen -->
              <div v-if="!match.played && match.slotA && match.slotB && tournament.currentRound === r - 1" style="margin-top: 10px; display: flex; gap: 4px; flex-wrap: wrap;">
                <button
                  v-if="match.slotA?.isMe || match.slotB?.isMe"
                  @click="launchMatch(match)"
                  style="flex: 1; background: linear-gradient(135deg, #E8002D, #B00020); color: white; border: none; padding: 6px; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; border-radius: 3px; cursor: pointer;"
                >▶ Lobby & Spielen</button>
                <button
                  @click="setWinner(match, match.slotA!.id)"
                  style="flex: 1; background: rgba(52,211,153,0.15); border: 1px solid rgba(52,211,153,0.4); color: #34D399; padding: 6px; font-size: 10px; border-radius: 3px; cursor: pointer;"
                >{{ match.slotA?.name.slice(0, 8) }} ✓</button>
                <button
                  @click="setWinner(match, match.slotB!.id)"
                  style="flex: 1; background: rgba(52,211,153,0.15); border: 1px solid rgba(52,211,153,0.4); color: #34D399; padding: 6px; font-size: 10px; border-radius: 3px; cursor: pointer;"
                >{{ match.slotB?.name.slice(0, 8) }} ✓</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style="margin-top: 16px; font-size: 11px; color: #64748B; letter-spacing: 1px; text-transform: uppercase;">
        💡 Nach jedem Match: Bei deinen Matches wird automatisch eine Lobby erstellt – der andere Spieler kriegt die Einladung. Ergebnisse werden nach dem Match <b style="color:#34D399;">automatisch erkannt</b> und ins Bracket eingetragen. Fallback: Sieger-Button.
      </div>
    </div>
  </div>
</template>
