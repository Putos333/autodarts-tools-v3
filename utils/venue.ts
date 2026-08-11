// v2.9.63: Venue-Presets — PDC-Hotspots als Atmosphäre-Pakete
// -----------------------------------------------------------
// Ein Venue-Preset bestimmt:
//   1) Reverb-Signatur (Hallgröße + Dämpfung) — Ally Pally-Bierzelt-Hall
//      vs. Butlin's-Trockenraum
//   2) Ambient-Grundlautstärke (Bierzelt-Sound lauter als TV-Studio)
//   3) Dynamische Loudness-Kurven: Publikum wird lauter je näher der
//      Match-Endpunkt (Deciding-Leg-Boost)
//   4) Empfohlene Chants + Buhruf-Verhalten pro Location
//
// Reverb-Impulse werden synthetisch generiert (keine externen Files, keine
// Copyright-Risiken). Chants wird OPTIONAL über die existierende Voice-Pack-
// Queue geladen (Community kann später eigene Chant-Packs hosten).

import { AutodartsToolsConfig, defaultConfig, type IConfig } from '@/utils/storage';

export type VenueId =
  | 'ally-pally'
  | 'blackpool'
  | 'butlins-minehead'
  | 'utilita-arena'
  | 'tv-studio'
  | 'local-pub';

export interface VenueProfile {
  id: VenueId;
  name: string;
  emoji: string;
  description: string;
  location: string;
  // Reverb-Parameter (Web Audio Convolution)
  reverb: {
    /** Sekunden. Größer = mehr Nachhall (Halle vs. Zimmer) */
    duration: number;
    /** 0-1. Wieviel Prozent des trockenen Signals durch Reverb ersetzt wird */
    wetMix: number;
    /** Frequenz-Dämpfung im hohen Bereich (Hz) */
    dampeningHz: number;
  };
  // Grundlautstärken
  ambientVolume: number;    // 0-100
  crowdVolume: number;      // 0-100
  // Loudness-Kurve
  decidingLegBoost: number; // Multiplikator für crowdVolume im Deciding-Leg (1.0 = keine Änderung)
  matchShotBoost: number;   // Extra-Boost auf den Match-Winning-Dart
  pressureEnabled: boolean; // Pfeifen bei Checkout-Druck
  lowScoreBoosEnabled: boolean;
  // Empfohlener Voice-Pack Hint (falls User noch keinen hat)
  suggestedVoicePackLang?: 'de-DE' | 'en-GB' | 'en-US';
  // Community-Chant-Pack (optional, URL zu ZIP)
  chantPackUrl?: string;
  chantPackLabel?: string;
  /**
   * v2.9.84 — Venue-Charakter für gebundelte Crowd-Samples.
   * Wird auf JEDES Crowd-Sample angewandt (Ambient + Reaktionen), so dass
   * dieselben MP3s in Ally Pally wie eine grölende 3000er-Masse und
   * im Local-Pub wie 12 leicht angeheiterte Kneipengänger klingen.
   */
  crowdCharacter: {
    /** Post-Playback Lowpass in Hz. Kleiner = "gedämpfter/kleinerer" Raum. */
    filterHz: number;
    /** Optional High-Pass in Hz (schneidet Tiefen, klingt "dünner"). */
    highpassHz?: number;
    /** Playback-Rate (0.95 = leicht dunkler/langsamer, 1.05 = heller/schneller). */
    pitch: number;
    /** Extra Multiplikator auf die Sample-Lautstärke (0.4 = Kneipe, 1.2 = Arena). */
    gainMult: number;
    /** 1-Wort-Label für Debug/UI ("Arena", "Halle", "Studio", "Kneipe"). */
    label: string;
  };
}

