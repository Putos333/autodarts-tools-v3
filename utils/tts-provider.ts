/**
 * tts-provider.ts – Multi-Provider Text-to-Speech System
 *
 * Unterstützte Anbieter:
 *  1. browser   – Browser Web Speech API (kostenlos, kein API-Key nötig)
 *  2. elevenlabs – ElevenLabs (beste Qualität, 10.000 Zeichen/Monat kostenlos)
 *  3. google    – Google Cloud TTS (1 Mio. Zeichen/Monat kostenlos)
 *  4. azure     – Microsoft Azure TTS (500.000 Zeichen/Monat kostenlos)
 *  5. openai    – OpenAI TTS (nur über Credits, $15/1 Mio. Zeichen)
 *
 * Fallback-Kette: Wenn ein API-Key fehlt oder ein Fehler auftritt,
 * fällt das System automatisch auf den Browser-TTS zurück.
 */

export type TTSProvider = 'browser' | 'elevenlabs' | 'google' | 'azure' | 'openai';

export interface TTSConfig {
  provider: TTSProvider;
  apiKey: string;
  voice?: string;          // Provider-spezifische Stimmen-ID
  language?: string;       // Sprache (z.B. "de-DE", "en-GB")
  speed?: number;          // Geschwindigkeit 0.5–2.0 (Standard: 1.0)
  pitch?: number;          // Tonhöhe 0.5–2.0 (Standard: 1.0, nur Browser)
}

export interface TTSResult {
  ok: boolean;
  audioBase64?: string;    // Base64-kodiertes Audio (MP3/WAV)
  error?: string;
}

// ─── Provider-Informationen (für das UI) ─────────────────────────────────────

