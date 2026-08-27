<template>
  <div>
    <!-- Confirmation Dialog -->
    <ConfirmDialog
      @confirm="confirmDialogConfirm"
      @cancel="confirmDialogCancel"
      :show="confirmDialog.show"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :confirm-text="confirmDialog.confirmText"
      :cancel-text="confirmDialog.cancelText"
    />

    <!-- Notification -->
    <AppNotification
      @close="hideNotification"
      :show="notification.show"
      :message="notification.message"
      :type="notification.type"
    />

    <!-- Settings Modal -->
    <SettingsModal
      @close="closeSettingsModal"
      v-if="activeSettings && getComponentForSetting(activeSettings)"
      :show="showSettingsModal"
      :title="getSettingTitle(activeSettings)"
    >
      <component @setting-change="handleSettingChange" :is="getComponentForSetting(activeSettings)" :config="config" />
    </SettingsModal>

    <div class="mx-auto mb-16 max-w-[1366px] space-y-8">
      <div class="space-y-4">
        <div class="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div class="flex items-center">
            <AppButton
              @click="goBack()"
              class="mr-4 aspect-square size-10 p-0"
            >
              <span class="icon-[pixelarticons--arrow-left]" />
            </AppButton>
            <h1 class="text-xl font-bold lg:text-2xl xl:text-3xl">
              Autodarts Tools {{ packageConfig.version }}
            </h1>
          </div>
          <div class="mt-2 grid grid-cols-2 items-center gap-2 sm:mt-0 sm:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]">
            <AppButton
              @click="exportSettings"
              title="Einstellungen als Datei herunterladen"
            >
              <span class="icon-[pixelarticons--calendar-export] mr-2" />
              <span>Exportieren</span>
            </AppButton>
            <AppButton
              @click="importSettings"
              title="Einstellungen aus Datei laden"
            >
              <span class="icon-[pixelarticons--calendar-import] mr-2" />
              <span>Importieren</span>
            </AppButton>
            <AppButton
              @click="copyToClipboard"
              title="Einstellungen in die Zwischenablage kopieren"
            >
              <span class="icon-[pixelarticons--copy] mr-2" />
              <span>Kopieren</span>
            </AppButton>
            <AppButton
              @click="pasteFromClipboard"
              title="Einstellungen aus Zwischenablage einfügen"
            >
              <span class="icon-[pixelarticons--calendar-import] mr-2" />
              <span>Einfügen</span>
            </AppButton>
            <AppButton
              @click="restartOnboarding"
              title="Setup-Assistent erneut starten (3 Schritte für Voice-Pack und Sound-Profil)"
              class="aspect-square size-10 p-0"
              data-testid="restart-onboarding-btn"
            >
              <span class="icon-[material-symbols--help-outline]" />
            </AppButton>
            <AppButton
              @click="toggleDangerZone"
              title="Erweiterte Einstellungen"
              class="aspect-square size-10 p-0"
            >
              <span class="icon-[material-symbols--settings-suggest-outline]" />
            </AppButton>
          </div>
        </div>

        <!-- Tabs Component -->
        <AppTabs
          v-if="!showDangerZone"
          v-model="activeTab"
          :tabs="tabs"
        />

        <!-- Advanced Settings -->
        <div v-if="showDangerZone" class="space-y-5">
          <!-- Ko-fi Support Section -->
          <div class="adt-container space-y-4">
            <div class="flex items-center justify-between">
              <h2 class="text-xl font-bold text-white">
                Projekt unterstützen
              </h2>
              <AppButton @click="toggleDangerZone" auto class="text-white/70 hover:text-white">
                <span class="icon-[pixelarticons--close]" />
              </AppButton>
            </div>
            <p class="text-white/70">
              Autodarts Tools ist kostenlos und Open Source. Wenn dir die Erweiterung gefällt, unterstütze die Entwicklung damit sie weitergeführt werden kann!
            </p>
            <AppButton
              @click="openKofi"
              type="success"
              auto
            >
              <span class="icon-[pixelarticons--heart] mr-2" />
              <span>Auf Ko-fi unterstützen</span>
            </AppButton>
          </div>

          <!-- Danger Zone -->
          <div class="adt-container space-y-6">
            <div class="flex items-center">
              <h2 class="text-xl font-bold text-red-400">
                Gefahrenzone
              </h2>
            </div>
            <div class="space-y-4">
              <p class="text-white/70">
                Diese Aktionen sind unumkehrbar. Bitte gehe vorsichtig vor und exportiere ggf. vorher deine Einstellungen.
              </p>
              <div class="rounded border border-red-500/30 bg-red-500/5 p-4">
                <div class="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                  <div>
                    <h3 class="font-semibold text-red-300">
                      Alle Einstellungen zurücksetzen
                    </h3>
                    <p class="text-sm text-white/60">
                      Setzt alle Einstellungen auf die Standardwerte zurück. Sämtliche Anpassungen gehen verloren.
                    </p>
                  </div>
                  <AppButton
                    @click="resetAllSettings"
                    auto
                    type="danger"
                  >
                    Zurücksetzen
                  </AppButton>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Feature cards grid for Lobbies tab -->
        <template v-if="mounted">
          <div
            v-if="activeTab === 0 && !showDangerZone"
            :key="reloadKey"
            class="grid grid-cols-1 gap-5 lg:grid-cols-2"
          >
            <!-- Lobby-Features -->
            <DiscordWebhooks @toggle="openSettingsModal('discord-webhooks')" @setting-change="updateConfig" class="feature-card" data-feature-index="1" />
            <AutoStart @setting-change="updateConfig" class="feature-card" data-feature-index="2" />
            <RecentLocalPlayers @toggle="openSettingsModal('recent-local-players')" @setting-change="updateConfig" class="feature-card" data-feature-index="4" />
            <ShufflePlayers @setting-change="updateConfig" class="feature-card" data-feature-index="5" />
            <TeamLobby @setting-change="updateConfig" class="feature-card" data-feature-index="6" />
            <QrCode @setting-change="updateConfig" class="feature-card" data-feature-index="3" />
            <Friends class="feature-card col-span-full" data-feature-index="7" />
          </div>

          <!-- Feature cards grid for Match tab -->
          <div
            v-if="activeTab === 1 && !showDangerZone"
            :key="reloadKey"
            class="grid grid-cols-1 gap-5 lg:grid-cols-2"
          >
            <Colors @toggle="openSettingsModal('colors')" @setting-change="updateConfig" class="feature-card" data-feature-index="8" />
            <TakeoutNotification @setting-change="updateConfig" class="feature-card" data-feature-index="9" />
            <NextPlayerOnTakeoutStuck @toggle="openSettingsModal('next-player-on-takeout-stuck')" @setting-change="updateConfig" class="feature-card" data-feature-index="10" />
            <AutomaticNextLeg @toggle="openSettingsModal('automatic-next-leg')" @setting-change="updateConfig" class="feature-card" data-feature-index="11" />
            <SmallerScores @setting-change="updateConfig" :config="config" class="feature-card" data-feature-index="12" />
            <HideMenuInMatch @setting-change="updateConfig" class="feature-card" data-feature-index="13" />
            <StreamingMode @toggle="openSettingsModal('streaming-mode')" @setting-change="updateConfig" class="feature-card" data-feature-index="14" />
            <LargerLegsSets @toggle="openSettingsModal('larger-legs-sets')" @setting-change="updateConfig" class="feature-card" data-feature-index="15" />
            <LargerPlayerNames @toggle="openSettingsModal('larger-player-names')" @setting-change="updateConfig" class="feature-card" data-feature-index="16" />
            <LargerPlayerMatchData @toggle="openSettingsModal('larger-player-match-data')" @setting-change="updateConfig" class="feature-card" data-feature-index="17" />
            <WinnerAnimation @setting-change="updateConfig" class="feature-card" data-feature-index="18" />
            <AutomaticFullscreen @setting-change="updateConfig" class="feature-card" data-feature-index="19" />
            <Zoom @toggle="openSettingsModal('zoom')" @setting-change="updateConfig" class="feature-card" data-feature-index="20" />
            <QuickCorrection @toggle="openSettingsModal('quick-correction')" @setting-change="updateConfig" class="feature-card" data-feature-index="21" />
            <EnhancedScoringDisplay @setting-change="updateConfig" class="feature-card" data-feature-index="22" />
            <InstantReplay @toggle="openSettingsModal('instant-replay')" @setting-change="updateConfig" class="feature-card" data-feature-index="23" />
            <Gotcha @setting-change="updateConfig" class="feature-card" data-feature-index="24" />
            <TvStats class="feature-card col-span-full" data-feature-index="25" />
            <GameplayExtras class="feature-card col-span-full" data-feature-index="26" />
          </div>

          <!-- Sounds & Animationen tab -->
          <div
            v-if="activeTab === 2 && !showDangerZone"
            :key="reloadKey"
            class="grid grid-cols-1 gap-5 lg:grid-cols-2"
          >
            <!-- Warning message for sound and animation features -->
            <div class="col-span-full rounded-md border border-yellow-500/50 bg-yellow-500/10 p-4 text-xs">
              <div class="flex items-start">
                <div>
                  <p class="font-medium text-yellow-400">
                    Performance-Hinweis
                  </p>
                  <p class="mt-1 text-white/70">
                    Wenn du <b>Animationen</b>, <b>Caller</b> oder <b>Sound FX</b> aktivierst, kann es zu Leistungsproblemen kommen – ein modernes Gerät wird empfohlen.
                    Bei Rucklern oder Fehlern deaktiviere diese Funktionen bitte wieder.
                  </p>
                </div>
              </div>
            </div>

            <Animations @toggle="openSettingsModal('animations')" @setting-change="updateConfig" :config="config" class="feature-card" data-feature-index="27" />
            <Caller @toggle="openSettingsModal('caller')" @setting-change="updateConfig" :config="config" class="feature-card" data-feature-index="28" />
            <SoundFx @toggle="openSettingsModal('sound-fx')" @setting-change="updateConfig" :config="config" class="feature-card" data-feature-index="29" />
            <Wled @toggle="openSettingsModal('wled-fx')" @setting-change="updateConfig" :config="config" class="feature-card" data-feature-index="30" />
            <WalkOn @toggle="openSettingsModal('walkon')" @setting-change="updateConfig" :config="config" class="feature-card col-span-full" data-feature-index="31" />
            <Crowd @toggle="openSettingsModal('crowd')" @setting-change="updateConfig" class="feature-card col-span-full" data-feature-index="32" />
            <Buzzer @toggle="openSettingsModal('buzzer')" @setting-change="updateConfig" class="feature-card col-span-full" data-feature-index="33" />
            <Soundboard @toggle="openSettingsModal('soundboard')" @setting-change="updateConfig" :config="config" class="feature-card col-span-full" data-feature-index="34" />
            <DartImpact @toggle="openSettingsModal('dart-impact')" @setting-change="updateConfig" :config="config" class="feature-card col-span-full" data-feature-index="35" />
            <TtsProvider @toggle="openSettingsModal('tts-provider')" @setting-change="updateConfig" class="feature-card col-span-full" data-feature-index="36" />
            <PrecisionMap @toggle="openSettingsModal('precision-map')" @setting-change="updateConfig" class="feature-card col-span-full" data-feature-index="37" />
            <!-- v2.9.93 – Vorbereitung Vision-Auto-Kalibrierung: nur Adress-Feld -->
            <VisionCalibration @toggle="openSettingsModal('vision-calibration')" @setting-change="updateConfig" class="feature-card col-span-full" data-feature-index="38" />
          </div>

          <!-- v2.9.45 NEU: Karriere-Modus (Full-Page) -->
          <div v-if="activeTab === 3 && !showDangerZone" :key="reloadKey">
            <Career />
          </div>

          <!-- v2.9.45 NEU: Turnier-Modus (Full-Page) mit Sub-Mode-Switcher -->
          <div v-if="activeTab === 4 && !showDangerZone" :key="reloadKey">
            <!-- Sub-Mode Tabs -->
            <div style="display: flex; gap: 8px; padding: 16px 20px 0 20px;">
              <button
                @click="tournamentSubMode = 'pdc'"
                :style="{
                  padding: '10px 20px',
                  border: tournamentSubMode === 'pdc' ? '2px solid #E8002D' : '1px solid rgba(255,255,255,0.12)',
                  background: tournamentSubMode === 'pdc' ? 'rgba(232,0,45,0.18)' : 'rgba(255,255,255,0.04)',
                  color: tournamentSubMode === 'pdc' ? '#FFFFFF' : '#94A3B8',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: tournamentSubMode === 'pdc' ? '700' : '500',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  borderRadius: '4px',
                }"
              >🏆 PDC Solo (vs Bot)</button>
              <button
                @click="tournamentSubMode = 'friends'"
                :style="{
                  padding: '10px 20px',
                  border: tournamentSubMode === 'friends' ? '2px solid #34D399' : '1px solid rgba(255,255,255,0.12)',
                  background: tournamentSubMode === 'friends' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.04)',
                  color: tournamentSubMode === 'friends' ? '#FFFFFF' : '#94A3B8',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: tournamentSubMode === 'friends' ? '700' : '500',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  borderRadius: '4px',
                }"
              >👥 Freunde-Turnier</button>
            </div>

            <TournamentMode v-if="tournamentSubMode === 'pdc'" />
            <FriendsTournament v-else />
          </div>

          <!-- Boards tab -->
          <div
            v-if="activeTab === 5 && !showDangerZone"
            :key="reloadKey"
            class="grid grid-cols-1 gap-5 lg:grid-cols-2"
          >
            <ExternalBoards @setting-change="updateConfig" class="feature-card" data-feature-index="37" />
          </div>

          <!-- v2.9.45 NEU: Extras (Liga, Training, Regelwerk, Hilfe, Info) -->
          <div v-if="activeTab === 6 && !showDangerZone" :key="reloadKey" class="space-y-5">
            <Liga class="feature-card" data-feature-index="38" />
            <Training class="feature-card" data-feature-index="39" />
            <TrainingExercises @toggle="openSettingsModal('training-exercises')" class="feature-card" data-feature-index="43" />
            <Regelwerk class="feature-card" data-feature-index="40" />
            <Help class="feature-card" data-feature-index="41" />
            <About class="feature-card" data-feature-index="42" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDebounceFn, useStorage } from "@vueuse/core";
