/**
 * Section-Registry des Control Centers.
 *
 * Eine Liste, aus der sich Sidebar, Top-Bar-Titel und Hash-Routing speisen.
 * Die Icon-Namen sind Iconify-Klassen aus `@iconify-json/pixelarticons`
 * (bereits als Dependency vorhanden, per `addDynamicIconSelectors()` in
 * `tailwind.config.ts` aktiviert).
 */

export type TCcSectionId =
  | "dashboard"
  | "board"
  | "match"
  | "training"
  | "party"
  | "sound"
  | "lighting"
  | "stats"
  | "history"
  | "settings";

export interface ICcSection {
  id: TCcSectionId;
  label: string;
  /** Kurzer Untertitel in der Top-Bar. */
  hint: string;
  /** Iconify-Klasse. */
  icon: string;
  /** Für MVP 1 noch ohne eigene Inhalte. */
  preview?: boolean;
}

export const CC_SECTIONS: ICcSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    hint: "Board, Verbindung, aktuelles Match und Spieler auf einen Blick",
    icon: "icon-[pixelarticons--dashboard]",
  },
  {
    id: "board",
    label: "Board & Autoscoring",
    hint: "Verbindungs- und Board-Diagnose (Kalibrierung/Erkennung bleiben bei Autodarts)",
    icon: "icon-[pixelarticons--bullseye]",
  },
  {
    id: "match",
    label: "Match",
    hint: "Live-Scoreboard, Spielerwerte und Match-Historie",
    icon: "icon-[pixelarticons--gamepad]",
  },
  {
    id: "training",
    label: "Training",
    hint: "Trainingsziele, Übungsbibliothek und Fortschritt",
    icon: "icon-[pixelarticons--trending-up]",
  },
  {
    id: "party",
    label: "Freunde / Party",
    hint: "Lobby-Status und Freundesliste von Autodarts",
    icon: "icon-[pixelarticons--users]",
  },
  {
    id: "sound",
    label: "Caller & Sounds",
    hint: "Status und Schnellumschalter für Caller, Sound-FX und Crowd",
    icon: "icon-[pixelarticons--volume-3]",
  },
  {
    id: "lighting",
    label: "WLED / Beleuchtung",
    hint: "Status und Schnellumschalter für konfigurierte WLED-Effekte",
    icon: "icon-[pixelarticons--lightbulb]",
  },
  {
    id: "stats",
    label: "Statistiken",
    hint: "Kennzahlen und Trends aus deinen gespeicherten Match-Ergebnissen",
    icon: "icon-[pixelarticons--chart-bar]",
  },
  {
    id: "history",
    label: "Verlauf",
    hint: "Gespeicherte Canonical Match Results durchsuchen und analysieren",
    icon: "icon-[pixelarticons--clock]",
  },
  {
    id: "settings",
    label: "Einstellungen",
    hint: "Version, Diagnose und Datenschutz — Details in den klassischen Einstellungen",
    icon: "icon-[pixelarticons--sliders]",
  },
];

export const CC_DEFAULT_SECTION: TCcSectionId = "dashboard";

/**
 * Transiente Übergabe eines gewünschten Spielmodus-Filters von Verlauf →
 * Statistiken. Bewusst `sessionStorage` statt persistenter Datenkopie: der
 * Wert wird von der Statistics-Ansicht sofort nach Anwendung wieder gelöscht
 * und überlebt keinen Browser-Neustart. Kein Eingriff in das Hash-Routing
 * (`ControlCenter.vue::readHash`/`isCcSectionId`), damit Deep-Links wie
 * `#stats` unverändert funktionieren.
 */
export const CC_STATS_PENDING_GAME_MODE_KEY = "cc-stats-pending-game-mode";

export function isCcSectionId(value: unknown): value is TCcSectionId {
  return typeof value === "string" && CC_SECTIONS.some(section => section.id === value);
}

export function getCcSection(id: TCcSectionId): ICcSection {
  return CC_SECTIONS.find(section => section.id === id) ?? CC_SECTIONS[0];
}
