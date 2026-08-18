/**
 * crowd.ts – Crowd & Atmosphäre System für tools-for-autodarts v2.9.18
 *
 * Vielseitige Publikumsreaktionen:
 *  - Hintergrundgemurmel (Crowd Buzz) mit dynamischer Lautstärke
 *  - Zufällige Variation bei gleichen Ereignissen (nie zweimal dasselbe)
 *  - Neue Trigger:
 *      • 180er         → Maximaler Jubel + "Stand up" Chant
 *      • 170           → Besonderer Jubel (höchstes Checkout)
 *      • 140+          → Lauter Applaus
 *      • 100+          → Applaus
 *      • Ton80 (3×T20) → Spezial-Reaktion
 *      • Gameshot      → Großer Jubel
 *      • Matchshot     → Maximale Eskalation + langer Jubel
 *      • Bust          → Enttäuschtes Raunen mit Pfeifen
 *      • Niedrige Scores (< 10) → Spöttisches Pfeifen
 *      • Checkout-Dart (letzter Dart auf Doppel) → Angespannte Stille
 *      • Checkout verpasst (Doppel verfehlt) → Kollektives Stöhnen
 *      • Leg gewonnen nach langer Aufholjagd → Besonderer Jubel
 *      • Erster Dart des Matches → Kurzer Applaus (Game On)
 *      • Spielerwechsel bei knappem Stand → Gemurmel
 *      • 9-Darter Potenzial (nach 6 Darts 180+180) → Aufgeregte Stille
 */

import { AutodartsToolsConfig, type IConfig } from "@/utils/storage";
import type { IGameData } from "@/utils/game-data-storage";
import {
  buildReverbBusForVenue,
  crowdDynamicMultiplier,
  getActiveVenueId,
  getVenue,
  type ReverbBus,
  type VenueProfile,
} from "@/utils/venue";
import { getBundledCrowdSampleUrl } from "@/utils/crowd-samples";
import type { CrowdEventKey } from "@/utils/crowd-events";

// ─── Typen ────────────────────────────────────────────────────────────────────

type CrowdEvent = CrowdEventKey;

// ─── Modul-Zustand ────────────────────────────────────────────────────────────

let config: IConfig;
let gameDataWatcherUnwatch: (() => void) | null = null;
let ambientAudio: HTMLAudioElement | null = null;
let reactionAudio: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let ambientGainNode: GainNode | null = null;
let activeVenue: VenueProfile | null = null;
let reverbBus: ReverbBus | null = null;
let isActive = false;
let lastEventTime = 0;
let lastEvent: CrowdEvent | null = null;
let consecutiveSameEvents = 0;
const EVENT_COOLDOWN_MS = 1200;

// Für 9-Darter-Erkennung
let first3DartsScore = 0;
let second3DartsScore = 0;
let nineDarterPotential = false;

// Für Aufholjagd-Erkennung
let previousLegsGap = 0;

// Lifecycle handles for crowd-owned resources
let venueStorageChangeHandler: Parameters<typeof browser.storage.onChanged.addListener>[0] | null = null;
const crowdTimeouts = new Set<ReturnType<typeof setTimeout>>();

function scheduleCrowdTask(fn: () => void, delay: number): void {
  const timeoutId = setTimeout(() => {
    crowdTimeouts.delete(timeoutId);
    if (!isActive) return;
    fn();
  }, delay);
  crowdTimeouts.add(timeoutId);
}

function clearCrowdTimeouts(): void {
  for (const timeoutId of crowdTimeouts) clearTimeout(timeoutId);
  crowdTimeouts.clear();
}

// ─── Öffentliche API ──────────────────────────────────────────────────────────

