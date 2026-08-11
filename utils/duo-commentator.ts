/**
 * duo-commentator.ts – LLM-basierter Duo-Kommentator (v2.9.73)
 *
 * Ruft den Backend-Proxy `/api/commentator/generate` auf, erhält zwei kurze
 * Kommentare (Analyst + Entertainer) und spricht sie mit zwei verschiedenen
 * TTS-Stimmen aus. Der Emergent-LLM-Key bleibt serverseitig – der Content-
 * Script sieht nur die generierten Texte.
 */

import { speakText, type TTSConfig, type TTSProvider } from "@/utils/tts-provider";
import { decryptApiKey } from "@/utils/secure-storage";

export type DuoEvent =
  | "match_start"
  | "score_180"
  | "score_140plus"
  | "score_100plus"
  | "low_score"
  | "bust"
  | "checkout_high"
  | "checkout_normal"
  | "matchshot"
  | "leg_win"
  | "bogey_number"
  | "checkout_suggestion";

export interface DuoRequest {
  event: DuoEvent;
  player: string;
  opponent?: string;
  score?: number;
  remaining?: number;
  leg?: number;
  set?: number;
  checkout_path?: string;
  average?: number;
  language: "de" | "en";
  intensity: "chill" | "normal" | "hype";
  session_id?: string;
}

export interface DuoResponse {
  session_id: string;
  analyst: string;
  entertainer: string;
  source: "llm" | "fallback";
}

interface DuoConfig {
  enabled: boolean;
  backendUrl: string;
  language: "de" | "en";
  intensity: "chill" | "normal" | "hype";
  ttsProvider: TTSProvider;
  ttsApiKey: string;
  analystVoice: string;
  entertainerVoice: string;
  volume: number;
}

let currentAudio: HTMLAudioElement | null = null;
let cachedSessionId: string | null = null;
let isSpeaking = false;

export function duoIsSpeaking(): boolean {
  return isSpeaking;
}

export function duoStop(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  isSpeaking = false;
}

export function duoResetSession(): void {
  cachedSessionId = null;
}

/**
 * Ruft den Backend-Proxy an und spielt beide Persona-Sätze nacheinander ab.
 * Wirft NICHT – bei Fehlern wird still zurückgekehrt (Log-Only).
 */
export async function generateAndSpeakDuo(
  cfg: DuoConfig,
  req: Omit<DuoRequest, "language" | "intensity" | "session_id">,
): Promise<void> {
  if (!cfg.enabled) return;
  if (isSpeaking) return; // Overlap vermeiden

  const url = normalizeBackendUrl(cfg.backendUrl);
  if (!url) {
    console.warn("Autodarts Tools Duo: kein Backend-URL konfiguriert");
    return;
  }

  const body: DuoRequest = {
    ...req,
    language: cfg.language,
    intensity: cfg.intensity,
    session_id: cachedSessionId ?? undefined,
  };

  isSpeaking = true;
  try {
    const response = await fetchViaBackground(`${url}/api/commentator/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.warn("Autodarts Tools Duo: Backend antwortete mit Fehler", response.status);
      return;
    }
    const data = response.data as DuoResponse;
    if (!data?.analyst || !data?.entertainer) return;
    cachedSessionId = data.session_id ?? cachedSessionId;

    // Sprachcode fürs Browser-TTS ableiten
    const langCode = cfg.language === "de" ? "de-DE" : "en-GB";
    const decryptedTtsKey = await safeDecrypt(cfg.ttsApiKey);

    const analystTts: TTSConfig = {
      provider: cfg.ttsProvider,
      apiKey: decryptedTtsKey,
      voice: cfg.analystVoice,
      language: langCode,
      speed: 1.0,
      pitch: 0.95,
    };
    const entertainerTts: TTSConfig = {
      provider: cfg.ttsProvider,
      apiKey: decryptedTtsKey,
      voice: cfg.entertainerVoice,
      language: langCode,
      speed: 1.1,
      pitch: 1.05,
    };

    // Analytiker zuerst, dann Entertainer – kurz auseinander damit sie hörbar unterscheidbar sind
    await speakText(data.analyst, analystTts);
    await new Promise(r => setTimeout(r, 400));
    await speakText(data.entertainer, entertainerTts);
  } catch (e) {
    console.warn("Autodarts Tools Duo: Fehler bei generateAndSpeakDuo", e);
  } finally {
    isSpeaking = false;
  }
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function normalizeBackendUrl(raw: string): string {
  const u = (raw || "").trim().replace(/\/+$/, "");
  if (!u) return "";
  if (!/^https?:\/\//.test(u)) return `https://${u}`;
  return u;
}

async function safeDecrypt(v: string): Promise<string> {
  if (!v) return "";
  try {
    if (v.length > 30) {
      const dec = await decryptApiKey(v);
      if (dec) return dec;
    }
  } catch { /* ignore */ }
  return v;
}

interface BgFetchResult { ok: boolean; status?: number; data?: any; error?: string }

async function fetchViaBackground(url: string, init: RequestInit): Promise<BgFetchResult> {
  // Content-Scripts könnten CORS-limitiert sein; Backend-Proxy sendet CORS:*,
  // aber wir routen trotzdem über das Background-Script für maximale Kompatibilität.
  try {
    const resp = await browser.runtime.sendMessage({
      type: "FETCH_JSON",
      payload: { url, method: init.method || "GET", headers: init.headers, body: init.body },
    });
    return resp as BgFetchResult;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