export const BUILTIN_VENUES: VenueProfile[] = [
  {
    id: 'ally-pally',
    name: 'Ally Pally',
    emoji: '🏆',
    description: 'Weltmeisterschaft-Bierzelt: gewaltiger Hall, ohrenbetäubender Jubel, Deciding-Leg-Wahnsinn',
    location: 'Alexandra Palace, London',
    reverb: { duration: 3.2, wetMix: 0.42, dampeningHz: 3200 },
    ambientVolume: 55,
    crowdVolume: 95,
    decidingLegBoost: 1.35,
    matchShotBoost: 1.6,
    pressureEnabled: true,
    lowScoreBoosEnabled: true,
    suggestedVoicePackLang: 'en-GB',
    crowdCharacter: { filterHz: 11000, pitch: 0.97, gainMult: 1.20, label: 'Arena-Wahnsinn' },
  },
  {
    id: 'blackpool',
    name: 'Blackpool Winter Gardens',
    emoji: '🌊',
    description: 'World Matchplay: mittelgroßer Saal, aggressive Crowd, viel Buhrufe bei Miss',
    location: 'Winter Gardens, Blackpool',
    reverb: { duration: 2.1, wetMix: 0.32, dampeningHz: 4200 },
    ambientVolume: 48,
    crowdVolume: 88,
    decidingLegBoost: 1.28,
    matchShotBoost: 1.45,
    pressureEnabled: true,
    lowScoreBoosEnabled: true,
    suggestedVoicePackLang: 'en-GB',
    crowdCharacter: { filterHz: 9500, pitch: 1.00, gainMult: 1.05, label: 'Küstenhalle' },
  },
  {
    id: 'butlins-minehead',
    name: "Butlin's Minehead",
    emoji: '🏖️',
    description: 'Masters/UK Open: Ferienlager-Vibe, entspannter, aber die 180er-Gesänge sind Kult',
    location: 'Butlin\'s Resort, Minehead',
    reverb: { duration: 1.4, wetMix: 0.22, dampeningHz: 5500 },
    ambientVolume: 40,
    crowdVolume: 78,
    decidingLegBoost: 1.18,
    matchShotBoost: 1.3,
    pressureEnabled: false,
    lowScoreBoosEnabled: false,
    suggestedVoicePackLang: 'en-GB',
    crowdCharacter: { filterHz: 7000, pitch: 1.02, gainMult: 0.85, label: 'Ferienlager' },
  },
  {
    id: 'utilita-arena',
    name: 'Utilita Arena',
    emoji: '🎪',
    description: 'Premier League Play-Offs: riesige Arena, Applaus-Wellen, TV-Show-Feeling',
    location: 'Utilita Arena, Cardiff/Newcastle',
    reverb: { duration: 4.0, wetMix: 0.5, dampeningHz: 2800 },
    ambientVolume: 60,
    crowdVolume: 92,
    decidingLegBoost: 1.4,
    matchShotBoost: 1.7,
    pressureEnabled: true,
    lowScoreBoosEnabled: false,
    suggestedVoicePackLang: 'en-GB',
    crowdCharacter: { filterHz: 12000, pitch: 0.96, gainMult: 1.15, label: 'Show-Arena' },
  },
  {
    id: 'tv-studio',
    name: 'TV-Studio (Sky Sports)',
    emoji: '📺',
    description: 'Trockene Studio-Akustik, dezente Publikums-Reaktionen, seriöser Commentator-Vibe',
    location: 'Sky Sports Studios',
    reverb: { duration: 0.35, wetMix: 0.08, dampeningHz: 8000 },
    ambientVolume: 22,
    crowdVolume: 45,
    decidingLegBoost: 1.1,
    matchShotBoost: 1.15,
    pressureEnabled: false,
    lowScoreBoosEnabled: false,
    suggestedVoicePackLang: 'en-US',
    crowdCharacter: { filterHz: 4500, highpassHz: 300, pitch: 1.03, gainMult: 0.55, label: 'TV-Studio' },
  },
  {
    id: 'local-pub',
    name: 'Local Pub Night',
    emoji: '🍺',
    description: 'Enger Kneipenraum, Glass-Clinks, deutsche Kommentare — Ligaabend-Feeling',
    location: 'Deine Stammkneipe',
    reverb: { duration: 0.9, wetMix: 0.18, dampeningHz: 4500 },
    ambientVolume: 38,
    crowdVolume: 70,
    decidingLegBoost: 1.22,
    matchShotBoost: 1.35,
    pressureEnabled: true,
    lowScoreBoosEnabled: true,
    suggestedVoicePackLang: 'de-DE',
    crowdCharacter: { filterHz: 3200, highpassHz: 200, pitch: 1.06, gainMult: 0.45, label: 'Kneipenrunde' },
  },
];

const STORAGE_KEY = 'adt-venue-active';

export async function getActiveVenueId(): Promise<VenueId | null> {
  try {
    const r = await browser.storage.local.get(STORAGE_KEY);
    const v = r[STORAGE_KEY];
    return (v && typeof v === 'string') ? (v as VenueId) : null;
  } catch (_) { return null; }
}