export async function crowd(): Promise<void> {
  console.log("Autodarts Tools: Crowd-Modul gestartet (v2.9.84 – Venue-Charakter)");
  config = await AutodartsToolsConfig.getValue();

  if (!config.crowd?.enabled) return;

  // Defensive idempotency in case initialization is requested twice.
  gameDataWatcherUnwatch?.();
  gameDataWatcherUnwatch = null;
  if (venueStorageChangeHandler) {
    browser.storage.onChanged.removeListener(venueStorageChangeHandler);
    venueStorageChangeHandler = null;
  }
  clearCrowdTimeouts();

  isActive = true;
  nineDarterPotential = false;
  first3DartsScore = 0;
  second3DartsScore = 0;

  // v2.9.63: Venue-Preset laden (dynamischer Hall + Loudness-Kurven)
  await refreshActiveVenue();

  // Listen for venue-change so the reverb-bus wird sofort neu aufgebaut
  venueStorageChangeHandler = (changes, area) => {
    if (!isActive) return;
    if (area === 'local' && 'adt-venue-active' in changes) {
      refreshActiveVenue().catch(() => {});
    }
  };
  browser.storage.onChanged.addListener(venueStorageChangeHandler);

  startAmbientCrowd();

  gameDataWatcherUnwatch = AutodartsToolsGameData.watch(
    async (gameData: IGameData, oldGameData: IGameData) => {
      await processGameData(gameData, oldGameData);
    },
  );
}

export function crowdOnRemove(): void {
  console.log("Autodarts Tools: Crowd-Modul entfernt");
  isActive = false;

  gameDataWatcherUnwatch?.();
  gameDataWatcherUnwatch = null;

  if (venueStorageChangeHandler) {
    browser.storage.onChanged.removeListener(venueStorageChangeHandler);
    venueStorageChangeHandler = null;
  }

  clearCrowdTimeouts();
  stopAmbientCrowd();
  stopReactionAudio();
  destroyReverbBus();
  activeVenue = null;
}

// ─── Hintergrundgemurmel ──────────────────────────────────────────────────────

function startAmbientCrowd(): void {
  if (!config.crowd?.ambientEnabled) return;

  const ambientConfig = config.crowd.reactions?.find(r => r.eventKey === 'crowd_ambient');

  // Priority 1: user has uploaded their own ambient sound
  if (ambientConfig?.base64) {
    ambientAudio = new Audio(ambientConfig.base64);
    ambientAudio.loop = true;
    ambientAudio.volume = (config.crowd.ambientVolume ?? 30) / 100;
    ambientAudio.play().catch(e => console.warn("Autodarts Tools: Ambient-Crowd konnte nicht gestartet werden", e));
    return;
  }

  // Priority 2: bundled real crowd-murmur sample (v2.9.83)
  // v2.9.84: If a venue is active, route the ambient loop through the
  // venue's Web-Audio character chain (filter + gain + pitch).
  const bundledUrl = getBundledCrowdSampleUrl('crowd_ambient');
  if (bundledUrl) {
    ambientAudio = new Audio(bundledUrl);
    ambientAudio.loop = true;
    ambientAudio.crossOrigin = 'anonymous';
    const baseVol = (config.crowd.ambientVolume ?? 30) / 100;

    const character = activeVenue?.crowdCharacter;
    if (character) {
      if (!audioCtx) {
        try { audioCtx = new AudioContext(); } catch { /* ignore */ }
      }
      if (audioCtx) {
        try {
          const src = audioCtx.createMediaElementSource(ambientAudio);
          const lp = audioCtx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.value = character.filterHz;
          lp.Q.value = 0.7;

          let last: AudioNode = src;
          last.connect(lp);
          last = lp;

          if (character.highpassHz && character.highpassHz > 0) {
            const hp = audioCtx.createBiquadFilter();
            hp.type = 'highpass';
            hp.frequency.value = character.highpassHz;
            hp.Q.value = 0.7;
            last.connect(hp);
            last = hp;
          }

          ambientGainNode = audioCtx.createGain();
          ambientGainNode.gain.value = baseVol * character.gainMult;
          last.connect(ambientGainNode);
          ambientGainNode.connect(ensureVenueBus(audioCtx));

          ambientAudio.playbackRate = character.pitch;
          ambientAudio.play().catch(() => {});
          return;
        } catch (e) {
          console.warn('[Crowd] Venue-Routing für Ambient fehlgeschlagen, plain audio fallback', e);
        }
      }
    }

    // Plain HTML-Audio fallback (no venue active)
    ambientAudio.volume = baseVol;
    ambientAudio.play().catch((e) => {
      console.warn("Autodarts Tools: Bundled Ambient konnte nicht gestartet werden, fallback synthetic", e);
      startSyntheticCrowdNoise();
    });
    return;
  }

  // Priority 3: synthetic noise (last resort — used to be default; now only fallback)
  startSyntheticCrowdNoise();
}

