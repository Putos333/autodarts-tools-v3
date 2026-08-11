/**
 * soundboard.ts – Manuelles Soundboard im HUD
 *
 * Zeigt eine Reihe von Buttons im HUD an, mit denen der Spieler
 * oder Zuschauer manuell Crowd-Sounds auslösen kann:
 *  - 👏 Applaus
 *  - 😮 Boooo!
 *  - 🎉 Ole Ole Ole!
 *  - 😤 Pfeifen
 *  - 🥁 Trommelwirbel
 *  - 🔇 Stille
 *
 * Alle Sounds werden über Web Audio API synthetisiert – kein Download nötig.
 */

import { AutodartsToolsConfig } from "@/utils/storage";

let overlayEl: HTMLElement | null = null;
let audioCtx: AudioContext | null = null;

// ─── Soundboard-Buttons ───────────────────────────────────────────────────────

const BUTTONS = [
  { id: 'applause',  emoji: '👏', label: 'Applaus',   color: '#00C853', fn: playApplause },
  { id: 'boo',       emoji: '😮', label: 'Boooo!',    color: '#E8002D', fn: playBoo },
  { id: 'ole',       emoji: '🎉', label: 'Olé Olé!',  color: '#F5C842', fn: playOle },
  { id: 'whistle',   emoji: '😤', label: 'Pfeifen',   color: '#2196F3', fn: playWhistle },
  { id: 'drumroll',  emoji: '🥁', label: 'Trommel',   color: '#9C27B0', fn: playDrumroll },
  { id: 'silence',   emoji: '🔇', label: 'Stille',    color: '#546E7A', fn: playSilence },
];

// ─── Öffentliche API ──────────────────────────────────────────────────────────

export async function soundboard(): Promise<void> {
  const config = await AutodartsToolsConfig.getValue();
  if (!config.soundboard?.enabled) return;

  audioCtx = new AudioContext();
  createSoundboardOverlay(config.soundboard);
}

export function soundboardOnRemove(): void {
  overlayEl?.remove();
  overlayEl = null;
  audioCtx?.close().catch(() => {});
  audioCtx = null;
}

// ─── Overlay erstellen ────────────────────────────────────────────────────────

function createSoundboardOverlay(cfg: any): void {
  overlayEl?.remove();

  const el = document.createElement('div');
  el.id = 'ad-soundboard';
  el.style.cssText = `
    position: fixed;
    bottom: ${cfg.position === 'top' ? 'auto' : '20px'};
    top: ${cfg.position === 'top' ? '80px' : 'auto'};
    right: 20px;
    z-index: 9995;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-end;
  `;

  el.innerHTML = `
    <style>
      #ad-soundboard .sb-toggle {
        background: rgba(13,27,42,0.95);
        border: 1px solid #1e3050;
        border-top: 3px solid #F5C842;
        border-radius: 8px;
        padding: 6px 12px;
        color: #F5C842;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 1.5px;
        cursor: pointer;
        font-family: 'Barlow Condensed', Arial, sans-serif;
        text-transform: uppercase;
        user-select: none;
      }
      #ad-soundboard .sb-panel {
        background: rgba(13,27,42,0.97);
        border: 1px solid #1e3050;
        border-radius: 8px;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 130px;
      }
      #ad-soundboard .sb-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid;
        background: transparent;
        cursor: pointer;
        font-family: 'Barlow Condensed', Arial, sans-serif;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.5px;
        transition: background 0.12s, transform 0.1s;
        user-select: none;
        text-transform: uppercase;
      }
      #ad-soundboard .sb-btn:active {
        transform: scale(0.95);
      }
      #ad-soundboard .sb-btn:hover {
        filter: brightness(1.2);
      }
      #ad-soundboard .sb-emoji {
        font-size: 18px;
        line-height: 1;
      }
      #ad-soundboard .sb-label {
        color: #fff;
        font-size: 12px;
      }
      #ad-soundboard .sb-volume {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px 0;
        border-top: 1px solid #1e3050;
        margin-top: 2px;
      }
      #ad-soundboard .sb-volume label {
        font-size: 10px;
        color: #556677;
        font-family: 'Barlow Condensed', Arial, sans-serif;
        text-transform: uppercase;
        letter-spacing: 1px;
        flex: 1;
      }
      #ad-soundboard .sb-volume input {
        width: 70px;
        accent-color: #F5C842;
      }
    </style>

    <button class="sb-toggle" onclick="
      var p = document.getElementById('ad-sb-panel');
      p.style.display = p.style.display === 'none' ? 'flex' : 'none';
    ">🎛️ Soundboard</button>

    <div class="sb-panel" id="ad-sb-panel" style="display:none; flex-direction:column; gap:6px;">
      ${BUTTONS.map(b => `
        <button class="sb-btn" id="sb-${b.id}"
          style="border-color:${b.color};color:${b.color}"
          onclick="window._adSoundboard('${b.id}')">
          <span class="sb-emoji">${b.emoji}</span>
          <span class="sb-label">${b.label}</span>
        </button>
      `).join('')}
      <div class="sb-volume">
        <label>Lautstärke</label>
        <input type="range" id="sb-volume" min="0" max="100"
          value="${cfg.volume ?? 70}"
          oninput="window._adSoundboardVolume(this.value)">
      </div>
    </div>
  `;

  document.body.appendChild(el);
  overlayEl = el;

  // Globale Handler
  (window as any)._adSoundboard = (id: string) => {
    const btn = BUTTONS.find(b => b.id === id);
    if (btn) {
      flashButton(id, btn.color);
      btn.fn();
    }
  };

  (window as any)._adSoundboardVolume = (val: string) => {
    globalVolume = parseInt(val) / 100;
  };
}

