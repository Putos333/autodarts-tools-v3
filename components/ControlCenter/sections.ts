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
    hint: "Board-Verbindung, Autoscoring-Zustand und externe Boards",
    icon: "icon-[pixelarticons--bullseye]",
    preview: true,
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
    hint: "Caller, Sound-FX, Crowd, Walk-On und Soundboard",
    icon: "icon-[pixelarticons--volume-3]",
    preview: true,
  },
  {
    id: "lighting",
    label: "WLED / Beleuchtung",
    hint: "Lichteffekte passend zu Würfen und Match-Ereignissen",
    icon: "icon-[pixelarticons--lightbulb]",
    preview: true,
  },
  {
    id: "stats",
    label: "Statistiken / Match History",
    hint: "Gespeicherte Match-Ergebnisse, Präzision und Liga",
    icon: "icon-[pixelarticons--chart-bar]",
    preview: true,
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
    hint: "Sprache, Backup, Import/Export und erweiterte Optionen",
    icon: "icon-[pixelarticons--sliders]",
    preview: true,
  },
];

export const CC_DEFAULT_SECTION: TCcSectionId = "dashboard";

export function isCcSectionId(value: unknown): value is TCcSectionId {
  return typeof value === "string" && CC_SECTIONS.some(section => section.id === value);
}

export function getCcSection(id: TCcSectionId): ICcSection {
  return CC_SECTIONS.find(section => section.id === id) ?? CC_SECTIONS[0];
}