export async function setActiveVenue(id: VenueId | null): Promise<void> {
  if (id === null) {
    await browser.storage.local.remove(STORAGE_KEY);
    return;
  }
  await browser.storage.local.set({ [STORAGE_KEY]: id });
}

export function getVenue(id: VenueId): VenueProfile | undefined {
  return BUILTIN_VENUES.find(v => v.id === id);
}

/**
 * v2.9.85 — Ordnet einer Karriere-Schwierigkeit ein passendes Standard-Venue zu:
 *   pub / amateur → local-pub     (Kneipenrunde)
 *   semipro       → butlins-minehead (Ferienlager / kleine Halle)
 *   pro           → blackpool     (Winter Gardens, mittelgroß)
 *   elite         → ally-pally    (WM-Kessel)
 *
 * TV-Events (World Championship, Premier League, Matchplay …) heben die
 * Auswahl auf `ally-pally` an — auch ein Amateur bekommt bei „Alexandra
 * Palace" das Bierzelt-Feeling, sobald er sich dahin gespielt hat.
 */
export function getDefaultVenueForDifficulty(
  difficulty: 'pub' | 'amateur' | 'semipro' | 'pro' | 'elite',
  isTvEvent: boolean = false,
): VenueId {
  if (isTvEvent) return 'ally-pally';
  switch (difficulty) {
    case 'pub': return 'local-pub';
    case 'amateur': return 'local-pub';
    case 'semipro': return 'butlins-minehead';
    case 'pro': return 'blackpool';
    case 'elite': return 'ally-pally';
  }
}

/**
 * v2.9.85 — Automatisches Venue-Preset laden, wenn der User die
 * Auto-Venue-Option aktiviert hat (Standard: an). Wendet applyVenue()
 * an, das Reverb + Loudness sofort umstellt.
 */
export async function autoApplyVenueForDifficulty(
  difficulty: 'pub' | 'amateur' | 'semipro' | 'pro' | 'elite',
  isTvEvent: boolean = false,
): Promise<VenueProfile | null> {
  try {
    const cfg = await AutodartsToolsConfig.getValue();
    const enabled = cfg?.crowd?.autoVenueByDifficulty ?? true;
    if (!enabled) return null;
  } catch { /* fall through, default = on */ }
  const id = getDefaultVenueForDifficulty(difficulty, isTvEvent);
  return applyVenue(id);
}

/**
 * Wendet ein Venue-Preset auf die Live-Config an. Nutzt UPDATE-Semantik —
 * bereits konfigurierte Reaction-Sounds (z.B. eigene 180er-Chants) bleiben
 * erhalten. Nur Lautstärken/Toggles werden überschrieben.
 */
export async function applyVenue(id: VenueId): Promise<VenueProfile | null> {
  const v = getVenue(id);
  if (!v) return null;
  const current = await AutodartsToolsConfig.getValue();
  const cfg: IConfig = { ...(current ?? defaultConfig) };
  cfg.crowd = cfg.crowd ?? defaultConfig.crowd;
  cfg.crowd.enabled = true;
  cfg.crowd.ambientEnabled = v.ambientVolume > 0;
  cfg.crowd.ambientVolume = v.ambientVolume;
  cfg.crowd.crowdVolume = v.crowdVolume;
  cfg.crowd.pressureEnabled = v.pressureEnabled;
  cfg.crowd.lowScoreBoosEnabled = v.lowScoreBoosEnabled;
  await AutodartsToolsConfig.setValue(cfg);
  await setActiveVenue(id);
  return v;
}

// ── Reverb-Bus (Web Audio API) ──────────────────────────────────────────────

let cachedReverbCtx: AudioContext | null = null;
const cachedImpulses = new Map<VenueId, AudioBuffer>();

/**
 * Erzeugt synthetisch eine Impulse-Response für die Convolution.
 * Exponentiell abklingendes Rauschen mit Frequenz-Dämpfung.
 */
function buildImpulseResponse(ctx: AudioContext, duration: number, dampHz: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * duration));
  const impulse = ctx.createBuffer(2, length, rate);
  const decay = Math.max(0.5, duration);
  // Damp-Faktor: höherer dampHz = mehr Höhen bleiben
  const dampFactor = Math.max(0, Math.min(1, dampHz / 20000));
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      const envelope = Math.pow(1 - t, decay);
      const noise = (Math.random() * 2 - 1) * envelope;
      // simpler One-Pole-Lowpass für Dämpfung
      lp = lp * (1 - dampFactor) + noise * dampFactor;
      data[i] = lp;
    }
  }
  return impulse;
}

