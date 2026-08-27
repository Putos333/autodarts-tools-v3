<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { AutodartsToolsConfig, updateConfigIfChanged } from "@/utils/storage";
import { TTS_PROVIDERS, testTTSProvider, type TTSProvider } from "@/utils/tts-provider";
import { encryptApiKey, decryptApiKey, deleteAllApiKeys, getStorageLocationInfo } from "@/utils/secure-storage";

const config = ref(await AutodartsToolsConfig.getValue());
const isTestening = ref(false);
const testResult = ref<{ ok: boolean; message: string } | null>(null);
const showApiKey = ref(false);
const showSecurityInfo = ref(false);
const apiKeyPlaintext = ref('');   // Nur im RAM – niemals persistent im Klartext
const keyIsSpeichernd = ref(false);
const isSavingKey = ref(false);
const isDeletingKeys = ref(false);

const storageInfo = getStorageLocationInfo();

// Beim Laden: verschlüsselten Key entschlüsseln für die Anzeige
onMounted(async () => {
  const encrypted = config.value.aiCommentator?.apiKey ?? '';
  if (encrypted && encrypted.length > 30) {
    // Sieht aus wie verschlüsselt (Base64, lang)
    const decrypted = await decryptApiKey(encrypted);
    if (decrypted) {
      apiKeyPlaintext.value = decrypted;
      keyIsSpeichernd.value = true;
    }
  } else if (encrypted) {
    // Alter Klartext-Key (Migration) – direkt anzeigen
    apiKeyPlaintext.value = encrypted;
    keyIsSpeichernd.value = true;
  }
});

watch(config, async (newConfig) => {
  const currentConfig = await AutodartsToolsConfig.getValue();
  await updateConfigIfChanged(currentConfig, newConfig, "aiCommentator");
}, { deep: true });

const selectedProvider = computed({
  get: () => (config.value.aiCommentator?.ttsProvider ?? 'browser') as TTSProvider,
  set: (val: TTSProvider) => {
    if (config.value.aiCommentator) {
      config.value.aiCommentator.ttsProvider = val;
      config.value.aiCommentator.voice = TTS_PROVIDERS[val].voices[0]?.id ?? '';
      testResult.value = null;
      keyIsSpeichernd.value = false;
      apiKeyPlaintext.value = '';
    }
  },
});

const providerInfo = computed(() => TTS_PROVIDERS[selectedProvider.value]);

// API-Key verschlüsselt speichern
async function saveApiKey() {
  if (!apiKeyPlaintext.value.trim()) return;
  isSavingKey.value = true;
  try {
    const encrypted = await encryptApiKey(apiKeyPlaintext.value.trim());
    if (config.value.aiCommentator) {
      config.value.aiCommentator.apiKey = encrypted;
      await updateConfigIfChanged(
        await AutodartsToolsConfig.getValue(),
        config.value,
        "aiCommentator"
      );
      keyIsSpeichernd.value = true;
      testResult.value = { ok: true, message: '✅ API-Key wurde verschlüsselt gespeichert.' };
    }
  } finally {
    isSavingKey.value = false;
  }
}

// Allee Keys löschen
async function clearAlleKeys() {
  isDeletingKeys.value = true;
  try {
    await deleteAllApiKeys();
    if (config.value.aiCommentator) {
      config.value.aiCommentator.apiKey = '';
    }
    apiKeyPlaintext.value = '';
    keyIsSpeichernd.value = false;
    testResult.value = { ok: true, message: '🗑️ Allee API-Keys wurden sicher gelöscht.' };
  } finally {
    isDeletingKeys.value = false;
  }
}

