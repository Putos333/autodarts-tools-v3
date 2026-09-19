<script setup lang="ts">
import { ref, watch } from "vue";
import { AutodartsToolsConfig, updateConfigIfChanged } from "@/utils/storage";

const config = ref(await AutodartsToolsConfig.getValue());

watch(config, async (newConfig) => {
  const currentConfig = await AutodartsToolsConfig.getValue();
  await updateConfigIfChanged(currentConfig, newConfig, "tvStats");
}, { deep: true });
</script>

<template>
  <div class="ad-section">
    <!-- Header -->
    <div class="ad-section-header">
      <div class="ad-section-icon">📺</div>
      <div>
        <div class="ad-section-title">Statistik-Overlay</div>
        <div class="ad-section-subtitle">Sporadische Einblendung nach jedem Wurf</div>
      </div>
      <label class="ad-toggle ml-auto">
        <input type="checkbox" v-model="config.tvStats.enabled" />
        <span class="ad-toggle-track"></span>
      </label>
    </div>

    <div v-if="config.tvStats.enabled" class="ad-section-body">

      <p class="ad-hint">
        Das Overlay erscheint automatisch nach jedem Spielerwechsel und blendet sich nach der eingestellten Zeit selbst aus.
      </p>

      <!-- Statistiken auswählen -->
      <div class="ad-subsection-label">ANGEZEIGTE WERTE</div>
      <div class="ad-grid-2">
        <label class="ad-checkbox-row">
          <input type="checkbox" v-model="config.tvStats.showFirst9Avg" />
          <span>Average &amp; First-9-Avg</span>
        </label>
        <label class="ad-checkbox-row">
          <input type="checkbox" v-model="config.tvStats.showDoubleQuote" />
          <span>Doppelquote (%)</span>
        </label>
        <label class="ad-checkbox-row">
          <input type="checkbox" v-model="config.tvStats.showCheckoutSuggestion" />
          <span>Checkout-Vorschlag</span>
        </label>
        <label class="ad-checkbox-row">
          <input type="checkbox" v-model="config.tvStats.showBestLeg" />
          <span>Bestes Leg (Darts)</span>
        </label>
      </div>

      <!-- Anzeigedauer -->
      <div class="ad-subsection-label mt-4">ANZEIGEDAUER</div>
      <div class="ad-slider-row">
        <input
          type="range"
          min="2000"
          max="12000"
          step="500"
          v-model.number="config.tvStats.displayDuration"
          class="ad-slider"
        />
        <span class="ad-slider-value">{{ (config.tvStats.displayDuration / 1000).toFixed(1) }}s</span>
      </div>

      <!-- Vorschau -->
      <div class="ad-subsection-label mt-4">VORSCHAU</div>
      <div class="ad-preview-wrap">
        <!-- Stats-Block -->
        <div class="ad-preview-stats-block">
          <div class="ad-preview-name">SPIELER 1</div>
          <div class="ad-preview-stats-row">
            <div class="ad-preview-stat">
              <div class="ad-preview-label">REST</div>
              <div class="ad-preview-value white">180</div>
            </div>
            <div class="ad-preview-stat" v-if="config.tvStats.showFirst9Avg">
              <div class="ad-preview-label">AVG</div>
              <div class="ad-preview-value gold">72.4</div>
            </div>
            <div class="ad-preview-stat" v-if="config.tvStats.showFirst9Avg">
              <div class="ad-preview-label">F9 AVG</div>
              <div class="ad-preview-value gold">88.2</div>
            </div>
            <div class="ad-preview-stat" v-if="config.tvStats.showDoubleQuote">
              <div class="ad-preview-label">DOPPEL</div>
              <div class="ad-preview-value normal">38%</div>
            </div>
            <div class="ad-preview-stat" v-if="config.tvStats.showBestLeg">
              <div class="ad-preview-label">BEST LEG</div>
              <div class="ad-preview-value green">15</div>
            </div>
          </div>
        </div>
        <!-- Checkout-Block -->
        <div class="ad-preview-checkout-block" v-if="config.tvStats.showCheckoutSuggestion">
          <div class="ad-preview-checkout-label">✅ CHECKOUT MÖGLICH</div>
          <div class="ad-preview-checkout-score">100</div>
          <div class="ad-preview-checkout-darts">
            <span class="dart-triple">T20</span>
            <span class="dart-sep">·</span>
            <span class="dart-double">D20</span>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.ad-section {
  background: #0D1B2A;
  border: 1px solid #1e3050;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 12px;
}
.ad-section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: #0a1520;
  border-bottom: 1px solid #1e3050;
}
.ad-section-icon { font-size: 22px; }
.ad-section-title {
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.5px;
}
.ad-section-subtitle { font-size: 12px; color: #556677; }
.ad-section-body { padding: 16px; }
.ad-hint {
  font-size: 12px;
  color: #556677;
  margin-bottom: 16px;
  line-height: 1.5;
}
.ad-subsection-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2px;
  color: #E8002D;
  text-transform: uppercase;
  margin-bottom: 10px;
}
.mt-4 { margin-top: 16px; }
.ml-auto { margin-left: auto; }
.ad-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.ad-checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #c0ccd8;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 4px;
  background: #0a1520;
  border: 1px solid #1e3050;
}
.ad-checkbox-row input { accent-color: #E8002D; }
.ad-slider-row { display: flex; align-items: center; gap: 12px; }
.ad-slider { flex: 1; accent-color: #E8002D; }
.ad-slider-value { font-size: 14px; font-weight: 700; color: #F5C842; min-width: 40px; }
.ad-toggle { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
.ad-toggle input { display: none; }
.ad-toggle-track {
  position: absolute;
  inset: 0;
  background: #1e3050;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
  border: 1px solid #2a3f5a;
}
.ad-toggle input:checked + .ad-toggle-track { background: #E8002D; }

/* Vorschau */
.ad-preview-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}
.ad-preview-stats-block {
  background: rgba(13,27,42,0.95);
  border: 2px solid #1a3a5c;
  border-top: 4px solid #E8002D;
  border-radius: 8px;
  padding: 10px 20px 12px;
  width: 100%;
  text-align: center;
}
.ad-preview-name {
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 3px;
  color: #E8002D;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.ad-preview-stats-row {
  display: flex;
  gap: 16px;
  justify-content: center;
  flex-wrap: wrap;
}
.ad-preview-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 48px;
}
.ad-preview-label {
  font-size: 8px;
  font-weight: 700;
  color: #556677;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.ad-preview-value { font-size: 18px; font-weight: 900; line-height: 1.1; }
.ad-preview-value.gold { color: #F5C842; }
.ad-preview-value.green { color: #00C853; }
.ad-preview-value.normal { color: #c0ccd8; }
.ad-preview-value.white { color: #ffffff; }

.ad-preview-checkout-block {
  background: rgba(13,27,42,0.95);
  border: 2px solid #00C853;
  border-top: 4px solid #00C853;
  border-radius: 8px;
  padding: 8px 20px 10px;
  text-align: center;
  width: 100%;
}
.ad-preview-checkout-label {
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 2px;
  color: #00C853;
  text-transform: uppercase;
  margin-bottom: 2px;
}
.ad-preview-checkout-score {
  font-size: 28px;
  font-weight: 900;
  color: #fff;
  line-height: 1;
}
.ad-preview-checkout-darts {
  font-size: 16px;
  margin-top: 4px;
  letter-spacing: 1px;
}
.dart-triple { color: #F5C842; font-weight: 900; }
.dart-double { color: #00C853; font-weight: 900; }
.dart-sep { color: #334; margin: 0 4px; }
</style>
