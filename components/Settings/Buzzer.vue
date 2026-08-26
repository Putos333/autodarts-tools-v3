<script setup lang="ts">
import { ref, watch } from "vue";
import { AutodartsToolsConfig, updateConfigIfChanged } from "@/utils/storage";

const config = ref(await AutodartsToolsConfig.getValue());

watch(config, async (newConfig) => {
  const currentConfig = await AutodartsToolsConfig.getValue();
  await updateConfigIfChanged(currentConfig, newConfig, "buzzer");
}, { deep: true });
</script>

<template>
  <div class="bz-wrap">
    <!-- Header -->
    <div class="bz-header">
      <div class="bz-header-icon">🔔</div>
      <div>
        <div class="bz-header-title">Party-Buzzer</div>
        <div class="bz-header-subtitle">Mehrspieler-Buzzer mit Handy-Unterstützung</div>
      </div>
      <label class="ad-toggle ml-auto">
        <input type="checkbox" v-model="config.buzzer.enabled" />
        <span class="ad-toggle-track"></span>
      </label>
    </div>

    <div class="bz-body">
      <!-- Info-Banner -->
      <div class="bz-info">
        <div class="bz-info-icon">📱</div>
        <div>
          Wenn aktiviert, erscheint während des Matches ein <strong>Buzzer-Panel</strong> auf dem TV.
          Spieler können per <strong>QR-Code</strong> mit dem Handy mitmachen oder direkt auf dem PC klicken.
          Wer zuerst drückt, wird groß angezeigt!
        </div>
      </div>

      <!-- Anzahl Spieler -->
      <div class="bz-section">
        <div class="bz-section-title">SPIELER</div>
        <div class="bz-option-row">
          <span class="bz-option-label">Anzahl Buzzer-Spieler</span>
          <div class="bz-player-count">
            <button
              v-for="n in [2,3,4]" :key="n"
              :class="['bz-count-btn', config.buzzer.maxPlayers === n ? 'active' : '']"
              @click="config.buzzer.maxPlayers = n"
            >{{ n }}</button>
          </div>
        </div>

        <!-- Vorschau der Buzzer-Colorsn -->
        <div class="bz-preview">
          <div
            v-for="(color, i) in ['#E8002D','#F5C842','#00C853','#2196F3'].slice(0, config.buzzer.maxPlayers)"
            :key="i"
            class="bz-preview-btn"
            :style="{ borderColor: color, background: `rgba(${hexToRgb(color)},0.15)`, color }"
          >
            Spieler {{ i + 1 }}
          </div>
        </div>
      </div>

      <!-- Optionen -->
      <div class="bz-section">
        <div class="bz-section-title">OPTIONEN</div>

        <label class="bz-checkbox-row">
          <input type="checkbox" v-model="config.buzzer.soundEnabled" />
          <div>
            <span class="bz-opt-label">🔊 Buzzer-Ton</span>
            <span class="bz-opt-desc">Spielt einen Ton ab wenn jemand buzzed</span>
          </div>
        </label>

        <label class="bz-checkbox-row">
          <input type="checkbox" v-model="config.buzzer.showQrCode" />
          <div>
            <span class="bz-opt-label">📱 QR-Code anzeigen</span>
            <span class="bz-opt-desc">Handy-Buzzer per QR-Code zugänglich machen</span>
          </div>
        </label>
      </div>

      <!-- Anleitung -->
      <div class="bz-section">
        <div class="bz-section-title">SO FUNKTIONIERT'S</div>
        <div class="bz-steps">
          <div class="bz-step">
            <div class="bz-step-num">1</div>
            <div class="bz-step-text">Buzzer aktivieren und ein Match auf autodarts.io starten</div>
          </div>
          <div class="bz-step">
            <div class="bz-step-num">2</div>
            <div class="bz-step-text">QR-Code mit dem Handy scannen (erscheint links oben auf dem TV)</div>
          </div>
          <div class="bz-step">
            <div class="bz-step-num">3</div>
            <div class="bz-step-text">Auf den großen farbigen Buzzer-Button tippen – wer zuerst drückt, ist dran!</div>
          </div>
          <div class="bz-step">
            <div class="bz-step-num">4</div>
            <div class="bz-step-text">Nach dem Wurf auf "Zurücksetzen" klicken für die nächste Runde</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// Hilfsfunktion für Vorschau
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}
</script>

<style scoped>
.bz-wrap {
  background: #0D1B2A; border: 1px solid #1e3050;
  border-radius: 8px; overflow: hidden;
  font-family: 'Barlow Condensed', Arial, sans-serif;
}
.bz-header {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 16px; background: #0a1520;
  border-bottom: 3px solid #F5C842;
}
.bz-header-icon { font-size: 24px; }
.bz-header-title { font-size: 16px; font-weight: 900; color: #fff; }
.bz-header-subtitle { font-size: 11px; color: #556677; }
.ml-auto { margin-left: auto; }
.bz-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.bz-info {
  display: flex; gap: 10px; align-items: flex-start;
  background: #0a1520; border: 1px solid #1e3050;
  border-left: 3px solid #F5C842; border-radius: 4px; padding: 12px;
  font-size: 13px; color: #c0ccd8; line-height: 1.5;
}
.bz-info-icon { font-size: 22px; flex-shrink: 0; }
.bz-section { background: #0a1520; border: 1px solid #1e3050; border-radius: 6px; padding: 12px; }
.bz-section-title {
  font-size: 10px; font-weight: 700; letter-spacing: 2px;
  color: #F5C842; text-transform: uppercase; margin-bottom: 10px;
}
.bz-option-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.bz-option-label { font-size: 14px; font-weight: 700; color: #c0ccd8; }
.bz-player-count { display: flex; gap: 6px; }
.bz-count-btn {
  width: 36px; height: 36px; border-radius: 50%; border: 2px solid #1e3050;
  background: #0D1B2A; color: #556677; font-size: 16px; font-weight: 900;
  cursor: pointer; transition: all 0.2s;
}
.bz-count-btn.active { border-color: #F5C842; color: #F5C842; background: rgba(245,200,66,0.1); }
.bz-preview { display: flex; gap: 8px; flex-wrap: wrap; }
.bz-preview-btn {
  padding: 8px 14px; border-radius: 6px; border: 2px solid;
  font-size: 14px; font-weight: 900;
}
.bz-checkbox-row {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 10px; border-radius: 4px; cursor: pointer;
  border: 1px solid #1e3050; margin-bottom: 6px;
}
.bz-checkbox-row input { accent-color: #F5C842; margin-top: 2px; flex-shrink: 0; }
.bz-opt-label { display: block; font-size: 14px; font-weight: 700; color: #c0ccd8; }
.bz-opt-desc { display: block; font-size: 11px; color: #556677; margin-top: 2px; }
.bz-steps { display: flex; flex-direction: column; gap: 8px; }
.bz-step { display: flex; align-items: flex-start; gap: 10px; }
.bz-step-num {
  width: 24px; height: 24px; border-radius: 50%; background: #E8002D;
  color: #fff; font-size: 13px; font-weight: 900;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.bz-step-text { font-size: 13px; color: #c0ccd8; line-height: 1.5; padding-top: 2px; }
.ad-toggle { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
.ad-toggle input { display: none; }
.ad-toggle-track {
  position: absolute; inset: 0; background: #1e3050; border-radius: 12px;
  cursor: pointer; transition: background 0.2s; border: 1px solid #2a3f5a;
}
.ad-toggle input:checked + .ad-toggle-track { background: #F5C842; }
</style>
