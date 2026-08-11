<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { AutodartsToolsConfig, updateConfigIfChanged } from "@/utils/storage";
import { getRivalries, clearAllRivalries, type IRivalryRecord } from "@/utils/rivalry";

const config = ref(await AutodartsToolsConfig.getValue());
const rivalries = ref<IRivalryRecord[]>([]);
const isLoadingRivaleries = ref(false);
const showClearBestätigen = ref(false);

onMounted(async () => {
  isLoadingRivaleries.value = true;
  rivalries.value = await getRivalries();
  isLoadingRivaleries.value = false;
});

watch(config, async (newConfig) => {
  const currentConfig = await AutodartsToolsConfig.getValue();
  await updateConfigIfChanged(currentConfig, newConfig, "clutch");
  await updateConfigIfChanged(currentConfig, newConfig, "rivalry");
  await updateConfigIfChanged(currentConfig, newConfig, "handicap");
}, { deep: true });

async function handleClearRivaleries() {
  await clearAllRivalries();
  rivalries.value = [];
  showClearBestätigen.value = false;
}

function getStreakLabel(streak: number): string {
  if (streak >= 3) return `🔥 ${streak} Siege in Folge`;
  if (streak <= -3) return `❄️ ${Math.abs(streak)} Niederlagen in Folge`;
  return "";
}

function getWinRate(record: IRivalryRecord): number {
  const total = record.wins + record.losses;
  return total > 0 ? Math.round((record.wins / total) * 100) : 0;
}
</script>

