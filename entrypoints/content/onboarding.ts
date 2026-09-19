// v2.9.59: 3-Screen Onboarding-Wizard beim ersten Start
// -----------------------------------------------------
// Wird 1x beim ersten Besuch von play.autodarts.io mit installierter Extension
// eingeblendet. Speichert den Status in `browser.storage.local`:
//   { 'adt-onboarding-completed': true, 'adt-onboarding-skipped': true }
//
// Screens:
//   1) Welcome — kurzer Feature-Überblick
//   2) Voice-Pack wählen (Dropdown, wird in Queue geschrieben; beim nächsten
//      Öffnen von /tools automatisch importiert)
//   3) Sound-Preset wählen (5 Built-ins aus Quick-Menu; sofort angewendet)

import { AutodartsToolsConfig, defaultConfig, type IConfig } from '@/utils/storage';
import { previewVoicePack, stopVoicePreview } from '@/utils/voice-pack-preview';

const OVERLAY_ID = 'adt-onboarding-overlay';
const COMPLETED_KEY = 'adt-onboarding-completed';
const SKIPPED_KEY = 'adt-onboarding-skipped';
const VOICE_PACK_QUEUE_KEY = 'adt-voice-pack-queue';

interface Preset {
  id: string; name: string; icon: string;
  callerEnabled: boolean; soundFxEnabled: boolean; crowdEnabled: boolean;
  ambientVolume?: number; crowdVolume?: number;
}

const PRESETS: Preset[] = [
  { id: 'immersion', name: 'Turnier-Immersion', icon: '🏆', callerEnabled: true,  soundFxEnabled: true,  crowdEnabled: true,  ambientVolume: 45, crowdVolume: 80 },
  { id: 'live-tv',   name: 'Live-TV-Style',     icon: '📺', callerEnabled: true,  soundFxEnabled: true,  crowdEnabled: true,  ambientVolume: 60, crowdVolume: 90 },
  { id: 'chill',     name: 'Chill-Modus',       icon: '😌', callerEnabled: false, soundFxEnabled: true,  crowdEnabled: true,  ambientVolume: 20, crowdVolume: 30 },
  { id: 'quiet',     name: 'Nur Caller',        icon: '🗣️', callerEnabled: true,  soundFxEnabled: false, crowdEnabled: false, ambientVolume: 0,  crowdVolume: 0  },
  { id: 'silence',   name: 'Alles aus',         icon: '🔇', callerEnabled: false, soundFxEnabled: false, crowdEnabled: false, ambientVolume: 0,  crowdVolume: 0  },
];

