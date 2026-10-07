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
  | "matchcenter"
  | "training"
  | "party"
  | "stats"
  | "history"
  | "settings";

/**
 * Navigationsgruppen (UI-2B): reine Präsentations-/Informationsarchitektur der Sidebar.
 * Kein Routing-Bestandteil — Hash, Section-IDs und Reihenfolge der Bereiche bleiben unverändert.
 */
export type TCcGroupId = "live" | "play" | "analysis" | "system";

export interface ICcSectionGroup {
  id: TCcGroupId;
  label: string;
}

export const CC_SECTION_GROUPS: ICcSectionGroup[] = [
  { id: "live", label: "Live" },
  { id: "play", label: "Spielen" },
  { id: "analysis", label: "Auswertung" },
  { id: "system", label: "System" },
];

export interface ICcSection {
  id: TCcSectionId;
  /** Navigationsgruppe der Desktop-Sidebar (UI-2B). */
  group: TCcGroupId;
  label: string;
  /** Kurzer Untertitel in der Top-Bar. */
  hint: string;
  /** Iconify-Klasse. */
  icon: string;
  /**
   * Kürzere Variante für die mobile Bottom-Navigation (#8), wo pro Item nur
   * ~45-55px Breite zur Verfügung stehen. Wird als sichtbarer UND
   * zugänglicher Name verwendet (kein separates `aria-label` — der
   * Accessible Name muss den sichtbaren Text enthalten, WCAG 2.5.3 "Label
   * in Name"; ein längeres `label` als `aria-label` hinter kürzerem
   * sichtbarem Text würde dagegen verstoßen). `title` bleibt `label` als
   * reiner Hover-Tooltip — überschreibt den Accessible Name nicht, solange
   * sichtbarer Textinhalt vorhanden ist. Ohne `shortLabel` wird `label`
   * verwendet.
   */
  shortLabel?: string;
  /** Für MVP 1 noch ohne eigene Inhalte. */
  preview?: boolean;
}

export const CC_SECTIONS: ICcSection[] = [
  {
    id: "dashboard",
    group: "live",
    label: "Dashboard",
    shortLabel: "Home",
    hint: "Board, Verbindung, aktuelles Match und Spieler auf einen Blick",
    icon: "icon-[pixelarticons--dashboard]",
  },
  {
    id: "board",
    group: "live",
    label: "Board & Autoscoring",
    shortLabel: "Board",
    hint: "Verbindungs- und Board-Diagnose (Kalibrierung/Erkennung bleiben bei Autodarts)",
    icon: "icon-[pixelarticons--bullseye]",
  },
  {
    id: "match",
    group: "live",
    label: "Match",
    hint: "Live-Scoreboard, Spielerwerte und Match-Historie",
    icon: "icon-[pixelarticons--gamepad]",
  },
  {
    id: "matchcenter",
    group: "live",
    label: "Match Center",
    shortLabel: "Center",
    hint: "3-Spalten-Match-Ansicht (Design Tokens + UI Shell, Phase 2C) — bereits als eigene Ansicht unter #matchcenter eingebunden",
    icon: "icon-[pixelarticons--layout-columns]",
    preview: true,
  },
  {
    id: "training",
    group: "play",
    label: "Training",
    hint: "Trainingsziele, Übungsbibliothek und Fortschritt",
    icon: "icon-[pixelarticons--trending-up]",
  },
  {
    id: "party",
    group: "play",
    label: "Freunde / Party",
    shortLabel: "Party",
    hint: "Lobby-Status und Freundesliste von Autodarts",
    icon: "icon-[pixelarticons--users]",
  },
  {
    id: "stats",
    group: "analysis",
    label: "Statistiken",
    shortLabel: "Stats",
    hint: "Kennzahlen und Trends aus deinen gespeicherten Match-Ergebnissen",
    icon: "icon-[pixelarticons--chart-bar]",
  },
  {
    id: "history",
    group: "analysis",
    label: "Verlauf",
    hint: "Gespeicherte Canonical Match Results durchsuchen und analysieren",
    icon: "icon-[pixelarticons--clock]",
  },
  {
    id: "settings",
    group: "system",
    label: "Einstellungen",
    shortLabel: "Optionen",
    hint: "Version, Diagnose, Datenschutz, Caller & Sounds, WLED / Beleuchtung",
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

/** Bereiche einer Gruppe in Registry-Reihenfolge (leere Gruppen entfallen im Aufrufer). */
export function getCcSectionsByGroup(group: TCcGroupId): ICcSection[] {
  return CC_SECTIONS.filter(section => section.group === group);
}

export function getCcSection(id: TCcSectionId): ICcSection {
  return CC_SECTIONS.find(section => section.id === id) ?? CC_SECTIONS[0];
}