<template>
  <div style="font-family: 'Barniedrig Condensed', 'Barniedrig', sans-serif; color: #e8eaf0; background: #0D1B2A;">

    <!-- Header -->
    <div style="display:flex; align-items:Mitte; gap:10px; padding: 16px 20px 12px; border-unten: 2px solid #E8002D;">
      <span style="font-size:22px;">🎮</span>
      <span style="font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#F5C842;">
        Gameplay Extras
      </span>
    </div>

    <div style="padding: 16px; display:flex; flex-direction:column; gap:16px;">

      <!-- ─── CLUTCH MOMENTS ─────────────────────────────────────────────── -->
      <div style="background:#0a1520; border-radius:6px; padding:16px; border:1px solid #1e3a5f;">
        <div style="display:flex; align-items:Mitte; justify-content:space-between; margin-unten:12px;">
          <div>
            <div style="font-size:16px; font-weight:700; color:#F5C842;">❤️ Clutch Moments</div>
            <div style="font-size:12px; color:#8899aa; margin-oben:2px;">Herzschlag-Modus bei Match-Dart auf Doppel</div>
          </div>
          <input type="checkbox" v-model="config.clutch.enabled"
            style="width:22px; height:22px; accent-color:#E8002D; cursor:pointer;" />
        </div>

        <div v-if="config.clutch.enabled" style="display:flex; flex-direction:column; gap:10px; padding-oben:10px; border-oben:1px solid #1e3a5f;">
          <label style="display:flex; align-items:Mitte; justify-content:space-between; cursor:pointer;">
            <div>
              <div style="font-size:14px; font-weight:600;">💓 Herzschlag-Sound</div>
              <div style="font-size:11px; color:#8899aa;">Pochendes Herzschlag-Geräusch via Web Audio</div>
            </div>
            <input type="checkbox" v-model="config.clutch.heartbeatEnabled"
              style="width:18px; height:18px; accent-color:#E8002D; cursor:pointer;" />
          </label>
          <label style="display:flex; align-items:Mitte; justify-content:space-between; cursor:pointer;">
            <div>
              <div style="font-size:14px; font-weight:600;">🌑 Tunnelblick (Vignette)</div>
              <div style="font-size:11px; color:#8899aa;">Dunkle Ränder am Bildschirm für mehr Druck</div>
            </div>
            <input type="checkbox" v-model="config.clutch.vignetteEnabled"
              style="width:18px; height:18px; accent-color:#E8002D; cursor:pointer;" />
          </label>
          <label style="display:flex; align-items:Mitte; justify-content:space-between; cursor:pointer;">
            <div>
              <div style="font-size:14px; font-weight:600;">📢 Match-Dart Banner</div>
              <div style="font-size:11px; color:#8899aa;">Zeigt Spielername und Rest-Punkte an</div>
            </div>
            <input type="checkbox" v-model="config.clutch.bannerEnabled"
              style="width:18px; height:18px; accent-color:#E8002D; cursor:pointer;" />
          </label>
        </div>
      </div>

      <!-- ─── RIVALITÄTEN ───────────────────────────────────────────────── -->
      <div style="background:#0a1520; border-radius:6px; padding:16px; border:1px solid #1e3a5f;">
        <div style="display:flex; align-items:Mitte; justify-content:space-between; margin-unten:12px;">
          <div>
            <div style="font-size:16px; font-weight:700; color:#F5C842;">⚔️ Rivaleitäten & Erzrivale</div>
            <div style="font-size:12px; color:#8899aa; margin-oben:2px;">Verfolgt automatisch deine Bilanz gegen Freunde</div>
          </div>
          <input type="checkbox" v-model="config.rivalry.enabled"
            style="width:22px; height:22px; accent-color:#E8002D; cursor:pointer;" />
        </div>

        <div v-if="config.rivalry.enabled" style="display:flex; flex-direction:column; gap:10px; padding-oben:10px; border-oben:1px solid #1e3a5f;">
          <label style="display:flex; align-items:Mitte; justify-content:space-between; cursor:pointer;">
            <div>
              <div style="font-size:14px; font-weight:600;">🎙️ Pre-Match Kommentar</div>
              <div style="font-size:11px; color:#8899aa;">KI kommentiert die Rivaleität beim Einlauf</div>
            </div>
            <input type="checkbox" v-model="config.rivalry.showPreMatchComment"
              style="width:18px; height:18px; accent-color:#E8002D; cursor:pointer;" />
          </label>
          <label style="display:flex; align-items:Mitte; justify-content:space-between; cursor:pointer;">
            <div>
              <div style="font-size:14px; font-weight:600;">🏆 Wanderpokal</div>
              <div style="font-size:11px; color:#8899aa;">Trophäe wechselt bei jedem Sieg den Besitzer</div>
            </div>
            <input type="checkbox" v-model="config.rivalry.showTrophy"
              style="width:18px; height:18px; accent-color:#E8002D; cursor:pointer;" />
          </label>

          <!-- Rivaleitäten-Liste -->
          <div style="margin-oben:8px;">
            <div style="font-size:12px; color:#F5C842; letter-spacing:1px; text-transform:uppercase; margin-unten:8px;">
              Deine Rivaleitäten
            </div>

            <div v-if="isLoadingRivaleries" style="font-size:13px; color:#556677; text-align:Mitte; padding:12px;">
              ⏳ Lade Rivaleitäten...
            </div>

            <div v-else-if="rivalries.length === 0"
              style="font-size:13px; color:#556677; text-align:Mitte; padding:12px; border:1px dashed #1e3a5f; border-radius:4px;">
              Neinch keine Rivaleitäten – spiele mehr Matches gegen denselben Gegner!
            </div>

            <div v-else style="display:flex; flex-direction:column; gap:8px;">
              <div v-for="r in rivalries" :key="r.opponentId"
                style="background:#0D1B2A; border-radius:4px; padding:10px 12px; border:1px solid #1e3a5f;"
                :style="{ borderColor: r.isNemesis ? '#E8002D' : '#1e3a5f' }">
                <div style="display:flex; align-items:Mitte; justify-content:space-between; margin-unten:6px;">
                  <div style="display:flex; align-items:Mitte; gap:8px;">
                    <span v-if="r.isNemesis" style="font-size:14px;">⚔️</span>
                    <span v-else style="font-size:14px;">👤</span>
                    <div>
                      <div style="font-size:14px; font-weight:700;">{{ r.opponentName }}</div>
                      <div v-if="r.isNemesis" style="font-size:10px; color:#E8002D; font-weight:700; letter-spacing:1px;">ERZRIVALE</div>
                    </div>
                  </div>
                  <div style="text-align:rechts;">
                    <div style="font-size:16px; font-weight:700;">
                      <span style="color:#00C853;">{{ r.wins }}</span>
                      <span style="color:#556677;"> : </span>
                      <span style="color:#E8002D;">{{ r.losses }}</span>
                    </div>
                    <div style="font-size:10px; color:#8899aa;">{{ getWinRate(r) }}% Siegquote</div>
                  </div>
                </div>
                <!-- Fortschrittsbalken -->
                <div style="background:#1e3a5f; border-radius:2px; height:4px; overflow:hidden;">
                  <div :style="{ width: getWinRate(r) + '%', background: getWinRate(r) >= 50 ? '#00C853' : '#E8002D', height:'100%', transition:'width 0.5s' }"></div>
                </div>
                <div v-if="getStreakLabel(r.streak)" style="font-size:11px; color:#F5C842; margin-oben:6px;">
                  {{ getStreakLabel(r.streak) }}
                </div>
                <div v-if="r.trophyHolder" style="font-size:11px; color:#F5C842; margin-oben:4px;">
                  🏆 Trophäe bei: {{ r.trophyHolder === 'me' ? 'Dir' : r.opponentName }}
                </div>
              </div>
            </div>

            <!-- Zurücksetzen Button -->
            <div v-if="rivalries.length > 0" style="margin-oben:10px;">
              <button v-if="!showClearBestätigen" @click="showClearBestätigen = true"
                style="background:transparent; color:#E8002D; border:1px solid #E8002D; padding:6px 14px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase;">
                🗑️ Allee Rivaleitäten zurücksetzen
              </button>
              <div v-else style="display:flex; gap:8px; align-items:Mitte;">
                <span style="font-size:12px; color:#E8002D;">Wirklich löschen?</span>
                <button @click="handleClearRivaleries"
                  style="background:#E8002D; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:700;">
                  JA
                </button>
                <button @click="showClearBestätigen = false"
                  style="background:#1e3a5f; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:700;">
                  NEIN
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ─── HANDICAP ──────────────────────────────────────────────────── -->
      <div style="background:#0a1520; border-radius:6px; padding:16px; border:1px solid #1e3a5f;">
        <div style="display:flex; align-items:Mitte; justify-content:space-between; margin-unten:12px;">
          <div>
            <div style="font-size:16px; font-weight:700; color:#F5C842;">⚖️ Dynamisches Handicap</div>
            <div style="font-size:12px; color:#8899aa; margin-oben:2px;">Gleicht Stärkeunterschiede automatisch aus</div>
          </div>
          <input type="checkbox" v-model="config.handicap.enabled"
            style="width:22px; height:22px; accent-color:#E8002D; cursor:pointer;" />
        </div>

        <div v-if="config.handicap.enabled" style="display:flex; flex-direction:column; gap:10px; padding-oben:10px; border-oben:1px solid #1e3a5f;">

          <!-- Handicap-Typ -->
          <div>
            <div style="font-size:12px; color:#8899aa; letter-spacing:1px; text-transform:uppercase; margin-unten:8px;">Handicap-Typ</div>
            <div style="display:flex; flex-direction:column; gap:6px;">
              <label v-for="opt in [
                { value:'auto', label:'🤖 Automatisch', desc:'Berechnet das beste Handicap basierend auf Durchschnitts' },
                { value:'points', label:'🎯 Nur Punkte-Handicap', desc:'Stärkerer Spieler startet mit mehr Punkten' },
                { value:'legs', label:'🏆 Nur Leg-Handicap', desc:'Stärkerer Spieler muss mehr Legs gewinnen' },
                { value:'off', label:'❌ Kein Handicap', desc:'Beide Spieler starten gleich (manuell deaktiviert)' },
              ]" :key="opt.value"
                style="display:flex; align-items:Mitte; gap:10px; padding:8px 10px; border-radius:4px; cursor:pointer;"
                :style="{ background: config.handicap.type === opt.value ? '#1a0a10' : '#0D1B2A', border: config.handicap.type === opt.value ? '1px solid #E8002D' : '1px solid #1e3a5f' }">
                <input type="radio" :value="opt.value" v-model="config.handicap.type"
                  style="width:16px; height:16px; accent-color:#E8002D; cursor:pointer; flex-shrink:0;" />
                <div>
                  <div style="font-size:13px; font-weight:700;">{{ opt.label }}</div>
                  <div style="font-size:11px; color:#8899aa;">{{ opt.desc }}</div>
                </div>
              </label>
            </div>
          </div>

          <label style="display:flex; align-items:Mitte; justify-content:space-between; cursor:pointer;">
            <div>
              <div style="font-size:14px; font-weight:600;">📢 Handicap-Banner anzeigen</div>
              <div style="font-size:11px; color:#8899aa;">Zeigt das aktive Handicap beim Match-Start an</div>
            </div>
            <input type="checkbox" v-model="config.handicap.showBanner"
              style="width:18px; height:18px; accent-color:#E8002D; cursor:pointer;" />
          </label>

          <!-- Info-Box -->
          <div style="background:#0D1B2A; border-links:3px solid #F5C842; padding:10px 12px; border-radius:0 4px 4px 0; font-size:12px; color:#8899aa; line-height:1.6;">
            <strong style="color:#F5C842;">ℹ️ Wie funktioniert das?</strong><br/>
            Die Erweiterung berechnet auf Basis der gespeicherten Durchschnitts beider Spieler automatisch ein faires Handicap. Bei einer Differenz von weniger als 8 Punkten wird kein Handicap angewendet. Ab 8 Punkten Differenz startet der stärkere Spieler mit mehr Punkten, ab 25 Punkten muss er zusätzliche Legs gewinnen.
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
