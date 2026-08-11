<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { AutodartsToolsConfig, updateConfigIfChanged } from "@/utils/storage";
import { getBackendUrl } from "@/utils/backend-url";
import {
  getThrows,
  computeStats,
  aggregateBySegment,
  clearHeatmap,
  countThrows,
  type IHeatmapThrow,
} from "@/utils/heatmap-storage";
import {
  getIdentity,
  updateIdentity,
  resetIdentity,
  fetchLeaderboard,
  fetchSelf,
  type EloLeaderboardEntry,
} from "@/utils/elo-client";

const config = ref(await AutodartsToolsConfig.getValue());
const throws = ref<IHeatmapThrow[]>([]);
const filter = ref<"session" | "match" | "lifetime">("session");
const totalStored = ref(0);
const isLoading = ref(false);

const coachText = ref<string>("");
const coachExercises = ref<string[]>([]);
const coachLoading = ref(false);
const coachError = ref<string>("");

// ── v2.9.75 ELO ──────────────────────────────────────────────────────
const identity = ref(await getIdentity());
const leaderboard = ref<EloLeaderboardEntry[]>([]);
const selfRating = ref<any>(null);
const eloLoading = ref(false);
const eloError = ref("");

async function loadEloState() {
  eloLoading.value = true;
  eloError.value = "";
  try {
    const backend = config.value.elo?.backendUrl || "";
    leaderboard.value = await fetchLeaderboard(backend, 10);
    selfRating.value = await fetchSelf(backend);
  } catch (e) {
    eloError.value = String(e);
  } finally {
    eloLoading.value = false;
  }
}

async function saveDisplayName() {
  const name = (config.value.elo?.displayName || "").trim();
  if (!name) return;
  await updateIdentity({ displayName: name });
  identity.value = await getIdentity();
}

async function regenerateIdentity() {
  if (!confirm("Neue anonyme Identität erstellen? Deine aktuelle ELO wird nicht mehr diesem Gerät zugeordnet.")) return;
  identity.value = await resetIdentity();
  selfRating.value = null;
}

const stats = computed(() => computeStats(throws.value));
const segmentAgg = computed(() => aggregateBySegment(throws.value));

async function refresh() {
  isLoading.value = true;
  try {
    let f: any = {};
    if (filter.value === "session") f.sinceTs = Date.now() - 6 * 60 * 60 * 1000;
    // "match" filter würde eine currentMatchId benötigen (aktuell nicht persistent)
    throws.value = await getThrows({ ...f, limit: 500 });
    totalStored.value = await countThrows();
  } finally {
    isLoading.value = false;
  }
}

async function reset() {
  if (!confirm("Alle gespeicherten Wurf-Daten löschen?")) return;
  await clearHeatmap();
  throws.value = [];
  totalStored.value = 0;
  coachText.value = "";
  coachExercises.value = [];
}

