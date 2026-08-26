<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { AutodartsToolsConfig, updateConfigIfChanged } from "@/utils/storage";
import { joinLiga, createLiga, generateShareLink, calculateTable, calculateHeadToHead, type LigaTableEntry, type HeadToHead } from "@/utils/liga-api";

const config = ref(await AutodartsToolsConfig.getValue());
const activeTab = ref<'tabelle' | 'h2h' | 'einstellungen'>('tabelle');
const tableData = ref<LigaTableEntry[]>([]);
const h2hData = ref<HeadToHead | null>(null);
const h2hSpieler1 = ref('');
const h2hSpieler2 = ref('');
const isLoading = ref(false);
const connectionStatus = ref<'idle' | 'ok' | 'error'>('idle');
const connectionMsg = ref('');
const allSpielers = ref<string[]>([]);
const newLigaName = ref('');
const isCreating = ref(false);
const linkCopied = ref(false);
const whatsappCopied = ref(false);

// Einladungslink berechnen
const shareLink = computed(() => {
  const code = config.value.liga?.shareCode;
  const name = config.value.liga?.name;
  if (!code) return '';
  return generateShareLink(code, name || 'Darts-Liga');
});

// WhatsApp-Nachricht
const whatsappMessage = computed(() => {
  if (!shareLink.value) return '';
  const name = config.value.liga?.name || 'Darts-Liga';
  return `Hallo! Ich lade dich ein, unserer Darts-Liga "${name}" beizutreten. Einfach auf den Link klicken und du bist dabei – kein Eintragen nötig! 🎯\n\n${shareLink.value}`;
});

const whatsappUrl = computed(() => {
  if (!whatsappMessage.value) return '';
  return `https://wa.me/?text=${encodeURIComponent(whatsappMessage.value)}`;
});

watch(config, async (newConfig) => {
  const currentConfig = await AutodartsToolsConfig.getValue();
  await updateConfigIfChanged(currentConfig, newConfig, "liga");
}, { deep: true });

onMounted(() => {
  if (config.value.liga?.enabled && config.value.liga?.shareCode) {
    loadTable();
  }
});

function getClient() {
  const code = config.value.liga?.shareCode;
  if (!code) throw new Error('Kein Share-Code konfiguriert');
  return joinLiga(code);
}

async function loadTable() {
  if (!config.value.liga?.shareCode) return;
  isLoading.value = true;
  try {
    const client = getClient();
    if (!client) return;
    const data = await client.load();
    tableData.value = calculateTable(data.matches);
    allSpielers.value = tableData.value.map(e => e.player);
  } catch (e: any) {
    connectionMsg.value = e.message;
  } finally {
    isLoading.value = false;
  }
}

async function testVerbindung() {
  isLoading.value = true;
  connectionStatus.value = 'idle';
  try {
    const client = getClient();
    if (!client) {
      connectionStatus.value = 'error';
      connectionMsg.value = 'Ungültiger Share-Code';
      return;
    }
    const result = await client.testConnection();
    connectionStatus.value = result.ok ? 'ok' : 'error';
    connectionMsg.value = result.ok ? '✅ Verbindung erfolgreich!' : (result.error || 'error');
    if (result.ok) loadTable();
  } catch (e: any) {
    connectionStatus.value = 'error';
    connectionMsg.value = e.message;
  } finally {
    isLoading.value = false;
  }
}

async function handleCreateLiga() {
  if (!newLigaName.value.trim()) return;
  isCreating.value = true;
  try {
    const result = await createLiga(newLigaName.value.trim());
    config.value.liga = {
      ...config.value.liga,
      enabled: true,
      name: newLigaName.value.trim(),
      shareCode: result.shareCode,
      autoSubmit: true,
    };
    newLigaName.value = '';
    connectionStatus.value = 'ok';
    connectionMsg.value = '✅ Liga erstellt! Teile den Link mit deinen Freunden.';
    activeTab.value = 'einstellungen';
  } catch (e: any) {
    connectionStatus.value = 'error';
    connectionMsg.value = e.message;
  } finally {
    isCreating.value = false;
  }
}

async function copyLink() {
  if (!shareLink.value) return;
  await navigator.clipboard.writeText(shareLink.value);
  linkCopied.value = true;
  setTimeout(() => { linkCopied.value = false; }, 2500);
}

async function copyWhatsApp() {
  if (!whatsappMessage.value) return;
  await navigator.clipboard.writeText(whatsappMessage.value);
  whatsappCopied.value = true;
  setTimeout(() => { whatsappCopied.value = false; }, 2500);
}

async function loadH2H() {
  if (!h2hSpieler1.value || !h2hSpieler2.value) return;
  isLoading.value = true;
  try {
    const client = getClient();
    if (!client) return;
    const data = await client.load();
    h2hData.value = calculateHeadToHead(data.matches, h2hSpieler1.value, h2hSpieler2.value);
  } finally {
    isLoading.value = false;
  }
}

