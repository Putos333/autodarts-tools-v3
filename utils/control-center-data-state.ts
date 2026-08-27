/**
 * Gemeinsames State-Modell für Control-Center-Ansichten (Issue #13, #7).
 *
 * History, Stats, Dashboard-Zusammenfassung und Training zeigten bisher
 * denselben leeren Zustand für "lädt noch", "Ladevorgang fehlgeschlagen" und
 * "wirklich keine Daten vorhanden" — nicht unterscheidbar für den Nutzer.
 * Dieses Modul liefert die gemeinsame, eindeutige Klassifikation; jede
 * Komponente behält ihre eigene Darstellung (Icon/Text) für jeden Zustand.
 */

export type TCcDataState = "loading" | "unavailable" | "no_data" | "identity_unknown";

export interface ICcDataStateInput {
  /** Der erste Ladevorgang läuft noch (nicht: ein Hintergrund-Refresh per Watcher). */
  loading: boolean;
  /** Der letzte Ladeversuch ist fehlgeschlagen. */
  error: boolean;
  /** Es liegen Rohdaten vor — unabhängig davon, ob `myUserId` bekannt ist. */
  hasData: boolean;
  /** Diese Ansicht braucht `myUserId`, um ihre Daten sinnvoll zuzuordnen. */
  identityRequired?: boolean;
  /** `myUserId` ist aufgelöst. */
  identityKnown?: boolean;
}

/**
 * `null` bedeutet: normal rendern, kein Sonderzustand nötig.
 *
 * Ein fehlgeschlagener Hintergrund-Refresh versteckt nie bereits geladene,
 * gute Daten (`hasData` gewinnt gegen `error`) — dieselbe Regel wie bei der
 * Verbindungs-Liveness in useControlCenterStatus.ts ("ein altes Signal wird
 * nie als 'getrennt' dargestellt").
 */
export function deriveCcDataState(input: ICcDataStateInput): TCcDataState | null {
  if (input.loading) return "loading";
  if (!input.hasData && input.error) return "unavailable";
  if (!input.hasData) return "no_data";
  if (input.identityRequired && !input.identityKnown) return "identity_unknown";
  return null;
}
