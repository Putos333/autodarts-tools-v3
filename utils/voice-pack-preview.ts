// v2.9.61: Voice-Pack-Vorschau via Browser-TTS
// Da die echten ZIP-Pakete 20 MB groß sind, nutzen wir die im Browser vorhandene
// Speech-Synthesis-API um eine SPRACHLICHE Näherung zu spielen — nicht die
// exakte Sprecher-Stimme, aber Sprache + Geschlecht sind identisch. Das
// entscheidet in der Regel schon "kaufen oder nicht".

export interface VoiceDescriptor {
  lang: string;                 // BCP-47 z.B. de-DE, en-GB
  gender: 'male' | 'female';
  phrase?: string;              // Testsatz; Default: "180"
}

/**
 * Ordnet peschi.org-URLs den Sprach-/Geschlecht-Metadaten zu.
 * Diese Map ist bewusst statisch: die Voice-Packs auf peschi.org sind stabil
 * (v3 / v5 / v8 sind nur Versionsnummern, Sprache/Geschlecht ändern sich nicht).
 */
export const VOICE_PACK_DESCRIPTORS: Record<string, VoiceDescriptor> = {
  'de-DE-Vicki-Female':   { lang: 'de-DE', gender: 'female' },
  'de-DE-Daniel-Male':    { lang: 'de-DE', gender: 'male' },
  'de-AT-Hannah-Female':  { lang: 'de-AT', gender: 'female' },
  'en-GB-Arthur-Male':    { lang: 'en-GB', gender: 'male' },
  'en-GB-Amy-Female':     { lang: 'en-GB', gender: 'female' },
  'en-US-Stephen-Male':   { lang: 'en-US', gender: 'male' },
  'en-US-Matthew-Male':   { lang: 'en-US', gender: 'male' },
  'en-US-Joey-Male':      { lang: 'en-US', gender: 'male' },
  'en-US-Kevin-Male':     { lang: 'en-US', gender: 'male' },
  'en-US-Justin-Male':    { lang: 'en-US', gender: 'male' },
  'en-US-Gregory-Male':   { lang: 'en-US', gender: 'male' },
  'en-US-Ivy-Female':     { lang: 'en-US', gender: 'female' },
  'en-US-Joanna-Female':  { lang: 'en-US', gender: 'female' },
  'en-US-Danielle-Female':{ lang: 'en-US', gender: 'female' },
  'en-US-Kimberly-Female':{ lang: 'en-US', gender: 'female' },
  'en-US-Ruth-Female':    { lang: 'en-US', gender: 'female' },
  'en-US-Salli-Female':   { lang: 'en-US', gender: 'female' },
  'en-US-Kendra-Female':  { lang: 'en-US', gender: 'female' },
  'nl-NL-Laura-Female':   { lang: 'nl-NL', gender: 'female' },
  'fr-FR-Remi-Male':      { lang: 'fr-FR', gender: 'male' },
  'fr-FR-Lea-Female':     { lang: 'fr-FR', gender: 'female' },
  'es-ES-Sergio-Male':    { lang: 'es-ES', gender: 'male' },
  'es-ES-Lucia-Female':   { lang: 'es-ES', gender: 'female' },
};

const SAMPLE_PHRASES: Record<string, string> = {
  'de-DE': 'Einhundertachtzig! Klasse Wurf!',
  'de-AT': 'Einhundertachtzig! Bombe!',
  'en-GB': 'One hundred and eighty! Game shot!',
  'en-US': 'One hundred and eighty! Game shot and match!',
  'nl-NL': 'Honderdtachtig! Game shot!',
  'fr-FR': 'Cent quatre-vingts! Coup gagnant!',
  'es-ES': '¡Ciento ochenta! ¡Buen tiro!',
};

/**
 * Extrahiert den Descriptor-Key aus einer peschi.org-URL, z.B.
 * ".../de-DE-Vicki-Female-v8.zip" -> "de-DE-Vicki-Female".
 */
export function descriptorKeyFromUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/([a-z]{2}-[A-Z]{2}-[A-Za-z]+-(?:Male|Female))(?:-v\d+)?\.zip/);
  return match ? match[1] : null;
}

/**
 * Wählt die beste Browser-Stimme für Sprache + Geschlecht aus.
 * Heuristik: Name enthält "female"/"male", "woman"/"man" oder bekannte Namen.
 */
function pickBestVoice(voices: SpeechSynthesisVoice[], lang: string, gender: 'male' | 'female'): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const langLower = lang.toLowerCase();
  const langBase = langLower.split('-')[0];

  // 1) exakte lang + gender-Hinweis im Namen
  const genderRegex = gender === 'female' ? /female|woman|frau|femme|mujer/i : /\bmale\b|man\b|mann|homme|hombre/i;
  const exact = voices.find(v => v.lang.toLowerCase() === langLower && genderRegex.test(v.name));
  if (exact) return exact;

  // 2) exakte lang ohne Gender-Filter
  const langOnly = voices.find(v => v.lang.toLowerCase() === langLower);
  if (langOnly) return langOnly;

  // 3) gleiche Basis-Sprache + Gender
  const baseGender = voices.find(v => v.lang.toLowerCase().startsWith(langBase) && genderRegex.test(v.name));
  if (baseGender) return baseGender;

  // 4) gleiche Basis-Sprache
  const base = voices.find(v => v.lang.toLowerCase().startsWith(langBase));
  return base ?? null;
}

let currentUtterance: SpeechSynthesisUtterance | null = null;

/** Bricht laufende Vorschau ab. */
export function stopVoicePreview() {
  try {
    window.speechSynthesis?.cancel();
  } catch (_) { /* ignore */ }
  currentUtterance = null;
}

/**
 * Spielt eine Vorschau für ein Voice-Pack ab. Gibt die verwendete Sprach-
 * Bezeichnung zurück, oder null wenn TTS im Browser nicht verfügbar ist.
 */
export async function previewVoicePack(url: string): Promise<{ voiceName: string; lang: string } | null> {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('[VoicePreview] speechSynthesis nicht verfügbar');
    return null;
  }
  const key = descriptorKeyFromUrl(url);
  if (!key) return null;
  const desc = VOICE_PACK_DESCRIPTORS[key];
  if (!desc) return null;

  stopVoicePreview();

  // Warten bis Voices geladen sind (Chrome lädt asynchron)
  let voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    await new Promise<void>((resolve) => {
      const onLoad = () => { window.speechSynthesis.removeEventListener('voiceschanged', onLoad); resolve(); };
      window.speechSynthesis.addEventListener('voiceschanged', onLoad);
      setTimeout(() => { window.speechSynthesis.removeEventListener('voiceschanged', onLoad); resolve(); }, 800);
    });
    voices = window.speechSynthesis.getVoices();
  }

  const chosen = pickBestVoice(voices, desc.lang, desc.gender);
  const phrase = desc.phrase ?? SAMPLE_PHRASES[desc.lang] ?? SAMPLE_PHRASES[desc.lang.split('-')[0]] ?? 'One hundred and eighty!';
  const utt = new SpeechSynthesisUtterance(phrase);
  utt.lang = desc.lang;
  utt.rate = 1.05;
  utt.pitch = desc.gender === 'female' ? 1.15 : 0.95;
  utt.volume = 1;
  if (chosen) utt.voice = chosen;
  currentUtterance = utt;
  try {
    window.speechSynthesis.speak(utt);
  } catch (e) {
    console.error('[VoicePreview] speak failed', e);
    return null;
  }
  return {
    voiceName: chosen?.name ?? `System-${desc.lang}-${desc.gender}`,
    lang: desc.lang,
  };
}