function stopAmbientCrowd(): void {
  if (ambientAudio) {
    ambientAudio.pause();
    ambientAudio.src = '';
    ambientAudio = null;
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
    ambientGainNode = null;
  }
}

function startSyntheticCrowdNoise(): void {
  try {
    audioCtx = new AudioContext();
    const bufferSize = audioCtx.sampleRate * 4;
    const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate); // Stereo

    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }

    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.4;

    // Leichtes Tremolo für lebendiges Gemurmel
    const tremoloOsc = audioCtx.createOscillator();
    tremoloOsc.frequency.value = 0.3 + Math.random() * 0.4; // 0.3–0.7 Hz
    const tremoloGain = audioCtx.createGain();
    tremoloGain.gain.value = 0.05;
    tremoloOsc.connect(tremoloGain);

    ambientGainNode = audioCtx.createGain();
    ambientGainNode.gain.value = (config.crowd.ambientVolume ?? 30) / 100 * 0.15;

    source.connect(filter);
    filter.connect(ambientGainNode);
    tremoloGain.connect(ambientGainNode);
    ambientGainNode.connect(ensureVenueBus(audioCtx));
    source.start();
    tremoloOsc.start();
  } catch (e) {
    console.warn("Autodarts Tools: Web Audio API nicht verfügbar", e);
  }
}

// ─── Spielereignis-Verarbeitung ───────────────────────────────────────────────

async function processGameData(gameData: IGameData, oldGameData: IGameData): Promise<void> {
  if (!gameData?.match || !gameData.match.turns?.length || !isActive) return;

  const editMode = gameData.match.activated !== undefined && gameData.match.activated >= 0;
  if (editMode || gameData.match.variant === "Bull-off") return;

  const currentTurn = gameData.match.turns[0];
  const currentThrow = currentTurn.throws[currentTurn.throws.length - 1];
  const busted: boolean = currentTurn.busted;
  const points: number = currentTurn.points;
  const winner: boolean = gameData.match.gameWinner >= 0;
  const winnerMatch: boolean = gameData.match.winner >= 0;
  const throwCount: number = currentTurn.throws.length;
  const gameScores: number[] = gameData.match.gameScores ?? [];
  const currentPlayerIdx: number = gameData.match.player;
  const round: number = gameData.match.round ?? 1;

  const now = Date.now();
  if (now - lastEventTime < EVENT_COOLDOWN_MS) return;

  // ── Match-Start (Runde 1, noch kein Wurf) ─────────────────────────────────
  if (round === 1 && throwCount === 0 && currentPlayerIdx === 0) {
    nineDarterPotential = false;
    first3DartsScore = 0;
    second3DartsScore = 0;
    await playCrowdReaction('crowd_gameon');
    return;
  }

  if (!currentThrow) return;

  // ── Matchshot ─────────────────────────────────────────────────────────────
  if (winnerMatch) {
    nineDarterPotential = false;
    await playCrowdReaction('crowd_matchshot');
    return;
  }

  // ── Gameshot ──────────────────────────────────────────────────────────────
  if (winner) {
    // Aufholjagd prüfen: War der Spieler vorher hinten?
    const legScores = (gameData.match.scores ?? []) as unknown as number[];
    if (legScores.length >= 2) {
      const playerLegs = legScores[currentPlayerIdx] ?? 0;
      const opponentLegs = legScores[1 - currentPlayerIdx] ?? 0;
      if (opponentLegs > playerLegs + 1 && previousLegsGap > 1) {
        await playCrowdReaction('crowd_comeback');
        previousLegsGap = 0;
        return;
      }
      previousLegsGap = Math.abs(playerLegs - opponentLegs);
    }
    nineDarterPotential = false;
    await playCrowdReaction('crowd_gameshot');
    return;
  }

  // ── Bust ──────────────────────────────────────────────────────────────────
  if (busted) {
    nineDarterPotential = false;
    // Unterscheide: Doppel-Verfehler (war auf Checkout) vs. normaler Bust
    const remaining = gameScores[currentPlayerIdx];
    if (remaining !== undefined && remaining <= 50 && remaining > 0) {
      await playCrowdReaction('crowd_bust_double_miss');
    } else {
      await playCrowdReaction('crowd_bust');
    }
    return;
  }

  // ── 9-Darter Potenzial ────────────────────────────────────────────────────
  if (throwCount === 3 && !nineDarterPotential) {
    if (round === 1 && points === 180) {
      first3DartsScore = 180;
    } else if (round === 2 && first3DartsScore === 180 && points === 180) {
      second3DartsScore = 180;
      nineDarterPotential = true;
      await playCrowdReaction('crowd_nine_darter_potential');
      return;
    }
  }

  // ── Nur nach dem 3. Dart reagieren (außer Checkout-Pressure) ─────────────
  if (throwCount < 3) {
    // Checkout-Pressure: Nach 2. Dart auf Doppel
    if (throwCount === 2 && config.crowd?.pressureEnabled) {
      const remaining = gameScores[currentPlayerIdx];
      if (remaining !== undefined && remaining <= 50 && remaining > 0 && remaining % 2 === 0) {
        await playCrowdReaction('crowd_checkout_pressure');
        return;
      }
    }
    return;
  }

  // ── 180 ───────────────────────────────────────────────────────────────────
  if (points === 180) {
    await playCrowdReaction('crowd_180');
    return;
  }

  // ── 170 (höchstes Checkout) ───────────────────────────────────────────────
  if (points === 170) {
    await playCrowdReaction('crowd_170');
    return;
  }

  // ── 140+ ──────────────────────────────────────────────────────────────────
  if (points >= 140) {
    await playCrowdReaction('crowd_140plus');
    return;
  }

  // ── 100+ ──────────────────────────────────────────────────────────────────
  if (points >= 100) {
    await playCrowdReaction('crowd_100plus');
    return;
  }

  // ── Knapper Stand (beide Spieler auf wenig Punkten) ──────────────────────
  if (config.crowd?.pressureEnabled) {
    const allScores = gameScores.filter(s => s !== undefined && s > 0);
    if (allScores.length >= 2 && Math.max(...allScores) <= 100) {
      // Beide Spieler unter 100 — Spannung
      if (Math.random() < 0.3) { // Nur manchmal, nicht bei jedem Wurf
        await playCrowdReaction('crowd_close_game');
        return;
      }
    }
  }

  // ── Niedrige Scores (Pfeifen/Spott) ──────────────────────────────────────
  if (points <= 5 && config.crowd?.lowScoreBoosEnabled) {
    await playCrowdReaction('crowd_low_score');
    return;
  }
}

