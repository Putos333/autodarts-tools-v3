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

        <CcTrainingActiveReflection />
      </CcCard>
    </div>

    <!-- (B) SCHNELLSTART -->
    <div class="cc-col-12">
      <CcCard title="Schnellstart" subtitle="Deine Top-Übungen — Fortschritt sichtbar, sofort loslegen" icon="icon-[pixelarticons--play]" accent="muted">
        <template #status>
          <span
            v-if="lastSession?.exerciseId"
            class="cc-panel-cta"
            data-testid="cc-training-repeat-last"
            @click="repeatLastExercise"
          ><span class="icon-[pixelarticons--reload]" /> Letzte Übung wiederholen</span>
          <CcStatusPill label="20 Übungen" tone="gold" class="is-sm" />
        </template>

        <p v-if="progressState === 'loading'" class="cc-note" style="margin-top: 8px;">Lädt …</p>
        <p v-else-if="progressState === 'unavailable'" class="cc-note" style="margin-top: 8px; color: var(--cc-warn);">
          Fortschritt nicht verfügbar.
          <a href="#" @click.prevent="() => loadProgress()" style="color: var(--cc-gold); text-decoration: underline;">Erneut versuchen</a>
        </p>
        <template v-else>
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
        </template>
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

    <!-- (D1) PERFORMANCE -->
    <div class="cc-col-12">
      <CcCard title="Trainings-Performance" subtitle="Aggregiert über alle gespeicherten Sessions" icon="icon-[pixelarticons--trending-up]" accent="muted">
        <CcEmptyState v-if="historyState === 'loading'" icon="icon-[pixelarticons--loader]" title="Lädt …" text="Trainings-Sessions werden geladen." />
        <div v-else-if="performance.sessionCount > 0" class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">
          <CcStatTile label="Sessions" :value="performance.sessionCount" />
          <CcStatTile label="Ø Average" :value="performance.meanAverage" :decimals="1" />
          <CcStatTile label="Ø Checkout-Quote" :value="performance.meanCheckoutRate" :decimals="0" unit="%" />
          <CcStatTile label="Bester Average" :value="personalBests.bestAverage?.value ?? null" :decimals="1" accent="gold" />
          <CcStatTile label="Meiste 180er / Session" :value="personalBests.best180sInSession?.value ?? null" accent="gold" />
          <CcStatTile label="Beste Checkout-Quote" :value="personalBests.bestCheckoutRate?.value ?? null" :decimals="0" unit="%" accent="gold" />
        </div>
        <CcEmptyState
          v-else
          icon="icon-[pixelarticons--trending-up]"
          title="Noch keine Trainingsdaten für eine Auswertung"
          text="Sobald deine erste Session gespeichert ist, erscheinen hier Durchschnittswerte und persönliche Bestleistungen."
        />
      </CcCard>
    </div>

    <!-- (D2) FORTSCHRITT & EMPFEHLUNG -->
    <div class="cc-col-8">
      <CcCard title="Fortschritt" subtitle="Average der letzten Sessions, chronologisch" icon="icon-[pixelarticons--chart]" accent="muted">
        <CcEmptyState v-if="historyState === 'loading'" icon="icon-[pixelarticons--loader]" title="Lädt …" text="Trainings-Sessions werden geladen." />
        <div v-else-if="progressTrend.length >= 2" class="cc-trend">
          <svg
            class="cc-trend-svg"
            viewBox="0 0 200 60"
            preserveAspectRatio="none"
            role="img"
            :aria-label="`Trainings-Average-Verlauf über ${progressTrend.length} Sessions, von ${progressTrend[0].average.toFixed(1)} bis ${progressTrend[progressTrend.length - 1].average.toFixed(1)}`"
          >
            <polyline :points="trainingTrendPoints" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
          </svg>
          <div class="cc-trend-range">
            <span>{{ progressTrend[0].average.toFixed(1) }}</span>
            <span>{{ progressTrend[progressTrend.length - 1].average.toFixed(1) }}</span>
          </div>
        </div>
        <CcEmptyState
          v-else
          icon="icon-[pixelarticons--chart]"
          title="Noch zu wenig Sessions für einen Verlauf"
          text="Sobald mindestens zwei Trainings-Sessions gespeichert sind, erscheint hier dein Average-Verlauf."
        />
      </CcCard>
    </div>

    <div class="cc-col-4">
      <CcCard title="Empfehlung" subtitle="Verglichen mit deinem eigenen Schnitt" icon="icon-[pixelarticons--target]" accent="muted">
        <template v-if="historyState === 'loading'">
          <CcEmptyState icon="icon-[pixelarticons--loader]" title="Lädt …" text="Trainings-Sessions werden geladen." />
        </template>
        <template v-else-if="!recommendation.sufficient">
          <CcEmptyState
            icon="icon-[pixelarticons--target]"
            title="Noch zu wenig Sessions"
            text="Ab 5 gespeicherten Sessions vergleichen wir deine jüngsten Werte mit deinem eigenen Gesamtschnitt."
          />
        </template>
        <template v-else-if="recommendation.reason === 'checkout'">
          <p class="cc-note">
            Deine Checkout-Quote der letzten 5 Sessions (<b>{{ recommendation.recentValue!.toFixed(0) }}%</b>)
            liegt unter deinem eigenen Gesamtschnitt (<b>{{ recommendation.overallValue!.toFixed(0) }}%</b>).
            Eine Checkout-Übung könnte sich lohnen.
          </p>
        </template>
        <template v-else-if="recommendation.reason === 'scoring'">
          <p class="cc-note">
            Dein Average der letzten 5 Sessions (<b>{{ recommendation.recentValue!.toFixed(1) }}</b>)
            liegt unter deinem eigenen Gesamtschnitt (<b>{{ recommendation.overallValue!.toFixed(1) }}</b>).
            Eine Scoring-Übung könnte sich lohnen.
          </p>
        </template>
        <template v-else>
          <p class="cc-note">Deine jüngsten Sessions liegen auf Höhe deines eigenen Schnitts — keine auffällige Schwäche.</p>
        </template>
      </CcCard>
    </div>

    <!-- (D3) LETZTES TRAINING -->
    <div class="cc-col-7">
      <CcCard title="Letztes Training" subtitle="Verlauf gespeicherter Sessions (Training-Modus) — Zeile anklicken für Details" icon="icon-[pixelarticons--clock]" accent="muted">
        <CcEmptyState v-if="historyState === 'loading'" icon="icon-[pixelarticons--loader]" title="Lädt …" text="Trainings-Sessions werden geladen." />
        <div v-else-if="trainingHistory.length > 0">
          <div class="cc-list" style="max-height: 320px; overflow-y: auto;">
            <div
              v-for="session in trainingHistory"
              :key="session.date"
              class="cc-result"
              :class="{ 'is-current': session === trainingHistory[0] }"
              style="cursor: pointer;"
              data-testid="cc-training-session-row"
              @click="selectedSession = session === selectedSession ? null : session"
            >
              <div class="cc-result-date">{{ formatDate(session.date) }}</div>
              <div class="cc-result-names">
                <span>
                  <template v-if="session.exerciseTitle">{{ session.exerciseTitle }} — </template>{{ session.goalsReached }} / {{ session.totalGoals }} Ziele erreicht
                  <span v-if="isSessionPersonalBest(session, 'average', personalBests)" class="cc-flag" data-testid="cc-training-pb-flag">Bester Average</span>
                </span>
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

          <div v-if="selectedSession" class="cc-session-detail" data-testid="cc-training-session-detail">
            <div class="cc-session-detail-head">
              <span class="cc-session-detail-title">
                <template v-if="selectedSession.exerciseTitle">{{ selectedSession.exerciseTitle }} — </template>{{ formatDate(selectedSession.date) }}
              </span>
            </div>
            <div class="cc-tiles" style="grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); margin-top: 6px;">
              <CcStatTile label="Average" :value="selectedSession.average" :decimals="1" :accent="isSessionPersonalBest(selectedSession, 'average', personalBests) ? 'gold' : 'plain'" />
              <CcStatTile label="140+" :value="selectedSession.count140Plus" />
              <CcStatTile label="180er" :value="selectedSession.count180s" :accent="isSessionPersonalBest(selectedSession, 'count180s', personalBests) ? 'gold' : 'plain'" />
              <CcStatTile label="Checkout-Quote" :value="selectedSession.checkoutRate" :decimals="0" unit="%" :accent="isSessionPersonalBest(selectedSession, 'checkoutRate', personalBests) ? 'gold' : 'plain'" />
              <CcStatTile label="Fehlversuche" :value="selectedSession.checkoutMisses" />
              <CcStatTile label="Ziele" :value="`${selectedSession.goalsReached}/${selectedSession.totalGoals}`" />
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
          Bronze/Silber/Gold sind die Zielstufen jeder Übung (sichtbar auf den Übungskarten oben).
          Die automatische Vergabe nach einem abgeschlossenen Match ist technisch noch nicht
          verdrahtet — der Fortschritt hier bleibt deshalb aktuell leer, bis das nachgezogen wird.
        </p>
      </CcCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, ref } from "vue";