import { resetOnboarding } from "@/entrypoints/content/onboarding";

import DiscordWebhooks from "./Settings/DiscordWebhooks.vue";
import AutoStart from "./Settings/AutoStart.vue";
import RecentLocalPlayers from "./Settings/RecentLocalPlayers.vue";
import ShufflePlayers from "./Settings/ShufflePlayers.vue";
import TeamLobby from "./Settings/TeamLobby.vue";
import QrCode from "./Settings/QrCode.vue";
import Colors from "./Settings/Colors.vue";
import TakeoutNotification from "./Settings/TakeoutNotification.vue";
import NextPlayerOnTakeoutStuck from "./Settings/NextPlayerOnTakeoutStuck.vue";
import AutomaticNextLeg from "./Settings/AutomaticNextLeg.vue";
import SmallerScores from "./Settings/SmallerScores.vue";
import StreamingMode from "./Settings/StreamingMode.vue";
import HideMenuInMatch from "./Settings/HideMenuInMatch.vue";
import AutomaticFullscreen from "./Settings/AutomaticFullscreen.vue";
import LargerLegsSets from "./Settings/LargerLegsSets.vue";
import LargerPlayerMatchData from "./Settings/LargerPlayerMatchData.vue";
import LargerPlayerNames from "./Settings/LargerPlayerNames.vue";
import WinnerAnimation from "./Settings/WinnerAnimation.vue";
import Animations from "./Settings/Animations.vue";
import Caller from "./Settings/Caller.vue";
import ExternalBoards from "./Settings/ExternalBoards.vue";
import SoundFx from "./Settings/SoundFx.vue";
import Wled from "./Settings/Wled.vue";
import Zoom from "./Settings/Zoom.vue";
import QuickCorrection from "./Settings/QuickCorrection.vue";
import EnhancedScoringDisplay from "./Settings/EnhancedScoringDisplay.vue";
import InstantReplay from "./Settings/InstantReplay.vue";
import Gotcha from "./Settings/Gotcha.vue";
// v2.9.45: fehlende Feature-Komponenten ergänzt (waren im Codebase aber nicht im Menü!)
import Career from "./Settings/Career.vue";
import TournamentMode from "./Settings/TournamentMode.vue";
import FriendsTournament from "./Settings/FriendsTournament.vue";
import Liga from "./Settings/Liga.vue";
import Training from "./Settings/Training.vue";
import TrainingExercises from "./Settings/TrainingExercises.vue";
import Buzzer from "./Settings/Buzzer.vue";
import Soundboard from "./Settings/Soundboard.vue";
import DartImpact from "./Settings/DartImpact.vue";
import WalkOn from "./Settings/WalkOn.vue";
import Crowd from "./Settings/Crowd.vue";
import TvStats from "./Settings/TvStats.vue";
import TtsProvider from "./Settings/TtsProvider.vue";
import PrecisionMap from "./Settings/PrecisionMap.vue";
import VisionCalibration from "./Settings/VisionCalibration.vue";
import Friends from "./Settings/Friends.vue";
import GameplayExtras from "./Settings/GameplayExtras.vue";
import Regelwerk from "./Settings/Regelwerk.vue";
import Help from "./Settings/Help.vue";
import About from "./Settings/About.vue";

