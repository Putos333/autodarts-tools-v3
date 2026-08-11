// v2.9.56/57: Quick-Menu für Caller / Sound FX / Crowd während des Matches
// + Test-Buttons, Live-Voice-Pack-Import, Preset-Templates

import { AutodartsToolsConfig, defaultConfig, type IConfig } from '@/utils/storage';

const CONTAINER_ID = 'adt-quick-menu';
const BUTTON_ID = 'adt-quick-menu-btn';
const PRESETS_KEY = 'adt-sound-presets';
const VOICE_PACK_QUEUE_KEY = 'adt-voice-pack-queue';

let container: HTMLDivElement | null = null;
let expanded = false;
let testAudio: HTMLAudioElement | null = null;

interface SoundPreset {
  id: string;
  name: string;
  icon: string;
  callerEnabled: boolean;
  soundFxEnabled: boolean;
  crowdEnabled: boolean;
  ambientVolume?: number;
  crowdVolume?: number;
}

const BUILTIN_PRESETS: SoundPreset[] = [
  { id: 'immersion', name: 'Turnier-Immersion', icon: '🏆', callerEnabled: true,  soundFxEnabled: true,  crowdEnabled: true,  ambientVolume: 45, crowdVolume: 80 },
  { id: 'live-tv',   name: 'Live-TV-Style',     icon: '📺', callerEnabled: true,  soundFxEnabled: true,  crowdEnabled: true,  ambientVolume: 60, crowdVolume: 90 },
  { id: 'chill',     name: 'Chill-Modus',       icon: '😌', callerEnabled: false, soundFxEnabled: true,  crowdEnabled: true,  ambientVolume: 20, crowdVolume: 30 },
  { id: 'quiet',     name: 'Nur Caller',        icon: '🗣️', callerEnabled: true,  soundFxEnabled: false, crowdEnabled: false, ambientVolume: 0,  crowdVolume: 0  },
  { id: 'silence',   name: 'Alles aus',         icon: '🔇', callerEnabled: false, soundFxEnabled: false, crowdEnabled: false, ambientVolume: 0,  crowdVolume: 0  },
];

async function loadCustomPresets(): Promise<SoundPreset[]> {
  try {
    const r = await browser.storage.local.get(PRESETS_KEY);
    return r[PRESETS_KEY] ? JSON.parse(r[PRESETS_KEY]) : [];
  } catch (_) { return []; }
}
async function saveCustomPresets(presets: SoundPreset[]) {
  try { await browser.storage.local.set({ [PRESETS_KEY]: JSON.stringify(presets) }); } catch (e) { console.error(e); }
}
async function updateConfig(mutator: (cfg: IConfig) => void) {
  const current = await AutodartsToolsConfig.getValue();
  const cfg = { ...(current ?? defaultConfig) } as IConfig;
  mutator(cfg);
  await AutodartsToolsConfig.setValue(cfg);
}
async function applyPreset(p: SoundPreset) {
  await updateConfig((c) => {
    c.caller.enabled = p.callerEnabled;
    c.soundFx.enabled = p.soundFxEnabled;
    (c as any).crowd = (c as any).crowd ?? {};
    (c as any).crowd.enabled = p.crowdEnabled;
    if (p.ambientVolume !== undefined) (c as any).crowd.ambientVolume = p.ambientVolume;
    if (p.crowdVolume  !== undefined) (c as any).crowd.crowdVolume  = p.crowdVolume;
  });
}

