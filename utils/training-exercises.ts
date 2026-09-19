// v2.9.72 – PDC-Trainer-Modus: 20 kuratierte Übungen
// ═══════════════════════════════════════════════════════════════════════════
// Jede Übung hat definierte Ziel-Metriken, die vom training-mode.ts überwacht
// werden. Fortschritt (Bronze/Silber/Gold) wird in browser.storage.local
// persistiert und in der TrainingExercises.vue-UI angezeigt.

export type ExerciseCategory =
  | "accuracy"     // Genauigkeit / Trefferquote
  | "checkout"     // Finish-Training
  | "consistency"  // Konsistenz / Rhythmus
  | "pressure"     // Druck-Situationen
  | "warmup";      // Aufwärmen

export type Medal = "bronze" | "silver" | "gold";

export interface TrainingExercise {
  id: string;
  title: string;
  category: ExerciseCategory;
  description: string;
  /** Kurze Anleitung, was der Spieler tun soll */
  instructions: string[];
  /** Optional: Autodarts-Game-Variante, die zur Übung passt */
  suggestedVariant?: "X01" | "Cricket" | "Bull-off" | "Around the Clock" | "Segment Training";
  /** Ziele je nach Medaillenstufe. Runtime-Runner vergleicht Live-Stats. */
  goals: {
    bronze: ExerciseGoal;
    silver: ExerciseGoal;
    gold: ExerciseGoal;
  };
  /** Estimated duration in minutes */
  durationMin: number;
}

export interface ExerciseGoal {
  /** Mindest-Average der Runde */
  minAverage?: number;
  /** Mindest-Anzahl 140+ Würfe */
  min140Plus?: number;
  /** Mindest-Anzahl 180er */
  min180s?: number;
  /** Mindest-Anzahl Checkouts (Legs gewonnen) */
  minCheckouts?: number;
  /** Maximale erlaubte Bust-/Miss-Rate in % */
  maxMissRate?: number;
  /** Mindest-Checkout-Rate in % */
  minCheckoutRate?: number;
  /** Custom-Bedingung als menschenlesbarer Text (kein Auto-Check) */
  customCondition?: string;
}

/**
 * Kuratiert von PDC-Coaching-Guides. Balanced Mix aus Accuracy, Checkout,
 * Consistency, Pressure und Warm-Up-Übungen. Reihenfolge grob nach
 * Einstiegs-Level (leichter zuerst).
 */
