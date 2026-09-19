/**
 * useI18n – Einfaches DE/EN Übersetzungs-Composable für tools-for-autodarts
 *
 * Verwendung in einer Vue-Komponente:
 *   import { useI18n } from '@/composables/useI18n'
 *   const { t, lang, setLang } = useI18n()
 *
 *   // Im Template:
 *   {{ t('caller.title') }}
 *   <button @click="setLang('en')">EN</button>
 */

import { ref, computed } from 'vue'
// storage ist ein WXT Auto-Import (global verfügbar via .wxt/types/imports.d.ts)
// kein manueller Import nötig

// ─── Typ-Definitionen ────────────────────────────────────────────────────────

export type Lang = 'de' | 'en'

type TranslationTree = {
  [key: string]: string | TranslationTree
}

// ─── Übersetzungen ───────────────────────────────────────────────────────────

const translations: Record<Lang, TranslationTree> = {
  de: {
    common: {
      save: 'Speichern',
      cancel: 'Abbrechen',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      add: 'Hinzufügen',
      upload: 'Hochladen',
      export: 'Exportieren',
      import: 'Importieren',
      enabled: 'Aktiviert',
      disabled: 'Deaktiviert',
      settings: 'Einstellungen',
      close: 'Schließen',
      play: 'Abspielen',
      change: 'Ändern',
      loading: 'Wird geladen…',
      error: 'Fehler',
      success: 'Erfolgreich',
    },
    nav: {
      lobby: 'Lobby',
      match: 'Match',
      friends: 'Freunde',
      league: 'Liga',
      sound: 'Sound & Caller',
      stats: 'Statistiken',
      animations: 'Animationen',
    },
    caller: {
      title: 'Einstellungen – Caller',
      description: 'Konfiguriere die Caller-Einstellungen für das Spiel. Klicke auf das Plus-Symbol, um einen neuen Sound hinzuzufügen.',
      callEveryDart: 'Jeden Dart ansagen',
      callCheckout: 'Checkout ansagen',
      sortSounds: 'Sortieren',
      deleteAll: 'Alle löschen',
      generateTts: 'TTS generieren',
      importUrl: 'Von URL importieren',
      uploadFiles: 'Dateien hochladen',
      addSound: 'Sound hinzufügen',
      dragHint: 'Sounds per Drag & Drop neu anordnen',
      noTriggers: 'Keine Trigger',
      uploaded: 'Hochgeladen',
      soundName: 'Sound-Name (optional)',
      soundNamePlaceholder: 'Name für diesen Sound eingeben',
      soundUrl: 'Sound-URL (MP3, WAV, etc.)',
      soundUrlPlaceholder: 'https://beispiel.de/sound.mp3',
      triggers: 'Trigger',
      triggersHint: '(einer pro Zeile)',
      triggersLink: 'Unterstützte Trigger anzeigen',
      uploadTitle: 'Sound-Dateien hochladen',
      uploadDropHint: 'Dateien hier ablegen oder klicken zum Durchsuchen',
      uploadFormats: 'Unterstützte Formate: MP3, WAV, OGG',
      selectedFiles: 'Ausgewählte Dateien',
      generateFromFilename: 'Trigger aus Dateinamen generieren',
      generateFromFilenameHint: 'Wenn aktiviert, werden Trigger automatisch aus Dateinamen generiert. Beispiel: "180.mp3" löst bei "180" aus.',
      bulkTrigger: 'Gleichen Trigger für alle Dateien verwenden (optional)',
      bulkTriggerPlaceholder: 'z.B. t20, 180, gameshot',
      bulkTriggerHint: 'Wenn angegeben, wird dieser Trigger allen hochgeladenen Dateien zugewiesen.',
      importUrlTitle: 'Sounds von URL importieren',
      presetSets: 'Vordefinierte Caller-Sets (Optional)',
      customUrl: 'Eigene URL',
      customUrlPlaceholder: 'https://beispiel.de/caller-set.zip',
      importBtn: 'Importieren',
      saveFiles: 'Dateien speichern',
      editSound: 'Sound bearbeiten',
      addSoundTitle: 'Sound hinzufügen',
    },
    walkon: {
      title: 'Walk-On Songs',
      sectionTitle: 'Einlaufmusik pro Spieler',
      description: 'Lade deine eigene Musikdatei hoch oder wähle einen der bekannten PDC Walk-On Songs als Vorlage.',
      homePlayer: 'Heimspieler',
      guestPlayer: 'Gast (Spieler 2)',
      presetLabel: '⭐ PDC-Preset',
      uploadedLabel: '✔ Eigene Datei hochgeladen',
      noSong: 'Kein Song ausgewählt',
      uploadTitle: 'Datei hier ablegen oder klicken',
      uploadHint: 'Drag & Drop oder Klicken zum Auswählen',
      presetsTitle: 'PDC Walk-On Vorlagen',
      volume: 'Walk-On Lautstärke',
      duration: 'Abspieldauer (Sekunden)',
      uploadSuccess: 'erfolgreich hochgeladen!',
      removeConfirm: 'Walk-On Song wirklich entfernen?',
    },
    crowd: {
      title: 'Publikum & Atmosphäre',
      sectionTitle: 'Dynamische Publikumsreaktionen',
      event180: '180 geworfen',
      event180Desc: 'Eruption – lauter Jubel & "Stand up if you love the darts"',
      eventHigh: 'Hoher Wurf (140+)',
      eventHighDesc: 'Jubel und Klatschen aus dem Publikum',
      eventBust: 'Überworfen (Bust)',
      eventBustDesc: 'Enttäuschtes "Aaaaww"-Raunen',
      eventBad: 'Schlechter Wurf (Score 3)',
      eventBadDesc: 'Spöttisches Pfeifen & "Boring, boring tables!"',
      eventPressure: 'Pressure-Modus (Match-Dart)',
      eventPressureDesc: 'Pfiffe & Buhrufe beim Anwurf auf entscheidendes Doppel',
      volumeCrowd: 'Publikum',
      volumeAmbient: 'Hintergrundgemurmel',
    },
    soundFx: {
      title: 'Einstellungen – Sound FX',
      description: 'Konfiguriere Sound-Effekte für Spielereignisse.',
    },
    autoStart: {
      title: 'Einstellungen – Auto-Start',
      description: 'Das Spiel startet automatisch nach einem konfigurierbaren Timer.',
      seconds: 'Sekunden bis zum Start',
    },
    qrCode: {
      title: 'Einstellungen – QR-Code',
      description: 'Zeigt automatisch einen QR-Code in der Lobby an.',
    },
    discord: {
      title: 'Einstellungen – Discord Webhook',
      description: 'Sendet automatisch einen Einladungslink an einen Discord-Kanal.',
      webhookUrl: 'Webhook-URL',
      manualMode: 'Manueller Modus',
    },
    zoom: {
      title: 'Einstellungen – Dart-Zoom',
      description: 'Vergrößerte Ansicht der Würfe.',
      position: 'Position',
      level: 'Zoom-Stufe',
      mode: 'Modus',
      zoomOn: 'Zoom für',
      showMarker: 'Markierung anzeigen',
      onlyOnCheckout: 'Nur beim Checkout',
    },
    stats: {
      title: 'Statistiken',
      totalAvg: 'Gesamt-Average',
      first9: 'First 9 Avg',
      checkout: 'Checkout-Quote',
      highestFinish: 'Höchstes Finish',
      count180: 'Anzahl 180er',
      h2hTitle: 'Head-to-Head Übersicht',
      opponent: 'Gegner',
      played: 'Spiele',
      record: 'Bilanz',
      myAvg: 'Dein Avg',
      oppAvg: 'Gegner Avg',
      bestFinish: 'Bestes Finish',
    },
    league: {
      title: 'Liga',
      tableTitle: 'Ligatabelle',
      position: 'Deine Position',
      matchdays: 'Spieltage',
      record: 'Bilanz',
      avgLabel: 'Liga-Average',
      player: 'Spieler',
      played: 'Sp',
      wins: 'S',
      losses: 'N',
      points: 'Pkt',
      avg: 'Avg',
      checkout: 'Checkout',
    },
    friends: {
      title: 'Freunde',
      quickPlay: 'Freundesliste – Quick Play',
      online: 'Online',
      offline: 'Offline',
      addFriend: '+ Freund hinzufügen',
      challenge: '▶ Herausfordern',
      inGame: 'Im Spiel',
      offlineStatus: 'Offline',
      ready: '● Online – Bereit',
      playing: '● Online – Im Spiel',
      lastSeen: 'Zuletzt online:',
      h2h: 'H2H:',
      avgLabel: 'Ø',
    },
  },

  en: {
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      add: 'Add',
      upload: 'Upload',
      export: 'Export',
      import: 'Import',
      enabled: 'Enabled',
      disabled: 'Disabled',
      settings: 'Settings',
      close: 'Close',
      play: 'Play',
      change: 'Change',
      loading: 'Loading…',
      error: 'Error',
      success: 'Success',
    },
    nav: {
      lobby: 'Lobby',
      match: 'Match',
      friends: 'Friends',
      league: 'League',
      sound: 'Sound & Caller',
      stats: 'Statistics',
      animations: 'Animations',
    },
    caller: {
      title: 'Settings – Caller',
      description: 'Configure the caller settings for the game. Click the plus button to add a new sound.',
      callEveryDart: 'Call every dart',
      callCheckout: 'Call checkout',
      sortSounds: 'Sort',
      deleteAll: 'Delete All',
      generateTts: 'Generate TTS',
      importUrl: 'Import from URL',
      uploadFiles: 'Upload Files',
      addSound: 'Add Sound',
      dragHint: 'Drag and drop sounds to change their order',
      noTriggers: 'No triggers',
      uploaded: 'Uploaded',
      soundName: 'Sound Name (optional)',
      soundNamePlaceholder: 'Enter a name for this sound',
      soundUrl: 'Sound URL (MP3, WAV, etc.)',
      soundUrlPlaceholder: 'https://example.com/sound.mp3',
      triggers: 'Triggers',
      triggersHint: '(one per line)',
      triggersLink: 'View supported triggers',
      uploadTitle: 'Upload Sound Files',
      uploadDropHint: 'Drag and drop sound files here or click to browse',
      uploadFormats: 'Supported formats: MP3, WAV, OGG',
      selectedFiles: 'Selected Files',
      generateFromFilename: 'Generate triggers from filenames',
      generateFromFilenameHint: 'If enabled, triggers will be automatically generated from filenames. E.g. "180.mp3" triggers on "180".',
      bulkTrigger: 'Assign same trigger to all files (optional)',
      bulkTriggerPlaceholder: 'e.g. t20, 180, gameshot',
      bulkTriggerHint: 'If provided, all uploaded files will be assigned this trigger.',
      importUrlTitle: 'Import Sounds from URL',
      presetSets: 'Predefined Caller Sets (Optional)',
      customUrl: 'Custom URL',
      customUrlPlaceholder: 'https://example.com/caller-set.zip',
      importBtn: 'Import',
      saveFiles: 'Save Files',
      editSound: 'Edit Sound',
      addSoundTitle: 'Add Sound',
    },
    walkon: {
      title: 'Walk-On Songs',
      sectionTitle: 'Walk-On Music per Player',
      description: 'Upload your own music file or choose one of the famous PDC walk-on songs as a template.',
      homePlayer: 'Home Player',
      guestPlayer: 'Guest (Player 2)',
      presetLabel: '⭐ PDC Preset',
      uploadedLabel: '✔ Custom file uploaded',
      noSong: 'No song selected',
      uploadTitle: 'Drop file here or click',
      uploadHint: 'Drag & Drop or click to select',
      presetsTitle: 'PDC Walk-On Templates',
      volume: 'Walk-On Volume',
      duration: 'Play duration (seconds)',
      uploadSuccess: 'successfully uploaded!',
      removeConfirm: 'Really remove walk-on song?',
    },
    crowd: {
      title: 'Crowd & Atmosphere',
      sectionTitle: 'Dynamic Crowd Reactions',
      event180: '180 thrown',
      event180Desc: 'Eruption – loud cheering & "Stand up if you love the darts"',
      eventHigh: 'High throw (140+)',
      eventHighDesc: 'Cheering and clapping from the crowd',
      eventBust: 'Bust (overthrown)',
      eventBustDesc: 'Disappointed "Aaaaww" murmur',
      eventBad: 'Bad throw (Score 3)',
      eventBadDesc: 'Mocking whistling & "Boring, boring tables!"',
      eventPressure: 'Pressure Mode (Match Dart)',
      eventPressureDesc: 'Whistling & booing when throwing at match-winning double',
      volumeCrowd: 'Crowd',
      volumeAmbient: 'Ambient murmur',
    },
    soundFx: {
      title: 'Settings – Sound FX',
      description: 'Configure sound effects for game events.',
    },
    autoStart: {
      title: 'Settings – Auto-Start',
      description: 'The game starts automatically after a configurable timer.',
      seconds: 'Seconds until start',
    },
    qrCode: {
      title: 'Settings – QR Code',
      description: 'Automatically shows a QR code in the lobby.',
    },
    discord: {
      title: 'Settings – Discord Webhook',
      description: 'Automatically sends an invite link to a Discord channel.',
      webhookUrl: 'Webhook URL',
      manualMode: 'Manual mode',
    },
    zoom: {
      title: 'Settings – Dart Zoom',
      description: 'Enlarged view of throws.',
      position: 'Position',
      level: 'Zoom level',
      mode: 'Mode',
      zoomOn: 'Zoom for',
      showMarker: 'Show marker',
      onlyOnCheckout: 'Only on checkout',
    },
    stats: {
      title: 'Statistics',
      totalAvg: 'Total Average',
      first9: 'First 9 Avg',
      checkout: 'Checkout Rate',
      highestFinish: 'Highest Finish',
      count180: 'Number of 180s',
      h2hTitle: 'Head-to-Head Overview',
      opponent: 'Opponent',
      played: 'Games',
      record: 'Record',
      myAvg: 'Your Avg',
      oppAvg: 'Opp. Avg',
      bestFinish: 'Best Finish',
    },
    league: {
      title: 'League',
      tableTitle: 'League Table',
      position: 'Your Position',
      matchdays: 'Match Days',
      record: 'Record',
      avgLabel: 'League Average',
      player: 'Player',
      played: 'P',
      wins: 'W',
      losses: 'L',
      points: 'Pts',
      avg: 'Avg',
      checkout: 'Checkout',
    },
    friends: {
      title: 'Friends',
      quickPlay: 'Friends List – Quick Play',
      online: 'Online',
      offline: 'Offline',
      addFriend: '+ Add Friend',
      challenge: '▶ Challenge',
      inGame: 'In Game',
      offlineStatus: 'Offline',
      ready: '● Online – Ready',
      playing: '● Online – In Game',
      lastSeen: 'Last seen:',
      h2h: 'H2H:',
      avgLabel: 'Avg',
    },
  },
}