// Verbindung testen (entschlüsselten Key verwenden)
async function runTesten() {
  isTestening.value = true;
  testResult.value = null;
  try {
    const plainKey = apiKeyPlaintext.value.trim() ||
      await decryptApiKey(config.value.aiCommentator?.apiKey ?? '');
    const result = await testTTSProvider({
      provider: selectedProvider.value,
      apiKey: plainKey,
      voice: config.value.aiCommentator?.voice ?? '',
      language: config.value.aiCommentator?.language === 'de' ? 'de-DE' : 'en-GB',
    });
    testResult.value = {
      ok: result.ok,
      message: result.ok
        ? '✅ Verbindung erfolgreich! Du solltest jetzt einen Testenton hören.'
        : `❌ error: ${result.error ?? 'Unbekannter error'}`,
    };
  } finally {
    isTestening.value = false;
  }
}
</script>

<template>
  <div style="font-family: 'Barlow Condensed', 'Barlow', sans-serif; color: #e8eaf0; background: #0D1B2A;">

    <!-- Header -->
    <div style="display:flex; align-items:center; gap:10px; padding: 16px 20px 12px; border-bottom: 2px solid #E8002D;">
      <span style="font-size:22px;">🎙️</span>
      <span style="font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#F5C842;">
        KI-Kommentator & TTS
      </span>
    </div>

    <div style="padding: 16px; display:flex; flex-direction:column; gap:16px;">

      <!-- ─── v2.9.73 – LLM Duo-Kommentator ──────────────────────────────── -->
      <div data-testid="duo-mode-panel"
        style="background:linear-gradient(135deg,#1a0a10 0%,#0a1520 100%); border-radius:8px; padding:16px; border:2px solid #E8002D;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
          <span style="font-size:24px;">🎭</span>
          <div style="flex:1;">
            <div style="font-size:15px; font-weight:800; color:#F5C842; letter-spacing:1px; text-transform:uppercase;">
              Duo-Kommentator (KI-Live)
            </div>
            <div style="font-size:12px; color:#8899aa; margin-top:2px;">
              Zwei KI-Personas kommentieren live: „Der Analytiker" &amp; „Der Entertainer"
            </div>
          </div>
          <input data-testid="duo-mode-toggle" type="checkbox" v-model="config.aiCommentator.duoMode"
            style="width:26px; height:26px; accent-color:#E8002D; cursor:pointer;" />
        </div>

        <div v-if="config.aiCommentator?.duoMode" style="display:flex; flex-direction:column; gap:10px;">
          <!-- Intensitäts-Auswahl -->
          <div>
            <div style="font-size:11px; color:#8899aa; letter-spacing:1px; text-transform:uppercase; margin-bottom:6px;">
              Kommentar-Intensität
            </div>
            <div style="display:flex; gap:6px;">
              <label v-for="opt in ['chill','normal','hype']" :key="opt"
                :style="{
                  flex:1, padding:'8px 10px', textAlign:'center', cursor:'pointer',
                  borderRadius:'4px', fontSize:'12px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'1px',
                  border: config.aiCommentator?.intensity === opt ? '2px solid #E8002D' : '1px solid #1e3a5f',
                  background: config.aiCommentator?.intensity === opt ? '#E8002D' : '#0D1B2A',
                  color: config.aiCommentator?.intensity === opt ? '#fff' : '#8899aa',
                }">
                <input type="radio" :value="opt" v-model="config.aiCommentator.intensity"
                  style="display:none;" />
                {{ opt === 'chill' ? '😌 Chill' : opt === 'normal' ? '📺 TV' : '🔥 Hype' }}
              </label>
            </div>
          </div>

          <!-- Voice-Zuweisung -->
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <div style="flex:1; min-width:170px;">
              <div style="font-size:11px; color:#8899aa; letter-spacing:1px; text-transform:uppercase; margin-bottom:6px;">
                🎓 Stimme Analytiker
              </div>
              <select v-model="config.aiCommentator.analystVoice" data-testid="duo-voice-analyst"
                style="width:100%; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:8px 10px; border-radius:4px; font-size:13px;">
                <option value="">(Standard-Stimme)</option>
                <option v-for="voice in providerInfo?.voices" :key="voice.id" :value="voice.id">
                  {{ voice.label }}
                </option>
              </select>
            </div>
            <div style="flex:1; min-width:170px;">
              <div style="font-size:11px; color:#8899aa; letter-spacing:1px; text-transform:uppercase; margin-bottom:6px;">
                🎤 Stimme Entertainer
              </div>
              <select v-model="config.aiCommentator.entertainerVoice" data-testid="duo-voice-entertainer"
                style="width:100%; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:8px 10px; border-radius:4px; font-size:13px;">
                <option value="">(Standard-Stimme)</option>
                <option v-for="voice in providerInfo?.voices" :key="voice.id" :value="voice.id">
                  {{ voice.label }}
                </option>
              </select>
            </div>
          </div>

          <!-- Backend-URL (Fortgeschritten) -->
          <details style="background:#0D1B2A; border:1px solid #1e3a5f; border-radius:4px; padding:8px 12px;">
            <summary style="font-size:11px; color:#8899aa; letter-spacing:1px; text-transform:uppercase; cursor:pointer;">
              ⚙️ Fortgeschritten: Backend-URL
            </summary>
            <input v-model="config.aiCommentator.backendUrl" data-testid="duo-backend-url"
              type="url" placeholder="https://darts-caller-ext.preview.emergentagent.com"
              style="width:100%; box-sizing:border-box; margin-top:8px; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:8px 10px; border-radius:4px; font-size:12px; font-family:monospace;" />
            <div style="margin-top:6px; font-size:11px; color:#556677;">
              Standard: Emergent-Hosting. Nur ändern, wenn du eine eigene Instanz betreibst.
            </div>
          </details>

          <div style="background:#001a0d; border:1px solid #00C853; border-radius:4px; padding:10px 12px; font-size:12px; color:#c8d4e0; line-height:1.6;">
            <strong style="color:#00C853;">✨ Powered by Claude Sonnet 4.5 (Emergent-Hosted)</strong><br />
            Bei jedem 180er, Bust, High-Checkout und Match-Ende erzeugt das KI-Duo einen einzigartigen, live-generierten Doppel-Kommentar.
            Kein separater API-Key nötig – der Emergent-Server erledigt das für dich.
          </div>
        </div>
      </div>

      <!-- KI-Kommentator An/Aus -->
      <div style="background:#0a1520; border-radius:6px; padding:14px 16px; border:1px solid #1e3a5f; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-size:16px; font-weight:700;">KI-Kommentator aktiv</div>
          <div style="font-size:12px; color:#8899aa; margin-top:2px;">Spricht live während des Spiels</div>
        </div>
        <input type="checkbox" v-model="config.aiCommentator.enabled"
          style="width:22px; height:22px; accent-color:#E8002D; cursor:pointer;" />
      </div>

      <!-- Provider-Auswahl -->
      <div style="background:#0a1520; border-radius:6px; padding:16px; border:1px solid #1e3a5f;">
        <div style="font-size:13px; font-weight:700; color:#F5C842; letter-spacing:1px; text-transform:uppercase; margin-bottom:12px;">
          🔊 Schritt 1: Sprachsynthese-Anbieter wählen
        </div>

        <!-- Provider-Karten -->
        <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
          <label v-for="(info, key) in TTS_PROVIDERS" :key="key"
            :style="{
              display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
              borderRadius:'5px', cursor:'pointer',
              border: selectedProvider === key ? '2px solid #E8002D' : '1px solid #1e3a5f',
              background: selectedProvider === key ? '#1a0a10' : '#0D1B2A',
            }">
            <input type="radio" :value="key" v-model="selectedProvider"
              style="width:18px; height:18px; accent-color:#E8002D; cursor:pointer; flex-shrink:0;" />
            <div style="flex:1;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap;">
                <div style="font-size:15px; font-weight:700;">{{ info.label }}</div>
                <a v-if="info.setupUrl" :href="info.setupUrl" target="_blank"
                  @click.stop
                  style="display:inline-flex; align-items:center; gap:5px; background:#E8002D; color:#fff; font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:5px 10px; border-radius:4px; text-decoration:none; white-space:nowrap; flex-shrink:0;">
                  🌐 Zur Webseite →
                </a>
              </div>
              <div style="font-size:12px; color:#8899aa; margin-top:4px;">{{ info.description }}</div>
              <div style="font-size:11px; color:#00C853; margin-top:4px; font-weight:600;">
                💰 {{ info.freeTier }}
              </div>
            </div>
          </label>
        </div>

        <!-- Setup-Anleitung für gewählten Provider -->
        <div v-if="providerInfo"
          :style="{
            background: '#0D1B2A', borderRadius:'5px', padding:'14px',
            borderLeft: '3px solid ' + (selectedProvider === 'browser' ? '#00C853' : '#F5C842'),
          }">
          <div style="font-size:13px; font-weight:700; color:#F5C842; letter-spacing:1px; text-transform:uppercase; margin-bottom:10px;">
            📋 Schritt 2: So richtest du {{ providerInfo.label }} ein
          </div>
          <ol style="margin:0; padding-left:18px; display:flex; flex-direction:column; gap:6px;">
            <li v-for="(step, i) in providerInfo.setupSteps" :key="i"
              style="font-size:13px; color:#c8d4e0; line-height:1.5;">
              {{ step }}
            </li>
          </ol>
          <a v-if="providerInfo.setupUrl" :href="providerInfo.setupUrl" target="_blank"
            style="display:inline-flex; align-items:center; gap:8px; margin-top:12px; background:#E8002D; color:#fff; font-size:13px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:10px 18px; border-radius:4px; text-decoration:none;">
            🌐 Jetzt bei {{ providerInfo.label }} registrieren →
          </a>
        </div>
      </div>

      <!-- API-Key Eingabe mit Sicherheitshinweis -->
      <div v-if="providerInfo?.requiresKey"
        style="background:#0a1520; border-radius:6px; padding:16px; border:1px solid #1e3a5f;">

        <!-- Titel + Sicherheits-Badge -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div style="font-size:13px; font-weight:700; color:#F5C842; letter-spacing:1px; text-transform:uppercase;">
            🔑 Schritt 3: API-Key eintragen
          </div>
          <div style="display:flex; align-items:center; gap:6px; background:#003320; border:1px solid #00C853; border-radius:4px; padding:4px 10px; cursor:pointer;"
            @click="showSecurityInfo = !showSecurityInfo">
            <span style="font-size:12px; color:#00C853; font-weight:700;">🔒 AES-256 verschlüsselt</span>
            <span style="font-size:11px; color:#00C853;">{{ showSecurityInfo ? '▲' : '▼' }}</span>
          </div>
        </div>

        <!-- Sicherheits-Info (aufklappbar) -->
        <div v-if="showSecurityInfo"
          style="background:#001a0d; border:1px solid #00C853; border-radius:5px; padding:12px 14px; margin-bottom:12px; font-size:12px; line-height:1.7;">
          <div style="font-weight:700; color:#00C853; margin-bottom:8px; font-size:13px;">🛡️ So wird dein API-Key geschützt:</div>
          <table style="width:100%; border-collapse:collapse;">
            <tr>
              <td style="color:#8899aa; padding:3px 0; width:130px;">📍 Speicherort:</td>
              <td style="color:#c8d4e0;">{{ storageInfo.location }}</td>
            </tr>
            <tr>
              <td style="color:#8899aa; padding:3px 0;">🔐 Verschlüsselung:</td>
              <td style="color:#c8d4e0;">{{ storageInfo.encryption }}</td>
            </tr>
            <tr>
              <td style="color:#8899aa; padding:3px 0;">☁️ Cloud-Sync:</td>
              <td style="color:#c8d4e0;">{{ storageInfo.syncStatus }}</td>
            </tr>
            <tr>
              <td style="color:#8899aa; padding:3px 0;">🗑️ Löschung:</td>
              <td style="color:#c8d4e0;">{{ storageInfo.deleteInfo }}</td>
            </tr>
          </table>
          <div style="margin-top:10px; color:#556677; font-size:11px;">
            ℹ️ Der Verschlüsselungsschlüssel wird automatisch auf diesem Gerät generiert und verlässt deinen Browser niemals. Selbst wenn jemand Zugriff auf die Erweiterungsdaten bekommt, sieht er nur unlesbaren Ciphertext.
          </div>
        </div>

        <!-- Wo kommt der Key hin? Hinweis -->
        <div style="background:#0D1B2A; border-left:3px solid #F5C842; padding:10px 12px; border-radius:0 4px 4px 0; margin-bottom:12px; font-size:12px; color:#c8d4e0; line-height:1.6;">
          <strong style="color:#F5C842;">📌 Wo findest du deinen API-Key?</strong><br/>
          <span v-if="selectedProvider === 'elevenlabs'">
            Nach der Registrierung auf <strong>elevenlabs.io</strong>: Oben rechts auf dein Profilbild klicken → <strong>"Profile + API key"</strong> → den langen Schlüssel kopieren und hier einfügen.
          </span>
          <span v-else-if="selectedProvider === 'google'">
            In der <strong>Google Cloud Console</strong>: Linkes Menü → <strong>"APIs & Dienste"</strong> → <strong>"Anmeldedaten"</strong> → unter "API-Schlüssel" auf deinen Schlüssel klicken → kopieren.
          </span>
          <span v-else-if="selectedProvider === 'azure'">
            Im <strong>Azure Portal</strong>: Deine Sprachdienst-Ressource öffnen → linkes Menü → <strong>"Schlüssel und Endpunkt"</strong> → <strong>"Schlüssel 1"</strong> kopieren. Zusätzlich die Region (z.B. "westeurope") notieren.
          </span>
          <span v-else-if="selectedProvider === 'openai'">
            Auf <strong>platform.openai.com</strong>: Linkes Menü → <strong>"API keys"</strong> → <strong>"Create new secret key"</strong> → den Schlüssel sofort kopieren (er wird nur einmal angezeigt!).
          </span>
        </div>

        <!-- Key-Eingabefeld -->
        <div style="display:flex; gap:8px; align-items:center;">
          <div style="flex:1; position:relative;">
            <input
              :type="showApiKey ? 'text' : 'password'"
              v-model="apiKeyPlaintext"
              @input="keyIsSpeichernd = false"
              placeholder="API-Key hier einfügen..."
              style="width:100%; box-sizing:border-box; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:10px 14px; border-radius:4px; font-size:13px; font-family:monospace;"
            />
          </div>
          <button @click="showApiKey = !showApiKey"
            style="background:#1e3a5f; color:#8899aa; border:1px solid #2a4a7f; padding:10px 14px; border-radius:4px; cursor:pointer; font-size:14px; flex-shrink:0;">
            {{ showApiKey ? '🙈' : '👁️' }}
          </button>
          <button @click="saveApiKey" :disabled="isSavingKey || !apiKeyPlaintext.trim()"
            :style="{
              background: keyIsSpeichernd ? '#003320' : '#E8002D',
              color: '#fff', border: 'none', padding:'10px 16px', borderRadius:'4px',
              cursor: 'pointer', fontSize:'12px', fontWeight:'700', letterSpacing:'1px',
              textTransform:'uppercase', flexShrink:0,
              opacity: (isSavingKey || !apiKeyPlaintext.trim()) ? 0.5 : 1,
            }">
            {{ isSavingKey ? '⏳' : keyIsSpeichernd ? '✅ Gespeichert' : '🔒 Speichern' }}
          </button>
        </div>

        <!-- Status-Anzeige -->
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:8px; flex-wrap:wrap; gap:6px;">
          <div style="font-size:11px; color:#556677;">
            🔒 Wird verschlüsselt in <strong style="color:#8899aa;">browser.storage.local</strong> gespeichert – nur auf diesem Gerät, nur für diese Erweiterung.
          </div>
          <button @click="clearAlleKeys" :disabled="isDeletingKeys"
            style="background:transparent; color:#E8002D; border:1px solid #E8002D; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase;">
            {{ isDeletingKeys ? '⏳' : '🗑️ Keys löschen' }}
          </button>
        </div>
      </div>

      <!-- Stimme wählen -->
      <div style="background:#0a1520; border-radius:6px; padding:16px; border:1px solid #1e3a5f;">
        <div style="font-size:13px; font-weight:700; color:#F5C842; letter-spacing:1px; text-transform:uppercase; margin-bottom:10px;">
          🗣️ Schritt 4: Stimme wählen
        </div>
        <select v-model="config.aiCommentator.voice"
          style="width:100%; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:10px 14px; border-radius:4px; font-size:14px;">
          <option v-for="voice in providerInfo?.voices" :key="voice.id" :value="voice.id">
            {{ voice.label }}
          </option>
        </select>
      </div>

      <!-- Sprache & Volume -->
      <div style="background:#0a1520; border-radius:6px; padding:16px; border:1px solid #1e3a5f; display:flex; gap:16px; flex-wrap:wrap;">
        <div style="flex:1; min-width:140px;">
          <div style="font-size:12px; color:#8899aa; letter-spacing:1px; text-transform:uppercase; margin-bottom:8px;">Kommentar-Sprache</div>
          <select v-model="config.aiCommentator.language"
            style="width:100%; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:10px; border-radius:4px; font-size:14px;">
            <option value="de">🇩🇪 Deutsch</option>
            <option value="en">🇬🇧 Englisch</option>
          </select>
        </div>
        <div style="flex:1; min-width:140px;">
          <div style="font-size:12px; color:#8899aa; letter-spacing:1px; text-transform:uppercase; margin-bottom:8px;">
            Volume: {{ config.aiCommentator?.volume ?? 80 }}%
          </div>
          <input type="range" min="0" max="100" step="5"
            v-model.number="config.aiCommentator.volume"
            style="width:100%; accent-color:#E8002D;" />
        </div>
      </div>

      <!-- Testen-Button -->
      <div style="background:#0a1520; border-radius:6px; padding:16px; border:1px solid #1e3a5f;">
        <div style="font-size:13px; font-weight:700; color:#F5C842; letter-spacing:1px; text-transform:uppercase; margin-bottom:10px;">
          🧪 Schritt 5: Verbindung testen
        </div>
        <button @click="runTesten" :disabled="isTestening"
          style="width:100%; background:#E8002D; color:#fff; border:none; padding:14px; border-radius:4px; cursor:pointer; font-size:16px; font-weight:700; letter-spacing:2px; text-transform:uppercase;"
          :style="{ opacity: isTestening ? 0.6 : 1 }">
          {{ isTestening ? '⏳ Testene Verbindung...' : '▶ TEST ABSPIELEN' }}
        </button>
        <div v-if="testResult" style="margin-top:10px; padding:10px 14px; border-radius:4px; font-size:13px; font-weight:600;"
          :style="{
            background: testResult.ok ? '#003320' : '#330010',
            border: `1px solid ${testResult.ok ? '#00C853' : '#E8002D'}`,
            color: testResult.ok ? '#00C853' : '#E8002D',
          }">
          {{ testResult.message }}
        </div>
      </div>

      <!-- Fallback-Hinweis -->
      <div style="background:#0a1520; border-radius:6px; padding:14px 16px; border-left:3px solid #1e3a5f; font-size:12px; color:#556677; line-height:1.6;">
        <strong style="color:#8899aa;">ℹ️ Automatischer Fallback:</strong>
        Wenn kein API-Key eingetragen ist oder ein Fehler auftritt, wechselt die Erweiterung
        automatisch auf den <strong style="color:#8899aa;">Browser-TTS</strong> –
        der KI-Kommentator funktioniert also immer, auch ohne externen Anbieter.
      </div>

    </div>
  </div>
</template>