import CcCard from "../CcCard.vue";
import CcStatTile from "../CcStatTile.vue";
import CcEmptyState from "../CcEmptyState.vue";
import CcStatusPill from "../CcStatusPill.vue";
import CcExerciseCard from "../CcExerciseCard.vue";
import CcTrainingActiveReflection from "../CcTrainingActiveReflection.vue";
import { openAutodarts, openClassicSettings } from "../open-autodarts";
import {
  TRAINING_EXERCISES,
  EXERCISE_CATEGORIES,
  type ExerciseCategory,
  type Medal,
  type ProgressMap,
} from "@/utils/training-exercises";
import { getTrainingHistory } from "@/entrypoints/match.content/training-mode";
import { useControlCenterStatus } from "@/composables/useControlCenterStatus";
import { AutodartsToolsTrainingHistory, AutodartsToolsTrainingProgress } from "@/utils/storage";
import {
  computePersonalBests,
  computeProgressTrend,
  computeTrainingPerformance,
  computeTrainingRecommendation,
  isSessionPersonalBest,
} from "@/utils/training-performance";
import type { TrainingSession } from "@/utils/training-history";
import { deriveCcDataState } from "@/utils/control-center-data-state";

/** Vom Control-Center-Root via provide() zur Verfügung gestellt (wie CcExerciseCard.vue). */
type ShowNotification = (message: string, type?: "success" | "error", duration?: number) => void;
const showNotification = inject<ShowNotification>("cc-notification");