// ─── Reaktiver Zustand (global, singleton) ───────────────────────────────────

const STORAGE_KEY = 'local:autodarts-tools-lang'
const lang = ref<Lang>('de')

// Sprache aus dem Browser-Storage laden
async function loadLang() {
  try {
    const stored = await storage.getItem<Lang>(STORAGE_KEY)
    if (stored === 'de' || stored === 'en') {
      lang.value = stored
    }
  }
  catch {
    // Fallback: Deutsch
  }
}

loadLang()

// ─── Composable ──────────────────────────────────────────────────────────────

export function useI18n() {
  /**
   * Übersetzt einen Schlüssel im Format "kategorie.schlüssel"
   * Beispiel: t('caller.title') → "Einstellungen – Caller"
   */
  function t(key: string): string {
    const keys = key.split('.')
    let node: string | TranslationTree = translations[lang.value]
    for (const k of keys) {
      if (typeof node === 'object' && k in node) {
        node = node[k]
      }
      else {
        // Fallback: englischen Text versuchen
        let fallback: string | TranslationTree = translations.en
        for (const fk of keys) {
          if (typeof fallback === 'object' && fk in fallback) {
            fallback = fallback[fk]
          }
          else {
            return key // Schlüssel als Fallback
          }
        }
        return typeof fallback === 'string' ? fallback : key
      }
    }
    return typeof node === 'string' ? node : key
  }

  /**
   * Sprache wechseln und im Storage persistieren
   */
  async function setLang(newLang: Lang) {
    lang.value = newLang
    try {
      await storage.setItem(STORAGE_KEY, newLang)
    }
    catch {
      // Ignorieren
    }
  }

  return {
    lang: computed(() => lang.value),
    t,
    setLang,
  }
}