const VOICE_PACKS = [
  { value: '',                                                                        label: '— Kein Voice-Pack (später wählen) —' },
  { value: 'https://darts-downloads.peschi.org/soundfiles/de-DE-Vicki-Female-v8.zip', label: '🇩🇪 Vicki — Klassisch Deutsch' },
  { value: 'https://darts-downloads.peschi.org/soundfiles/de-DE-Daniel-Male-v8.zip',  label: '🇩🇪 Daniel — Ernster Sprecher DE' },
  { value: 'https://darts-downloads.peschi.org/soundfiles/en-GB-Arthur-Male-v4.zip',  label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Arthur — PDC-Style EN' },
  { value: 'https://darts-downloads.peschi.org/soundfiles/en-GB-Amy-Female-v4.zip',   label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Amy — Britisch EN' },
  { value: 'https://darts-downloads.peschi.org/soundfiles/en-US-Joey-Male-v9.zip',    label: '🇺🇸 Joey — Jung/energetisch' },
];

let currentStep = 1;
let selectedVoicePack = '';
let selectedPresetId = 'immersion';

async function alreadyCompleted(): Promise<boolean> {
  try {
    const r = await browser.storage.local.get([COMPLETED_KEY, SKIPPED_KEY]);
    return !!(r[COMPLETED_KEY] || r[SKIPPED_KEY]);
  } catch (_) { return false; }
}

async function markCompleted(skipped: boolean) {
  const patch: Record<string, boolean> = { [COMPLETED_KEY]: true };
  if (skipped) patch[SKIPPED_KEY] = true;
  await browser.storage.local.set(patch);
}

async function applyPreset(id: string) {
  const p = PRESETS.find(x => x.id === id);
  if (!p) return;
  const current = await AutodartsToolsConfig.getValue();
  const cfg = { ...(current ?? defaultConfig) } as IConfig;
  cfg.caller.enabled = p.callerEnabled;
  cfg.soundFx.enabled = p.soundFxEnabled;
  (cfg as any).crowd = (cfg as any).crowd ?? {};
  (cfg as any).crowd.enabled = p.crowdEnabled;
  if (p.ambientVolume !== undefined) (cfg as any).crowd.ambientVolume = p.ambientVolume;
  if (p.crowdVolume !== undefined) (cfg as any).crowd.crowdVolume = p.crowdVolume;
  await AutodartsToolsConfig.setValue(cfg);
}

async function queueVoicePack(url: string) {
  if (!url) return;
  await browser.storage.local.set({ [VOICE_PACK_QUEUE_KEY]: url });
}

// ── UI ──────────────────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(tag: K, style: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.style.cssText = style;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function buildStep1(): HTMLElement {
  const wrap = el('div', 'text-align:center; padding: 8px 4px 0 4px;');
  wrap.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 12px;">🎯</div>
    <div style="font-size: 12px; letter-spacing: 4px; color: #E8002D; text-transform: uppercase; font-weight: 900;">Willkommen bei</div>
    <div style="font-size: 32px; letter-spacing: 2px; text-transform: uppercase; font-weight: 900; color: #FFFFFF; line-height: 1; margin: 6px 0 12px 0;">Autodarts Tools</div>
    <div style="font-size: 14px; color: #94A3B8; line-height: 1.6; max-width: 480px; margin: 0 auto 22px auto;">
      Bringt PDC-Feeling zu deinem Autodarts. In 60 Sekunden startklar:
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-width: 480px; margin: 0 auto 20px auto; text-align: left;">
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 12px;">
        <div style="font-size: 18px; margin-bottom: 4px;">🗣️</div>
        <div style="font-size: 12px; font-weight: 700; color: #FFFFFF;">Caller</div>
        <div style="font-size: 11px; color: #64748B; margin-top: 2px;">25+ Sprach-Pakete</div>
      </div>
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 12px;">
        <div style="font-size: 18px; margin-bottom: 4px;">🏆</div>
        <div style="font-size: 12px; font-weight: 700; color: #FFFFFF;">Saison & Turnier</div>
        <div style="font-size: 11px; color: #64748B; margin-top: 2px;">Gegen echte PDC-Bots</div>
      </div>
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 12px;">
        <div style="font-size: 18px; margin-bottom: 4px;">👥</div>
        <div style="font-size: 12px; font-weight: 700; color: #FFFFFF;">Crowd & Sound FX</div>
        <div style="font-size: 11px; color: #64748B; margin-top: 2px;">180er-Jubel, Buzzer, Musik</div>
      </div>
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 12px;">
        <div style="font-size: 18px; margin-bottom: 4px;">🔊</div>
        <div style="font-size: 12px; font-weight: 700; color: #FFFFFF;">Match Quick-Menü</div>
        <div style="font-size: 11px; color: #64748B; margin-top: 2px;">Alles im Match steuern</div>
      </div>
    </div>
  `;
  return wrap;
}

function buildStep2(): HTMLElement {
  const wrap = el('div', 'padding: 8px 4px 0 4px;');
  wrap.innerHTML = `
    <div style="font-size: 11px; color: #E8002D; letter-spacing: 4px; text-transform: uppercase; font-weight: 900; margin-bottom: 6px;">Schritt 2 · Caller-Stimme</div>
    <div style="font-size: 22px; font-weight: 900; color: #FFFFFF; letter-spacing: 1px; margin-bottom: 6px;">Wähle deine Sprecher-Stimme</div>
    <div style="font-size: 13px; color: #94A3B8; margin-bottom: 20px; line-height: 1.5;">
      Deine Wahl wird beim ersten Öffnen der Tool-Einstellungen automatisch importiert. Kannst du später jederzeit ändern.
    </div>
  `;
  const select = document.createElement('select');
  select.style.cssText = 'width: 100%; background: rgba(0,0,0,0.4); color: #FFFFFF; border: 1px solid rgba(255,255,255,0.15); padding: 12px 14px; border-radius: 6px; font-size: 14px; font-family: inherit; margin-bottom: 12px;';
  VOICE_PACKS.forEach((vp) => {
    const opt = document.createElement('option');
    opt.value = vp.value; opt.textContent = vp.label; opt.style.color = '#000';
    if (vp.value === selectedVoicePack) opt.selected = true;
    select.appendChild(opt);
  });
  wrap.appendChild(select);

  // Preview-Button
  const previewBtn = document.createElement('button');
  previewBtn.style.cssText = `
    background: rgba(52,211,153,0.15); border: 1px solid rgba(52,211,153,0.4);
    color: #34D399; padding: 8px 16px; border-radius: 5px; cursor: pointer;
    font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
    font-family: inherit; margin-bottom: 12px;
    display: ${selectedVoicePack ? 'inline-flex' : 'none'};
  `;
  previewBtn.textContent = '▶ Anhören';
  previewBtn.setAttribute('data-testid', 'ob-voice-preview-btn');
  wrap.appendChild(previewBtn);

  select.addEventListener('change', () => {
    selectedVoicePack = select.value;
    previewBtn.style.display = selectedVoicePack ? 'inline-flex' : 'none';
    stopVoicePreview();
    previewBtn.textContent = '▶ Anhören';
  });

  let playing = false;
  previewBtn.addEventListener('click', async () => {
    if (playing) { stopVoicePreview(); playing = false; previewBtn.textContent = '▶ Anhören'; return; }
    if (!selectedVoicePack) return;
    playing = true; previewBtn.textContent = '■ Stop';
    const res = await previewVoicePack(selectedVoicePack);
    if (!res) { playing = false; previewBtn.textContent = '▶ Anhören (nicht verfügbar)'; return; }
    setTimeout(() => { playing = false; previewBtn.textContent = '▶ Anhören'; }, 4500);
  });

  const hint = el('div',
    'font-size: 11px; color: #64748B; letter-spacing: 1px; text-transform: uppercase; margin-top: 6px;',
    '💡 Ca. 20 MB Download beim ersten Import. Ohne Auswahl fährt der Wizard fort.',
  );
  wrap.appendChild(hint);
  return wrap;
}

function buildStep3(rerender: () => void): HTMLElement {
  const wrap = el('div', 'padding: 8px 4px 0 4px;');
  wrap.innerHTML = `
    <div style="font-size: 11px; color: #E8002D; letter-spacing: 4px; text-transform: uppercase; font-weight: 900; margin-bottom: 6px;">Schritt 3 · Sound-Profil</div>
    <div style="font-size: 22px; font-weight: 900; color: #FFFFFF; letter-spacing: 1px; margin-bottom: 6px;">Wie soll's klingen?</div>
    <div style="font-size: 13px; color: #94A3B8; margin-bottom: 18px; line-height: 1.5;">
      Ein-Klick-Voreinstellung, kannst du im Match jederzeit über das 🔊-Quickmenü umschalten.
    </div>
  `;
  const grid = el('div', 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;');
  PRESETS.forEach((p) => {
    const active = selectedPresetId === p.id;
    const btn = document.createElement('button');
    btn.style.cssText = `
      display: flex; align-items: center; gap: 12px; padding: 14px 16px;
      background: ${active ? 'rgba(232,0,45,0.15)' : 'rgba(255,255,255,0.03)'};
      border: 2px solid ${active ? '#E8002D' : 'rgba(255,255,255,0.08)'};
      color: #FFFFFF; border-radius: 6px; cursor: pointer; text-align: left;
      transition: all 0.15s; font-family: inherit;
    `;
    btn.innerHTML = `
      <div style="font-size: 26px;">${p.icon}</div>
      <div style="flex: 1;">
        <div style="font-size: 13px; font-weight: 700; letter-spacing: 1px;">${p.name}</div>
        <div style="font-size: 10px; color: #94A3B8; margin-top: 2px;">
          ${p.callerEnabled ? 'Caller · ' : ''}${p.soundFxEnabled ? 'SFX · ' : ''}${p.crowdEnabled ? 'Crowd' : ''}
        </div>
      </div>
      ${active ? '<div style="color:#34D399; font-size:18px; font-weight:900;">✓</div>' : ''}
    `;
    btn.addEventListener('click', () => { selectedPresetId = p.id; rerender(); });
    grid.appendChild(btn);
  });
  wrap.appendChild(grid);
  return wrap;
}

function buildOverlay(): HTMLElement {
  const backdrop = el('div', `
    position: fixed; inset: 0; z-index: 2147483000;
    background: rgba(2,6,15,0.72); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    font-family: "Barlow Condensed", "Arial Narrow", Arial, sans-serif;
  `);
  backdrop.id = OVERLAY_ID;

  const dialog = el('div', `
    width: min(640px, 92vw); max-height: 88vh; overflow: auto;
    background: linear-gradient(135deg, #0D1B2A 0%, #1a2e45 100%);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 14px;
    box-shadow: 0 24px 60px rgba(0,0,0,0.6); padding: 28px 30px 22px 30px;
    color: #FFFFFF; position: relative;
  `);
  backdrop.appendChild(dialog);

  // Skip-Link oben rechts
  const skip = el('button', `
    position: absolute; top: 14px; right: 16px;
    background: none; border: none; color: #64748B; font-size: 11px;
    letter-spacing: 2px; text-transform: uppercase; cursor: pointer; font-family: inherit;
  `, 'Überspringen ✕');
  skip.addEventListener('click', async () => {
    await markCompleted(true);
    backdrop.remove();
  });
  dialog.appendChild(skip);

  const stepIndicator = el('div', 'font-size: 10px; color: #64748B; letter-spacing: 3px; margin-bottom: 14px;');
  dialog.appendChild(stepIndicator);

  const body = el('div', 'min-height: 340px;');
  dialog.appendChild(body);

  const footer = el('div', 'display: flex; justify-content: space-between; align-items: center; margin-top: 24px; gap: 10px;');
  dialog.appendChild(footer);

  const backBtn = document.createElement('button');
  backBtn.style.cssText = 'background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #94A3B8; padding: 10px 18px; border-radius: 5px; cursor: pointer; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; font-family: inherit;';
  backBtn.textContent = '← Zurück';
  const nextBtn = document.createElement('button');
  nextBtn.style.cssText = 'background: linear-gradient(135deg, #E8002D, #B00020); border: none; color: white; padding: 12px 26px; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; font-family: inherit;';
  footer.append(backBtn, nextBtn);

  function render() {
    stepIndicator.textContent = `SCHRITT ${currentStep} VON 3`;
    body.innerHTML = '';
    if (currentStep === 1) body.appendChild(buildStep1());
    else if (currentStep === 2) body.appendChild(buildStep2());
    else body.appendChild(buildStep3(render));
    backBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
    nextBtn.textContent = currentStep === 3 ? '✓ FERTIG!' : (currentStep === 1 ? 'LOS GEHT\'S →' : 'WEITER →');
  }

  backBtn.addEventListener('click', () => { if (currentStep > 1) { currentStep--; render(); } });
  nextBtn.addEventListener('click', async () => {
    if (currentStep < 3) {
      currentStep++;
      render();
      return;
    }
    // Fertig — Voice-Pack in Queue + Preset direkt anwenden
    try {
      if (selectedVoicePack) await queueVoicePack(selectedVoicePack);
      await applyPreset(selectedPresetId);
      await markCompleted(false);
    } catch (e) {
      console.error('[Onboarding] finish error', e);
    }
    // Erfolgs-Toast
    dialog.innerHTML = `
      <div style="text-align:center; padding: 30px 10px;">
        <div style="font-size: 56px; margin-bottom: 12px;">✅</div>
        <div style="font-size: 22px; font-weight: 900; letter-spacing: 1px; margin-bottom: 6px;">Alles klar!</div>
        <div style="font-size: 13px; color: #94A3B8; max-width: 380px; margin: 0 auto 22px auto; line-height: 1.6;">
          ${selectedVoicePack ? 'Dein Voice-Pack wird beim ersten Öffnen der Tool-Einstellungen automatisch importiert.<br>' : ''}
          Alle Feinheiten findest du unter <b style="color:#F5C842;">Tools → Sounds</b>.
        </div>
        <button id="adt-ob-close" style="background: rgba(52,211,153,0.15); border: 1px solid rgba(52,211,153,0.4); color: #34D399; padding: 10px 24px; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; font-family: inherit;">Schließen</button>
      </div>
    `;
    (dialog.querySelector('#adt-ob-close') as HTMLButtonElement | null)?.addEventListener('click', () => backdrop.remove());
    setTimeout(() => backdrop.remove(), 4000);
  });

  render();
  return backdrop;
}

export async function initOnboarding() {
  if (document.getElementById(OVERLAY_ID)) return;
  if (await alreadyCompleted()) return;
  // Reset state (bei erneuter Anzeige)
  currentStep = 1; selectedVoicePack = ''; selectedPresetId = 'immersion';
  document.body.appendChild(buildOverlay());
  console.log('[ADT] Onboarding-Wizard gestartet');
}

/** Manuell erneut zeigen (z.B. aus Settings-Menü) */
export async function resetOnboarding() {
  await browser.storage.local.remove([COMPLETED_KEY, SKIPPED_KEY]);
  await initOnboarding();
}
