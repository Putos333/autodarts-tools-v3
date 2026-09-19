/**
 * crowd-samples.ts — v2.9.83
 *
 * Bundled real crowd-sound assets (CC0 / Public Domain from
 * archive.org/details/Red_Library_Crowds_Applause and
 * archive.org/details/CrowdTalkingLoudlyD.D.TeoliJr.).
 *
 * Replaces the earlier "white-noise + bandpass" synthetic fallback which
 * users rightly complained sounded like static.
 *
 * The extension ships these MP3s under public/sounds/crowd/ and exposes
 * them via web_accessible_resources so both the content-script world
 * and the background world can load them via browser.runtime.getURL().
 */

import type { CrowdEventKey } from "./crowd-events";

/** Filename in /public/sounds/crowd for each crowd event. */
const SAMPLE_FILES: Record<CrowdEventKey, string> = {
  crowd_180: "crowd_180.mp3",
  crowd_170: "crowd_170.mp3",
  crowd_140plus: "crowd_140plus.mp3",
  crowd_100plus: "crowd_100plus.mp3",
  crowd_matchshot: "crowd_matchshot.mp3",
  crowd_gameshot: "crowd_gameshot.mp3",
  crowd_comeback: "crowd_comeback.mp3",
  crowd_bust: "crowd_bust.mp3",
  crowd_bust_double_miss: "crowd_bust_double_miss.mp3",
  crowd_low_score: "crowd_low_score.mp3",
  crowd_gameon: "crowd_gameon.mp3",
  crowd_ambient: "crowd_ambient.mp3",
  // These two are "atmosphere" events that intentionally stay
  // procedural (hushed silence / murmur) — no bundled sample.
  crowd_checkout_pressure: "",
  crowd_nine_darter_potential: "",
  crowd_close_game: "",
};

/**
 * Returns the extension-URL for a bundled crowd sample, or null if
 * the event has no bundled sample (e.g. "hush" / "tension" events).
 */
export function getBundledCrowdSampleUrl(event: CrowdEventKey): string | null {
  const file = SAMPLE_FILES[event];
  if (!file) return null;
  try {
    // browser.runtime.getURL is available in every extension context.
    // Cast to PublicPath compatible string
    return browser.runtime.getURL(`/sounds/crowd/${file}` as any);
  } catch {
    return null;
  }
}

/** True if this event has a bundled sample shipped with the extension. */
export function hasBundledCrowdSample(event: CrowdEventKey): boolean {
  return !!SAMPLE_FILES[event];
}
