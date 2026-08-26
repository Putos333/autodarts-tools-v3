<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { AutodartsToolsConfig, updateConfigIfChanged } from "@/utils/storage";
import { getTrainingHistory, clearTrainingHistory } from "@/entrypoints/match.content/training-mode";

const config = ref(await AutodartsToolsConfig.getValue());
const activeTab = ref<'ziele' | 'verlauf'>('ziele');
const history = ref(await getTrainingHistory());

watch(config, async (newConfig) => {
  const currentConfig = await AutodartsToolsConfig.getValue();
  await updateConfigIfChanged(currentConfig, newConfig, "training");
}, { deep: true });

async function refreshVerlauf() {
  history.value = await getTrainingHistory();
}

async function clearVerlauf() {
  await clearTrainingHistory();
  history.value = [];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function goalColors(reached: number, total: number): string {
  const pct = total > 0 ? reached / total : 0;
  if (pct >= 1) return '#00C853';
  if (pct >= 0.6) return '#F5C842';
  return '#E8002D';
}
</script>

<template>
  <div class="tr-wrap">
    <!-- Header -->
    <div class="tr-header">
      <div class="tr-header-icon">🎯</div>
      <div>
        <div class="tr-header-title">Trainings-Modus</div>
        <div class="tr-header-subtitle">Zielvorgaben & Fortschrittsauswertung</div>
      </div>
      <label class="ad-toggle ml-auto">
        <input type="checkbox" v-model="config.training.enabled" />
        <span class="ad-toggle-track"></span>
      </label>
    </div>

    <!-- Tabs -->
    <div class="tr-tabs">
      <button :class="['tr-tab', activeTab === 'ziele' ? 'active' : '']" @click="activeTab = 'ziele'">🎯 Ziele</button>
      <button :class="['tr-tab', activeTab === 'verlauf' ? 'active' : '']" @click="activeTab = 'verlauf'; refreshVerlauf()">📈 Verlauf</button>
    </div>

    <!-- ZIELE -->
    <div v-if="activeTab === 'ziele'" class="tr-body">

      <div class="tr-info">
        Setze Trainingsziele. Während des Matches siehst du deinen Fortschritt live.
        Nach dem Spiel erscheint eine Auswertung.
      </div>

      <!-- Mindest-Durchschnitt -->
      <div class="tr-goal-block">
        <div class="tr-goal-header">
          <span class="tr-goal-label">📊 Mindest-Durchschnitt</span>
          <span class="tr-goal-value">{{ config.training.goals.minAverage }}</span>
        </div>
        <input type="range" min="0" max="120" step="5" v-model.number="config.training.goals.minAverage" class="tr-slider" />
        <div class="tr-slider-hints"><span>Deaktiviert (0)</span><span>Profi (100+)</span></div>
      </div>

      <!-- 140+ Würfe -->
      <div class="tr-goal-block">
        <div class="tr-goal-header">
          <span class="tr-goal-label">💥 Mindest-Anzahl 140+</span>
          <span class="tr-goal-value">{{ config.training.goals.min140Plus }}</span>
        </div>
        <input type="range" min="0" max="10" step="1" v-model.number="config.training.goals.min140Plus" class="tr-slider" />
        <div class="tr-slider-hints"><span>Deaktiviert (0)</span><span>Sehr gut (10)</span></div>
      </div>

      <!-- 180er -->
      <div class="tr-goal-block">
        <div class="tr-goal-header">
          <span class="tr-goal-label">🎰 Mindest-Anzahl 180er</span>
          <span class="tr-goal-value">{{ config.training.goals.min180s }}</span>
        </div>
        <input type="range" min="0" max="5" step="1" v-model.number="config.training.goals.min180s" class="tr-slider" />
        <div class="tr-slider-hints"><span>Deaktiviert (0)</span><span>Top (5)</span></div>
      </div>

      <!-- Checkout-Rate -->
      <div class="tr-goal-block">
        <div class="tr-goal-header">
          <span class="tr-goal-label">🎯 Mindest-Checkout-Rate</span>
          <span class="tr-goal-value">{{ config.training.goals.minCheckoutRate }}%</span>
        </div>
        <input type="range" min="0" max="80" step="5" v-model.number="config.training.goals.minCheckoutRate" class="tr-slider" />
        <div class="tr-slider-hints"><span>Deaktiviert (0%)</span><span>Weltklasse (80%)</span></div>
      </div>

      <!-- Max. Fehlversuche -->
      <div class="tr-goal-block">
        <div class="tr-goal-header">
          <span class="tr-goal-label">❌ Max. Checkout-Fehlversuche</span>
          <span class="tr-goal-value">{{ config.training.goals.maxCheckoutMisses === 0 ? 'Deaktiviert' : config.training.goals.maxCheckoutMisses }}</span>
        </div>
        <input type="range" min="0" max="10" step="1" v-model.number="config.training.goals.maxCheckoutMisses" class="tr-slider" />
        <div class="tr-slider-hints"><span>Deaktiviert (0)</span><span>Streng (1-3)</span></div>
      </div>

      <!-- Optionen -->
      <div class="tr-subsection-label mt">OPTIONEN</div>
      <label class="tr-checkbox-row">
        <input type="checkbox" v-model="config.training.showLiveProgress" />
        <span>Live-Fortschritt während des Matches anzeigen</span>
      </label>
      <label class="tr-checkbox-row">
        <input type="checkbox" v-model="config.training.showSummaryAfterMatch" />
        <span>Auswertung nach dem Match einblenden</span>
      </label>
      <label class="tr-checkbox-row">
        <input type="checkbox" v-model="config.training.trackHistory" />
        <span>Trainingsverlauf speichern</span>
      </label>
    </div>

    <!-- VERLAUF -->
    <div v-if="activeTab === 'verlauf'" class="tr-body">
      <div class="tr-verlauf-actions">
        <button class="tr-btn" @click="refreshVerlauf">🔄 Aktualisieren</button>
        <button class="tr-btn-danger" @click="clearVerlauf" v-if="history.length > 0">🗑 Verlauf löschen</button>
      </div>

      <div v-if="history.length === 0" class="tr-empty">
        <div style="font-size:32px">📈</div>
        <div>Neinch keine Trainingseinheiten gespeichert.</div>
        <div style="font-size:12px;color:#556677">Aktiviere den Trainings-Modus und spiele ein Match.</div>
      </div>

      <div v-for="(session, idx) in history" :key="idx" class="tr-session-card">
        <div class="tr-session-header">
          <span class="tr-session-date">{{ formatDate(session.date) }}</span>
          <span class="tr-session-goals" :style="{ color: goalColors(session.goalsReached, session.totalGoals) }">
            {{ session.goalsReached }}/{{ session.totalGoals }} Ziele
          </span>
        </div>
        <div class="tr-session-stats">
          <div class="tr-session-stat">
            <div class="tr-session-stat-label">AVG</div>
            <div class="tr-session-stat-value">{{ session.average.toFixed(1) }}</div>
          </div>
          <div class="tr-session-stat">
            <div class="tr-session-stat-label">140+</div>
            <div class="tr-session-stat-value">{{ session.count140Plus }}</div>
          </div>
          <div class="tr-session-stat">
            <div class="tr-session-stat-label">180er</div>
            <div class="tr-session-stat-value">{{ session.count180s }}</div>
          </div>
          <div class="tr-session-stat">
            <div class="tr-session-stat-label">DBL%</div>
            <div class="tr-session-stat-value">{{ session.checkoutRate.toFixed(0) }}%</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tr-wrap {
  background: #0D1B2A;
  border: 1px solid #1e3050;
  border-radius: 8px;
  overflow: hidden;
  font-family: 'Barlow Condensed', Arial, sans-serif;
}
.tr-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; background: #0a1520;
  border-bottom: 3px solid #F5C842;
}
.tr-header-icon { font-size: 24px; }
.tr-header-title { font-size: 16px; font-weight: 900; color: #fff; }
.tr-header-subtitle { font-size: 11px; color: #556677; }
.ml-auto { margin-left: auto; }
.tr-tabs { display: flex; background: #0a1520; border-bottom: 1px solid #1e3050; }
.tr-tab {
  flex: 1; padding: 10px; background: none; border: none;
  border-bottom: 2px solid transparent; color: #556677;
  font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.2s;
}
.tr-tab.active { color: #F5C842; border-bottom-color: #F5C842; }
.tr-body { padding: 16px; }
.tr-info {
  font-size: 13px; color: #556677; padding: 10px 12px;
  background: #0a1520; border-radius: 4px; border-left: 3px solid #F5C842;
  margin-bottom: 16px; line-height: 1.5;
}
.tr-goal-block {
  background: #0a1520; border: 1px solid #1e3050; border-radius: 6px;
  padding: 12px; margin-bottom: 10px;
}
.tr-goal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.tr-goal-label { font-size: 14px; font-weight: 700; color: #c0ccd8; }
.tr-goal-value { font-size: 18px; font-weight: 900; color: #F5C842; }
.tr-slider { width: 100%; accent-color: #F5C842; }
.tr-slider-hints { display: flex; justify-content: space-between; font-size: 10px; color: #556677; margin-top: 2px; }
.tr-subsection-label {
  font-size: 10px; font-weight: 700; letter-spacing: 2px;
  color: #F5C842; text-transform: uppercase; margin-bottom: 8px;
}
.mt { margin-top: 16px; }
.tr-checkbox-row {
  display: flex; align-items: center; gap: 8px; font-size: 14px;
  color: #c0ccd8; cursor: pointer; padding: 8px;
  border-radius: 4px; background: #0a1520; border: 1px solid #1e3050;
  margin-bottom: 6px;
}
.tr-checkbox-row input { accent-color: #F5C842; }
.tr-verlauf-actions { display: flex; gap: 8px; margin-bottom: 12px; }
.tr-btn {
  padding: 8px 14px; background: #1e3050; border: 1px solid #2a4060;
  border-radius: 4px; color: #c0ccd8; font-size: 13px; font-weight: 700; cursor: pointer;
}
.tr-btn-danger {
  padding: 8px 14px; background: rgba(232,0,45,0.1); border: 1px solid #E8002D;
  border-radius: 4px; color: #E8002D; font-size: 13px; font-weight: 700; cursor: pointer;
}
.tr-empty {
  text-align: center; padding: 30px; color: #c0ccd8; font-size: 15px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
}
.tr-session-card {
  background: #0a1520; border: 1px solid #1e3050; border-radius: 6px;
  padding: 10px 12px; margin-bottom: 8px;
}
.tr-session-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.tr-session-date { font-size: 12px; color: #556677; }
.tr-session-goals { font-size: 14px; font-weight: 900; }
.tr-session-stats { display: flex; gap: 12px; }
.tr-session-stat { display: flex; flex-direction: column; align-items: center; }
.tr-session-stat-label { font-size: 9px; font-weight: 700; color: #556677; letter-spacing: 1px; }
.tr-session-stat-value { font-size: 18px; font-weight: 900; color: #F5C842; }
.ad-toggle { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
.ad-toggle input { display: none; }
.ad-toggle-track {
  position: absolute; inset: 0; background: #1e3050; border-radius: 12px;
  cursor: pointer; transition: background 0.2s; border: 1px solid #2a3f5a;
}
.ad-toggle input:checked + .ad-toggle-track { background: #F5C842; }
</style>
