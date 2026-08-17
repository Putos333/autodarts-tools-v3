<template>
  <!-- Settings Panel (Modal-Inhalt) -->
  <template v-if="modalOpen">
    <div class="space-y-4">
      <div class="rounded-md border border-white/10 bg-black/20 p-4">
        <h4 class="mb-2 font-bold uppercase tracking-wider text-white">
          🎯 PDC-Übungs-Bibliothek
        </h4>
        <p class="text-sm text-white/70">
          20 kuratierte PDC-Übungen für Aufwärmen, Genauigkeit, Checkouts, Konsistenz und Druck-Situationen. Jede Übung hat Bronze/Silber/Gold-Ziele. Wähle unten deine Übung und starte sie im Match.
        </p>
      </div>

      <!-- Kategorie-Filter -->
      <div class="flex flex-wrap gap-2">
        <button
          @click="activeCategory = null"
          :class="[
            'rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all',
            !activeCategory ? 'bg-white text-black' : 'bg-white/5 text-white/70 hover:bg-white/10',
          ]"
          data-testid="filter-all"
        >Alle ({{ exercises.length }})</button>
        <button
          v-for="(meta, cat) in categories"
          :key="cat"
          @click="activeCategory = activeCategory === cat ? null : cat"
          :class="[
            'flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all',
            activeCategory === cat ? 'text-black' : 'bg-white/5 text-white/70 hover:bg-white/10',
          ]"
          :style="activeCategory === cat ? { background: meta.color } : {}"
          :data-testid="`filter-${cat}`"
        >
          <span>{{ meta.icon }}</span>
          <span>{{ meta.label }}</span>
          <span class="opacity-60">({{ countByCategory(cat) }})</span>
        </button>
      </div>

      <!-- Übungs-Grid -->
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div
          v-for="ex in filteredExercises"
          :key="ex.id"
          class="rounded-md border border-white/10 bg-black/20 p-4 transition-all hover:border-white/25 hover:bg-black/30"
          :data-testid="`exercise-card-${ex.id}`"
        >
          <div class="mb-2 flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="text-2xl">{{ categories[ex.category].icon }}</span>
                <div>
                  <h5 class="font-bold text-white">{{ ex.title }}</h5>
                  <div class="text-xs text-white/50">
                    {{ categories[ex.category].label }} · ~{{ ex.durationMin }} min
                  </div>
                </div>
              </div>
            </div>
            <!-- Medal-Anzeige -->
            <div class="flex flex-col items-end gap-1">
              <div v-if="progress[ex.id]?.medal" class="text-2xl">
                {{ medalEmoji(progress[ex.id]!.medal!) }}
              </div>
              <div v-else class="text-xs text-white/40">–</div>
              <div class="text-xs text-white/50">
                {{ progress[ex.id]?.attempts || 0 }} Versuche
              </div>
            </div>
          </div>

          <p class="mb-3 text-sm text-white/70">{{ ex.description }}</p>

          <div class="mb-3 space-y-1 text-xs text-white/60">
            <div v-for="(step, i) in ex.instructions" :key="i" class="flex gap-2">
              <span class="text-white/40">{{ i + 1 }}.</span>
              <span>{{ step }}</span>
            </div>
          </div>

          <div class="mb-3 rounded bg-black/40 p-2 text-xs">
            <div class="mb-1 font-bold uppercase tracking-wide text-white/80">🏅 Ziele</div>
            <div class="grid grid-cols-3 gap-1 text-white/60">
              <div>🥉 {{ goalText(ex.goals.bronze) }}</div>
              <div>🥈 {{ goalText(ex.goals.silver) }}</div>
              <div>🥇 {{ goalText(ex.goals.gold) }}</div>
            </div>
          </div>

          <div class="flex gap-2">
            <AppButton
              @click="startExercise(ex.id)"
              type="success"
              size="sm"
              class="flex-1"
              :data-testid="`start-${ex.id}`"
            >
              ▶ Übung starten
            </AppButton>
            <AppButton
              v-if="progress[ex.id]?.attempts"
              @click="resetProgress(ex.id)"
              size="sm"
              type="danger"
              :data-testid="`reset-${ex.id}`"
              title="Fortschritt für diese Übung zurücksetzen"
            >
              <span class="icon-[pixelarticons--trash]" />
            </AppButton>
          </div>
        </div>
      </div>

      <div v-if="filteredExercises.length === 0" class="rounded-md border border-white/10 bg-black/20 p-6 text-center text-white/50">
        Keine Übungen in dieser Kategorie.
      </div>

      <!-- Overall Progress -->
      <div class="rounded-md border border-white/10 bg-gradient-to-br from-yellow-500/10 to-amber-500/5 p-4">
        <h4 class="mb-2 font-bold uppercase tracking-wider text-white">📊 Deine Erfolge</h4>
        <div class="grid grid-cols-4 gap-2 text-center text-sm">
          <div>
            <div class="text-2xl font-black text-white">{{ totalCompleted }}</div>
            <div class="text-xs uppercase tracking-wide text-white/50">Abgeschlossen</div>
          </div>
          <div>
            <div class="text-2xl">🥇</div>
            <div class="text-xs font-bold text-white">{{ medalCounts.gold }}</div>
          </div>
          <div>
            <div class="text-2xl">🥈</div>
            <div class="text-xs font-bold text-white">{{ medalCounts.silver }}</div>
          </div>
          <div>
            <div class="text-2xl">🥉</div>
            <div class="text-xs font-bold text-white">{{ medalCounts.bronze }}</div>
          </div>
        </div>
      </div>
    </div>
  </template>

  <!-- Feature-Card -->
  <div v-else class="adt-container h-56 transition-transform hover:-translate-y-0.5" data-testid="training-exercises-card">
    <div class="relative z-10 flex h-full flex-col justify-between">
      <div>
        <h3 class="mb-1 flex items-center font-bold uppercase">
          🎯 PDC-Übungs-Bibliothek
          <span class="icon-[material-symbols--settings-alert-outline-rounded] ml-2 size-5" />
        </h3>
        <p class="w-2/3 text-white/70">
          20 kuratierte PDC-Übungen: Aufwärmen, T20-Jagd, Doubles-Drill, 170er Big-Fish, Perfect-9 & mehr — mit Bronze/Silber/Gold-Medaillen.
        </p>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3 text-xs text-white/60">
          <span>🥇 {{ medalCounts.gold }}</span>
          <span>🥈 {{ medalCounts.silver }}</span>
          <span>🥉 {{ medalCounts.bronze }}</span>
        </div>
        <AppButton @click="$emit('toggle')" size="sm" auto data-testid="open-training-exercises">
          Öffnen
        </AppButton>
      </div>
    </div>
  </div>

  <AppNotification
    @close="hideNotification"
    :show="notification.show"
    :message="notification.message"
    :type="notification.type"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import AppButton from "@/components/AppButton.vue";