/* ─── Training History ──────────────────────────────────────────────────────── */
const trainingHistory = ref<Awaited<ReturnType<typeof getTrainingHistory>>>([]);
const selectedSession = ref<TrainingSession | null>(null);

/**
 * Issue #13, #7: "lädt noch", "Laden fehlgeschlagen" und "zu wenige Sessions"
 * zeigten bisher denselben leeren Zustand in Performance/Fortschritt/Empfehlung.
 * `loading` gilt nur für den ersten Ladevorgang.
 *
 * KEIN `unavailable`-Zustand für diese Quelle: `getTrainingHistory()` (und
 * `components/Settings/Training.vue`, der andere Aufrufer) fängt Storage-
 * Fehler bereits selbst ab und liefert `[]` statt zu werfen — ein Fehler wäre
 * hier nie von "wirklich keine Sessions" unterscheidbar. Der try/catch ist
 * rein defensiv für alles andere, was vor diesem Rückgabewert werfen könnte.
 */
const historyLoading = ref(true);

async function loadHistory(): Promise<void> {
  try {
    trainingHistory.value = await getTrainingHistory();
  } catch (error) {
    console.error("[CcTraining] loadHistory failed", error);
  }
}

const historyState = computed(() => deriveCcDataState({
  loading: historyLoading.value,
  error: false,
  hasData: trainingHistory.value.length > 0,
}));

