<template>
  <div class="cc-grid" data-testid="cc-training">
    <!-- (A) TRAINING HERO -->
    <div class="cc-col-12">
      <CcCard title="TRAINING" subtitle="Gezielt trainieren. Fortschritt messen. Konstanter werden." icon="icon-[pixelarticons--trending-up]" accent="gold">
        <template #status>
          <div class="cc-btn-row" style="gap: 8px;">
            <CcStatusPill
              :label="livenessLabel"
              :tone="livenessTone"
              :meta="livenessMeta"
              class="is-sm"
            />
            <CcStatusPill
              v-if="hasBoardSignal"
              :label="boardStatusLabel"
              :tone="boardTone"
              class="is-sm"
            />
          </div>
        </template>

        <div class="cc-card-body" style="display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: center;">
          <div>
            <p class="cc-note" style="font-size: 13px; margin-bottom: 8px;">
              Das Training läuft <b>in deinem Match auf play.autodarts.io</b>. Die Überwachung
              startet, sobald du eine Übung unten startest und ein Match beginnst. Live-Fortschritt,
              Ziele und Zusammenfassung werden dir direkt im Match-Overlay angezeigt.
            </p>
            <div class="cc-btn-row">
              <button @click="() => openAutodarts()" class="cc-btn is-primary" type="button" data-testid="cc-training-open-autodarts">
                <span class="icon-[pixelarticons--external-link]" />
                <span>Autodarts öffnen</span>
              </button>
              <button @click="() => openClassicSettings()" class="cc-btn" type="button" data-testid="cc-training-open-classic">
                <span class="icon-[pixelarticons--sliders]" />
                <span>Einstellungen</span>
              </button>
            </div>
          </div>

          <div class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
            <CcStatTile label="Verbindung" :value="connectionLabel" />
            <CcStatTile label="Letztes Signal" :value="lastSignalAgo" />
            <CcStatTile v-if="hasBoardSignal" label="Board" :value="boardStatusLabel" accent="accent" />
          </div>
        </div>
      </CcCard>
    </div>

    <!-- (B) SCHNELLSTART -->
    <div class="cc-col-12">
      <CcCard title="Schnellstart" subtitle="Deine Top-Übungen — Fortschritt sichtbar, sofort loslegen" icon="icon-[pixelarticons--play]" accent="muted">
        <template #status>
          <CcStatusPill label="20 Übungen" tone="gold" class="is-sm" />
        </template>

        <div class="cc-grid" style="grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 18px;">
          <CcExerciseCard
            v-for="ex in topExercises"
            :key="ex.id"
            :exercise="ex"
            :medal="progress[ex.id]?.medal ?? null"
            :large="true"
            class="cc-col-3"
          />
        </div>

        <p v-if="topExercises.length === 0" class="cc-note" style="margin-top: 8px;">
          Noch keine Medaillen errungen. Starte eine Übung unten in den Kategorien!
        </p>
      </CcCard>
    </div>

    <!-- (C) TRAININGSKATEGORIEN -->
    <template v-for="category in orderedCategories" :key="category">
      <div class="cc-col-12">
        <CcCard
          :title="EXERCISE_CATEGORIES[category].label"
          :subtitle="exercisesByCategory[category].length + ' Übungen'"
          :icon="categoryIcon(category)"
          accent="muted"
          class="cc-col-12"
        >
          <template #status>
            <CcStatusPill
              :label="exercisesByCategory[category].length + ' Übungen'"
              tone="gold"
              class="is-sm"
            />
          </template>

          <div class="cc-grid" style="grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 18px;">
            <CcExerciseCard
              v-for="ex in exercisesByCategory[category]"
              :key="ex.id"
              :exercise="ex"
              :medal="progress[ex.id]?.medal ?? null"
              class="cc-col-3"
            />
          </div>
        </CcCard>
      </div>
    </template>

    <!-- (D) LETZTES TRAINING / FORTSCHRITT -->
    <div class="cc-col-7">
      <CcCard title="Letztes Training" subtitle="Verlauf gespeicherter Sessions (Training-Modus)" icon="icon-[pixelarticons--clock]" accent="muted">
        <div v-if="trainingHistory.length > 0">
          <div class="cc-list" style="max-height: 320px; overflow-y: auto;">
            <div
              v-for="session in trainingHistory"
              :key="session.date"
              class="cc-result"
              :class="{ 'is-current': session === trainingHistory[0] }"
            >
              <div class="cc-result-date">{{ formatDate(session.date) }}</div>
              <div class="cc-result-names">
                <span>{{ session.goalsReached }} / {{ session.totalGoals }} Ziele erreicht</span>
                <div class="cc-result-sub">
                  Ø {{ session.average.toFixed(1) }} · {{ session.count140Plus }}× 140+ · {{ session.count180s }}× 180
                  · Checkout {{ session.checkoutRate.toFixed(0) }}% · {{ session.checkoutMisses }} Fehlversuche
                </div>
              </div>
              <div class="cc-result-score" :class="session.goalsReached === session.totalGoals ? 'is-gold' : ''">
                {{ session.goalsReached }}/{{ session.totalGoals }}
              </div>
            </div>
          </div>
        </div>

        <CcEmptyState
          v-else
          icon="icon-[pixelarticons--clock]"
          title="Noch keine gespeicherten Trainingsdaten"
          text="Sobald du eine Übung startest und ein Match mit aktiviertem Training-Modus spielst, erscheinen hier deine Sessions."
        >
          <template #action>
            <button @click="() => openAutodarts()" class="cc-btn is-primary" type="button">
              <span class="icon-[pixelarticons--external-link]" />
              <span>Autodarts öffnen</span>
            </button>
          </template>
        </CcEmptyState>
      </CcCard>
    </div>

    <!-- (E) PERSÖNLICHE ZIELE -->
    <div class="cc-col-5">
      <CcCard title="Persönliche Ziele" subtitle="Folgt in einer späteren Phase" icon="icon-[pixelarticons--target]" accent="gold">
        <CcEmptyState
          icon="icon-[pixelarticons--trophy]"
          title="Persönliche Ziele – folgt in einer späteren Phase"
          text="Hier kannst du später eigene Zielwerte setzen (Average, 140+, 180er, Checkout-Quote) und sie über mehrere Trainings-Sessions hinweg verfolgen."
        />
      </CcCard>
    </div>

    <!-- Medaillen-Übersicht -->
    <div class="cc-col-12">
      <CcCard title="Deine Medaillen" subtitle="Bronze / Silber / Gold pro Übung" icon="icon-[pixelarticons--trophy]" accent="muted">
        <div class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
          <CcStatTile label="🥇 Gold" :value="medalCounts.gold" accent="gold" />
          <CcStatTile label="🥈 Silber" :value="medalCounts.silver" accent="accent" />
          <CcStatTile label="🥉 Bronze" :value="medalCounts.bronze" accent="plain" />
          <CcStatTile label="Abgeschlossen" :value="totalCompleted" accent="gold" />
        </div>

        <p class="cc-note" style="margin-top: 8px;">
          Medaillen werden automatisch vergeben, wenn du die Ziele einer Übung im Match erreichst
          (Bronze/Silber/Gold = aufsteigende Stufen). Der Fortschritt ist pro Übung gespeichert.
        </p>
      </CcCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