// ─── Crowd-Reaktion abspielen ─────────────────────────────────────────────────

async function playCrowdReaction(event: CrowdEvent): Promise<void> {
  lastEventTime = Date.now();

  // Variation: Bei gleichen aufeinanderfolgenden Events leicht variieren
  if (event === lastEvent) {
    consecutiveSameEvents++;
  } else {
    consecutiveSameEvents = 0;
  }
  lastEvent = event;

  const reactionConfig = config.crowd?.reactions?.find(r => r.eventKey === event);
  let volume = (config.crowd?.crowdVolume ?? 80) / 100;

  // v2.9.63: Venue Match-Timing-Dynamik — Deciding-Leg-Wahnsinn & Match-Shot-Boost
  if (activeVenue) {
    const isMatchShot = event === 'crowd_matchshot';
    const isDecidingLeg = event === 'crowd_gameshot' || event === 'crowd_matchshot' || event === 'crowd_comeback';
    const mult = crowdDynamicMultiplier(activeVenue, { isDecidingLeg, isMatchShot });
    volume = Math.min(1, volume * mult);
  }

  if (reactionConfig?.base64) {
    // Priority 1: user-uploaded sample
    await playAudioBase64(reactionConfig.base64, volume);
  } else {
    // Priority 2 (v2.9.83): bundled real crowd sample
    const bundledUrl = getBundledCrowdSampleUrl(event);
    if (bundledUrl) {
      await playAudioUrl(bundledUrl, volume);
    } else {
      // Priority 3: synthetic (only for hush/tension/murmur events without a bundled sample)
      playSyntheticReaction(event, volume);
    }
  }

  // Ambient-Boost bei großen Ereignissen
  if (['crowd_180', 'crowd_170', 'crowd_matchshot', 'crowd_gameshot', 'crowd_comeback', 'crowd_nine_darter_potential'].includes(event)) {
    boostAmbient(volume, event === 'crowd_matchshot' ? 5.0 : 3.0);
  }

  // Ambient kurz dämpfen bei Spannung
  if (['crowd_checkout_pressure', 'crowd_nine_darter_potential', 'crowd_close_game'].includes(event)) {
    dampAmbient();
  }
}