export interface ReverbBus {
  input: GainNode;
  output: GainNode;
  destroy(): void;
}

/**
 * Baut einen Reverb-Bus für ein Venue in einem AudioContext. Der Bus hat
 * einen Input-Gain-Node — dahin routet man das trockene Signal — und
 * einen Output-Gain, der nach destination verbunden wird.
 */
export function buildReverbBusForVenue(ctx: AudioContext, venue: VenueProfile): ReverbBus {
  let impulse = cachedImpulses.get(venue.id);
  if (!impulse || impulse.sampleRate !== ctx.sampleRate) {
    impulse = buildImpulseResponse(ctx, venue.reverb.duration, venue.reverb.dampeningHz);
    cachedImpulses.set(venue.id, impulse);
  }
  const input = ctx.createGain();
  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  const output = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.buffer = impulse;

  dryGain.gain.value = 1 - venue.reverb.wetMix;
  wetGain.gain.value = venue.reverb.wetMix;

  input.connect(dryGain);
  input.connect(conv);
  conv.connect(wetGain);
  dryGain.connect(output);
  wetGain.connect(output);

  return {
    input,
    output,
    destroy() {
      try { input.disconnect(); dryGain.disconnect(); wetGain.disconnect(); conv.disconnect(); output.disconnect(); } catch (_) { /* ignore */ }
    },
  };
}

// ── Sample-Preview (kurzer synthesizer Chant-Swell zur Vorschau) ────────────

let previewCtx: AudioContext | null = null;

/**
 * Spielt einen ~3 Sekunden langen Crowd-Roar mit dem venue-typischen Reverb
 * ab. Nutzt gefiltertes Rauschen + Amplitude-Hüllkurve als „Applaus-Swell".
 */
export async function previewVenue(id: VenueId): Promise<boolean> {
  const v = getVenue(id);
  if (!v || typeof window === 'undefined') return false;
  stopVenuePreview();
  try {
    previewCtx = new AudioContext();
    const ctx = previewCtx;
    const rate = ctx.sampleRate;
    const duration = 2.8;
    const buf = ctx.createBuffer(2, Math.floor(rate * duration), rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99 * b0 + white * 0.05;
        b1 = 0.96 * b1 + white * 0.15;
        b2 = 0.86 * b2 + white * 0.31;
        const t = i / data.length;
        // Swell: fade-in 0.4s, plateau, fade-out 0.6s
        let env = 1;
        if (t < 0.15) env = t / 0.15;
        else if (t > 0.75) env = (1 - t) / 0.25;
        data[i] = (b0 + b1 + b2) * 0.35 * env;
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 850; filter.Q.value = 0.6;
    const bus = buildReverbBusForVenue(ctx, v);
    const master = ctx.createGain();
    master.gain.value = Math.min(1, v.crowdVolume / 100 + 0.15);

    source.connect(filter);
    filter.connect(bus.input);
    bus.output.connect(master);
    master.connect(ctx.destination);
    source.start();
    setTimeout(() => stopVenuePreview(), duration * 1000 + 300);
    return true;
  } catch (e) {
    console.error('[Venue] preview failed', e);
    return false;
  }
}

export function stopVenuePreview() {
  if (previewCtx) {
    try { previewCtx.close(); } catch (_) { /* ignore */ }
    previewCtx = null;
  }
}

// ── Dynamische Loudness-Kurve ──────────────────────────────────────────────

export interface MatchDynamicsContext {
  isDecidingLeg: boolean;
  isMatchShot: boolean;
}

/**
 * Gibt den effektiven Crowd-Volume-Multiplikator für den aktuellen
 * Match-Kontext zurück. `crowd.ts` und `sound-fx.ts` können das
 * multiplizieren um Publikum-Wahnsinn bei Deciding-Leg zu erzeugen.
 */
export function crowdDynamicMultiplier(v: VenueProfile, ctx: MatchDynamicsContext): number {
  let m = 1;
  if (ctx.isDecidingLeg) m *= v.decidingLegBoost;
  if (ctx.isMatchShot)   m *= v.matchShotBoost;
  return Math.min(m, 2.0);
}
