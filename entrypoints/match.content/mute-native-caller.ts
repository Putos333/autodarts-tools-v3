// v2.9.64: Native-Autodarts-Audio unterdrücken wenn eigene Sounds aktiv
// ---------------------------------------------------------------------
// Autodarts spielt eigene Ansagen ("180", Score-Zahlen, Winning-Sounds).
// Wenn der User unseren Caller / Sound FX / Crowd nutzt, kollidieren beide.
// Diese Datei überschreibt `HTMLAudioElement.prototype.play` und filtert
// audiovisuell nach URL-Typ:
//   - `data:` und `blob:` URLs → unsere eigenen Sounds → durchgelassen
//   - alles andere (http[s]://) → Autodarts-nativ → gemutet wenn aktiv
//
// Aktivierung wenn min. eines von caller.enabled / soundFx.enabled /
// crowd.enabled true ist UND config.caller.muteNativeAutodarts !== false.

import { AutodartsToolsConfig } from '@/utils/storage';

let installed = false;
let originalPlay: typeof HTMLAudioElement.prototype.play | null = null;
let muteActive = false;
let configWatcher: any = null;

/** WeakSet für unsere eigenen Audio-Elemente (Whitelist). */
const OWN_AUDIO = new WeakSet<HTMLAudioElement>();

/** Andere Module rufen das auf um ihre Audios sicher als "unsere" zu markieren. */
export function markOwnAudio(audio: HTMLAudioElement) {
  OWN_AUDIO.add(audio);
}

function shouldSuppress(audio: HTMLAudioElement): boolean {
  if (!muteActive) return false;
  if (OWN_AUDIO.has(audio)) return false;
  if (audio.hasAttribute('data-adt-own')) return false;
  const src = audio.src || audio.currentSrc || '';
  // Datei-URIs (data: / blob:) sind IMMER unsere eigenen Sounds
  if (src.startsWith('data:') || src.startsWith('blob:')) return false;
  // Alles andere (Autodarts-CDN, autodarts.io Domains) muten
  return true;
}

function installHook() {
  if (installed) return;
  const proto = HTMLAudioElement.prototype;
  originalPlay = proto.play;
  const wrapped = function (this: HTMLAudioElement): Promise<void> {
    try {
      if (shouldSuppress(this)) {
        this.muted = true;
        this.volume = 0;
      }
    } catch (_) { /* ignore */ }
    return originalPlay!.call(this);
  };
  proto.play = wrapped as any;
  installed = true;
  console.log('[MuteNativeCaller] Audio-Play-Hook installiert');
}

function uninstallHook() {
  if (!installed || !originalPlay) return;
  HTMLAudioElement.prototype.play = originalPlay;
  originalPlay = null;
  installed = false;
  console.log('[MuteNativeCaller] Audio-Play-Hook entfernt');
}

async function evaluateActive() {
  try {
    const cfg = await AutodartsToolsConfig.getValue();
    const anyOwnSound =
      !!cfg?.caller?.enabled ||
      !!cfg?.soundFx?.enabled ||
      !!cfg?.crowd?.enabled;
    // Opt-Out via config.caller.muteNativeAutodarts === false (Default true)
    const enabledByUser = (cfg as any)?.caller?.muteNativeAutodarts !== false;
    const shouldBeActive = anyOwnSound && enabledByUser;
    if (shouldBeActive && !muteActive) {
      muteActive = true;
      installHook();
      // Bereits laufende Autodarts-Audios rückwirkend muten
      document.querySelectorAll('audio').forEach((el) => {
        const audio = el as HTMLAudioElement;
        if (shouldSuppress(audio)) { audio.muted = true; audio.volume = 0; }
      });
    } else if (!shouldBeActive && muteActive) {
      muteActive = false;
      uninstallHook();
      // Bereits gemutete Autodarts-Audios NICHT reaktivieren — sonst spielen alte
      // Ansagen plötzlich verspätet ab. Beim nächsten Match-Reload läuft alles normal.
    }
  } catch (e) {
    console.error('[MuteNativeCaller] evaluate failed', e);
  }
}

export function initMuteNativeCaller() {
  evaluateActive();
  if (configWatcher) return;
  configWatcher = AutodartsToolsConfig.watch(() => evaluateActive());
}

export function cleanupMuteNativeCaller() {
  if (configWatcher) { configWatcher(); configWatcher = null; }
  uninstallHook();
  muteActive = false;
}