import CcCard from "../CcCard.vue";
import CcStatTile from "../CcStatTile.vue";
import CcEmptyState from "../CcEmptyState.vue";
import CcStatusPill from "../CcStatusPill.vue";
import CcExerciseCard from "../CcExerciseCard.vue";
import { openAutodarts, openClassicSettings } from "../open-autodarts";
import {
  TRAINING_EXERCISES,
  EXERCISE_CATEGORIES,
  PROGRESS_STORAGE_KEY,
  type ExerciseCategory,
  type Medal,
  type ProgressMap,
} from "@/utils/training-exercises";
import { getTrainingHistory } from "@/entrypoints/match.content/training-mode";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

/* ─── Training History ──────────────────────────────────────────────────────── */
const trainingHistory = ref<Awaited<ReturnType<typeof getTrainingHistory>>>([]);

async function loadHistory(): Promise<void> {
  trainingHistory.value = await getTrainingHistory();
}

/* ─── Exercise Progress (Medaillen) ─────────────────────────────────────────── */
const progress = ref<ProgressMap>({});

async function loadProgress(): Promise<void> {
  try {
    const key = PROGRESS_STORAGE_KEY.replace("local:", "");
    const r = await browser.storage.local.get(key);
    progress.value = (r[key] ?? {}) as ProgressMap;
  } catch (e) {
    console.error("[CcTraining] loadProgress failed", e);
  }
}