export const TTS_PROVIDERS: Record<TTSProvider, {
  label: string;
  description: string;
  freeTier: string;
  setupUrl: string;
  setupSteps: string[];
  voices: { id: string; label: string }[];
  requiresKey: boolean;
}> = {
  browser: {
    label: '🌐 Browser (kostenlos)',
    description: 'Nutzt die eingebaute Sprachsynthese deines Browsers. Komplett kostenlos, kein Account nötig. Qualität hängt vom Betriebssystem ab.',
    freeTier: 'Unbegrenzt kostenlos',
    setupUrl: '',
    setupSteps: [
      'Kein Setup nötig! Einfach auswählen und loslegen.',
      'Unter Windows: Einstellungen → Zeit & Sprache → Sprache → Deutsch installieren für bessere Stimmen.',
      'Unter Linux: "espeak-ng" oder "festival" installieren für mehr Stimmen.',
    ],
    voices: [
      { id: 'de-DE', label: 'Deutsch (Standard)' },
      { id: 'en-GB', label: 'Englisch (UK)' },
      { id: 'en-US', label: 'Englisch (US)' },
    ],
    requiresKey: false,
  },
  elevenlabs: {
    label: '🎙️ ElevenLabs (beste Qualität)',
    description: 'Die realistischsten KI-Stimmen am Markt. Klingt wie ein echter Kommentator. Kostenloses Kontingent reicht für ~400 Kommentare pro Monat.',
    freeTier: '10.000 Zeichen/Monat kostenlos',
    setupUrl: 'https://elevenlabs.io',
    setupSteps: [
      '1. Auf elevenlabs.io kostenlos registrieren.',
      '2. Oben rechts auf dein Profilbild klicken → "Profile + API key".',
      '3. Den API-Key kopieren und hier einfügen.',
      '4. Fertig! Das kostenlose Kontingent reicht für viele Dart-Abende.',
    ],
    voices: [
      { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam (männlich, tief)' },
      { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Bella (weiblich)' },
      { id: 'VR6AewLTigWG4xSOukaG', label: 'Arnold (männlich, kräftig)' },
      { id: 'yoZ06aMxZJJ28mfd3POQ', label: 'Sam (neutral)' },
      { id: 'onwK4e9ZLuTAKqWW03F9', label: 'Daniel (britisch)' },
    ],
    requiresKey: true,
  },
  google: {
    label: '🔵 Google Cloud TTS',
    description: 'Zuverlässige Qualität von Google. 1 Million Zeichen pro Monat kostenlos – das reicht für tausende Kommentare.',
    freeTier: '1.000.000 Zeichen/Monat kostenlos',
    setupUrl: 'https://console.cloud.google.com',
    setupSteps: [
      '1. Auf console.cloud.google.com mit einem Google-Konto anmelden.',
      '2. Neues Projekt erstellen (z.B. "autodarts-tts").',
      '3. "Text-to-Speech API" suchen und aktivieren.',
      '4. Links auf "APIs & Dienste" → "Anmeldedaten" → "API-Schlüssel erstellen".',
      '5. Den Schlüssel kopieren und hier einfügen.',
    ],
    voices: [
      { id: 'de-DE-Neural2-B', label: 'Deutsch männlich (Neural2)' },
      { id: 'de-DE-Neural2-A', label: 'Deutsch weiblich (Neural2)' },
      { id: 'en-GB-Neural2-B', label: 'Englisch UK männlich' },
      { id: 'en-GB-Neural2-A', label: 'Englisch UK weiblich' },
      { id: 'en-US-Neural2-D', label: 'Englisch US männlich' },
    ],
    requiresKey: true,
  },
  azure: {
    label: '🔷 Microsoft Azure TTS',
    description: '400+ Stimmen in 140+ Sprachen. Sehr gute deutsche Stimmen inklusive. 500.000 Zeichen pro Monat kostenlos.',
    freeTier: '500.000 Zeichen/Monat kostenlos',
    setupUrl: 'https://portal.azure.com',
    setupSteps: [
      '1. Auf portal.azure.com mit einem Microsoft-Konto anmelden (kostenlos).',
      '2. "Ressource erstellen" → "KI + Machine Learning" → "Sprachdienste".',
      '3. Kostenlose Stufe (F0) auswählen und erstellen.',
      '4. Nach der Erstellung: "Schlüssel und Endpunkt" → Schlüssel 1 kopieren.',
      '5. Den Schlüssel und deine Region (z.B. "westeurope") hier einfügen.',
    ],
    voices: [
      { id: 'de-DE-KillianNeural', label: 'Killian (Deutsch, männlich)' },
      { id: 'de-DE-ConradNeural', label: 'Conrad (Deutsch, männlich)' },
      { id: 'de-DE-KatjaNeural', label: 'Katja (Deutsch, weiblich)' },
      { id: 'en-GB-RyanNeural', label: 'Ryan (Englisch UK, männlich)' },
      { id: 'en-GB-SoniaNeural', label: 'Sonia (Englisch UK, weiblich)' },
    ],
    requiresKey: true,
  },
  openai: {
    label: '🤖 OpenAI TTS',
    description: 'Natürliche Sprache mit Stil-Kontrolle. Nur über bezahlte Credits verfügbar.',
    freeTier: 'Nur über Credits ($15/1 Mio. Zeichen)',
    setupUrl: 'https://platform.openai.com/api-keys',
    setupSteps: [
      '1. Auf platform.openai.com anmelden.',
      '2. Links auf "API Keys" → "Create new secret key".',
      '3. Den Schlüssel kopieren und hier einfügen.',
      '4. Hinweis: OpenAI benötigt ein aufgeladenes Guthaben.',
    ],
    voices: [
      { id: 'onyx', label: 'Onyx (männlich, tief)' },
      { id: 'echo', label: 'Echo (männlich, klar)' },
      { id: 'fable', label: 'Fable (britisch)' },
      { id: 'nova', label: 'Nova (weiblich)' },
      { id: 'shimmer', label: 'Shimmer (weiblich, sanft)' },
      { id: 'alloy', label: 'Alloy (neutral)' },
    ],
    requiresKey: true,
  },
};

// ─── TTS-Funktionen pro Anbieter ──────────────────────────────────────────────

/**
 * Hauptfunktion: Text in Sprache umwandeln.
 * Fällt automatisch auf Browser-TTS zurück, wenn der gewählte Anbieter
 * keinen API-Key hat oder einen Fehler zurückgibt.
 */
export async function speakText(text: string, config: TTSConfig): Promise<TTSResult> {
  // Kein API-Key → direkt Browser-TTS
  if (config.provider !== 'browser' && !config.apiKey?.trim()) {
    console.info(`Autodarts TTS: Kein API-Key für ${config.provider}, nutze Browser-Fallback`);
    return speakWithBrowser(text, config);
  }

  try {
    switch (config.provider) {
      case 'browser':    return await speakWithBrowser(text, config);
      case 'elevenlabs': return await speakWithElevenLabs(text, config);
      case 'google':     return await speakWithGoogle(text, config);
      case 'azure':      return await speakWithAzure(text, config);
      case 'openai':     return await speakWithOpenAI(text, config);
      default:           return await speakWithBrowser(text, config);
    }
  } catch (e: any) {
    console.warn(`Autodarts TTS: Fehler bei ${config.provider}, nutze Browser-Fallback:`, e.message);
    return speakWithBrowser(text, config);
  }
}

// ─── Browser Web Speech API ───────────────────────────────────────────────────

async function speakWithBrowser(text: string, config: TTSConfig): Promise<TTSResult> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve({ ok: false, error: 'Browser unterstützt keine Sprachsynthese' });
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = config.language || config.voice || 'de-DE';
    utterance.rate = config.speed || 1.0;
    utterance.pitch = config.pitch || 1.0;
    utterance.volume = 1.0;

    // Passende Stimme suchen
    const voices = window.speechSynthesis.getVoices();
    const lang = config.language || config.voice || 'de-DE';
    const match = voices.find(v => v.lang.startsWith(lang.split('-')[0]));
    if (match) utterance.voice = match;

    utterance.onend = () => resolve({ ok: true });
    utterance.onerror = (e) => resolve({ ok: false, error: e.error });
    window.speechSynthesis.speak(utterance);
  });
}