function getRangColors(rank: number): string {
  if (rank === 1) return '#F5C842';
  if (rank === 2) return '#c0ccd8';
  if (rank === 3) return '#cd7f32';
  return '#556677';
}
</script>

<template>
  <div class="liga-root" style="font-family: 'Barlow Condensed', 'Barlow', sans-serif; color: #e8eaf0; background: #0D1B2A;">

    <!-- Header -->
    <div style="display:flex; align-items:center; justify-content:space-between; padding: 16px 20px 8px; border-bottom: 2px solid #E8002D;">
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:22px;">🏆</span>
        <span style="font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#F5C842;">
          {{ config.liga?.name || 'Darts-Liga' }}
        </span>
        <span v-if="config.liga?.enabled" style="background:#00C853; color:#fff; font-size:11px; padding:2px 8px; border-radius:3px; font-weight:700; letter-spacing:1px;">AKTIV</span>
        <span v-else style="background:#556677; color:#fff; font-size:11px; padding:2px 8px; border-radius:3px; font-weight:700; letter-spacing:1px;">INAKTIV</span>
      </div>
      <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
        <span style="font-size:13px; color:#8899aa;">Liga aktiv</span>
        <input type="checkbox" v-model="config.liga.enabled" style="width:18px; height:18px; accent-color:#E8002D;" />
      </label>
    </div>

    <!-- Tabs -->
    <div style="display:flex; border-bottom:1px solid #1e3a5f; background:#0a1520;">
      <button v-for="tab in [['tabelle','📊 Tabelle'],['h2h','⚔️ H2H'],['einstellungen','⚙️ Einstellungen']]"
        :key="tab[0]"
        @click="activeTab = tab[0] as any"
        :style="{
          flex:1, padding:'12px 8px', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:700,
          letterSpacing:'1px', textTransform:'uppercase', transition:'all .2s',
          background: activeTab === tab[0] ? '#E8002D' : 'transparent',
          color: activeTab === tab[0] ? '#fff' : '#8899aa',
          borderBottom: activeTab === tab[0] ? '3px solid #F5C842' : '3px solid transparent',
        }">
        {{ tab[1] }}
      </button>
    </div>

    <!-- TAB: TABELLE -->
    <div v-if="activeTab === 'tabelle'" style="padding:16px;">
      <div v-if="!config.liga?.shareCode" style="text-align: center; padding:32px 16px;">
        <div style="font-size:40px; margin-bottom:12px;">🎯</div>
        <div style="font-size:16px; color:#8899aa; margin-bottom:20px;">Neinch keine Liga verbunden.</div>
        <div style="font-size:13px; color:#556677;">Gehe zu <strong style="color:#F5C842;">Einstellungen</strong>, um eine Liga zu erstellen oder beizutreten.</div>
      </div>
      <div v-else>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-size:13px; color:#8899aa;">{{ tableData.length }} Spieler</span>
          <button @click="loadTable" :disabled="isLoading"
            style="background:#1e3a5f; color:#e8eaf0; border:none; padding:6px 14px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:700; letter-spacing:1px;">
            {{ isLoading ? '...' : '↻ AKTUALISIEREN' }}
          </button>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:15px;">
          <thead>
            <tr style="background:#0a1520; color:#8899aa; font-size:11px; letter-spacing:1px; text-transform:uppercase;">
              <th style="padding:8px 6px; text-align: center; width:36px;">#</th>
              <th style="padding:8px 6px; text-align: left;">Spieler</th>
              <th style="padding:8px 6px; text-align: center;">Sp</th>
              <th style="padding:8px 6px; text-align: center;">S</th>
              <th style="padding:8px 6px; text-align: center;">N</th>
              <th style="padding:8px 6px; text-align: center; color:#F5C842;">Avg</th>
              <th style="padding:8px 6px; text-align: center;">Pkt</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(entry, i) in tableData" :key="entry.player"
              :style="{ background: i % 2 === 0 ? '#0a1520' : '#0D1B2A', borderLeft: i === 0 ? '3px solid #F5C842' : i === 1 ? '3px solid #c0ccd8' : i === 2 ? '3px solid #cd7f32' : '3px solid transparent' }">
              <td style="padding:10px 6px; text-align: center; font-weight:700;" :style="{ color: getRangColors(i+1) }">{{ i+1 }}</td>
              <td style="padding:10px 6px; font-weight:600;">{{ entry.player }}</td>
              <td style="padding:10px 6px; text-align: center; color:#8899aa;">{{ entry.played }}</td>
              <td style="padding:10px 6px; text-align: center; color:#00C853; font-weight:700;">{{ entry.wins }}</td>
              <td style="padding:10px 6px; text-align: center; color:#E8002D;">{{ entry.losses }}</td>
              <td style="padding:10px 6px; text-align: center; color:#F5C842; font-weight:700;">{{ entry.avgAverage?.toFixed(1) || '-' }}</td>
              <td style="padding:10px 6px; text-align: center; font-weight:700; font-size:16px;">{{ entry.points }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB: HEAD-TO-HEAD -->
    <div v-if="activeTab === 'h2h'" style="padding:16px;">
      <div style="display:flex; gap:10px; margin-bottom:14px; align-items:center;">
        <select v-model="h2hSpieler1" style="flex:1; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:10px; border-radius:4px; font-size:14px;">
          <option value="">Spieler 1 wählen</option>
          <option v-for="p in allSpielers" :key="p" :value="p">{{ p }}</option>
        </select>
        <span style="color:#E8002D; font-weight:700; font-size:18px;">VS</span>
        <select v-model="h2hSpieler2" style="flex:1; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:10px; border-radius:4px; font-size:14px;">
          <option value="">Spieler 2 wählen</option>
          <option v-for="p in allSpielers" :key="p" :value="p">{{ p }}</option>
        </select>
        <button @click="loadH2H" :disabled="!h2hSpieler1 || !h2hSpieler2 || isLoading"
          style="background:#E8002D; color:#fff; border:none; padding:10px 16px; border-radius:4px; cursor:pointer; font-weight:700; font-size:13px; letter-spacing:1px;">
          {{ isLoading ? '...' : 'ANZEIGEN' }}
        </button>
      </div>
      <div v-if="h2hData" style="background:#0a1520; border-radius:6px; padding:16px;">
        <div style="display:flex; justify-content:space-around; text-align: center; margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid #1e3a5f;">
          <div>
            <div style="font-size:32px; font-weight:700; color:#F5C842;">{{ h2hData.wins1 }}</div>
            <div style="font-size:12px; color:#8899aa; letter-spacing:1px;">SIEGE</div>
            <div style="font-size:14px; font-weight:600; margin-top:4px;">{{ h2hData.player1 }}</div>
          </div>
          <div style="display:flex; flex-direction:column; justify-content:center; color:#556677; font-size:20px; font-weight:700;">:</div>
          <div>
            <div style="font-size:32px; font-weight:700; color:#F5C842;">{{ h2hData.wins2 }}</div>
            <div style="font-size:12px; color:#8899aa; letter-spacing:1px;">SIEGE</div>
            <div style="font-size:14px; font-weight:600; margin-top:4px;">{{ h2hData.player2 }}</div>
          </div>
        </div>
        <div style="font-size:12px; color:#8899aa; letter-spacing:1px; margin-bottom:8px; text-transform:uppercase;">Letzte Begegnungen</div>
        <div v-for="m in h2hData.matches" :key="m.id" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #1e3a5f; font-size:13px;">
          <span>{{ m.player1 }}</span>
          <span style="font-weight:700; color:#F5C842;">{{ m.score1 }} : {{ m.score2 }}</span>
          <span>{{ m.player2 }}</span>
        </div>
      </div>
    </div>

    <!-- TAB: EINSTELLUNGEN -->
    <div v-if="activeTab === 'einstellungen'" style="padding:16px; display:flex; flex-direction:column; gap:16px;">

      <!-- Liga erstellen -->
      <div v-if="!config.liga?.shareCode" style="background:#0a1520; border-radius:6px; padding:16px; border:1px solid #1e3a5f;">
        <div style="font-size:14px; font-weight:700; color:#F5C842; letter-spacing:1px; margin-bottom:12px; text-transform:uppercase;">🆕 Neue Liga erstellen</div>
        <div style="display:flex; gap:10px;">
          <input v-model="newLigaName" placeholder="Liga-Name (z.B. Keller-Liga 2025)"
            style="flex:1; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:10px 14px; border-radius:4px; font-size:14px;"
            @keyup.enter="handleCreateLiga" />
          <button @click="handleCreateLiga" :disabled="!newLigaName.trim() || isCreating"
            style="background:#E8002D; color:#fff; border:none; padding:10px 18px; border-radius:4px; cursor:pointer; font-weight:700; font-size:13px; letter-spacing:1px; white-space:nowrap;">
            {{ isCreating ? '...' : 'ERSTELLEN' }}
          </button>
        </div>
        <div style="margin-top:12px; padding:10px; background:#0D1B2A; border-radius:4px; border-left:3px solid #1e3a5f;">
          <div style="font-size:12px; color:#8899aa;">Oder bestehender Liga beitreten:</div>
          <div style="display:flex; gap:8px; margin-top:8px;">
            <input v-model="config.liga.shareCode" placeholder="Share-Code einfügen"
              style="flex:1; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:8px 12px; border-radius:4px; font-size:13px;" />
            <button @click="testVerbindung" :disabled="!config.liga?.shareCode || isLoading"
              style="background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:8px 14px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:700;">
              VERBINDEN
            </button>
          </div>
        </div>
      </div>

      <!-- Liga verbunden: Einladungslink -->
      <div v-if="config.liga?.shareCode" style="background:#0a1520; border-radius:6px; padding:16px; border:1px solid #00C853;">
        <div style="font-size:14px; font-weight:700; color:#00C853; letter-spacing:1px; margin-bottom:4px; text-transform:uppercase;">✅ Liga verbunden</div>
        <div style="font-size:12px; color:#8899aa; margin-bottom:14px;">Teile den Einladungslink – Freunde treten mit einem Klick bei!</div>

        <!-- Link anzeigen -->
        <div style="background:#0D1B2A; border:1px solid #1e3a5f; border-radius:4px; padding:10px 12px; font-size:12px; color:#8899aa; word-break:break-all; margin-bottom:10px; font-family:monospace;">
          {{ shareLink }}
        </div>

        <!-- Buttons -->
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <!-- Link kopieren -->
          <button @click="copyLink"
            style="flex:1; min-width:140px; background: linkCopied ? '#00C853' : '#1e3a5f'; color:#fff; border:none; padding:10px 14px; border-radius:4px; cursor:pointer; font-weight:700; font-size:13px; letter-spacing:1px; display:flex; align-items:center; justify-content:center; gap:6px; transition:background .3s;"
            :style="{ background: linkCopied ? '#00C853' : '#1e3a5f' }">
            {{ linkCopied ? '✅ KOPIERT!' : '📋 LINK KOPIEREN' }}
          </button>

          <!-- WhatsApp -->
          <a :href="whatsappUrl" target="_blank"
            style="flex:1; min-width:140px; background:#25D366; color:#fff; border:none; padding:10px 14px; border-radius:4px; cursor:pointer; font-weight:700; font-size:13px; letter-spacing:1px; text-decoration:none; display:flex; align-items:center; justify-content:center; gap:6px;">
            📱 WHATSAPP
          </a>

          <!-- Nachricht kopieren -->
          <button @click="copyWhatsApp"
            style="flex:1; min-width:140px; border:1px solid #1e3a5f; color:#8899aa; background:transparent; padding:10px 14px; border-radius:4px; cursor:pointer; font-weight:700; font-size:12px; letter-spacing:1px;"
            :style="{ color: whatsappCopied ? '#00C853' : '#8899aa' }">
            {{ whatsappCopied ? '✅ KOPIERT!' : '💬 NACHRICHT KOPIEREN' }}
          </button>
        </div>
      </div>

      <!-- Liga-Einstellungen -->
      <div v-if="config.liga?.shareCode" style="background:#0a1520; border-radius:6px; padding:16px; border:1px solid #1e3a5f;">
        <div style="font-size:13px; font-weight:700; color:#F5C842; letter-spacing:1px; margin-bottom:12px; text-transform:uppercase;">⚙️ Einstellungen</div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px;">Auto-Submit nach Match</span>
            <input type="checkbox" v-model="config.liga.autoSubmit" style="width:18px; height:18px; accent-color:#E8002D;" />
          </label>
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px;">Tabellen-Overlay im Match</span>
            <input type="checkbox" v-model="config.liga.showTableOverlay" style="width:18px; height:18px; accent-color:#E8002D;" />
          </label>
          <label style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:14px;">Sortierenierung</span>
            <select v-model="config.liga.rankingMode" style="background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:6px 10px; border-radius:4px; font-size:13px;">
              <option value="wins">Nach Siegen</option>
              <option value="average">Nach Durchschnitt</option>
              <option value="combined">Kombiniert</option>
            </select>
          </label>
        </div>
        <!-- Liga verlassen -->
        <button @click="config.liga.shareCode = ''; config.liga.enabled = false"
          style="margin-top:14px; width:100%; background:transparent; color:#E8002D; border:1px solid #E8002D; padding:8px; border-radius:4px; cursor:pointer; font-size:12px; font-weight:700; letter-spacing:1px;">
          LIGA VERLASSEN
        </button>
      </div>

      <!-- Status-Meldung -->
      <div v-if="connectionMsg"
        :style="{ background: connectionStatus === 'ok' ? '#003320' : '#330010', border: `1px solid ${connectionStatus === 'ok' ? '#00C853' : '#E8002D'}`, borderRadius:'4px', padding:'10px 14px', fontSize:'13px', color: connectionStatus === 'ok' ? '#00C853' : '#E8002D' }">
        {{ connectionMsg }}
      </div>
    </div>
  </div>
</template>