import packageConfig from "../package.json";

import type { IConfig, ISound } from "@/utils/storage";

import { AutodartsToolsConfig, defaultConfig } from "@/utils/storage";
import { clearCallerSoundsFromIndexedDB, clearSoundFxFromIndexedDB, getAllCallerSoundsFromIndexedDB, getAllSoundFxFromIndexedDB, isIndexedDBAvailable, saveSoundFxToIndexedDB, saveSoundToIndexedDB } from "@/utils/helpers";
import AppButton from "@/components/AppButton.vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import AppNotification from "@/components/AppNotification.vue";
import SettingsModal from "@/components/SettingsModal.vue";
import { useConfirmDialog } from "@/composables/useConfirmDialog";
import { useNotification } from "@/composables/useNotification";
import AppTabs from "@/components/AppTabs.vue";

// Define feature groups with titles for modals
const featureGroups = [
  // Lobbies (Tab 0)
  {
    id: "lobbies",
    tab: 0,
    features: [
      { id: "discord-webhooks", title: "Discord-Webhooks – Einstellungen", component: DiscordWebhooks, hasSettings: true },
      { id: "auto-start", title: "Automatischer Start – Einstellungen", component: AutoStart, hasSettings: false },
      { id: "recent-local-players", title: "Zuletzt lokale Spieler – Einstellungen", component: RecentLocalPlayers, hasSettings: true },
      { id: "shuffle-players", title: "Spieler mischen – Einstellungen", component: ShufflePlayers, hasSettings: false },
      { id: "team-lobby", title: "Team-Lobby – Einstellungen", component: TeamLobby, hasSettings: false },
      { id: "qr-code", title: "QR-Code – Einstellungen", component: QrCode, hasSettings: false },
    ],
    settingIds: [ "discord-webhooks", "recent-local-players" ],
  },
  // Matches (Tab 1)
  {
    id: "matches",
    tab: 1,
    features: [
      { id: "colors", title: "Farben – Einstellungen", component: Colors, hasSettings: true },
      { id: "takeout-notification", title: "Take-out Benachrichtigung – Einstellungen", component: TakeoutNotification, hasSettings: false },
      { id: "next-player-on-takeout-stuck", title: "Nächster Spieler bei feststeckendem Take-out – Einstellungen", component: NextPlayerOnTakeoutStuck, hasSettings: true },
      { id: "automatic-next-leg", title: "Automatischer Leg-Wechsel – Einstellungen", component: AutomaticNextLeg, hasSettings: true },
      { id: "smaller-scores", title: "Kleinere Punkteanzeige – Einstellungen", component: SmallerScores, hasSettings: false },
      { id: "hide-menu-in-match", title: "Menü im Match ausblenden – Einstellungen", component: HideMenuInMatch, hasSettings: false },
      { id: "enhanced-scoring-display", title: "Erweiterte Score-Anzeige – Einstellungen", component: EnhancedScoringDisplay, hasSettings: false },
      { id: "streaming-mode", title: "Streaming-Modus – Einstellungen", component: StreamingMode, hasSettings: true },
      { id: "larger-legs-sets", title: "Größere Legs/Sets-Anzeige – Einstellungen", component: LargerLegsSets, hasSettings: true },
      { id: "larger-player-names", title: "Größere Spielernamen – Einstellungen", component: LargerPlayerNames, hasSettings: true },
      { id: "larger-player-match-data", title: "Größere Match-Daten – Einstellungen", component: LargerPlayerMatchData, hasSettings: true },
      { id: "winner-animation", title: "Gewinner-Animation – Einstellungen", component: WinnerAnimation, hasSettings: false },

      { id: "automatic-fullscreen", title: "Automatischer Vollbildmodus – Einstellungen", component: AutomaticFullscreen, hasSettings: false },
      { id: "zoom", title: "Dart-Zoom – Einstellungen", component: Zoom, hasSettings: true },
      { id: "quick-correction", title: "Schnelle Korrektur – Einstellungen", component: QuickCorrection, hasSettings: true },
      { id: "instant-replay", title: "Instant Replay – Einstellungen", component: InstantReplay, hasSettings: true },
    ],
    settingIds: [ "colors", "next-player-on-takeout-stuck", "automatic-next-leg", "streaming-mode", "larger-legs-sets", "larger-player-names", "larger-player-match-data", "automatic-fullscreen", "zoom", "quick-correction", "instant-replay" ],
  },
  // Boards (Tab 2)
  {
    id: "boards",
    tab: 2,
    features: [
      { id: "external-boards", title: "Externe Boards – Einstellungen", component: ExternalBoards, hasSettings: false },
    ],
    settingIds: [],
  },
  // Sounds & Animations (Tab 3)
  {
    id: "sounds-animations",
    tab: 3,
    features: [
      { id: "animations", title: "Animationen – Einstellungen", component: Animations, hasSettings: true },
      { id: "caller", title: "Caller – Einstellungen", component: Caller, hasSettings: true },
      { id: "sound-fx", title: "Sound-FX – Einstellungen", component: SoundFx, hasSettings: true },
      { id: "wled-fx", title: "WLED – Einstellungen", component: Wled, hasSettings: true },
    ],
    settingIds: [ "animations", "caller", "sound-fx", "wled-fx" ],
  },
  // Extras (Tab 6)
  {
    id: "extras",
    tab: 6,
    features: [
      { id: "training-exercises", title: "PDC-Übungs-Bibliothek", component: TrainingExercises, hasSettings: true },
    ],
    settingIds: [ "training-exercises" ],
  },
];

