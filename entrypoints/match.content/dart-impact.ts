/**
 * dart-impact.ts – Dart-Aufprall-Sound
 *
 * Spielt bei jedem geworfenen Dart einen kurzen, realistischen
 * Aufprall-Sound ("Thud") via Web Audio API.
 *
 * Erkennung: Vergleich der throws.length zwischen altem und neuem
 * GameData-Snapshot (analog zu sound-fx.ts).
 *
 * Drei Varianten werden zufällig gemischt:
 *  - "thud"   → dumpfer Aufprall (Hauptsegment)
 *  - "click"  → knackiger Treffer (Draht / Rand)
 *  - "thud2"  → leicht variierter Aufprall (Variation)
 *
 * Konfiguration via config.dartImpact:
 *  - enabled  : boolean
 *  - volume   : number (0–100)
 *  - variant  : 'thud' | 'click' | 'random'
 */

import { AutodartsToolsConfig, type IConfig } from "@/utils/storage";
import type { IGameData } from "@/utils/game-data-storage";

// ─── Modul-Zustand ────────────────────────────────────────────────────────────

let config: IConfig;
let gameDataWatcherUnwatch: (() => void) | null = null;
let audioCtx: AudioContext | null = null;

// ─── Öffentliche API ──────────────────────────────────────────────────────────

export async function dartImpact(): Promise<void> {
  console.log("Autodarts Tools: Dart-Impact-Sound gestartet");
  config = await AutodartsToolsConfig.getValue();

  if (!config.dartImpact?.enabled) return;

  audioCtx = new AudioContext();

  gameDataWatcherUnwatch = AutodartsToolsGameData.watch(
    (gameData: IGameData, oldGameData: IGameData) => {
      processGameData(gameData, oldGameData);
    },
  );
}

export function dartImpactOnRemove(): void {
  gameDataWatcherUnwatch?.();
  gameDataWatcherUnwatch = null;
  audioCtx?.close().catch(() => {});
  audioCtx = null;
}

// ─── Spielereignis-Verarbeitung ───────────────────────────────────────────────

function processGameData(gameData: IGameData, oldGameData: IGameData): void {
  if (!gameData?.match || !gameData.match.turns?.length) return;
  if (gameData.match.variant === "Bull-off") return;

  // Edit-Mode: kein Sound
  if (gameData.match.activated !== undefined && gameData.match.activated >= 0) return;

  const currentThrows = gameData.match.turns[0].throws.length;
  const previousThrows = oldGameData?.match?.turns?.[0]?.throws?.length ?? 0;

  // Nur wenn ein neuer Dart geworfen wurde (throws.length hat sich erhöht)
  if (currentThrows <= previousThrows) return;

  // Kein Sound wenn das Leg gerade beendet wurde (gameWinner gesetzt)
  // – der Checkout-Sound ist bereits durch crowd/sound-fx abgedeckt
  if (gameData.match.gameWinner >= 0) return;

  // Letzten Dart lesen
  const lastThrow = gameData.match.turns[0].throws[currentThrows - 1];
  if (!lastThrow) return;

  // Segment bestimmen für Klangvariation
  const bed = lastThrow.segment?.bed ?? 'S';
  playImpactSound(bed);
}

// ─── Audio-Kontext holen ──────────────────────────────────────────────────────

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// ─── Lautstärke ───────────────────────────────────────────────────────────────

function getVolume(): number {
  return (config.dartImpact?.volume ?? 70) / 100;
}

// ─── Impact-Sound spielen ─────────────────────────────────────────────────────