async function runCoach() {
  coachLoading.value = true;
  coachError.value = "";
  coachText.value = "";
  coachExercises.value = [];
  try {
    const url = getBackendUrl(config.value.aiCommentator?.backendUrl);
    const body = {
      language: config.value.aiCommentator?.language ?? "de",
      total_throws: stats.value.total,
      avg_offset_mm: stats.value.avgOffsetMm,
      t20: stats.value.t20Hits,
      t19: stats.value.t19Hits,
      t18: stats.value.t18Hits,
      bull: stats.value.bullHits,
      bullseye: stats.value.bullseyeHits,
      total_doubles: stats.value.totalDoubles,
      double_attempts: stats.value.doubleAttempts,
      double_acc: stats.value.doubleAcc,
      zones: stats.value.scoreZones,
      segments: segmentAgg.value,
    };
    const resp = await browser.runtime.sendMessage({
      type: "FETCH_JSON",
      payload: {
        url: `${url}/api/coach/analyze`,
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    });
    if (!resp?.ok) {
      coachError.value = `Coach-Fehler: ${resp?.status ?? "?"}`;
      return;
    }
    coachText.value = resp.data?.analysis ?? "";
    coachExercises.value = resp.data?.exercises ?? [];
  } catch (e) {
    coachError.value = String(e);
  } finally {
    coachLoading.value = false;
  }
}

// Dartboard-SVG-Konstanten (Radien in mm laut Standard)
const R = { db: 6.35, bull: 15.9, tripleIn: 99, tripleOut: 107, doubleIn: 162, doubleOut: 170 };
const VIEWBOX = 400; // px
const SCALE = VIEWBOX / (2 * R.doubleOut + 20);
function toCanvas(x: number, y: number): { cx: number; cy: number } {
  return { cx: VIEWBOX / 2 + x * SCALE, cy: VIEWBOX / 2 + y * SCALE };
}

// Farbverlauf: Kalt=blau, Warm=gelb, Heiß=rot je nach Punkte
function throwColor(t: IHeatmapThrow): string {
  if (t.points === 0) return "#3a5a8a";
  if (t.multiplier === 3) return "#E8002D";
  if (t.multiplier === 2) return "#F5C842";
  if (t.points >= 20) return "#F5A742";
  return "#8899aa";
}

onMounted(async () => {
  await refresh();
  await loadEloState();
});
</script>

<template>
  <div data-testid="precision-map-panel"
    style="font-family: 'Barlow Condensed', sans-serif; color:#e8eaf0; background:#0D1B2A;">
    <!-- Header -->
    <div style="display:flex; align-items:center; gap:10px; padding:16px 20px 12px; border-bottom:2px solid #E8002D;">
      <span style="font-size:22px;">🎯</span>
      <span style="font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#F5C842;">
        Precision Map &amp; KI-Coach
      </span>
    </div>

    <div style="padding:16px; display:flex; flex-direction:column; gap:16px;">
      <!-- ── v2.9.75: Globaler ELO-Ladder ──────────────────────────────── -->
      <div data-testid="elo-panel"
        style="background:linear-gradient(135deg,#0d1e10 0%,#0a1520 100%); border-radius:8px; padding:16px; border:2px solid #00C853;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
          <span style="font-size:24px;">🌍</span>
          <div style="flex:1;">
            <div style="font-size:15px; font-weight:800; color:#00C853; letter-spacing:1px; text-transform:uppercase;">
              Globaler ELO-Ladder
            </div>
            <div style="font-size:12px; color:#8899aa; margin-top:2px;">
              Vollständig anonym · UUID lokal generiert · Nur Anzeigename &amp; ELO werden übertragen.
            </div>
          </div>
          <input data-testid="elo-submit-toggle" type="checkbox"
            v-model="config.elo.submitEnabled"
            @change="updateConfigIfChanged({}, config, 'elo')"
            style="width:24px; height:24px; accent-color:#00C853; cursor:pointer;" />
        </div>

        <!-- Eigenes Rating -->
        <div v-if="selfRating" data-testid="elo-self"
          style="display:flex; align-items:center; gap:16px; padding:12px 14px; background:#0D1B2A; border-radius:6px; margin-bottom:12px;">
          <div style="flex:1;">
            <div style="font-size:11px; color:#8899aa; letter-spacing:1px; text-transform:uppercase;">Dein Rating</div>
            <div style="font-size:32px; font-weight:900; color:#00C853;">
              {{ selfRating.rating }} <span style="font-size:16px; color:#8899aa;">· Rang #{{ selfRating.rank }}</span>
            </div>
            <div style="font-size:12px; color:#8899aa; margin-top:2px;">
              {{ selfRating.matches }} Matches · {{ selfRating.wins }} Siege · {{ selfRating.losses }} Niederlagen
              <span v-if="selfRating.total_180"> · 180er: {{ selfRating.total_180 }}</span>
              <span v-if="selfRating.best_finish"> · Best-Finish: {{ selfRating.best_finish }}</span>
            </div>
          </div>
        </div>
        <div v-else data-testid="elo-not-ranked"
          style="padding:10px 14px; background:#0D1B2A; border-left:3px solid #F5C842; border-radius:0 4px 4px 0; font-size:12px; color:#c8d4e0; margin-bottom:12px;">
          📊 Noch kein Match gewertet. Spiele ein Match zu Ende, damit deine ELO gestartet wird.
        </div>

        <!-- Anzeigename -->
        <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
          <input v-model="config.elo.displayName" data-testid="elo-display-name"
            :placeholder="identity.displayName"
            maxlength="24"
            @change="updateConfigIfChanged({}, config, 'elo')"
            @blur="saveDisplayName"
            style="flex:1; min-width:200px; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:8px 12px; border-radius:4px; font-size:13px;" />
          <button @click="loadEloState" data-testid="elo-refresh"
            style="padding:8px 14px; background:#00C853; color:#0d1e10; border:none; border-radius:4px; cursor:pointer; font-size:11px; font-weight:800; letter-spacing:1px; text-transform:uppercase;">
            🔄 Ladder
          </button>
          <button @click="regenerateIdentity" data-testid="elo-reset-id"
            style="padding:8px 12px; background:transparent; color:#E8002D; border:1px solid #E8002D; border-radius:4px; cursor:pointer; font-size:11px;">
            ⚠️ Neue ID
          </button>
        </div>

        <!-- Top-10 -->
        <div v-if="leaderboard.length" data-testid="elo-leaderboard"
          style="background:#0D1B2A; border:1px solid #1e3a5f; border-radius:4px; overflow:hidden;">
          <div style="display:grid; grid-template-columns:50px 1fr 90px 60px 60px; padding:8px 12px; font-size:10px; color:#8899aa; letter-spacing:1px; text-transform:uppercase; border-bottom:1px solid #1e3a5f;">
            <div>Rang</div><div>Spieler</div><div style="text-align:right;">Rating</div><div style="text-align:right;">Siege</div><div style="text-align:right;">180</div>
          </div>
          <div v-for="entry in leaderboard" :key="entry.rank"
            :style="{
              display:'grid', gridTemplateColumns:'50px 1fr 90px 60px 60px',
              padding:'8px 12px', fontSize:'13px', alignItems:'center',
              background: entry.rank === 1 ? 'rgba(0,200,83,0.08)' : entry.rank <= 3 ? 'rgba(245,200,66,0.05)' : 'transparent',
              borderBottom:'1px solid #0a1520',
            }">
            <div style="font-weight:800; color:#F5C842;">#{{ entry.rank }}</div>
            <div style="font-weight:600;">{{ entry.display_name }}</div>
            <div style="text-align:right; font-weight:800; color:#00C853;">{{ entry.rating }}</div>
            <div style="text-align:right; color:#8899aa;">{{ entry.wins }}/{{ entry.matches }}</div>
            <div style="text-align:right; color:#8899aa;">{{ entry.total_180 }}</div>
          </div>
        </div>
        <div v-else-if="!eloLoading" style="font-size:12px; color:#556677; text-align:center; padding:12px;">
          Noch keine Einträge in der globalen Ladder.
        </div>
      </div>

      <!-- Toggles -->
      <div data-testid="precision-toggle-row"
        style="background:#0a1520; border-radius:6px; padding:14px 16px; border:1px solid #1e3a5f; display:flex; flex-direction:column; gap:10px;">
        <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div>
            <div style="font-size:15px; font-weight:700;">Wurf-Koordinaten aufzeichnen</div>
            <div style="font-size:12px; color:#8899aa; margin-top:2px;">
              Speichert jeden geworfenen Dart lokal (IndexedDB) – nichts verlässt dein Gerät.
            </div>
          </div>
          <input data-testid="precision-enabled-toggle" type="checkbox"
            v-model="config.precisionMap.enabled"
            @change="updateConfigIfChanged({}, config, 'precisionMap')"
            style="width:22px; height:22px; accent-color:#E8002D; cursor:pointer;" />
        </label>
        <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div>
            <div style="font-size:14px; font-weight:600;">Karte nach Match-Ende einblenden</div>
            <div style="font-size:11px; color:#8899aa;">Automatischer Overlay-Report mit Heatmap + Coach-Empfehlung.</div>
          </div>
          <input type="checkbox" v-model="config.precisionMap.autoShowAfterMatch"
            @change="updateConfigIfChanged({}, config, 'precisionMap')"
            style="width:20px; height:20px; accent-color:#E8002D; cursor:pointer;" />
        </label>
        <label style="display:flex; align-items:center; justify-content:space-between; gap:12px;">
          <div>
            <div style="font-size:14px; font-weight:600;">Post-Match Share-Card generieren</div>
            <div style="font-size:11px; color:#8899aa;">1080×1920 Bild zum Teilen auf Discord/Twitter/WhatsApp.</div>
          </div>
          <input type="checkbox" v-model="config.precisionMap.shareCardEnabled"
            @change="updateConfigIfChanged({}, config, 'precisionMap')"
            style="width:20px; height:20px; accent-color:#E8002D; cursor:pointer;" />
        </label>
      </div>

      <!-- Filter -->
      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <label v-for="opt in ['session','match','lifetime']" :key="opt"
          data-testid="precision-filter-btn"
          :style="{
            padding:'8px 14px', cursor:'pointer', borderRadius:'4px',
            fontSize:'12px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'1px',
            border: filter === opt ? '2px solid #E8002D' : '1px solid #1e3a5f',
            background: filter === opt ? '#E8002D' : '#0D1B2A',
            color: filter === opt ? '#fff' : '#8899aa',
          }">
          <input type="radio" :value="opt" v-model="filter" @change="refresh" style="display:none;" />
          {{ opt === 'session' ? '⏱️ Session (6h)' : opt === 'match' ? '🎯 Match' : '📚 Lifetime' }}
        </label>
        <button data-testid="precision-refresh" @click="refresh"
          style="margin-left:auto; padding:8px 14px; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; border-radius:4px; cursor:pointer; font-size:12px;">
          🔄 Aktualisieren
        </button>
      </div>

      <!-- Statistik + Heatmap -->
      <div style="display:flex; gap:16px; flex-wrap:wrap;">
        <!-- Board SVG -->
        <div style="flex:1; min-width:320px; background:#0a1520; border-radius:6px; padding:16px; border:1px solid #1e3a5f;">
          <div style="font-size:12px; color:#8899aa; letter-spacing:1px; text-transform:uppercase; margin-bottom:10px;">
            🎯 {{ throws.length }} Würfe · Ø-Streuung T20: {{ stats.avgOffsetMm }} mm
          </div>
          <svg :viewBox="`0 0 ${VIEWBOX} ${VIEWBOX}`" style="width:100%; max-width:400px; display:block; margin:0 auto;">
            <!-- Double Ring -->
            <circle :cx="VIEWBOX/2" :cy="VIEWBOX/2" :r="R.doubleOut*SCALE" fill="#111" />
            <circle :cx="VIEWBOX/2" :cy="VIEWBOX/2" :r="R.doubleIn*SCALE" fill="#2a2a2a" />
            <!-- Triple Ring -->
            <circle :cx="VIEWBOX/2" :cy="VIEWBOX/2" :r="R.tripleOut*SCALE" fill="#1e3a5f" />
            <circle :cx="VIEWBOX/2" :cy="VIEWBOX/2" :r="R.tripleIn*SCALE" fill="#2a2a2a" />
            <!-- Bull -->
            <circle :cx="VIEWBOX/2" :cy="VIEWBOX/2" :r="R.bull*SCALE" fill="#00C853" />
            <circle :cx="VIEWBOX/2" :cy="VIEWBOX/2" :r="R.db*SCALE" fill="#E8002D" />
            <!-- Segment-Linien (20 Sektoren) -->
            <g v-for="i in 20" :key="i" stroke="#000" stroke-width="0.5" opacity="0.4">
              <line
                :x1="VIEWBOX/2" :y1="VIEWBOX/2"
                :x2="VIEWBOX/2 + Math.cos((i-1) * Math.PI/10 - Math.PI/2 - Math.PI/20) * R.doubleOut * SCALE"
                :y2="VIEWBOX/2 + Math.sin((i-1) * Math.PI/10 - Math.PI/2 - Math.PI/20) * R.doubleOut * SCALE"
              />
            </g>
            <!-- Wurf-Marker -->
            <g v-for="(t, idx) in throws" :key="t.id + idx">
              <circle
                :cx="toCanvas(t.x, t.y).cx"
                :cy="toCanvas(t.x, t.y).cy"
                :r="4"
                :fill="throwColor(t)"
                opacity="0.75"
              />
            </g>
          </svg>
        </div>

        <!-- Statistik-Panel -->
        <div data-testid="precision-stats"
          style="flex:1; min-width:240px; background:#0a1520; border-radius:6px; padding:16px; border:1px solid #1e3a5f;">
          <div style="font-size:12px; color:#8899aa; letter-spacing:1px; text-transform:uppercase; margin-bottom:12px;">
            📊 Trefferverteilung
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px 20px; font-size:13px;">
            <div><span style="color:#8899aa;">Triple 20:</span> <b>{{ stats.t20Hits }}</b></div>
            <div><span style="color:#8899aa;">Triple 19:</span> <b>{{ stats.t19Hits }}</b></div>
            <div><span style="color:#8899aa;">Triple 18:</span> <b>{{ stats.t18Hits }}</b></div>
            <div><span style="color:#8899aa;">Bull (25):</span> <b>{{ stats.bullHits }}</b></div>
            <div><span style="color:#8899aa;">Bullseye (50):</span> <b>{{ stats.bullseyeHits }}</b></div>
            <div><span style="color:#8899aa;">Doppel-Treffer:</span> <b>{{ stats.totalDoubles }}</b></div>
          </div>
          <div style="margin-top:16px; font-size:12px; color:#8899aa;">Zonen-Verteilung:</div>
          <div style="display:flex; gap:6px; margin-top:6px;">
            <div v-for="z in [
              { k: 'top', label: 'Oben', v: stats.scoreZones.top, c: '#E8002D' },
              { k: 'center', label: 'Bull', v: stats.scoreZones.center, c: '#00C853' },
              { k: 'bottomLeft', label: 'U-L', v: stats.scoreZones.bottomLeft, c: '#F5C842' },
              { k: 'bottomRight', label: 'U-R', v: stats.scoreZones.bottomRight, c: '#F5A742' },
              { k: 'misses', label: 'Miss', v: stats.scoreZones.misses, c: '#3a5a8a' },
            ]" :key="z.k"
              :style="{ flex:1, textAlign:'center', padding:'8px 4px', background:'#0D1B2A', border:'1px solid '+z.c, borderRadius:'4px' }">
              <div style="font-size:10px; color:#8899aa; letter-spacing:1px; text-transform:uppercase;">{{ z.label }}</div>
              <div style="font-size:16px; font-weight:800;" :style="{ color: z.c }">{{ z.v }}</div>
            </div>
          </div>
          <button data-testid="precision-reset" @click="reset"
            style="margin-top:16px; width:100%; padding:8px 14px; background:transparent; color:#E8002D; border:1px solid #E8002D; border-radius:4px; cursor:pointer; font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase;">
            🗑️ Alle Wurf-Daten löschen ({{ totalStored }} Einträge)
          </button>
        </div>
      </div>

      <!-- KI-Coach -->
      <div style="background:linear-gradient(135deg,#1a0a10 0%,#0a1520 100%); border-radius:8px; padding:16px; border:2px solid #E8002D;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
          <span style="font-size:22px;">🧠</span>
          <div style="flex:1;">
            <div style="font-size:15px; font-weight:800; color:#F5C842; letter-spacing:1px; text-transform:uppercase;">
              KI-Coach (Claude Sonnet 4.5)
            </div>
            <div style="font-size:12px; color:#8899aa; margin-top:2px;">
              Analysiert deine Wurfmuster und empfiehlt gezielte PDC-Übungen.
            </div>
          </div>
          <button data-testid="coach-run-btn" @click="runCoach" :disabled="coachLoading || throws.length < 3"
            :style="{
              padding:'10px 18px',
              background: (coachLoading || throws.length < 3) ? '#333' : '#E8002D',
              color:'#fff', border:'none', borderRadius:'4px', cursor: 'pointer',
              fontSize:'12px', fontWeight:'800', letterSpacing:'1px', textTransform:'uppercase',
              opacity: (coachLoading || throws.length < 3) ? 0.5 : 1,
            }">
            {{ coachLoading ? '⏳ Analysiert…' : '🚀 Analysieren' }}
          </button>
        </div>
        <div v-if="throws.length < 3" style="font-size:12px; color:#8899aa;">
          ⓘ Mindestens 3 Würfe nötig, damit der Coach etwas analysieren kann.
        </div>
        <div v-if="coachError" data-testid="coach-error"
          style="padding:10px 14px; background:#330010; border:1px solid #E8002D; border-radius:4px; color:#E8002D; font-size:13px;">
          {{ coachError }}
        </div>
        <div v-if="coachText" data-testid="coach-text"
          style="padding:12px 14px; background:#0D1B2A; border-left:3px solid #F5C842; border-radius:0 4px 4px 0; font-size:13px; line-height:1.7; white-space:pre-wrap;">
          {{ coachText }}
        </div>
        <div v-if="coachExercises.length" data-testid="coach-exercises"
          style="margin-top:12px; display:flex; flex-direction:column; gap:6px;">
          <div style="font-size:11px; color:#F5C842; letter-spacing:1px; text-transform:uppercase; font-weight:800;">
            🎯 Empfohlene PDC-Übungen:
          </div>
          <div v-for="(ex, i) in coachExercises" :key="i"
            style="padding:8px 12px; background:#0D1B2A; border:1px solid #1e3a5f; border-radius:4px; font-size:13px;">
            {{ i + 1 }}. {{ ex }}
          </div>
        </div>
      </div>

    </div>
  </div>
</template>