// Tabs component data
const tabs = ref([
  "Lobby",
  "Match",
  "Sounds & Animationen",
  "Saison",
  "Turniere",
  "Boards",
  "Extras",
]);
const activeSettings = useStorage("adt:active-settings", null);
const activeTab = useStorage("adt:active-tab", 0);
const showSettingsModal = ref(false);
const reloadKey = ref(0);

// Create a debounced function for updating reloadKey
const debouncedReload = useDebounceFn(() => {
  // Get the current scroll position before updating reloadKey
  const scrollContainers = [ document.querySelector("#root > div > div:nth-of-type(2)"), document.querySelector("html") ];
  const scrollPositions = scrollContainers.map(container => container?.scrollTop || 0);

  // Update reloadKey
  reloadKey.value++;

  // Restore scroll position after DOM update
  nextTick(() => {
    setTimeout(() => {
      scrollContainers.forEach((container, index) => {
        if (container) {
          container.scrollTop = scrollPositions[index];
        }
      });
    }, 250);
  });
}, 250); // 250ms debounce time

// Initialize config with default values to avoid null issues
const config = ref<IConfig>(defaultConfig);
const importFileInput = ref<HTMLInputElement>();

// v2.9.49: Sub-Mode für Turnier-Tab (PDC Solo vs. Freunde-Turnier)
const tournamentSubMode = ref<'pdc' | 'friends'>('pdc');