// ─── Visuelles Feedback ───────────────────────────────────────────────────────

function flashButton(id: string, color: string): void {
  const btn = document.getElementById(`sb-${id}`);
  if (!btn) return;
  const orig = btn.style.background;
  btn.style.background = `rgba(${hexToRgb(color)},0.3)`;
  setTimeout(() => { btn.style.background = orig; }, 300);
}

// ─── Lautstärke ───────────────────────────────────────────────────────────────

let globalVolume = 0.7;

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// ─── Sound-Synthesizer ────────────────────────────────────────────────────────

function playApplause(): void {
  const ctx = getCtx();
  const duration = 3.5;
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < bufferSize; i++) {
      // Rauschen mit Hüllkurve (Anschwellen dann Abklingen)
      const t = i / ctx.sampleRate;
      const envelope = t < 0.3
        ? t / 0.3
        : t < 2.5
          ? 1.0
          : 1.0 - (t - 2.5) / (duration - 2.5);
      // Leichte Stereo-Variation
      const stereoFactor = ch === 0 ? 1.0 : 0.92;
      data[i] = (Math.random() * 2 - 1) * envelope * 0.4 * stereoFactor;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  // Bandpass-Filter für Applaus-Charakter
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 0.8;

  const gain = ctx.createGain();
  gain.gain.value = globalVolume;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

function playBoo(): void {
  const ctx = getCtx();
  const duration = 2.5;

  // Mehrere Stimmen für "Boooo"
  for (let i = 0; i < 8; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = 180 + (Math.random() - 0.5) * 60;
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(baseFreq * 0.85, ctx.currentTime + duration);
    osc.type = 'sawtooth';

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06 * globalVolume, ctx.currentTime + 0.2);
    gain.gain.linearRampToValueAtTime(0.04 * globalVolume, ctx.currentTime + duration - 0.3);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    // Vibrato
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 5 + Math.random() * 2;
    lfoGain.gain.value = 8;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfo.start(ctx.currentTime);
    lfo.stop(ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + Math.random() * 0.1);
    osc.stop(ctx.currentTime + duration);
  }
}

function playOle(): void {
  const ctx = getCtx();

  // Rhythmisches "Olé Olé Olé" Muster
  const pattern = [0, 0.5, 1.0, 1.6, 2.1, 2.6];
  pattern.forEach((startTime, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const freq = idx % 3 === 0 ? 440 : idx % 3 === 1 ? 523 : 392;
    osc.frequency.value = freq;
    osc.type = 'sine';

    const t = ctx.currentTime + startTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.25 * globalVolume, t + 0.05);
    gain.gain.linearRampToValueAtTime(0.15 * globalVolume, t + 0.3);
    gain.gain.linearRampToValueAtTime(0, t + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  });

  // Crowd-Rauschen im Hintergrund
  const bufferSize = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.15;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 800;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = globalVolume * 0.3;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start();
}

function playWhistle(): void {
  const ctx = getCtx();
  const duration = 2.0;

  // Mehrere Pfiffe
  const whistleTimes = [0, 0.6, 1.1, 1.5];
  whistleTimes.forEach(startOffset => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = 2400 + Math.random() * 400;
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime + startOffset);
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.1, ctx.currentTime + startOffset + 0.1);
    osc.frequency.linearRampToValueAtTime(baseFreq * 0.95, ctx.currentTime + startOffset + 0.35);
    osc.type = 'sine';

    const t = ctx.currentTime + startOffset;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18 * globalVolume, t + 0.03);
    gain.gain.linearRampToValueAtTime(0.12 * globalVolume, t + 0.3);
    gain.gain.linearRampToValueAtTime(0, t + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.45);
  });
}

function playDrumroll(): void {
  const ctx = getCtx();
  const totalDuration = 2.5;
  const hitCount = 40;

  for (let i = 0; i < hitCount; i++) {
    const t = ctx.currentTime + (i / hitCount) * totalDuration;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = 80 + Math.random() * 20;
    osc.type = 'triangle';

    const intensity = i / hitCount; // Crescendo
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3 * intensity * globalVolume, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Finaler Crash
  const crashTime = ctx.currentTime + totalDuration;
  const crash = ctx.createOscillator();
  const crashGain = ctx.createGain();
  crash.frequency.value = 200;
  crash.type = 'sawtooth';
  crashGain.gain.setValueAtTime(0.4 * globalVolume, crashTime);
  crashGain.gain.exponentialRampToValueAtTime(0.001, crashTime + 0.8);
  crash.connect(crashGain);
  crashGain.connect(ctx.destination);
  crash.start(crashTime);
  crash.stop(crashTime + 0.8);
}

function playSilence(): void {
  const ctx = getCtx();
  // Kurzer "Shhhh"-Sound
  const duration = 1.5;
  const bufferSize = ctx.sampleRate * duration;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const t = i / ctx.sampleRate;
    const env = t < 0.1 ? t / 0.1 : t > 1.2 ? 1.0 - (t - 1.2) / 0.3 : 1.0;
    data[i] = (Math.random() * 2 - 1) * 0.3 * env;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 3000;

  const gain = ctx.createGain();
  gain.gain.value = globalVolume * 0.5;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