/* ─── Performance / Bestleistungen / Fortschritt / Empfehlung (rein abgeleitet) ── */
const lastSession = computed<TrainingSession | null>(() => trainingHistory.value[0] ?? null);
const performance = computed(() => computeTrainingPerformance(trainingHistory.value));
const personalBests = computed(() => computePersonalBests(trainingHistory.value));
const progressTrend = computed(() => computeProgressTrend(trainingHistory.value, 8));
const recommendation = computed(() => computeTrainingRecommendation(trainingHistory.value));

const trainingTrendPoints = computed(() => {
  const points = progressTrend.value;
  if (points.length < 2) return "";
  const values = points.map(p => p.average);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = 200 / (points.length - 1);
  return points
    .map((p, i) => {
      const x = i * stepX;
      const y = 55 - ((p.average - min) / range) * 50;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
});

/**
 * Wiederholt exakt denselben echten Start-Workflow wie CcExerciseCard.vue
 * (setzt nur den bestehenden Storage-Key, keine zweite Engine) — für die
 * zuletzt tatsächlich gespielte Übung, falls bekannt.
 */
async function repeatLastExercise(): Promise<void> {
  const exerciseId = lastSession.value?.exerciseId;
  if (!exerciseId) return;
  const exercise = TRAINING_EXERCISES.find(ex => ex.id === exerciseId);
  try {
    await browser.storage.local.set({ "training-active-exercise": exerciseId });
    showNotification?.(
      `Übung „${exercise?.title ?? exerciseId}" gestartet. Öffne jetzt play.autodarts.io und beginne ein Match.`,
      "success",
      8000,
    );
  } catch (error) {
    console.error("[CcTraining] repeatLastExercise failed", error);
    showNotification?.("Übung konnte nicht gestartet werden.", "error");
  }
}

/* ─── Exercise Progress (Medaillen) ─────────────────────────────────────────── */
const progress = ref<ProgressMap>({});
const progressLoading = ref(true);
const progressError = ref(false);

async function loadProgress(): Promise<void> {
  try {
    progress.value = (await AutodartsToolsTrainingProgress.getValue()) as ProgressMap;
    progressError.value = false;
  } catch (e) {
    console.error("[CcTraining] loadProgress failed", e);
    progressError.value = true;
  }
}

const progressState = computed(() => deriveCcDataState({
  loading: progressLoading.value,
  error: progressError.value,
  hasData: Object.keys(progress.value).length > 0,
}));

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

/**
 * Issue #13, P2-5: History/Progress wurden bisher nur beim Mount geladen —
 * Änderungen aus einem anderen Autodarts-Tab blieben bis Navigation/Reload
 * unsichtbar. Fix: dieselben Watcher-Patterns wie an anderer Stelle im
 * Control Center (z.B. CcHistory.vue::AutodartsToolsCanonicalMatchResults.watch).
 */
/* ─── Init & Cleanup ─────────────────────────────────────────────────────────── */
let disposed = false;
let unwatchHistory: (() => void) | undefined;
let unwatchProgress: (() => void) | undefined;

onMounted(async () => {
  await Promise.all([loadHistory(), loadProgress()]);
  historyLoading.value = false;
  progressLoading.value = false;
  if (disposed) return;
  unwatchHistory = AutodartsToolsTrainingHistory.watch(() => void loadHistory());
  unwatchProgress = AutodartsToolsTrainingProgress.watch(() => void loadProgress());
});

onBeforeUnmount(() => {
  disposed = true;
  unwatchHistory?.();
  unwatchHistory = undefined;
  unwatchProgress?.();
  unwatchProgress = undefined;
});
</script>

<style scoped>
.cc-trend {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cc-trend-svg {
  width: 100%;
  height: 80px;
  color: var(--cc-gold);
}
.cc-trend-range {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--cc-text-faint);
}
.cc-session-detail {
  border: 1px solid var(--cc-border-bright);
  background: var(--cc-surface);
  border-radius: var(--cc-radius-sm);
  padding: 12px 14px;
  margin-top: 10px;
}
.cc-session-detail-title {
  font-family: var(--cc-font-display);
  font-weight: 700;
}
</style>