function playAudioBase64(base64: string, volume: number): Promise<void> {
  return new Promise<void>((resolve) => {
    stopReactionAudio();
    reactionAudio = new Audio(base64);
    reactionAudio.volume = Math.min(1, Math.max(0, volume));
    reactionAudio.addEventListener('ended', () => resolve());
    reactionAudio.addEventListener('error', () => resolve());
    reactionAudio.play().catch(() => resolve());
  });
}

/**
 * v2.9.83: Plays a bundled crowd-sound asset (extension URL, not base64).
 * v2.9.84: When a venue is active, routes playback through the venue's
 *          Web-Audio chain (Biquad filter + pitch + gain) so the SAME
 *          sample sounds like an Ally-Pally roar in one venue and a
 *          local-pub cheer in another.
 */
function playAudioUrl(url: string, volume: number): Promise<void> {
  return new Promise<void>((resolve) => {
    stopReactionAudio();
    reactionAudio = new Audio(url);
    reactionAudio.crossOrigin = 'anonymous';
    reactionAudio.addEventListener('ended', () => resolve(), { once: true });
    reactionAudio.addEventListener('error', () => resolve(), { once: true });

    // Try venue-aware Web-Audio routing first.
    const character = activeVenue?.crowdCharacter;
    if (character) {
      if (!audioCtx) {
        try { audioCtx = new AudioContext(); } catch { /* no WebAudio */ }
      }
    }
    if (character && audioCtx) {
      try {
        const src = audioCtx.createMediaElementSource(reactionAudio);
        const gain = audioCtx.createGain();
        gain.gain.value = Math.min(1.5, Math.max(0, volume * character.gainMult));

        const lp = audioCtx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = character.filterHz;
        lp.Q.value = 0.7;

        let last: AudioNode = src;
        last.connect(lp);
        last = lp;

        if (character.highpassHz && character.highpassHz > 0) {
          const hp = audioCtx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.value = character.highpassHz;
          hp.Q.value = 0.7;
          last.connect(hp);
          last = hp;
        }

        last.connect(gain);
        gain.connect(ensureVenueBus(audioCtx));

        reactionAudio.playbackRate = character.pitch;
        reactionAudio.play().catch(() => resolve());
        return;
      } catch (e) {
        // MediaElementSource kann pro Audio-Instanz nur einmal erstellt werden;
        // im Fehlerfall Fallback auf plain <audio> unten.
        console.warn('[Crowd] Venue-Routing fehlgeschlagen, Fallback plain audio', e);
      }
    }

    // Fallback: plain HTMLAudio (kein Venue aktiv, oder AudioContext fehlt).
    reactionAudio.volume = Math.min(1, Math.max(0, volume));
    reactionAudio.play().catch(() => resolve());
  });
}

function stopReactionAudio(): void {
  if (reactionAudio) {
    reactionAudio.pause();
    reactionAudio.src = '';
    reactionAudio = null;
  }
}

// ─── Synthetische Reaktionen ──────────────────────────────────────────────────

// v2.9.63: Venue-Reverb helper — routes synthetic sounds through convolution reverb
function ensureVenueBus(ctx: AudioContext): AudioNode {
  if (!activeVenue) return ctx.destination;
  if (!reverbBus) {
    try {
      reverbBus = buildReverbBusForVenue(ctx, activeVenue);
      reverbBus.output.connect(ctx.destination);
    } catch (e) {
      console.warn('Autodarts Tools: Venue-Reverb konnte nicht aufgebaut werden', e);
      return ctx.destination;
    }
  }
  return reverbBus.input;
}

function destroyReverbBus() {
  if (reverbBus) {
    try { reverbBus.destroy(); } catch (_) { /* ignore */ }
    reverbBus = null;
  }
}

async function refreshActiveVenue() {
  const id = await getActiveVenueId();
  const next = id ? (getVenue(id) ?? null) : null;
  if (next?.id !== activeVenue?.id) {
    destroyReverbBus();
    activeVenue = next;
    console.log('[Crowd] Venue aktiv:', activeVenue?.name ?? 'keins');
  }
}