// Test-Play Funktionen
async function playTestCaller() {
  const cfg = await AutodartsToolsConfig.getValue();
  const sounds = cfg?.caller?.sounds ?? [];
  if (sounds.length === 0) { alert('Kein Caller-Voice-Pack importiert. Öffne Tools → Sounds → Caller.'); return; }
  const preferred = sounds.find((s: any) => /180|maximum/i.test(s.name)) ?? sounds[Math.floor(Math.random() * sounds.length)];
  const src = (preferred as any)?.data ?? (preferred as any)?.url;
  if (!src) { alert('Sound-Datei nicht verfügbar.'); return; }
  if (testAudio) { testAudio.pause(); testAudio = null; }
  testAudio = new Audio(src);
  testAudio.volume = 1.0;
  await testAudio.play().catch(e => console.error(e));
}
async function playTestSoundFx() {
  const cfg = await AutodartsToolsConfig.getValue();
  const sfx = (cfg as any)?.soundFx?.sounds ?? [];
  if (sfx.length === 0) { alert('Keine Sound-FX konfiguriert.'); return; }
  const chosen = sfx.find((s: any) => s.enabled) ?? sfx[0];
  const src = chosen?.data ?? chosen?.url;
  if (!src) { alert('Sound-Datei nicht verfügbar.'); return; }
  if (testAudio) { testAudio.pause(); testAudio = null; }
  testAudio = new Audio(src);
  testAudio.volume = 1.0;
  await testAudio.play().catch(e => console.error(e));
}
async function playTestCrowd() {
  const cfg = await AutodartsToolsConfig.getValue();
  const crowd = (cfg as any)?.crowd;
  const evts = crowd?.reactions ?? [];
  const withSound = evts.find((e: any) => e.sounds?.length > 0);
  const soundEntry = withSound?.sounds?.[0];
  const src = soundEntry?.data ?? soundEntry?.url;
  if (!src) { alert('Keine Crowd-Sounds konfiguriert. Nutze Tools → Sounds → Crowd.'); return; }
  if (testAudio) { testAudio.pause(); testAudio = null; }
  testAudio = new Audio(src);
  testAudio.volume = ((crowd?.crowdVolume ?? 60) / 100);
  await testAudio.play().catch(e => console.error(e));
}

// UI Builder Helpers
function makeToggleRow(opts: { emoji: string; label: string; initialEnabled: boolean; onToggle: (v: boolean) => void; onTest?: () => void; }): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 6px;';
  const emo = document.createElement('div'); emo.textContent = opts.emoji; emo.style.fontSize = '20px';
  const lbl = document.createElement('div'); lbl.textContent = opts.label;
  lbl.style.cssText = 'flex: 1; font-size: 13px; font-weight: 700; color: #FFFFFF; text-transform: uppercase; letter-spacing: 1px;';
  row.append(emo, lbl);
  if (opts.onTest) {
    const testBtn = document.createElement('button');
    testBtn.textContent = '▶ Test';
    testBtn.style.cssText = 'background: rgba(96,165,250,0.15); border: 1px solid rgba(96,165,250,0.4); color: #60A5FA; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;';
    testBtn.addEventListener('click', (e) => { e.stopPropagation(); opts.onTest?.(); });
    row.appendChild(testBtn);
  }
  const toggle = document.createElement('button');
  toggle.style.cssText = `width: 44px; height: 22px; border-radius: 11px; border: none; cursor: pointer; position: relative; background: ${opts.initialEnabled ? '#34D399' : 'rgba(255,255,255,0.15)'}; transition: background 0.2s; flex-shrink: 0;`;
  const knob = document.createElement('div');
  knob.style.cssText = `position: absolute; top: 2px; left: ${opts.initialEnabled ? '24px' : '2px'}; width: 18px; height: 18px; border-radius: 50%; background: white; transition: left 0.2s;`;
  toggle.appendChild(knob);
  let current = opts.initialEnabled;
  toggle.addEventListener('click', () => {
    current = !current;
    toggle.style.background = current ? '#34D399' : 'rgba(255,255,255,0.15)';
    knob.style.left = current ? '24px' : '2px';
    opts.onToggle(current);
  });
  row.appendChild(toggle);
  return row;
}
function makeSliderRow(opts: { emoji: string; label: string; min: number; max: number; initialValue: number; onChange: (v: number) => void; }): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 6px;';
  const emo = document.createElement('div'); emo.textContent = opts.emoji; emo.style.fontSize = '18px';
  const lbl = document.createElement('div'); lbl.textContent = opts.label;
  lbl.style.cssText = 'width: 65px; font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase;';
  const slider = document.createElement('input');
  slider.type = 'range'; slider.min = String(opts.min); slider.max = String(opts.max); slider.value = String(opts.initialValue);
  slider.style.cssText = 'flex: 1; accent-color: #E8002D;';
  const num = document.createElement('div');
  num.textContent = String(opts.initialValue);
  num.style.cssText = 'width: 32px; text-align: right; font-size: 12px; color: #FFFFFF; font-weight: 700;';
  slider.addEventListener('input', () => { const v = parseInt(slider.value); num.textContent = String(v); opts.onChange(v); });
  row.append(emo, lbl, slider, num);
  return row;
}
function makeSection(title: string): HTMLDivElement {
  const s = document.createElement('div');
  s.textContent = title;
  s.style.cssText = 'font-size: 10px; color: #E8002D; letter-spacing: 3px; text-transform: uppercase; font-weight: 900; padding: 10px 12px 4px 12px;';
  return s;
}