import AppNotification from "@/components/AppNotification.vue";
import { useNotification } from "@/composables/useNotification";
import {
  TRAINING_EXERCISES,
  EXERCISE_CATEGORIES,
  PROGRESS_STORAGE_KEY,
  type ExerciseCategory,
  type ExerciseGoal,
  type ProgressMap,
  type Medal,
} from "@/utils/training-exercises";

defineProps<{ modalOpen?: boolean }>();
defineEmits<{ (e: "toggle"): void }>();

const { notification, showNotification, hideNotification } = useNotification();

const exercises = TRAINING_EXERCISES;
const categories = EXERCISE_CATEGORIES;
const activeCategory = ref<ExerciseCategory | null>(null);
const progress = ref<ProgressMap>({});

const filteredExercises = computed(() =>
  activeCategory.value
    ? exercises.filter((e) => e.category === activeCategory.value)
    : exercises,
);

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

function countByCategory(cat: ExerciseCategory): number {
  return exercises.filter((e) => e.category === cat).length;
}

function medalEmoji(m: Medal): string {
  return m === "gold" ? "🥇" : m === "silver" ? "🥈" : "🥉";
}

function goalText(g: ExerciseGoal): string {
  if (g.customCondition) return g.customCondition;
  if (g.minAverage) return `Avg ≥ ${g.minAverage}`;
  if (g.min140Plus) return `${g.min140Plus}× 140+`;
  if (g.min180s) return `${g.min180s}× 180`;
  if (g.minCheckoutRate) return `Checkout ≥ ${g.minCheckoutRate}%`;
  return "—";
}

async function loadProgress() {
  try {
    const key = PROGRESS_STORAGE_KEY.replace("local:", "");
    const r = await browser.storage.local.get(key);
    progress.value = (r[key] ?? {}) as ProgressMap;
  } catch (e) {
    console.error("[TrainingExercises] loadProgress failed", e);
  }
}

async function startExercise(id: string) {
  // Aktive Übung im Storage merken → training-mode.ts wertet aus
  try {
    await browser.storage.local.set({ "training-active-exercise": id });
    const ex = exercises.find((e) => e.id === id);
    if (ex) {
      showNotification(
        `Übung „${ex.title}" gestartet.<br><br>Öffne jetzt play.autodarts.io und beginne mit einem Match. Das Overlay im Match zeigt dir den Fortschritt.<br><br>Empfohlener Modus: ${ex.suggestedVariant ?? "beliebig"}`,
        "success",
        8000,
      );
    }
  } catch (e) {
    console.error("[TrainingExercises] startExercise failed", e);
  }
}

async function resetProgress(id: string) {
  if (!confirm(`Fortschritt für „${exercises.find((e) => e.id === id)?.title}" wirklich zurücksetzen?`)) return;
  delete progress.value[id];
  const key = PROGRESS_STORAGE_KEY.replace("local:", "");
  await browser.storage.local.set({ [key]: progress.value });
}

onMounted(loadProgress);
</script>