function playSyntheticReaction(event: CrowdEvent, volume: number): void {
  if (!audioCtx) {
    try { audioCtx = new AudioContext(); } catch { return; }
  }

  const ctx = audioCtx;
  const gainNode = ctx.createGain();
  gainNode.connect(ensureVenueBus(ctx));

  // Variation: Lautstärke leicht zufällig variieren (±10%)
  const variationFactor = 0.9 + Math.random() * 0.2;
  const effectiveVolume = volume * variationFactor;

  switch (event) {
    case 'crowd_matchshot':
      // Maximaler Jubel — lang, eskalierend, mit Nachklang
      createCrowdBurst(ctx, gainNode, effectiveVolume, 4.0, true, 1200);
      scheduleCrowdTask(() => createCrowdBurst(ctx, gainNode, effectiveVolume * 0.7, 2.0, false, 900), 1500);
      break;

    case 'crowd_180':
      // Großer Jubel mit Variation
      if (consecutiveSameEvents === 0) {
        createCrowdBurst(ctx, gainNode, effectiveVolume, 2.5, true, 1100);
      } else {
        // Beim zweiten 180 in Folge: noch lauter
        createCrowdBurst(ctx, gainNode, Math.min(1, effectiveVolume * 1.2), 3.0, true, 1300);
      }
      break;

    case 'crowd_170':
      // Besonderer Jubel — etwas anders als 180
      createCrowdBurst(ctx, gainNode, effectiveVolume * 0.95, 2.2, true, 1050);
      break;

    case 'crowd_comeback':
      // Aufholjagd — langer, wachsender Jubel
      createCrowdBurst(ctx, gainNode, effectiveVolume * 0.6, 1.0, false, 800);
      scheduleCrowdTask(() => createCrowdBurst(ctx, gainNode, effectiveVolume, 2.5, true, 1100), 800);
      break;

    case 'crowd_nine_darter_potential':
      // Aufgeregte Stille → dann Gemurmel
      createCrowdTension(ctx, gainNode, effectiveVolume * 0.6, 3.0);
      scheduleCrowdTask(() => createCrowdBurst(ctx, gainNode, effectiveVolume * 0.4, 1.0, false, 700), 2000);
      break;

    case 'crowd_gameshot':
      createCrowdBurst(ctx, gainNode, effectiveVolume * 0.85, 2.0, false, 950);
      break;

    case 'crowd_140plus':
      createCrowdBurst(ctx, gainNode, effectiveVolume * 0.75, 1.5, false, 900);
      break;

    case 'crowd_100plus':
      createCrowdBurst(ctx, gainNode, effectiveVolume * 0.6, 1.0, false, 850);
      break;

    case 'crowd_gameon':
      // Kurzer Applaus zu Beginn
      createCrowdBurst(ctx, gainNode, effectiveVolume * 0.5, 1.2, false, 800);
      break;

    case 'crowd_bust_double_miss':
      // Kollektives Stöhnen — tiefer und länger als normaler Bust
      createCrowdGroan(ctx, gainNode, effectiveVolume * 0.7, 1.8, 500);
      scheduleCrowdTask(() => createCrowdGroan(ctx, gainNode, effectiveVolume * 0.3, 0.8, 400), 1000);
      break;

    case 'crowd_bust':
      createCrowdGroan(ctx, gainNode, effectiveVolume * 0.5, 1.2, 600);
      break;

    case 'crowd_low_score':
      // Spöttisches Pfeifen
      createCrowdWhistle(ctx, gainNode, effectiveVolume * 0.4, 1.5);
      break;

    case 'crowd_checkout_pressure':
      // Angespannte Stille — Gemurmel nimmt ab
      createCrowdTension(ctx, gainNode, effectiveVolume * 0.35, 2.5);
      break;

    case 'crowd_close_game':
      // Aufgeregtes Gemurmel bei knappem Stand
      createCrowdMurmur(ctx, gainNode, effectiveVolume * 0.4, 1.5);
      break;
  }
}

// ─── Audio-Bausteine ──────────────────────────────────────────────────────────