export const TRAINING_EXERCISES: TrainingExercise[] = [
  // ─── WARMUP ─────────────────────────────────────────────────────
  {
    id: "wu-t20-hunt",
    title: "T20-Jagd (Warm-up)",
    category: "warmup",
    description: "Ziel Triple-20 – Grundlage jedes ordentlichen Averages.",
    instructions: [
      "Wirf ausschließlich auf Triple 20",
      "Ziel: 5 Minuten kontinuierliches Trainieren",
      "Zähle deine Treffer laut mit",
    ],
    suggestedVariant: "Segment Training",
    goals: {
      bronze: { customCondition: "3 Triples in einer 5-Minuten-Session" },
      silver: { customCondition: "6 Triples in einer 5-Minuten-Session" },
      gold: { customCondition: "9+ Triples in einer 5-Minuten-Session" },
    },
    durationMin: 5,
  },
  {
    id: "wu-around-clock",
    title: "Around the Clock",
    category: "warmup",
    description: "Durch alle Zahlen 1–20, dann Bullseye. Perfekt zum Aufwärmen.",
    instructions: [
      "Wirf reihum: erst 1er-Segment, dann 2er, dann 3er, … bis 20",
      "Zum Schluss: Single Bull → Double Bull",
      "Wenn du triffst, geht's zur nächsten Zahl",
    ],
    suggestedVariant: "Around the Clock",
    goals: {
      bronze: { customCondition: "Durchgang unter 15 Minuten" },
      silver: { customCondition: "Durchgang unter 10 Minuten" },
      gold: { customCondition: "Durchgang unter 6 Minuten" },
    },
    durationMin: 10,
  },
  {
    id: "wu-shanghai",
    title: "Shanghai (7 Runden)",
    category: "warmup",
    description: "Klassisches Aufwärm-Spiel. Wirf pro Runde auf eine Zahl (1-7).",
    instructions: [
      "Runde 1: wirf 3 Darts auf die 1",
      "Runde 2: wirf 3 Darts auf die 2, usw.",
      "Nach 7 Runden zählst du Single/Double/Triple",
      "Shanghai = Single + Double + Triple in einer Runde",
    ],
    suggestedVariant: "Segment Training",
    goals: {
      bronze: { customCondition: "Punktzahl ≥ 25" },
      silver: { customCondition: "Punktzahl ≥ 60" },
      gold: { customCondition: "1× echtes Shanghai (S+D+T)" },
    },
    durationMin: 8,
  },

  // ─── ACCURACY ───────────────────────────────────────────────────
  {
    id: "acc-doubles-drill",
    title: "Doubles-Drill",
    category: "accuracy",
    description: "10 Runden ausschließlich Doubles trainieren – Finish-Basis.",
    instructions: [
      "Wähle ein Double (z.B. D16, D20)",
      "Wirf 3 Darts pro Runde, 10 Runden lang",
      "Notiere jedes getroffene Double",
    ],
    suggestedVariant: "Segment Training",
    goals: {
      bronze: { customCondition: "3 Treffer in 30 Darts" },
      silver: { customCondition: "6 Treffer in 30 Darts" },
      gold: { customCondition: "10+ Treffer in 30 Darts" },
    },
    durationMin: 10,
  },
  {
    id: "acc-triples-drill",
    title: "Triples-Drill (T19/T20)",
    category: "accuracy",
    description: "Wechsel zwischen T20 und T19 – hoher Average braucht beides.",
    instructions: [
      "Wirf Dart 1 auf T20",
      "Wirf Dart 2 auf T19",
      "Wirf Dart 3 wieder auf T20",
      "10 Runden × 3 Darts = 30 Darts",
    ],
    suggestedVariant: "Segment Training",
    goals: {
      bronze: { customCondition: "3 Triples in 30 Darts" },
      silver: { customCondition: "7 Triples in 30 Darts" },
      gold: { customCondition: "12+ Triples in 30 Darts" },
    },
    durationMin: 10,
  },
  {
    id: "acc-bullseye-sniper",
    title: "Bullseye-Sniper",
    category: "accuracy",
    description: "20 Darts auf Bull – wie oft triffst du das Double Bull?",
    instructions: [
      "Wirf 20 Darts konzentriert auf Bull",
      "Ziel: Double Bull (rotes Zentrum)",
      "Zähle Single-Bulls (25) und Double-Bulls (50)",
    ],
    suggestedVariant: "Segment Training",
    goals: {
      bronze: { customCondition: "3 Bulls (jede Art) in 20 Darts" },
      silver: { customCondition: "3 Double-Bulls in 20 Darts" },
      gold: { customCondition: "5+ Double-Bulls in 20 Darts" },
    },
    durationMin: 6,
  },

  // ─── CHECKOUT ───────────────────────────────────────────────────
  {
    id: "co-double-out",
    title: "Doppel-Checkout-Training (Range 32-40)",
    category: "checkout",
    description: "Beliebte Finishes trainieren: 32, 36, 40 (D16, D18, D20).",
    instructions: [
      "Starte auf 32, 36 oder 40 (Zufall)",
      "Wirf bis zu 3 Darts, um zu finishen",
      "10 Runden, notiere Erfolge",
    ],
    goals: {
      bronze: { customCondition: "3 Finishes in 10 Versuchen" },
      silver: { customCondition: "6 Finishes in 10 Versuchen" },
      gold: { customCondition: "8+ Finishes in 10 Versuchen" },
    },
    durationMin: 15,
  },
  {
    id: "co-121-finish",
    title: "121er-Finish (T20-S11-D25)",
    category: "checkout",
    description: "PDC-Klassiker: T20, S11, Bull. Trainiere das Setup dahin.",
    instructions: [
      "Wirf Dart 1 auf T20",
      "Wirf Dart 2 auf S11",
      "Wirf Dart 3 auf Double Bull",
      "10 Runden × 3 Darts",
    ],
    goals: {
      bronze: { customCondition: "1× komplettes 121er Finish" },
      silver: { customCondition: "3× komplettes 121er Finish" },
      gold: { customCondition: "5× komplettes 121er Finish in 10 Runden" },
    },
    durationMin: 12,
  },
  {
    id: "co-170-master",
    title: "170er Big-Fish",
    category: "checkout",
    description: "Der Traum jedes Dart-Spielers: T20-T20-Bull. Maximum-Finish.",
    instructions: [
      "Start bei 170",
      "T20 (60) → 110",
      "T20 (60) → 50",
      "Double Bull → checkout",
      "20 Versuche insgesamt",
    ],
    goals: {
      bronze: { customCondition: "1× erfolgreiche 170 in 20 Versuchen" },
      silver: { customCondition: "3× 170er Finish in 20 Versuchen" },
      gold: { customCondition: "5+ 170er Finishes (Legenden-Level)" },
    },
    durationMin: 25,
  },
  {
    id: "co-checkout-100",
    title: "100er-Range Finish",
    category: "checkout",
    description: "Alle Finishes von 100 bis 110 – die häufigsten Match-Situationen.",
    instructions: [
      "Wirf ab 100, 105, 110 (Zufall)",
      "Nutze deine bevorzugte Route (T20-D20 für 100, T20-S13-D16 für 105 etc.)",
      "10 Runden × 3 Darts",
    ],
    goals: {
      bronze: { customCondition: "3 Finishes in 10 Versuchen" },
      silver: { customCondition: "6 Finishes in 10 Versuchen" },
      gold: { customCondition: "8+ Finishes in 10 Versuchen" },
    },
    durationMin: 12,
  },
  {
    id: "co-bogey-rescue",
    title: "Bogey-Number Rescue",
    category: "checkout",
    description: "Trainiere die Rettung aus Bogey-Situationen (169, 168, 166, 165, 163, 162, 159).",
    instructions: [
      "Diese Restpunktzahlen brauchen 2 Dart-Kombos",
      "Beispiel 169 → T20 + T20 + S9 dann D25 (Bogey!)",
      "Denk-Übung: wie kommst du sicher zu einer Finish-Zahl?",
    ],
    goals: {
      bronze: { customCondition: "3 Bogey-Rescues in 10 Versuchen" },
      silver: { customCondition: "6 Bogey-Rescues in 10 Versuchen" },
      gold: { customCondition: "8+ Bogey-Rescues perfekt gemeistert" },
    },
    durationMin: 20,
  },

  // ─── CONSISTENCY ────────────────────────────────────────────────
  {
    id: "cons-perfect-9",
    title: "Perfect-9 Challenge",
    category: "consistency",
    description: "Best-Case: 501 in 9 Darts. Trainiere die perfekte Route.",
    instructions: [
      "Standard: T20-T20-T20 → T20-T20-T20 → T20-T19-D12 (oder T19-Bull-D25)",
      "Wirf 3 komplette 9-Dart-Attempts (27 Darts)",
      "Zähle wie viele Runden du perfekt gemacht hast",
    ],
    suggestedVariant: "X01",
    goals: {
      bronze: { customCondition: "Höchster Score einer Runde ≥ 150" },
      silver: { customCondition: "Alle 3 Runden ≥ 180" },
      gold: { customCondition: "1× echter Perfect-9-Leg" },
    },
    durationMin: 20,
  },
  {
    id: "cons-100-club",
    title: "100er-Club-Session",
    category: "consistency",
    description: "3 komplette 501-Legs mit Ziel: Average > 100.",
    instructions: [
      "Spiele 3 Legs 501",
      "Behalte deinen Live-Average im Blick",
      "Nach 3 Legs: prüfe den Gesamt-Average",
    ],
    suggestedVariant: "X01",
    goals: {
      bronze: { minAverage: 60 },
      silver: { minAverage: 80 },
      gold: { minAverage: 100 },
    },
    durationMin: 20,
  },
  {
    id: "cons-140-hunt",
    title: "140er-Jagd",
    category: "consistency",
    description: "10 komplette 501-Legs: wie viele 140+-Würfe schaffst du?",
    instructions: [
      "Spiele 10 komplette 501-Legs (oder pausiere und mach mehrere Sessions)",
      "Zähle nur die Runden mit ≥ 140 Score",
      "Ziel: mindestens ein 140+ pro Leg",
    ],
    suggestedVariant: "X01",
    goals: {
      bronze: { min140Plus: 10 },
      silver: { min140Plus: 20 },
      gold: { min140Plus: 35 },
    },
    durationMin: 45,
  },
  {
    id: "cons-180-hunt",
    title: "180er-Jagd",
    category: "consistency",
    description: "Wie viele 180er schaffst du in 20 Legs? PDC-Pro-Level.",
    instructions: [
      "Spiele 20 komplette 501-Legs (mehrere Sessions okay)",
      "Zähle nur die 180er",
      "Ziel: Maximum-Serien",
    ],
    suggestedVariant: "X01",
    goals: {
      bronze: { min180s: 2 },
      silver: { min180s: 5 },
      gold: { min180s: 10 },
    },
    durationMin: 90,
  },

  // ─── PRESSURE ───────────────────────────────────────────────────
  {
    id: "pre-clutch-double",
    title: "Clutch-Double (Sudden Death)",
    category: "pressure",
    description: "Ein Dart zum Finish. Kein zweiter Versuch. Simuliert Match-Dart-Druck.",
    instructions: [
      "Setze dir mental: 'Ein Dart zum Sieg'",
      "Wähle eine feste Double-Zahl (z.B. D16)",
      "Wirf 15 Darts – jedes zählt einzeln",
      "Zähle Treffer",
    ],
    suggestedVariant: "Segment Training",
    goals: {
      bronze: { customCondition: "4 Treffer in 15 Darts (26 %)" },
      silver: { customCondition: "7 Treffer in 15 Darts (46 %)" },
      gold: { customCondition: "10+ Treffer in 15 Darts (66 %+, PDC-Level)" },
    },
    durationMin: 8,
  },
  {
    id: "pre-match-simulation",
    title: "Match-Simulation (Best of 5 vs Bot)",
    category: "pressure",
    description: "Echtes Match gegen den Autodarts-Bot – Druck-Situation trainieren.",
    instructions: [
      "Erstelle privates Match: Best of 5 Legs 501",
      "Bot-Level: Average 70 (Anfänger-PDC-Bot)",
      "Ziel: Gewinnen mit Average > deiner Baseline",
    ],
    suggestedVariant: "X01",
    goals: {
      bronze: { customCondition: "Match gewonnen" },
      silver: { customCondition: "Match gewonnen mit Average > 65" },
      gold: { customCondition: "Match gewonnen mit Average > 80 + 1 High Finish (≥ 100)" },
    },
    durationMin: 15,
  },
  {
    id: "pre-double-trouble",
    title: "Double-Trouble (Round-the-Board)",
    category: "pressure",
    description: "Nacheinander alle Doubles treffen (D1, D2, ..., D20). Zeit läuft.",
    instructions: [
      "Start bei D1, dann D2, D3, ..., bis D20",
      "Jeder Wurf zählt, egal welcher Dart",
      "Wenn du triffst, geht's zum nächsten Double",
      "Zeit-Ziel: siehe unten",
    ],
    suggestedVariant: "Segment Training",
    goals: {
      bronze: { customCondition: "Alle 20 Doubles in < 30 Minuten" },
      silver: { customCondition: "Alle 20 Doubles in < 15 Minuten" },
      gold: { customCondition: "Alle 20 Doubles in < 8 Minuten" },
    },
    durationMin: 20,
  },
  {
    id: "pre-nothing-but-t20",
    title: "Nur T20 (Rhythm-Trainer)",
    category: "pressure",
    description: "60 Darts nur auf T20 – keine Alternative. Reine Rhythmus-Übung.",
    instructions: [
      "Nur T20, kein Alternativ-Ziel",
      "60 Darts (20 Runden × 3 Darts)",
      "Zähle Triples, Singles, Missen",
    ],
    suggestedVariant: "Segment Training",
    goals: {
      bronze: { customCondition: "15 Triples in 60 Darts (25 %)" },
      silver: { customCondition: "25 Triples in 60 Darts (42 %)" },
      gold: { customCondition: "35+ Triples in 60 Darts (58 %+, PDC-Pro)" },
    },
    durationMin: 15,
  },
];

export const EXERCISE_CATEGORIES: Record<ExerciseCategory, { label: string; icon: string; color: string }> = {
  warmup: { label: "Aufwärmen", icon: "🔥", color: "#F59E0B" },
  accuracy: { label: "Genauigkeit", icon: "🎯", color: "#3B82F6" },
  checkout: { label: "Checkout", icon: "🏁", color: "#10B981" },
  consistency: { label: "Konsistenz", icon: "📊", color: "#8B5CF6" },
  pressure: { label: "Druck-Situationen", icon: "⚡", color: "#EF4444" },
};

export function getExerciseById(id: string): TrainingExercise | undefined {
  return TRAINING_EXERCISES.find((e) => e.id === id);
}

export function getExercisesByCategory(cat: ExerciseCategory): TrainingExercise[] {
  return TRAINING_EXERCISES.filter((e) => e.category === cat);
}

// Achievement-Storage (Bronze/Silber/Gold pro Übung)
export interface ExerciseProgress {
  medal: Medal | null;
  attempts: number;
  bestScore: number | null;
  lastAttempt: string | null; // ISO date
}

export type ProgressMap = Record<string, ExerciseProgress>;

export const PROGRESS_STORAGE_KEY = "local:training-exercise-progress";