function playImpactSound(bed: string): void {
  const variant = config.dartImpact?.variant ?? 'random';

  // Segment-basierte Klangauswahl
  // 'D' = Doppelring, 'T' = Triplefeld, 'S' = Single, 'SB'/'DB' = Bull
  let soundType: 'thud' | 'click' | 'thud2';

  if (variant === 'thud') {
    soundType = 'thud';
  } else if (variant === 'click') {
    soundType = 'click';
  } else {
    // 'random': Segment-basierte Auswahl mit zufälliger Variation
    if (bed === 'D') {
      // Doppel → knackiger Klick (präziser Treffer)
      soundType = Math.random() < 0.6 ? 'click' : 'thud';
    } else if (bed === 'T') {
      // Triple → dumpfer Aufprall (kräftiger Wurf)
      soundType = Math.random() < 0.7 ? 'thud' : 'thud2';
    } else if (bed === 'SB' || bed === 'DB') {
      // Bull → harter Aufprall
      soundType = 'thud2';
    } else {
      // Single → zufällig
      const r = Math.random();
      soundType = r < 0.5 ? 'thud' : r < 0.8 ? 'thud2' : 'click';
    }
  }

  switch (soundType) {
    case 'thud':  playThud();  break;
    case 'click': playClick(); break;
    case 'thud2': playThud2(); break;
  }
}

// ─── Sound-Synthesizer ────────────────────────────────────────────────────────

/**
 * Dumpfer Aufprall: Kurzer Noise-Burst mit schnellem Decay
 * und tiefem Resonanz-Anteil – wie ein Dart der ins Sisal trifft.
 */
function playThud(): void {
  const ctx = getCtx();
  const vol = getVolume();
  const now = ctx.currentTime;

  // Noise-Burst (Aufprall-Rauschen)
  const bufferSize = Math.floor(ctx.sampleRate * 0.08);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    const env = Math.exp(-t * 18); // schnelles Decay
    data[i] = (Math.random() * 2 - 1) * env;
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;

  // Tiefpass-Filter für dumpfen Charakter
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 800 + Math.random() * 400; // leichte Variation
  lpf.Q.value = 1.5;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(vol * 0.9, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  noiseSource.connect(lpf);
  lpf.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noiseSource.start(now);

  // Resonanz-Ton (tiefes "Thump")
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120 + Math.random() * 40, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.06);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(vol * 0.4, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.07);
}

/**
 * Knackiger Klick: Kurzer, harter Impuls – wie ein Dart der
 * den Draht oder den Doppelring trifft.
 */
function playClick(): void {
  const ctx = getCtx();
  const vol = getVolume();
  const now = ctx.currentTime;

  // Sehr kurzer Noise-Burst
  const bufferSize = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    const env = Math.exp(-t * 35); // sehr schnelles Decay
    data[i] = (Math.random() * 2 - 1) * env;
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;

  // Bandpass für knackigen Klick-Charakter
  const bpf = ctx.createBiquadFilter();
  bpf.type = 'bandpass';
  bpf.frequency.value = 2500 + Math.random() * 1000;
  bpf.Q.value = 2.0;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol * 0.7, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

  noiseSource.connect(bpf);
  bpf.connect(gain);
  gain.connect(ctx.destination);
  noiseSource.start(now);

  // Kurzer Klick-Ton
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(800 + Math.random() * 200, now);
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.025);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(vol * 0.2, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.025);
}

/**
 * Variierter Aufprall: Etwas weicher als playThud(),
 * mit leichtem "Schwing"-Anteil – für Triple-Treffer.
 */
function playThud2(): void {
  const ctx = getCtx();
  const vol = getVolume();
  const now = ctx.currentTime;

  // Noise-Burst
  const bufferSize = Math.floor(ctx.sampleRate * 0.1);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const t = i / bufferSize;
    const env = Math.exp(-t * 14);
    data[i] = (Math.random() * 2 - 1) * env;
  }

  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buffer;

  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 600 + Math.random() * 300;
  lpf.Q.value = 2.0;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(vol * 0.8, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

  noiseSource.connect(lpf);
  lpf.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noiseSource.start(now);

  // Resonanz mit leichtem Pitch-Sweep
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150 + Math.random() * 50, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.09);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(vol * 0.35, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

  osc.connect(oscGain);
  oscGain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.09);
}