// Voice-Pack Presets
const CALLER_PRESETS = [
  { value: '', label: '— Voice-Pack wählen —' },
  { value: 'https://darts-downloads.peschi.org/soundfiles/de-DE-Vicki-Female-v8.zip',  label: '🇩🇪 Vicki (DE)' },
  { value: 'https://darts-downloads.peschi.org/soundfiles/de-DE-Daniel-Male-v8.zip',   label: '🇩🇪 Daniel (DE)' },
  { value: 'https://darts-downloads.peschi.org/soundfiles/de-AT-Hannah-Female-v5.zip', label: '🇦🇹 Hannah (AT)' },
  { value: 'https://darts-downloads.peschi.org/soundfiles/en-GB-Arthur-Male-v4.zip',   label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Arthur (EN GB)' },
  { value: 'https://darts-downloads.peschi.org/soundfiles/en-GB-Amy-Female-v4.zip',    label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Amy (EN GB)' },
  { value: 'https://darts-downloads.peschi.org/soundfiles/en-US-Joey-Male-v9.zip',     label: '🇺🇸 Joey (EN US)' },
  { value: 'https://darts-downloads.peschi.org/soundfiles/en-US-Ivy-Female-v8.zip',    label: '🇺🇸 Ivy (EN US)' },
  { value: 'https://darts-downloads.peschi.org/soundfiles/nl-NL-Laura-Female-v5.zip',  label: '🇳🇱 Laura (NL)' },
];

async function queueVoicePackImport(url: string) {
  if (!url) return;
  await browser.storage.local.set({ [VOICE_PACK_QUEUE_KEY]: url });
  window.location.href = '/tools#sounds';
}

function makeDropdownRow(opts: { emoji: string; label: string; options: { value: string; label: string }[]; buttonLabel?: string; onButtonClick?: (v: string) => void; }): HTMLDivElement {
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 6px;';
  const emo = document.createElement('div'); emo.textContent = opts.emoji; emo.style.fontSize = '18px';
  const lbl = document.createElement('div'); lbl.textContent = opts.label;
  lbl.style.cssText = 'width: 55px; font-size: 11px; font-weight: 700; color: #94A3B8; text-transform: uppercase;';
  const sel = document.createElement('select');
  sel.style.cssText = 'flex: 1; background: rgba(0,0,0,0.4); color: #FFFFFF; border: 1px solid rgba(255,255,255,0.15); padding: 5px 8px; border-radius: 4px; font-size: 12px;';
  opts.options.forEach((o) => { const opt = document.createElement('option'); opt.value = o.value; opt.textContent = o.label; opt.style.color = '#000'; sel.appendChild(opt); });
  row.append(emo, lbl, sel);
  if (opts.buttonLabel && opts.onButtonClick) {
    const btn = document.createElement('button');
    btn.textContent = opts.buttonLabel;
    btn.style.cssText = 'background: linear-gradient(135deg, #34D399, #22C58E); color: #0D1B2A; border: none; padding: 5px 10px; border-radius: 3px; font-size: 10px; font-weight: 900; letter-spacing: 1px; cursor: pointer;';
    btn.addEventListener('click', () => opts.onButtonClick?.(sel.value));
    row.appendChild(btn);
  }
  return row;
}

async function buildMenu(): Promise<HTMLDivElement> {
  const cfg = await AutodartsToolsConfig.getValue();
  const wrap = document.createElement('div');
  wrap.id = CONTAINER_ID;
  wrap.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 999998; font-family: "Barlow Condensed", "Arial Narrow", Arial, sans-serif;';

  const toggleBtn = document.createElement('button');
  toggleBtn.id = BUTTON_ID;
  toggleBtn.title = 'Sound Quick-Menü';
  toggleBtn.style.cssText = 'background: linear-gradient(135deg, #E8002D, #B00020); color: white; border: none; width: 52px; height: 52px; border-radius: 50%; cursor: pointer; font-size: 24px; box-shadow: 0 4px 16px rgba(232,0,45,0.4); display: flex; align-items: center; justify-content: center;';
  toggleBtn.textContent = '🔊';
  wrap.appendChild(toggleBtn);

  const panel = document.createElement('div');
  panel.style.cssText = 'position: absolute; bottom: 62px; right: 0; width: 340px; background: linear-gradient(135deg, #0D1B2A 0%, #1a2e45 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.6); padding: 12px; display: none; max-height: 80vh; overflow-y: auto;';
  wrap.appendChild(panel);
  toggleBtn.addEventListener('click', () => {
    expanded = !expanded;
    panel.style.display = expanded ? 'block' : 'none';
    toggleBtn.textContent = expanded ? '✕' : '🔊';
  });

  const header = document.createElement('div');
  header.innerHTML = '<div style="font-size: 11px; color: #E8002D; letter-spacing: 4px; text-transform: uppercase; padding: 6px 12px 2px 12px;">Sound Quick-Menü</div><div style="font-size: 12px; color: #94A3B8; padding: 0 12px 8px 12px;">Alles was du für den Sound brauchst</div>';
  panel.appendChild(header);

  // Presets
  panel.appendChild(makeSection('Presets — mit 1 Klick anwenden'));
  const customPresets = await loadCustomPresets();
  const allPresets = [...BUILTIN_PRESETS, ...customPresets];
  const presetGrid = document.createElement('div');
  presetGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 0 4px;';
  allPresets.forEach((p) => {
    const btn = document.createElement('button');
    // v2.9.97 SEC-001: XSS-Schutz. customPresets kommen aus User-Storage,
    // Name und Icon werden gleich als innerHTML gerendert. Escapen bevor
    // wir sie einbauen.
    const escIcon = String(p.icon ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const escName = String(p.name ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    btn.innerHTML = `<div style="font-size:16px;">${escIcon}</div><div style="font-size:11px; font-weight:700; margin-top:2px;">${escName}</div>`;
    btn.style.cssText = 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: #FFFFFF; padding: 8px 6px; border-radius: 5px; cursor: pointer; text-align: center; transition: all 0.15s;';
    btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(232,0,45,0.15)'; btn.style.borderColor = '#E8002D'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,255,255,0.04)'; btn.style.borderColor = 'rgba(255,255,255,0.1)'; });
    btn.addEventListener('click', async () => {
      await applyPreset(p);
      const oldExpanded = expanded;
      wrap.remove();
      container = await buildMenu();
      document.body.appendChild(container);
      if (oldExpanded) (container.querySelector('#' + BUTTON_ID) as HTMLButtonElement).click();
    });
    presetGrid.appendChild(btn);
  });
  panel.appendChild(presetGrid);

  const saveBtn = document.createElement('button');
  saveBtn.textContent = '➕ Aktuelles Setup als Preset speichern';
  saveBtn.style.cssText = 'display: block; width: calc(100% - 8px); margin: 6px 4px 8px 4px; background: rgba(96,165,250,0.1); border: 1px dashed rgba(96,165,250,0.4); color: #60A5FA; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 11px;';
  saveBtn.addEventListener('click', async () => {
    const name = prompt('Preset-Name?', 'Mein Setup');
    if (!name) return;
    const c = await AutodartsToolsConfig.getValue();
    const preset: SoundPreset = {
      id: 'user-' + Date.now(), name, icon: '💾',
      callerEnabled: !!c?.caller?.enabled,
      soundFxEnabled: !!c?.soundFx?.enabled,
      crowdEnabled: !!(c as any)?.crowd?.enabled,
      ambientVolume: (c as any)?.crowd?.ambientVolume,
      crowdVolume: (c as any)?.crowd?.crowdVolume,
    };
    const customs = await loadCustomPresets();
    customs.push(preset);
    await saveCustomPresets(customs);
    alert('✅ Preset gespeichert.');
    wrap.remove();
    container = await buildMenu();
    document.body.appendChild(container);
  });
  panel.appendChild(saveBtn);

  // Toggles mit Test
  panel.appendChild(makeSection('Features an/aus'));
  panel.appendChild(makeToggleRow({ emoji: '📢', label: 'Caller', initialEnabled: !!cfg?.caller?.enabled, onToggle: (v) => updateConfig((c) => { c.caller.enabled = v; }), onTest: playTestCaller }));
  panel.appendChild(makeToggleRow({ emoji: '🎯', label: 'Sound FX', initialEnabled: !!cfg?.soundFx?.enabled, onToggle: (v) => updateConfig((c) => { c.soundFx.enabled = v; }), onTest: playTestSoundFx }));
  panel.appendChild(makeToggleRow({ emoji: '👥', label: 'Crowd', initialEnabled: !!(cfg as any)?.crowd?.enabled, onToggle: (v) => updateConfig((c) => { (c as any).crowd.enabled = v; }), onTest: playTestCrowd }));

  // Slider
  panel.appendChild(makeSection('Lautstärken'));
  panel.appendChild(makeSliderRow({ emoji: '🎭', label: 'Ambient', min: 0, max: 100, initialValue: (cfg as any)?.crowd?.ambientVolume ?? 25, onChange: (v) => updateConfig((c) => { (c as any).crowd.ambientVolume = v; }) }));
  panel.appendChild(makeSliderRow({ emoji: '🎉', label: 'Crowd Fx', min: 0, max: 100, initialValue: (cfg as any)?.crowd?.crowdVolume ?? 60, onChange: (v) => updateConfig((c) => { (c as any).crowd.crowdVolume = v; }) }));

  // Voice-Pack
  panel.appendChild(makeSection('Voice-Pack live wechseln'));
  panel.appendChild(makeDropdownRow({ emoji: '🗣️', label: 'Voice', options: CALLER_PRESETS, buttonLabel: 'Import', onButtonClick: (url) => queueVoicePackImport(url) }));

  // Actions
  panel.appendChild(makeSection('Aktionen'));
  const openTools = document.createElement('button');
  openTools.textContent = '⚙️ Volles Sound-Menü öffnen';
  openTools.style.cssText = 'display: block; width: 100%; background: rgba(232,0,45,0.15); border: 1px solid rgba(232,0,45,0.3); color: #FFFFFF; padding: 10px; border-radius: 5px; cursor: pointer; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 6px;';
  openTools.addEventListener('click', () => { window.location.href = '/tools'; });
  panel.appendChild(openTools);

  return wrap;
}

export async function initQuickMenu() {
  if (document.getElementById(CONTAINER_ID)) return;
  container = await buildMenu();
  document.body.appendChild(container);
  console.log('[QuickMenu] gemountet');
}

export function onRemoveQuickMenu() {
  document.getElementById(CONTAINER_ID)?.remove();
  container = null;
  expanded = false;
  if (testAudio) { testAudio.pause(); testAudio = null; }
}