function createCrowdBurst(
  ctx: AudioContext,
  gain: GainNode,
  volume: number,
  duration: number,
  escalate: boolean,
  centerFreq: number = 900,
): void {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate); // Stereo

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    const phaseOffset = ch * 0.1; // Leichter Stereo-Effekt
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      let envelope: number;
      if (escalate) {
        // Schnell ansteigen, langsam abfallen
        envelope = t < 0.3
          ? t / 0.3
          : 1.0 - ((t - 0.3) / 0.7) * 0.6;
      } else {
        envelope = Math.sin((t + phaseOffset) * Math.PI);
      }
      data[i] = (Math.random() * 2 - 1) * envelope * 0.3;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = centerFreq + (Math.random() * 100 - 50); // ±50 Hz Variation
  filter.Q.value = 0.7 + Math.random() * 0.3;

  gain.gain.value = volume;
  source.connect(filter);
  filter.connect(gain);
  source.start();
}

function createCrowdGroan(
  ctx: AudioContext,
  gain: GainNode,
  volume: number,
  duration: number,
  centerFreq: number = 600,
): void {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    const envelope = Math.pow(1 - t, 0.4) * (t < 0.1 ? t / 0.1 : 1.0);
    data[i] = (Math.random() * 2 - 1) * envelope * 0.25;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = centerFreq;

  gain.gain.value = volume;
  source.connect(filter);
  filter.connect(gain);
  source.start();
}

function createCrowdTension(
  ctx: AudioContext,
  gain: GainNode,
  volume: number,
  duration: number,
): void {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    // Leises Ansteigen mit leichtem Pulsieren
    const pulse = 1 + 0.1 * Math.sin(t * Math.PI * 8);
    const envelope = (t * 0.4 + 0.1) * pulse;
    data[i] = (Math.random() * 2 - 1) * envelope * 0.08;
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1200;

  gain.gain.value = volume;
  source.connect(filter);
  filter.connect(gain);
  source.start();
}

function createCrowdWhistle(
  ctx: AudioContext,
  gain: GainNode,
  volume: number,
  duration: number,
): void {
  // Synthetisches Pfeifen: Sinus-Oszillator mit Frequenz-Modulation
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 2200;
  osc.frequency.linearRampToValueAtTime(1800, ctx.currentTime + duration * 0.5);
  osc.frequency.linearRampToValueAtTime(2000, ctx.currentTime + duration);

  const whistleGain = ctx.createGain();
  whistleGain.gain.value = volume * 0.15;
  whistleGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

  // Rauschen dazu für "Menge pfeift"
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * (1 - t) * 0.1;
  }
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;

  gain.gain.value = volume;
  osc.connect(whistleGain);
  whistleGain.connect(gain);
  noiseSource.connect(gain);
  osc.start();
  osc.stop(ctx.currentTime + duration);
  noiseSource.start();
}

function createCrowdMurmur(
  ctx: AudioContext,
  gain: GainNode,
  volume: number,
  duration: number,
): void {
  // Aufgeregtes Gemurmel: mehrere Frequenzschichten
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      // Unregelmäßiges Pulsieren
      const pulse = 0.7 + 0.3 * Math.sin(t * Math.PI * (5 + ch * 2));
      data[i] = (Math.random() * 2 - 1) * pulse * 0.2;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 750;
  filter.Q.value = 0.6;

  gain.gain.value = volume;
  source.connect(filter);
  filter.connect(gain);
  source.start();
}

// ─── Ambient-Steuerung ────────────────────────────────────────────────────────

function boostAmbient(volume: number, duration: number = 3.0): void {
  if (!ambientGainNode || !audioCtx) return;

  const targetGain = Math.min(1, volume * 0.45);
  const baseGain = (config.crowd.ambientVolume ?? 30) / 100 * 0.15;

  ambientGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
  ambientGainNode.gain.linearRampToValueAtTime(targetGain, audioCtx.currentTime + 0.2);
  ambientGainNode.gain.linearRampToValueAtTime(baseGain, audioCtx.currentTime + duration);
}

function dampAmbient(): void {
  if (!ambientGainNode || !audioCtx) return;

  const baseGain = (config.crowd.ambientVolume ?? 30) / 100 * 0.15;
  const dampedGain = baseGain * 0.3;

  ambientGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
  ambientGainNode.gain.linearRampToValueAtTime(dampedGain, audioCtx.currentTime + 0.5);
  ambientGainNode.gain.linearRampToValueAtTime(baseGain, audioCtx.currentTime + 4.0);
}