/* ─── Live Status ───────────────────────────────────────────────────────────── */
const {
  liveness,
  hasBoardSignal,
  boardStatusLabel,
  boardTone,
  connectionLabel,
  connectionHint,
  lastSignalAgo,
} = useControlCenterStatus();

const livenessLabel = computed(() => {
  switch (liveness.value) {
    case "live": return "Live";
    case "stale": return "Veraltet";
    default: return "Unbekannt";
  }
});

const livenessTone = computed(() => {
  switch (liveness.value) {
    case "live": return "ok";
    case "stale": return "warn";
    default: return "idle";
  }
});

const livenessMeta = computed(() => {
  switch (liveness.value) {
    case "live": return "Daten aktuell";
    case "stale": return "Kein Autodarts-Tab offen";
    default: return "Noch nie Signal empfangen";
  }
});

/* ─── Exercise Categories & Sorting ─────────────────────────────────────────── */
const orderedCategories: ExerciseCategory[] = [
  "warmup",
  "accuracy",
  "checkout",
  "consistency",
  "pressure",
];

const exercisesByCategory = computed(() => {
  const result: Record<ExerciseCategory, typeof TRAINING_EXERCISES> = {
    warmup: [],
    accuracy: [],
    checkout: [],
    consistency: [],
    pressure: [],
  };
  for (const ex of TRAINING_EXERCISES) {
    result[ex.category].push(ex);
  }
  return result;
});

/* Top-4 Übungen für Schnellstart: nach Medaillen sortiert (Gold > Silber > Bronze),
   dann nach Versuchen (weniger = besser für Anzeige). */
const topExercises = computed(() => {
  const scored = TRAINING_EXERCISES.map((ex) => {
    const p = progress.value[ex.id];
    let medalRank = 0; // 3=gold, 2=silver, 1=bronze, 0=keine
    if (p?.medal === "gold") medalRank = 3;
    else if (p?.medal === "silver") medalRank = 2;
    else if (p?.medal === "bronze") medalRank = 1;
    return { ex, medalRank, attempts: p?.attempts ?? 0 };
  });
  scored.sort((a, b) => b.medalRank - a.medalRank || a.attempts - b.attempts);
  return scored.slice(0, 4).map((s) => s.ex);
});

/* ─── Medaillen-Zähler ──────────────────────────────────────────────────────── */
const totalCompleted = computed(
  () => Object.values(progress.value).filter((p) => p.medal !== null).length,
);

const medalCounts = computed(() => {
  const counts = { gold: 0, silver: 0, bronze: 0 };
  Object.values(progress.value).forEach((p) => {
    if (p.medal === "gold") counts.gold++;
    else if (p.medal === "silver") counts.silver++;
    else if (p.medal === "bronze") counts.bronze++;
  });
  return counts;
});

function categoryIcon(category: ExerciseCategory): string {
  const iconMap: Record<ExerciseCategory, string> = {
    warmup: "icon-[pixelarticons--fire]",
    accuracy: "icon-[pixelarticons--target]",
    checkout: "icon-[pixelarticons--flag]",
    consistency: "icon-[pixelarticons--chart]",
    pressure: "icon-[pixelarticons--zap]",
  };
  return iconMap[category];
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ─── Init ───────────────────────────────────────────────────────────────────── */
onMounted(async () => {
  await Promise.all([loadHistory(), loadProgress()]);
});
</script>