// ─── ElevenLabs ───────────────────────────────────────────────────────────────

async function speakWithElevenLabs(text: string, config: TTSConfig): Promise<TTSResult> {
  const voiceId = config.voice || 'pNInz6obpgDQGcFmaJgB'; // Adam (Standard)
  const response = await browser.runtime.sendMessage({
    type: 'FETCH_TTS',
    payload: {
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      headers: {
        'xi-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.3 },
      }),
    },
  });
  if (!response?.ok) return { ok: false, error: response?.error || 'ElevenLabs Fehler' };
  playBase64Audio(response.audioBase64, 'audio/mpeg');
  return { ok: true };
}

// ─── Google Cloud TTS ─────────────────────────────────────────────────────────

async function speakWithGoogle(text: string, config: TTSConfig): Promise<TTSResult> {
  const voiceName = config.voice || 'de-DE-Neural2-B';
  const langCode = voiceName.substring(0, 5); // z.B. "de-DE"
  const response = await browser.runtime.sendMessage({
    type: 'FETCH_TTS',
    payload: {
      url: `https://texttospeech.googleapis.com/v1/text:synthesize?key=${config.apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: langCode, name: voiceName },
        audioConfig: {
          audioEncoding: 'MP3',
          speakingRate: config.speed || 1.0,
          pitch: ((config.pitch || 1.0) - 1.0) * 20, // Google: -20 bis +20
        },
      }),
    },
  });
  if (!response?.ok) return { ok: false, error: response?.error || 'Google TTS Fehler' };

  // Google gibt Base64 direkt zurück (kein Blob-Umweg nötig)
  if (response.googleAudioContent) {
    playBase64Audio(response.googleAudioContent, 'audio/mpeg');
    return { ok: true };
  }
  return { ok: false, error: 'Kein Audio von Google erhalten' };
}

// ─── Microsoft Azure TTS ─────────────────────────────────────────────────────

async function speakWithAzure(text: string, config: TTSConfig): Promise<TTSResult> {
  const voiceName = config.voice || 'de-DE-KillianNeural';
  const langCode = voiceName.substring(0, 5);
  const region = 'westeurope'; // Standard-Region; kann später konfigurierbar gemacht werden

  const ssml = `<speak version='1.0' xml:lang='${langCode}'>
    <voice name='${voiceName}'>
      <prosody rate='${config.speed || 1.0}'>
        ${text}
      </prosody>
    </voice>
  </speak>`;

  const response = await browser.runtime.sendMessage({
    type: 'FETCH_TTS',
    payload: {
      url: `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
      },
      body: ssml,
    },
  });
  if (!response?.ok) return { ok: false, error: response?.error || 'Azure TTS Fehler' };
  playBase64Audio(response.audioBase64, 'audio/mpeg');
  return { ok: true };
}

// ─── OpenAI TTS ───────────────────────────────────────────────────────────────

async function speakWithOpenAI(text: string, config: TTSConfig): Promise<TTSResult> {
  const response = await browser.runtime.sendMessage({
    type: 'FETCH_TTS',
    payload: {
      url: 'https://api.openai.com/v1/audio/speech',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: config.voice || 'onyx',
        speed: config.speed || 1.0,
      }),
    },
  });
  if (!response?.ok) return { ok: false, error: response?.error || 'OpenAI TTS Fehler' };
  playBase64Audio(response.audioBase64, 'audio/mpeg');
  return { ok: true };
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function playBase64Audio(base64: string, mimeType: string): void {
  try {
    const audio = new Audio(`data:${mimeType};base64,${base64}`);
    audio.volume = 1.0;
    audio.play().catch(e => console.warn('Autodarts TTS: Audio-Wiedergabe fehlgeschlagen', e));
  } catch (e) {
    console.warn('Autodarts TTS: Fehler beim Erstellen des Audio-Elements', e);
  }
}

/**
 * Testet die Verbindung zum gewählten TTS-Anbieter mit einem kurzen Text.
 * Gibt zurück ob der Test erfolgreich war und ggf. eine Fehlermeldung.
 */
export async function testTTSProvider(config: TTSConfig): Promise<{ ok: boolean; error?: string }> {
  const testText = config.language?.startsWith('de') ? 'Test erfolgreich!' : 'Test successful!';
  const result = await speakText(testText, config);
  return { ok: result.ok, error: result.error };
}
