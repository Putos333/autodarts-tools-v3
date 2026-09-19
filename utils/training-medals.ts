/**
 * training-medals.ts – reine Ableitung: welches Medaillen-Tier (Bronze/Silber/
 * Gold) hat eine abgeschlossene Trainings-Session automatisch erreicht?
 *
 * Seit v2.9.72 (PDC-Trainer-Modus) hatte jede Übung Bronze/Silber/Gold-Ziele
 * definiert, aber KEIN Code vergab die Medaille je automatisch — die einzige
 * bestehende Schreibstelle für `local:training-exercise-progress`
 * (`components/Settings/TrainingExercises.vue::resetProgress()`) LÖSCHT nur.
 * `CcTraining.vue` dokumentierte das offen: "Die automatische Vergabe nach
 * einem abgeschlossenen Match ist technisch noch nicht verdrahtet."
 *
 * Diese Datei ist bewusst seiteneffektfrei (kein @/-Import, kein Vue/WXT/
 * Browser) — wie utils/training-performance.ts, utils/checkout-path.ts und
 * utils/live-throw.ts. Das eigentliche Schreiben nach `browser.storage.local`
 * bleibt in entrypoints/match.content/training-mode.ts.
 *
 * Nur Tier-Ziele, die AUSSCHLIESSLICH aus bereits live getrackten,
 * quantifizierbaren Feldern bestehen (minAverage/min140Plus/min180s/
 * minCheckoutRate/maxMissRate), werden automatisch geprüft. `customCondition`
 * ("kein Auto-Check" laut training-exercises.ts) und `minCheckouts` (aktuell
 * nicht live getrackt) machen ein Tier NICHT automatisch verifizierbar — ein
 * solches Tier bleibt dann unbewertet statt geraten.
 */

import type { ExerciseGoal, Medal, TrainingExercise } from "./training-exercises";

export const MEDAL_RANK: Record<Medal, number> = { bronze: 0, silver: 1, gold: 2 };
const MEDAL_TIERS: Medal[] = [ "gold", "silver", "bronze" ];

export interface LiveTrainingStats {
  average: number;
  count140Plus: number;
  count180s: number;
  checkoutRate: number;
  checkoutMisses: number;
}

/** true, wenn dieses Tier vollständig aus bereits live getrackten Zahlenwerten besteht. */
export function isAutoCheckableGoal(goal: ExerciseGoal): boolean {
  if (goal.customCondition) return false;
  if (goal.minCheckouts !== undefined) return false; // aktuell nicht live getrackt
  return goal.minAverage !== undefined || goal.min140Plus !== undefined || goal.min180s !== undefined
    || goal.minCheckoutRate !== undefined || goal.maxMissRate !== undefined;
}

/** true, wenn die Live-Werte alle in diesem Tier gesetzten Zahlenziele erfüllen. */
export function goalMet(goal: ExerciseGoal, live: LiveTrainingStats): boolean {
  const checks: boolean[] = [];
  if (goal.minAverage !== undefined) checks.push(live.average >= goal.minAverage);
  if (goal.min140Plus !== undefined) checks.push(live.count140Plus >= goal.min140Plus);
  if (goal.min180s !== undefined) checks.push(live.count180s >= goal.min180s);
  if (goal.minCheckoutRate !== undefined) checks.push(live.checkoutRate >= goal.minCheckoutRate);
  // Dieselbe (bestehende) Zuordnung maxMissRate → Fehlversuche-Anzahl wie beim
  // Gold-Live-Tracking in training-mode.ts — kein neues Mapping.
  if (goal.maxMissRate !== undefined) checks.push(live.checkoutMisses <= goal.maxMissRate);
  return checks.length > 0 && checks.every(Boolean);
}

/** Höchstes Tier, das vollständig automatisch verifiziert werden kann und erreicht wurde — sonst `null`. */
export function determineAutoMedal(exercise: TrainingExercise, live: LiveTrainingStats): Medal | null {
  for (const tier of MEDAL_TIERS) {
    const goal = exercise.goals[tier];
    if (!goal || !isAutoCheckableGoal(goal)) continue;
    if (goalMet(goal, live)) return tier;
  }
  return null;
}

/** true, wenn `candidate` eine echte Verbesserung gegenüber `current` wäre (nie abwertend). */
export function isMedalImprovement(candidate: Medal | null, current: Medal | null): candidate is Medal {
  return candidate !== null && (current === null || MEDAL_RANK[candidate] > MEDAL_RANK[current]);
}
