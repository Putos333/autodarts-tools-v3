<template>
  <div class="cc-human-test" data-testid="cc-human-test-panel">
    <div class="cc-human-test-head">
      <span class="cc-human-test-title">🧪 TEMPORÄRER HUMAN TEST MODE — X01 301 / 2 Legs</span>
      <span class="cc-human-test-note">Nur für den realen Live-Test. Danach entfernbar.</span>
    </div>
    <ul class="cc-human-test-list">
      <li v-for="item in checkpoints" :key="item.key" :data-testid="`cc-human-test-${item.key}`" :class="item.seen && 'is-seen'">
        <span class="cc-human-test-box">{{ item.seen ? "✔" : "☐" }}</span>
        <span>{{ item.label }}</span>
      </li>
    </ul>
    <p class="cc-human-test-hint">
      Kein Häkchen wird automatisch gesetzt, ohne dass die zugehörige echte Bedingung in
      <code>useControlCenterStatus()</code> mindestens einmal wirklich zutraf. Ein Reload setzt alle Häkchen zurück.
    </p>
  </div>
</template>

<script setup lang="ts">
/**
 * CcMatchHumanTestPanel.vue — TEMPORÄR (Phase 5, 301/2-Legs Human Test).
 *
 * Zeigt neun Checkpoints für den realen Live-Test, jeder ausschließlich aus
 * bereits vorhandenem, reaktivem State abgeleitet (useControlCenterStatus() /
 * CMR-Store) — keine eigene Match-Auswertung, kein zweiter Datenpfad. Jedes
 * Häkchen ist "sticky": einmal wirklich beobachtet, bleibt es für den Rest der
 * Sitzung gesetzt, auch wenn der Zustand sich danach wieder ändert (z.B.
 * "Spielerwechsel erkannt" bleibt an, nachdem der Spieler zurückgewechselt hat).
 *
 * Behauptet NIE von sich aus "PASS" — das Panel zeigt nur, was tatsächlich
 * beobachtet wurde. Die Bewertung bleibt beim Menschen, der den Live-Test
 * durchführt.
 */
import { computed, ref, watch } from "vue";

import { useControlCenterStatus } from "@/composables/useControlCenterStatus";

const { hasMatch, players, matchFinished, matchProgress, liveThrow, recentVisits, matchId, results, hasResults } = useControlCenterStatus();

const seenMatch = ref(false);
const seenPlayers = ref(false);
const seenFirstThrow = ref(false);
const seenScoreUpdate = ref(false);
const seenPlayerSwitch = ref(false);
const seenLegEnd = ref(false);
const seenSecondLeg = ref(false);
const seenMatchEnd = ref(false);
const seenResultSaved = ref(false);

let initialRemaining: (number | undefined)[] | null = null;
let lastActiveSeat: number | null = null;
let lastLegSum: number | null = null;

watch(hasMatch, (value) => { if (value) seenMatch.value = true; }, { immediate: true });

watch(players, (list) => {
  if (list.length > 0) seenPlayers.value = true;

  // Score aktualisiert: Restscore mindestens eines Spielers weicht vom ersten
  // beobachteten Snapshot ab.
  const remaining = list.map(p => p.remaining);
  if (initialRemaining === null) {
    initialRemaining = remaining;
  } else if (remaining.some((value, index) => value !== initialRemaining![index])) {
    seenScoreUpdate.value = true;
  }

  // Spielerwechsel: der aktive Sitzplatz hat sich mindestens einmal geändert.
  const activeSeat = list.find(p => p.isActive)?.seat ?? null;
  if (activeSeat !== null) {
    if (lastActiveSeat !== null && activeSeat !== lastActiveSeat) seenPlayerSwitch.value = true;
    lastActiveSeat = activeSeat;
  }

  // Leg-Ende: die Summe aller gemeldeten Legs ist gegenüber dem letzten
  // Snapshot gestiegen.
  const legSum = list.reduce((sum, p) => sum + (p.legs ?? 0), 0);
  if (lastLegSum !== null && legSum > lastLegSum) seenLegEnd.value = true;
  lastLegSum = legSum;
}, { deep: true, immediate: true });

watch([ liveThrow, recentVisits ], ([ throwState, visits ]) => {
  if (throwState.darts.some(d => d.hit) || visits.length > 0) seenFirstThrow.value = true;
}, { deep: true, immediate: true });

watch(matchProgress, (progress) => {
  if (progress && typeof progress.leg === "number" && progress.leg >= 2) seenSecondLeg.value = true;
}, { immediate: true });
// Zweites Leg auch über die Leg-Summe erkennbar, falls `leg` selbst nicht belegt ist.
watch(seenLegEnd, (value) => { if (value) seenSecondLeg.value = true; });

watch(matchFinished, (value) => { if (value) seenMatchEnd.value = true; }, { immediate: true });

watch([ hasResults, results, matchId ], ([ has, list, id ]) => {
  if (has && id && list.some(r => r.matchId === id)) seenResultSaved.value = true;
}, { deep: true, immediate: true });

const checkpoints = computed(() => [
  { key: "match", label: "Match erkannt", seen: seenMatch.value },
  { key: "players", label: "Spieler erkannt", seen: seenPlayers.value },
  { key: "first-throw", label: "Erster Wurf erkannt", seen: seenFirstThrow.value },
  { key: "score", label: "Score aktualisiert", seen: seenScoreUpdate.value },
  { key: "player-switch", label: "Spielerwechsel erkannt", seen: seenPlayerSwitch.value },
  { key: "leg-end", label: "Leg-Ende erkannt", seen: seenLegEnd.value },
  { key: "second-leg", label: "Zweites Leg erkannt", seen: seenSecondLeg.value },
  { key: "match-end", label: "Match-Ende erkannt", seen: seenMatchEnd.value },
  { key: "result-saved", label: "Ergebnis gespeichert", seen: seenResultSaved.value },
]);
</script>

<style scoped>
.cc-human-test {
  background: rgba(245, 200, 66, 0.06);
  border: 1px dashed rgba(245, 200, 66, 0.4);
  border-radius: 8px;
  padding: 12px 14px;
  margin-top: 14px;
  font-size: 12px;
}
.cc-human-test-head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 8px;
}
.cc-human-test-title {
  font-weight: 800;
  color: #F5C842;
  letter-spacing: 0.3px;
}
.cc-human-test-note {
  color: var(--cc-text-faint, #8992a8);
}
.cc-human-test-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 4px 12px;
}
.cc-human-test-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--cc-text-faint, #8992a8);
}
.cc-human-test-list li.is-seen {
  color: var(--cc-text, #e8eaf0);
}
.cc-human-test-box {
  font-family: monospace;
  width: 14px;
  text-align: center;
}
.cc-human-test-hint {
  margin: 8px 0 0;
  color: var(--cc-text-faint, #8992a8);
  font-size: 11px;
}
</style>
