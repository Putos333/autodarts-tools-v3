/**
 * Trainings-Verlauf – reine Datenstruktur + Helfer, ohne Vue/WXT/Browser-Abhängigkeit.
 * Bewusst getrennt von utils/storage.ts (das WXT-Auto-Imports wie `storage.defineItem`
 * nutzt und daher nicht unter dem reinen Node-Testrunner importierbar ist), damit
 * diese Logik wie utils/event-dedupe.ts und utils/match-history-view.ts unit-testbar bleibt.
 */

export interface TrainingSession {
  date: string;
  average: number;
  count140Plus: number;
  count180s: number;
  checkoutMisses: number;
  checkoutRate: number;
  goalsReached: number;
  totalGoals: number;
  /**
   * ID/Titel der aktiven Übung (aus training-exercises.ts), falls beim Speichern
   * eine gesetzt war. Optional und rückwärtskompatibel: ältere Sessions (vor
   * dieser Erweiterung) und freies Training ohne gewählte Übung haben dieses
   * Feld nicht — das ist "unbekannt", nicht 0/erfunden.
   */
  exerciseId?: string;
  exerciseTitle?: string;
}

/**
 * Merge legacy (page-localStorage) training sessions into the current history, deduped by `date`
 * (unique per session via `new Date().toISOString()` at save time), newest first, capped at maxEntries.
 * Pure — safe to unit test.
 */
export function mergeTrainingHistories(
  current: TrainingSession[],
  legacy: TrainingSession[],
  maxEntries = 50,
): TrainingSession[] {
  const byDate = new Map<string, TrainingSession>();
  for (const session of [ ...legacy, ...current ]) {
    if (session && typeof session.date === "string") {
      byDate.set(session.date, session);
    }
  }
  return [ ...byDate.values() ]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, maxEntries);
}