const mounted = useMounted();

// Use the composables
const { confirmDialog, showConfirmDialog, confirmDialogConfirm, confirmDialogCancel } = useConfirmDialog();
const { notification, showNotification, hideNotification } = useNotification();

function goBack() {
  window.history.back();
  window.history.back();
}

onMounted(async () => {
  const loadedConfig = await AutodartsToolsConfig.getValue();
  if (loadedConfig) {
    config.value = loadedConfig;
  }
});

watch(config, async () => {
  // Save the config to storage
  await AutodartsToolsConfig.setValue(toRaw(config.value));
  debouncedReload();
}, { deep: true });

// Function to get the title for a setting
function getSettingTitle(settingId) {
  for (const group of featureGroups) {
    const feature = group.features.find(f => f.id === settingId);
    if (feature) {
      return feature.title;
    }
  }
  return "Einstellungen";
}

// Function to handle setting changes
function handleSettingChange() {
  updateConfig();
}

// Function to get the component for a setting
function getComponentForSetting(settingId) {
  for (const group of featureGroups) {
    const feature = group.features.find(f => f.id === settingId && f.hasSettings);
    if (feature) {
      return feature.component;
    }
  }
  return null;
}

// Function to open settings modal
function openSettingsModal(settingId) {
  activeSettings.value = settingId;
  showSettingsModal.value = true;
}

// Function to close settings modal
function closeSettingsModal() {
  showSettingsModal.value = false;
  setTimeout(() => {
    activeSettings.value = null;
  }, 300); // Wait for animation to complete
}

async function exportSettings() {
  config.value = await AutodartsToolsConfig.getValue();
  if (!config.value) return;

  interface ExportData {
    config: IConfig;
    exportDate: string;
    version: string;
    sounds: {
      caller: ISound[];
      soundFx: ISound[];
    };
  }

  const exportData: ExportData = {
    config: config.value,
    exportDate: new Date().toISOString(),
    version: "1.0",
    sounds: {
      caller: [],
      soundFx: [],
    },
  };

  // Add sounds from IndexedDB if available
  if (isIndexedDBAvailable()) {
    try {
      // Get all sounds from IndexedDB
      const callerSounds = await getAllCallerSoundsFromIndexedDB();
      const soundFxSounds = await getAllSoundFxFromIndexedDB();

      if (callerSounds) {
        // Convert IndexedDB sound format to ISound format
        exportData.sounds.caller = callerSounds.map(sound => ({
          name: sound.name,
          url: "", // Ensure url field exists
          base64: sound.base64,
          enabled: true,
          triggers: [], // Empty triggers array as default
          soundId: sound.id,
        }));
      }

      if (soundFxSounds) {
        // Convert IndexedDB sound format to ISound format
        exportData.sounds.soundFx = soundFxSounds.map(sound => ({
          name: sound.name,
          url: "", // Ensure url field exists
          base64: sound.base64,
          enabled: true,
          triggers: [], // Empty triggers array as default
          soundId: sound.id,
        }));
      }

      console.log("Autodarts Tools: Loaded sounds for export", {
        caller: callerSounds?.length || 0,
        soundFx: soundFxSounds?.length || 0,
      });
    } catch (error) {
      console.error("Autodarts Tools: Error exporting sounds from IndexedDB", error);
      showNotification("Fehler beim Exportieren der Sound-Dateien", "error");
    }
  }

  // Convert to JSON and then to base64
  const jsonString = JSON.stringify(exportData);
  const base64String = btoa(encodeURIComponent(jsonString));

  // Create a blob and download it
  const blob = new Blob([ base64String ], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `autodarts-tools-settings-${new Date().toISOString().split("T")[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importSettings() {
  if (!importFileInput.value) {
    importFileInput.value = document.createElement("input");
    importFileInput.value.type = "file";
    importFileInput.value.accept = ".txt";
    importFileInput.value.onchange = async (e) => {
      const file = importFileInput.value?.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64String = e.target?.result as string;
          const jsonString = decodeURIComponent(atob(base64String));
          const importedData = JSON.parse(jsonString);

          if (!importedData.config) {
            showNotification("Ungültige Einstellungsdatei", "error");
            return;
          }

          // Update the config
          const newConfig = {
            ...JSON.parse(JSON.stringify(defaultConfig)),
            ...JSON.parse(JSON.stringify(importedData.config)),
          };

          // Set the local ref
          config.value = newConfig;

          // Explicitly save to storage
          await AutodartsToolsConfig.setValue(newConfig);

          // Import sounds to IndexedDB if available
          if (importedData.sounds && isIndexedDBAvailable()) {
            try {
              // Clear existing sounds first if there are new sounds to import
              if (importedData.sounds.caller?.length > 0) {
                await clearCallerSoundsFromIndexedDB();
              }

              if (importedData.sounds.soundFx?.length > 0) {
                await clearSoundFxFromIndexedDB();
              }

              // Import caller sounds
              let callerImportCount = 0;
              if (importedData.sounds.caller?.length > 0) {
                for (const sound of importedData.sounds.caller) {
                  // Use existing soundId if available instead of creating a new one
                  const soundId = await saveSoundToIndexedDB(
                    sound.name,
                    sound.base64,
                    sound.soundId || sound.id, // Use existing soundId/id from imported data
                  );
                  if (soundId) {
                    callerImportCount++;

                    // Update the sound in config to reference the soundId
                    const soundInConfig = newConfig.caller.sounds.find(
                      s => s.name === sound.name && (!s.soundId || s.soundId === sound.soundId || s.soundId === sound.id),
                    );

                    if (soundInConfig) {
                      soundInConfig.soundId = soundId;
                      soundInConfig.base64 = ""; // Clear base64 data from config
                    }
                  }
                }
              }

              // Import soundFx sounds
              let soundFxImportCount = 0;
              if (importedData.sounds.soundFx?.length > 0) {
                for (const sound of importedData.sounds.soundFx) {
                  // Use existing soundId if available instead of creating a new one
                  const soundId = await saveSoundFxToIndexedDB(
                    sound.name,
                    sound.base64,
                    sound.soundId || sound.id, // Use existing soundId/id from imported data
                  );
                  if (soundId) {
                    soundFxImportCount++;

                    // Update the sound in config to reference the soundId
                    const soundInConfig = newConfig.soundFx.sounds.find(
                      s => s.name === sound.name && (!s.soundId || s.soundId === sound.soundId || s.soundId === sound.id),
                    );

                    if (soundInConfig) {
                      soundInConfig.soundId = soundId;
                      soundInConfig.base64 = ""; // Clear base64 data from config
                    }
                  }
                }
              }

              // Update the config with the updated sounds
              config.value = newConfig;
              await AutodartsToolsConfig.setValue(newConfig);

              console.log("Autodarts Tools: Imported sounds", {
                caller: callerImportCount,
                soundFx: soundFxImportCount,
              });
            } catch (error) {
              console.error("Autodarts Tools: Error importing sounds to IndexedDB", error);
              showNotification("Einstellungen importiert, aber Fehler beim Importieren der Sounds", "error");
            }
          }

          showNotification("Einstellungen erfolgreich importiert. Die Seite wird neu geladen...");

          // Reload the page after a short delay to allow the notification to be seen
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } catch (error) {
          console.error("Failed to import settings:", error);
          showNotification("Import der Einstellungen fehlgeschlagen", "error");
        }
      };
      reader.readAsText(file);
    };
  }
  importFileInput.value.click();
}

// State for danger zone
const showDangerZone = ref(false);

function openKofi() {
  window.open("https://ko-fi.com/creazy231", "_blank", "noopener,noreferrer");
}

function toggleDangerZone() {
  showDangerZone.value = !showDangerZone.value;
}

async function restartOnboarding() {
  try {
    await resetOnboarding();
  } catch (e) {
    console.error("Autodarts Tools: resetOnboarding failed", e);
  }
}

function resetAllSettings() {
  showConfirmDialog(
    "Alle Einstellungen zurücksetzen",
    "Damit werden alle Einstellungen auf die Standardwerte zurückgesetzt. Sämtliche Anpassungen gehen verloren. Bist du sicher, dass du fortfahren möchtest?",
    async () => {
      // Clear the IndexedDB sound files
      if (isIndexedDBAvailable()) {
        try {
          await clearCallerSoundsFromIndexedDB();
          await clearSoundFxFromIndexedDB();
          console.log("Autodarts Tools: IndexedDB sounds cleared");
        } catch (error) {
          console.error("Autodarts Tools: Error clearing IndexedDB sounds", error);
        }
      }

      config.value = { ...defaultConfig };

      // Explicitly save to storage
      await AutodartsToolsConfig.setValue(defaultConfig);
      await new Promise(resolve => setTimeout(resolve, 1000));

      showNotification("Alle Einstellungen wurden zurückgesetzt. Die Seite wird neu geladen...");

      // Close danger zone
      showDangerZone.value = false;

      // Reload the page after a short delay to allow the notification to be seen
      setTimeout(() => {
        window.location.reload();
        // After reload, navigate to first tab
        activeTab.value = 0;
      }, 1500);
    },
  );
}

async function copyToClipboard() {
  config.value = await AutodartsToolsConfig.getValue();
  if (!config.value) return;

  interface ExportData {
    config: IConfig;
    exportDate: string;
    version: string;
    sounds: {
      caller: ISound[];
      soundFx: ISound[];
    };
  }

  const exportData: ExportData = {
    config: config.value,
    exportDate: new Date().toISOString(),
    version: "1.0",
    sounds: {
      caller: [],
      soundFx: [],
    },
  };

  // Add sounds from IndexedDB if available
  if (isIndexedDBAvailable()) {
    try {
      // Get all sounds from IndexedDB
      const callerSounds = await getAllCallerSoundsFromIndexedDB();
      const soundFxSounds = await getAllSoundFxFromIndexedDB();

      if (callerSounds) {
        // Convert IndexedDB sound format to ISound format
        exportData.sounds.caller = callerSounds.map(sound => ({
          name: sound.name,
          url: "", // Ensure url field exists
          base64: sound.base64,
          enabled: true,
          triggers: [], // Empty triggers array as default
          soundId: sound.id,
        }));
      }

      if (soundFxSounds) {
        // Convert IndexedDB sound format to ISound format
        exportData.sounds.soundFx = soundFxSounds.map(sound => ({
          name: sound.name,
          url: "", // Ensure url field exists
          base64: sound.base64,
          enabled: true,
          triggers: [], // Empty triggers array as default
          soundId: sound.id,
        }));
      }

      console.log("Autodarts Tools: Copied sounds to clipboard", {
        caller: callerSounds?.length || 0,
        soundFx: soundFxSounds?.length || 0,
      });
    } catch (error) {
      console.error("Autodarts Tools: Error copying sounds from IndexedDB", error);
      showNotification("Einstellungen kopiert, aber Fehler beim Einbinden der Sounds", "error");
    }
  }

  // Convert to JSON and then to base64
  const jsonString = JSON.stringify(exportData);
  const base64String = btoa(encodeURIComponent(jsonString));

  // Copy to clipboard
  navigator.clipboard.writeText(base64String)
    .then(() => {
      showNotification("Einstellungen in die Zwischenablage kopiert");
    })
    .catch((err) => {
      console.error("Failed to copy settings to clipboard:", err);
      showNotification("Kopieren in die Zwischenablage fehlgeschlagen", "error");
    });
}

function pasteFromClipboard() {
  navigator.clipboard.readText()
    .then(async (text) => {
      try {
        const jsonString = decodeURIComponent(atob(text));
        const importedData = JSON.parse(jsonString);

        if (!importedData.config) {
          showNotification("Ungültige Einstellungsdaten", "error");
          return;
        }

        // Update the config
        const newConfig = {
          ...JSON.parse(JSON.stringify(defaultConfig)),
          ...JSON.parse(JSON.stringify(importedData.config)),
        };

        // Set the local ref
        config.value = newConfig;

        // Explicitly save to storage
        await AutodartsToolsConfig.setValue(newConfig);

        // Import sounds to IndexedDB if available
        if (importedData.sounds && isIndexedDBAvailable()) {
          try {
            // Clear existing sounds first if there are new sounds to import
            if (importedData.sounds.caller?.length > 0) {
              await clearCallerSoundsFromIndexedDB();
            }

            if (importedData.sounds.soundFx?.length > 0) {
              await clearSoundFxFromIndexedDB();
            }

            // Import caller sounds
            let callerImportCount = 0;
            if (importedData.sounds.caller?.length > 0) {
              for (const sound of importedData.sounds.caller) {
                // Use existing soundId if available instead of creating a new one
                const soundId = await saveSoundToIndexedDB(
                  sound.name,
                  sound.base64,
                  sound.soundId || sound.id, // Use existing soundId/id from imported data
                );
                if (soundId) {
                  callerImportCount++;

                  // Update the sound in config to reference the soundId
                  const soundInConfig = newConfig.caller.sounds.find(
                    s => s.name === sound.name && (!s.soundId || s.soundId === sound.soundId || s.soundId === sound.id),
                  );

                  if (soundInConfig) {
                    soundInConfig.soundId = soundId;
                    soundInConfig.base64 = ""; // Clear base64 data from config
                  }
                }
              }
            }

            // Import soundFx sounds
            let soundFxImportCount = 0;
            if (importedData.sounds.soundFx?.length > 0) {
              for (const sound of importedData.sounds.soundFx) {
                // Use existing soundId if available instead of creating a new one
                const soundId = await saveSoundFxToIndexedDB(
                  sound.name,
                  sound.base64,
                  sound.soundId || sound.id, // Use existing soundId/id from imported data
                );
                if (soundId) {
                  soundFxImportCount++;

                  // Update the sound in config to reference the soundId
                  const soundInConfig = newConfig.soundFx.sounds.find(
                    s => s.name === sound.name && (!s.soundId || s.soundId === sound.soundId || s.soundId === sound.id),
                  );

                  if (soundInConfig) {
                    soundInConfig.soundId = soundId;
                    soundInConfig.base64 = ""; // Clear base64 data from config
                  }
                }
              }
            }

            // Update the config with the updated sounds
            config.value = newConfig;
            await AutodartsToolsConfig.setValue(newConfig);

            console.log("Autodarts Tools: Imported sounds from clipboard", {
              caller: callerImportCount,
              soundFx: soundFxImportCount,
            });
          } catch (error) {
            console.error("Autodarts Tools: Error importing sounds from clipboard to IndexedDB", error);
            showNotification("Einstellungen importiert, aber Fehler beim Importieren der Sounds", "error");
          }
        }

        showNotification("Einstellungen erfolgreich importiert. Die Seite wird neu geladen...");

        // Reload the page after a short delay to allow the notification to be seen
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } catch (error) {
        console.error("Failed to import settings from clipboard:", error);
        showNotification("Import aus Zwischenablage fehlgeschlagen", "error");
      }
    })
    .catch((err) => {
      console.error("Failed to read from clipboard:", err);
      showNotification("Zwischenablage konnte nicht gelesen werden", "error");
    });
}

async function updateConfig() {
  config.value = await AutodartsToolsConfig.getValue();
  debouncedReload();
}
</script>

<style>
input[type="color"] {
  -webkit-appearance: none;
  border: none;
}

input[type="color"]::-webkit-color-swatch-wrapper {
  padding: 0;
}

input[type="color"]::-webkit-color-swatch {
  border: none;
}

.gradient-mask-left {
  mask-image: linear-gradient(to right, transparent 10%, black 60%);
  -webkit-mask-image: linear-gradient(to right, transparent 10%, black 60%);
}
</style>
