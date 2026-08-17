import type { BoardStatus } from "@/utils/types";
import type { TrainingSession } from "@/utils/training-history";
import { FALLBACK_BACKEND_URL } from "@/utils/backend-url";

export interface IConfig {
  version: number;
  discord: {
    enabled: boolean;
    manually: boolean;
    url: string;
    autoStartAfterTimer?: {
      enabled: boolean;
      minutes: number;
      stream: boolean;
      matchId: string;
      messageId: string;
    };
  };
  autoStart: {
    enabled: boolean;
  };
  qrCode: {
    enabled: boolean;
  };
  streamingMode: {
    enabled: boolean;
    backgroundImage: boolean;
    chromaKeyColor: string;
    image: string;
    throws: boolean;
    footerText: string;
    board: boolean;
    boardImage: boolean;
    avg: boolean; // P4394
    checkout: boolean; // Display checkout suggestions
    scoreBoardSettings: {
      scale: number;
      x: number;
      y: number;
    };
    coordsSettings: {
      scale: number;
      x: number;
      y: number;
    };
  };
  colors: {
    enabled: boolean;
    background: string;
    text: string;
    matchBackground: string;
  };
  recentLocalPlayers: {
    enabled: boolean;
    cap: number;
    players: string[];
  };
  takeout: {
    enabled: boolean;
  };
  smallerScores: {
    enabled: boolean;
  };
  shufflePlayers: {
    enabled: boolean;
  };
  sounds: {
    enabled: boolean;
  };
  externalBoards: {
    enabled: boolean;
    boards: {
      id: string;
      name: string;
    }[];
  };
  hideMenuInMatch: {
    enabled: boolean;
  };
  automaticFullscreen: {
    enabled: boolean;
  };
  largerLegsSets: {
    enabled: boolean;
    value: number;
  };
  largerPlayerMatchData: {
    enabled: boolean;
    value: number;
  };
  largerPlayerNames: {
    enabled: boolean;
    value: number;
  };
  automaticNextLeg: {
    enabled: boolean;
    sec: number;
  };
  winnerAnimation: {
    enabled: boolean;
  };
  nextPlayerOnTakeOutStuck: {
    enabled: boolean;
    sec: number;
  };
  teamLobby: {
    enabled: boolean;
  };

  animations: {
    enabled: boolean;
    duration?: number;
    delayStart?: number;
    objectFit?: "cover" | "contain";
    viewMode?: "full-page" | "board-only";
    data: IAnimation[];
  };
  caller: {
    enabled: boolean;
    callEveryDart: boolean;
    callCheckout: boolean;
    randomCaller: boolean; // Zufälligen Caller pro Match wählen
    sounds: ISound[];
    muteNativeAutodarts?: boolean; // v2.9.64: nativen Autodarts-Caller unterdrücken (Default: true)
  };
  soundFx: {
    enabled: boolean;
    sounds: ISound[];
  };
  zoom: {
    enabled: boolean;
    position: "bottom-right" | "bottom-left" | "center";
    level: number;
    mode: "live" | "image";
    zoomOn: "everyone" | "opponents";
    showMarker: boolean;
    onlyOnCheckout: boolean;
  };
  quickCorrection: {
    enabled: boolean;
    scale: number;
  };
  enhancedScoringDisplay: {
    enabled: boolean;
  };
  instantReplay: {
    enabled: boolean;
    deviceId: string;
    duration: number;
    delay: number;
    viewMode?: "full-page" | "board-only";
    zoom: number;
    positionX: number;
    positionY: number;
  };
  wledFx: {
    enabled: boolean;
    onlyOnce: boolean;
    boardIds: string[];
    effects: IWled[];
  };
  gotcha: {
    enabled: boolean;
  };
  // ─── NEU: Walk-On Songs ───────────────────────────────────────────────────
  walkon: {
    enabled: boolean;
    volume: number;
    duration: number;
    players: IWalkonPlayer[];
  };
  // ─── NEU: Crowd & Atmosphäre ─────────────────────────────────────────────
  crowd: {
    enabled: boolean;
    ambientEnabled: boolean;        // Hintergrundgemurmel an/aus
    ambientVolume: number;
    crowdVolume: number;
    pressureEnabled: boolean;       // Pfeifen bei Checkout-Druck
    lowScoreBoosEnabled: boolean;   // Buhrufe bei sehr niedrigen Scores
    /** v2.9.85 — Auto-Venue passend zur Karriere-Difficulty. */
    autoVenueByDifficulty?: boolean;
    reactions: ICrowdReaction[];
  };
  // ─── NEU: Bogey-Number Warnung ──────────────────────────────────────────────
  bogeyWarning: {
    enabled: boolean;
    showCheckoutSuggestion: boolean;
    highlightColor: string;
  };
  // ─── NEU: KI-Kommentator ─────────────────────────────────────────────────────
  aiCommentator: {
    enabled: boolean;
    language: 'de' | 'en';
    voice: string;
    volume: number;
    playerName1: string;
    playerName2: string;
    ttsProvider: 'browser' | 'elevenlabs' | 'google' | 'azure' | 'openai';
    apiKey: string;
    legStatsEnabled: boolean;
    checkoutSpeechEnabled: boolean;
    // ── v2.9.73 – LLM Duo-Kommentator ─────────────────────────────────────
    duoMode: boolean;               // Aktiviert LLM-basiertes Duo (Analytiker + Entertainer)
    backendUrl: string;             // Emergent-Backend Basis-URL für den Proxy
    analystVoice: string;           // TTS-Voice-ID des Analytikers
    entertainerVoice: string;       // TTS-Voice-ID des Entertainers
    intensity: 'chill' | 'normal' | 'hype';
  };
  // ─── v2.9.74 – Precision Map (Heatmap + KI-Coach + Share-Card) ───────────
  precisionMap: {
    enabled: boolean;
    autoShowAfterMatch: boolean;
    coachEnabled: boolean;
    shareCardEnabled: boolean;
    maxThrowsRetained: number;
  };
  // ─── v2.9.75 – Anonymer globaler ELO-Ladder ───────────────────────────────
  elo: {
    enabled: boolean;
    displayName: string;         // frei wählbar, default Anonymous_XXXX
    submitEnabled: boolean;      // Auto-Submit am Match-Ende
    backendUrl: string;          // Ladder-Backend
  };
  // ─── v2.9.78 – PDC Bot-Skin-Picker ────────────────────────────────────────
  botSkinPicker: {
    enabled: boolean;
  };
  // ─── v2.9.81 – Face-to-Face Video (WebRTC) ────────────────────────────────
  faceToFace: {
    enabled: boolean;
    backendUrl: string;
  };
  // ─── v2.9.93 – Externer Kalibrierungs-Server (Vorbereitung für Vision-Auto-Cal)
  // Aktuell NUR Adress-Feld + Health-Check-Anzeige, keine echte Integration.
  // Wird später von einem eigenen Vision-Modul befüllt, sobald beide Seiten stabil.
  visionCalibration: {
    backendUrl: string;
  };
  // ─── NEU: Sprache ─────────────────────────────────────────────────────────
  language: 'de' | 'en';
  // ─── NEU: TV-Style Statistiken ──────────────────────────────────────────────
  tvStats: {
    enabled: boolean;
    showFirst9Avg: boolean;
    showDoubleQuote: boolean;
    showCheckoutSuggestion: boolean;
    showBestLeg: boolean;
    showSetsLegs: boolean;
    position: 'bottom' | 'top' | 'side';
    opacity: number;
    displayDuration: number; // Anzeigedauer in Millisekunden (z.B. 5000 = 5 Sekunden)
  };
  // ─── NEU: Liga-System ───────────────────────────────────────────────────────
  liga: {
    enabled: boolean;
    name: string;
    shareCode: string;        // Share-Code zum Beitreten einer Liga (kein Account nötig)
    autoSubmit: boolean;
    showTableOverlay: boolean;
    rankingMode: 'wins' | 'average' | 'combined';
  };
  // ─── NEU: Trainings-Modus ───────────────────────────────────────────────────
  training: {
    enabled: boolean;
    goals: {
      minAverage: number;
      min140Plus: number;
      min180s: number;
      maxCheckoutMisses: number;
      minCheckoutRate: number;
    };
    showLiveProgress: boolean;
    showSummaryAfterMatch: boolean;
    trackHistory: boolean;
  };
  // ─── NEU: Buzzer Party-Modus ────────────────────────────────────────────────
  buzzer: {
    enabled: boolean;
    maxPlayers: number;
    soundEnabled: boolean;
    showQrCode: boolean;
    serverPort: number;
  };
  // ─── NEU: Clutch Moments ────────────────────────────────────────────────────
  clutch: {
    enabled: boolean;
    heartbeatEnabled: boolean;
    vignetteEnabled: boolean;
    bannerEnabled: boolean;
  };
  // ─── NEU: Rivalitäten & Nemesis ─────────────────────────────────────────────
  rivalry: {
    enabled: boolean;
    showPreMatchComment: boolean;
    showTrophy: boolean;
  };
  // ─── NEU: Dynamisches Handicap ──────────────────────────────────────────────
  handicap: {
    enabled: boolean;
    type: 'auto' | 'points' | 'legs' | 'off';
    showBanner: boolean;
  };
  // ─── NEU: Manuelles Soundboard ──────────────────────────────────────────────
  soundboard: {
    enabled: boolean;
    position: 'bottom' | 'top';
    volume: number;
  };
  // ─── NEU: Dart-Aufprall-Sound ──────────────────────────────────────────────
  dartImpact: {
    enabled: boolean;
    volume: number;
    variant: 'thud' | 'click' | 'random';
  };
}

export interface IWalkonPlayer {
  playerId: string;
  playerName: string;
  songName: string;
  songArtist: string;
  presetKey: string;
  base64: string;
  url: string;
}

export interface ICrowdReaction {
  eventKey: string;
  enabled: boolean;
  soundUrl: string;
  base64: string;
}

export interface ISoundTTS {
  text: string;
  voiceURI: string;
  lang: string;
  rate: number;
  pitch: number;
}

export interface ISound {
  name: string;
  url: string;
  base64: string;
  enabled: boolean;
  triggers: string[];
  soundId?: string;
  tts?: ISoundTTS;
  callerName?: string; // Optionaler Caller-Name für Zufalls-Caller-Funktion
}

export interface IAnimation {
  url: string;
  triggers: string[];
  enabled: boolean;
  animationId?: string;
}

export interface IGlobalStatus {
  isFirstStart: boolean;
  user: {
    name: string;
  };
  auth?: {
    token: string;
    // v2.9.90: Zeitstempel des zuletzt eingefangenen Tokens (ms since epoch).
    // Wird von `ensureFreshAuthToken()` benutzt, um festzustellen ob ein
    // Token noch frisch genug ist (Autodarts-JWT lebt nur ~15 Minuten).
    tokenAt?: number;
  };
}

export interface IPlayerInfo {
  id?: string;
  index?: number;
  name: string;
  score: string;
  isActive: boolean;
  legs?: string;
  sets?: string;
  darts?: string;
  stats?: string;
  matchHasLegs?: boolean;
  matchHasSets?: boolean;
  userId?: string;
  avatarUrl?: string;
  hostId?: string;
  boardId?: string;
  cpuPPR?: number | null;
  user?: {
    id: string;
    name: string;
    avatarUrl: string;
    userSettings: {
      showCheckoutGuide: boolean;
      countEachThrow: boolean;
      showChalkboard: boolean;
      showAnimations: boolean;
      caller: string;
      callerEmotion: string;
      callerLanguage: string;
      callerVolume: number;
      callScores: boolean;
      callCheckouts: boolean;
      showSeasonalEffects: boolean;
    };
    country: string;
    legsPlayed: number;
    total180s: number;
    average: number;
    averageUntil170: number;
    first9Average: number;
    checkoutRate: number;
    tournamentsPlayed: number;
    tournamentWins: number;
    tournamentAverage: number;
    tournamentAverageUntil170: number;
    tournament180s: number;
  };
  host?: {
    id: string;
    name: string;
    avatarUrl: string;
    userSettings: {
      showCheckoutGuide: boolean;
      countEachThrow: boolean;
      showChalkboard: boolean;
      showAnimations: boolean;
      caller: string;
      callerEmotion: string;
      callerLanguage: string;
      callerVolume: number;
      callScores: boolean;
      callCheckouts: boolean;
      showSeasonalEffects: boolean;
    };
    country: string;
    legsPlayed: number;
    total180s: number;
    average: number;
    averageUntil170: number;
    first9Average: number;
    checkoutRate: number;
    tournamentsPlayed: number;
    tournamentWins: number;
    tournamentAverage: number;
    tournamentAverageUntil170: number;
    tournament180s: number;
  };
}

export interface ILobbyStatus {
  isPrivate: boolean;
  id?: string;
  createdAt?: string;
  variant?: string;
  settings?: {
    baseScore: number;
    bullMode: string;
    inMode: string;
    maxRounds: number;
    outMode: string;
  };
  bullOffMode?: string;
  host?: {
    id: string;
    name: string;
    avatarUrl: string;
    userSettings: {
      showCheckoutGuide: boolean;
      countEachThrow: boolean;
      showChalkboard: boolean;
      showAnimations: boolean;
      caller: string;
      callerEmotion: string;
      callerLanguage: string;
      callerVolume: number;
      callScores: boolean;
      callCheckouts: boolean;
      showSeasonalEffects: boolean;
    };
    country: string;
    legsPlayed: number;
    total180s: number;
    average: number;
    averageUntil170: number;
    first9Average: number;
    checkoutRate: number;
    tournamentsPlayed: number;
    tournamentWins: number;
    tournamentAverage: number;
    tournamentAverageUntil170: number;
    tournament180s: number;
  };
  players?: any | null;
  maxPlayers?: number;
}

export enum WledType {
  PRESET = "PRESET",
  URL = "URL",
  API = "API",
}

export interface IWled {
  name: string;
  type: WledType;
  url: string;
  preset: string;
  json_api: string;
  enabled: boolean;
  triggers: string|string[];
}

export type TBoardStatus = BoardStatus | undefined;

export const defaultConfig: IConfig = {
  version: 21,
  discord: {
    enabled: false,
    manually: false,
    url: "",
    autoStartAfterTimer: {
      enabled: false,
      minutes: 5,
      stream: false,
      matchId: "",
      messageId: "",
    },
  },
  autoStart: {
    enabled: false,
  },
  qrCode: {
    enabled: false,
  },
  streamingMode: {
    enabled: false,
    backgroundImage: false,
    chromaKeyColor: "#009933",
    image: "",
    throws: false,
    footerText: "",
    board: false,
    boardImage: false,
    avg: false, // P42de
    checkout: false,
    scoreBoardSettings: {
      scale: 1,
      x: 0,
      y: 0,
    },
    coordsSettings: {
      scale: 1,
      x: 0,
      y: 0,
    },
  },
  colors: {
    enabled: false,
    background: "#3182CE",
    text: "#FFFFFF",
    matchBackground: "#3c3c3c",
  },
  recentLocalPlayers: {
    enabled: false,
    cap: 10,
    players: [],
  },
  takeout: {
    enabled: false,
  },
  smallerScores: {
    enabled: false,
  },
  shufflePlayers: {
    enabled: false,
  },
  caller: {
    enabled: false,
    callEveryDart: false,
    callCheckout: false,
    randomCaller: false,
    sounds: [],
    muteNativeAutodarts: true,
  },
  sounds: {
    enabled: false,
  },
  externalBoards: {
    enabled: false,
    boards: [],
  },
  hideMenuInMatch: {
    enabled: true,
  },
  automaticFullscreen: {
    enabled: false,
  },
  largerLegsSets: {
    enabled: false,
    value: 2.5,
  },
  largerPlayerMatchData: {
    enabled: false,
    value: 1.5,
  },
  largerPlayerNames: {
    enabled: false,
    value: 2.5,
  },
  automaticNextLeg: {
    enabled: false,
    sec: 5,
  },
  winnerAnimation: {
    enabled: false,
  },
  nextPlayerOnTakeOutStuck: {
    enabled: false,
    sec: 10,
  },
  teamLobby: {
    enabled: false,
  },

  zoom: {
    enabled: false,
    position: "bottom-right",
    level: 3,
    mode: "live",
    zoomOn: "everyone",
    showMarker: true,
    onlyOnCheckout: false,
  },
  quickCorrection: {
    enabled: false,
    scale: 1,
  },
  enhancedScoringDisplay: {
    enabled: false,
  },
  instantReplay: {
    enabled: false,
    deviceId: "",
    duration: 10,
    delay: 5,
    viewMode: "board-only",
    zoom: 1,
    positionX: 0,
    positionY: 0,
  },
  animations: {
    enabled: false,
    duration: 5,
    delayStart: 1,
    objectFit: "cover",
    viewMode: "board-only",
    data: [
      {
        url: "https://media.tenor.com/G4cRydvvtU4AAAAM/ted-hankey-darts.gif",
        triggers: [ "t20_t20_bull" ],
        enabled: true,
      },
      {
        url: "https://media1.tenor.com/m/uhkDiMdcP44AAAAd/rapid-darts-darts.gif",
        triggers: [ "gameshot" ],
        enabled: true,
      },
      {
        url: "https://media1.tenor.com/m/QriSf7Rc78cAAAAd/darts-niner.gif",
        triggers: [ "gameshot" ],
        enabled: true,
      },
      {
        url: "https://media.tenor.com/VGyxDGucFyAAAAAM/dancing-bubbly.gif",
        triggers: [ "gameshot" ],
        enabled: true,
      },
      {
        url: "https://media1.tenor.com/m/2SQcMaUE_D8AAAAd/celebrate-winner.gif",
        triggers: [ "gameshot" ],
        enabled: true,
      },
      {
        url: "https://media1.tenor.com/m/HhqlzHe8tXsAAAAd/bulls-eye-anderson.gif",
        triggers: [ "bull", "s50" ],
        enabled: true,
      },
      {
        url: "https://media1.tenor.com/m/Oqlecl-G3xAAAAAd/simon-whitlock-darts-bull.gif",
        triggers: [ "bull", "s50" ],
        enabled: true,
      },
      {
        url: "https://media1.tenor.com/m/pJJbIyu-Bf0AAAAd/tony-o-shea-tony.gif",
        triggers: [ "bull", "s50" ],
        enabled: true,
      },
      {
        url: "https://media1.tenor.com/m/bYQ_X5uvRrIAAAAd/gerwyn-price-darts.gif",
        triggers: [ "180" ],
        enabled: true,
      },
      {
        url: "https://media1.tenor.com/m/lTiUQMnV_qQAAAAC/gerwynprice-darts.gif",
        triggers: [ "180" ],
        enabled: true,
      },
      {
        url: "https://media.tenor.com/xFkVft-1xMQAAAAM/gerwyn-price-darts.gif",
        triggers: [ "180" ],
        enabled: true,
      },
      {
        url: "https://media.tenor.com/uL_HJCSQfkIAAAAM/throw-toss.gif",
        triggers: [ "180" ],
        enabled: true,
      },
      {
        url: "https://media1.tenor.com/m/psyC1iEr058AAAAd/bulls-eye-animation.gif",
        triggers: [ "outside" ],
        enabled: true,
      },
      {
        url: "https://media1.tenor.com/m/x715u156Jz4AAAAd/bbc-america-darts-bbca.gif",
        triggers: [ "outside" ],
        enabled: true,
      },
      {
        url: "https://media.tenor.com/sbknQ0awa2sAAAAM/bbc-america-darts-bbca.gif",
        triggers: [ "outside" ],
        enabled: true,
      },
      {
        url: "https://media.tenor.com/kD_PH0LHaHEAAAAM/sigh-growl.gif",
        triggers: [ "outside" ],
        enabled: true,
      },
      {
        url: "https://media1.tenor.com/m/jaqTZHiIA7EAAAAd/james-wade-darts.gif",
        triggers: [ "busted" ],
        enabled: true,
      },
      {
        url: "https://media.tenor.com/LU60882wezcAAAAM/fallon-sherrock-sports.gif",
        triggers: [ "busted" ],
        enabled: true,
      },
      {
        url: "https://media.tenor.com/Rpa8qRNWZ3UAAAAM/glen-durrant-miss.gif",
        triggers: [ "busted" ],
        enabled: true,
      },
      {
        url: "https://media.tenor.com/tfkMfGGbcLoAAAAM/bbc-america-darts-bbca.gif",
        triggers: [ "busted" ],
        enabled: true,
      },
    ],
  },
  soundFx: {
    enabled: false,
    sounds: [
      {
        name: "busted",
        url: "https://www.myinstants.com/media/sounds/super-mario-dies.mp3",
        base64: "",
        enabled: true,
        triggers: [ "ambient_busted" ],
      },
      {
        name: "triple",
        url: "https://autodarts.x10.mx/beep_1.mp3",
        base64: "",
        enabled: true,
        triggers: [ "ambient_triple" ],
      },
      {
        name: "t17",
        url: "https://autodarts.x10.mx/beep_2_17.wav",
        base64: "",
        enabled: true,
        triggers: [ "ambient_t17" ],
      },
      {
        name: "t18",
        url: "https://autodarts.x10.mx/beep_2_18.wav",
        base64: "",
        enabled: true,
        triggers: [ "ambient_t18" ],
      },
      {
        name: "t19",
        url: "https://autodarts.x10.mx/beep_2_19.wav",
        base64: "",
        enabled: true,
        triggers: [ "ambient_t19" ],
      },
      {
        name: "t20",
        url: "https://autodarts.x10.mx/beep_2_20.wav",
        base64: "",
        enabled: true,
        triggers: [ "ambient_t20" ],
      },
      {
        name: "bull",
        url: "https://autodarts.x10.mx/beep_2_bullseye.mp3",
        base64: "",
        enabled: true,
        triggers: [ "ambient_bull" ],
      },
      {
        name: "miss",
        url: "https://autodarts.x10.mx/miss_1.mp3",
        base64: "",
        enabled: true,
        triggers: [ "ambient_miss" ],
      },
      {
        name: "miss",
        url: "https://autodarts.x10.mx/miss_2.mp3",
        base64: "",
        enabled: true,
        triggers: [ "ambient_miss" ],
      },
      {
        name: "miss",
        url: "https://autodarts.x10.mx/miss_3.mp3",
        base64: "",
        enabled: true,
        triggers: [ "ambient_miss" ],
      },
      {
        name: "gameshot",
        url: "https://www.myinstants.com/media/sounds/dart-winner.mp3",
        base64: "",
        enabled: true,
        triggers: [ "ambient_gameshot" ],
      },
      {
        name: "cricket_miss",
        url: "https://autodarts.x10.mx/sound_double_windart.wav",
        base64: "",
        enabled: true,
        triggers: [ "cricket_miss" ],
      },
      {
        name: "cricket_hit",
        url: "https://autodarts.x10.mx/bonus-points.mp3",
        base64: "",
        enabled: true,
        triggers: [ "cricket_hit" ],
      },
    ],
  },
  wledFx: {
    enabled: false,
    onlyOnce: true,
    boardIds: [],
    effects: [
      {
        name: "gameon",
        type: WledType.URL,
        url: "http://wled-device.local/win/PL=10",
        preset: "",
        json_api: "",
        enabled: true,
        triggers: [ "gameon" ],
      },
      {
        name: "takeout",
        type: WledType.URL,
        url: "wled-device.local",
        preset: "4",
        json_api: "",
        enabled: true,
        triggers: [ "takeout" ],
      },
      {
        name: "gameshot",
        type: WledType.URL,
        url: "192.168.0.69",
        preset: "6",
        json_api: "",
        enabled: true,
        triggers: [ "gameshot" ],
      }
    ],
  },
  gotcha: {
    enabled: false,
  },
  // ─── NEU: Walk-On Songs ───────────────────────────────────────────────────
  walkon: {
    enabled: false,
    volume: 75,
    duration: 15,
    players: [
      {
        playerId: 'home',
        playerName: 'Heimspieler',
        songName: '',
        songArtist: '',
        presetKey: '',
        base64: '',
        url: '',
      },
      {
        playerId: 'guest',
        playerName: 'Gast',
        songName: '',
        songArtist: '',
        presetKey: '',
        base64: '',
        url: '',
      },
    ],
  },
  // ─── NEU: Crowd & Atmosphäre ─────────────────────────────────────────────
  crowd: {
    enabled: false,
    ambientEnabled: true,
    ambientVolume: 25,
    crowdVolume: 60,
    pressureEnabled: true,
    lowScoreBoosEnabled: false,
    // v2.9.85 — Automatisches Venue-Preset abhängig vom Karriere-Skill-Level
    // (pub/amateur→local-pub, semipro→Butlin's, pro→Blackpool, elite→Ally Pally).
    // TV-Turniere heben dies auf Ally Pally an. Standard: an.
    autoVenueByDifficulty: true,
    reactions: [
      { eventKey: 'crowd_180',                  enabled: true,  soundUrl: '', base64: '' },
      { eventKey: 'crowd_170',                  enabled: true,  soundUrl: '', base64: '' },
      { eventKey: 'crowd_140plus',              enabled: true,  soundUrl: '', base64: '' },
      { eventKey: 'crowd_100plus',              enabled: true,  soundUrl: '', base64: '' },
      { eventKey: 'crowd_matchshot',            enabled: true,  soundUrl: '', base64: '' },
      { eventKey: 'crowd_gameshot',             enabled: true,  soundUrl: '', base64: '' },
      { eventKey: 'crowd_comeback',             enabled: true,  soundUrl: '', base64: '' },
      { eventKey: 'crowd_nine_darter_potential', enabled: true,  soundUrl: '', base64: '' },
      { eventKey: 'crowd_bust',                 enabled: true,  soundUrl: '', base64: '' },
      { eventKey: 'crowd_bust_double_miss',     enabled: true,  soundUrl: '', base64: '' },
      { eventKey: 'crowd_low_score',            enabled: false, soundUrl: '', base64: '' },
      { eventKey: 'crowd_checkout_pressure',    enabled: true,  soundUrl: '', base64: '' },
      { eventKey: 'crowd_close_game',           enabled: true,  soundUrl: '', base64: '' },
      { eventKey: 'crowd_gameon',               enabled: true,  soundUrl: '', base64: '' },
      { eventKey: 'crowd_ambient',              enabled: true,  soundUrl: '', base64: '' },
    ],
  },
  // ─── NEU: Bogey-Number Warnung ──────────────────────────────────────────────
  bogeyWarning: {
    enabled: true,
    showCheckoutSuggestion: true,
    highlightColor: '#E8002D',
  },
  // ─── NEU: KI-Kommentator ─────────────────────────────────────────────────────
  aiCommentator: {
    enabled: false,
    language: 'de',
    ttsProvider: 'browser',
    voice: '',
    volume: 80,
    playerName1: '',
    playerName2: '',
    apiKey: '',
    legStatsEnabled: true,
    checkoutSpeechEnabled: true,
    // v2.9.73 – LLM Duo
    duoMode: false,
    backendUrl: FALLBACK_BACKEND_URL,
    analystVoice: '',
    entertainerVoice: '',
    intensity: 'normal',
  },
  // ─── v2.9.74 – Precision Map ──────────────────────────────────────────────
  precisionMap: {
    enabled: true,
    autoShowAfterMatch: true,
    coachEnabled: true,
    shareCardEnabled: true,
    maxThrowsRetained: 5000,
  },
  // ─── v2.9.75 – Anonymer ELO-Ladder ────────────────────────────────────────
  elo: {
    enabled: true,
    displayName: '',
    submitEnabled: true,
    backendUrl: FALLBACK_BACKEND_URL,
  },
  // ─── v2.9.78 – PDC Bot-Skin-Picker ────────────────────────────────────────
  botSkinPicker: {
    enabled: true,
  },
  // ─── v2.9.81 – Face-to-Face Video (WebRTC) ────────────────────────────────
  faceToFace: {
    enabled: false,
    backendUrl: FALLBACK_BACKEND_URL,
  },
  // ─── v2.9.93 – Externer Kalibrierungs-Server (nur Adress-Feld) ────────────
  visionCalibration: {
    // Leerer Default: der User muss die Adresse seines lokal laufenden
    // Kalibrierungs-Servers (z.B. http://localhost:8765) selbst eintragen.
    // Kein FALLBACK_BACKEND_URL, weil das Feature ausschließlich lokal läuft.
    backendUrl: "",
  },
  // ─── NEU: Sprache ─────────────────────────────────────────────────────────
  language: 'de',
  // ─── NEU: TV-Style Statistiken ──────────────────────────────────────────────
  tvStats: {
    enabled: true,
    showFirst9Avg: true,
    showDoubleQuote: true,
    showCheckoutSuggestion: true,
    showBestLeg: true,
    showSetsLegs: true,
    position: 'bottom',
    opacity: 90,
    displayDuration: 5000,
  },
  // ─── NEU: Liga-System ───────────────────────────────────────────────────────
  liga: {
    enabled: false,
    name: 'Meine Darts-Liga',
    shareCode: '',            // Wird beim Erstellen einer Liga automatisch generiert
    autoSubmit: true,
    showTableOverlay: true,
    rankingMode: 'combined',
  },
  // ─── NEU: Trainings-Modus ───────────────────────────────────────────────────
  training: {
    enabled: false,
    goals: {
      minAverage: 60,
      min140Plus: 2,
      min180s: 1,
      maxCheckoutMisses: 3,
      minCheckoutRate: 30,
    },
    showLiveProgress: true,
    showSummaryAfterMatch: true,
    trackHistory: true,
  },
  // ─── NEU: Buzzer Party-Modus ────────────────────────────────────────────────
  buzzer: {
    enabled: false,
    maxPlayers: 4,
    soundEnabled: true,
    showQrCode: true,
    serverPort: 7182,
  },
  // ─── NEU: Clutch Moments ────────────────────────────────────────────────────
  clutch: {
    enabled: true,
    heartbeatEnabled: true,
    vignetteEnabled: true,
    bannerEnabled: true,
  },
  // ─── NEU: Rivalitäten & Nemesis ─────────────────────────────────────────────
  rivalry: {
    enabled: true,
    showPreMatchComment: true,
    showTrophy: true,
  },
  // ─── NEU: Dynamisches Handicap ──────────────────────────────────────────────
  handicap: {
    enabled: false,
    type: 'auto',
    showBanner: true,
  },
  // ─── NEU: Manuelles Soundboard ──────────────────────────────────────────────
  soundboard: {
    enabled: false,
    position: 'bottom' as 'bottom' | 'top',
    volume: 70,
  },
  // ─── NEU: Dart-Aufprall-Sound ──────────────────────────────────────────────
  dartImpact: {
    enabled: false,
    volume: 70,
    variant: 'random' as 'thud' | 'click' | 'random',
  },
};

export const AutodartsToolsConfig: WxtStorageItem<IConfig, any> = storage.defineItem(
  "local:config-2-0-0",
  {
    defaultValue: defaultConfig,
  },
);

export const defaultGlobalStatus: IGlobalStatus = {
  isFirstStart: false,
  user: {
    name: "",
  },
  auth: {
    token: "",
  },
};

export const AutodartsToolsGlobalStatus: WxtStorageItem<IGlobalStatus, any> = storage.defineItem(
  "local:globalstatus",
  {
    defaultValue: defaultGlobalStatus,
  },
);

export const AutodartsToolsBoardStatus: WxtStorageItem<TBoardStatus, any> = storage.defineItem(
  "local:boardstatus",
  {
    defaultValue: undefined,
  },
);

export const AutodartsToolsUrlStatus: WxtStorageItem<string, any> = storage.defineItem(
  "local:urlstatus",
  {
    defaultValue: typeof window !== "undefined" ? window.location.href.split("#")[0] || "undefined" : "undefined",
  },
);

export const AutodartsToolsStreamingModeStatus: WxtStorageItem<boolean, any> = storage.defineItem(
  "local:streamingmodestatus",
  {
    defaultValue: false,
  },
);

export const AutodartsToolsTrainingHistory: WxtStorageItem<TrainingSession[], any> = storage.defineItem(
  "local:training-history",
  {
    defaultValue: [],
  },
);

/** Guards the one-time migration of legacy page-`localStorage` training history into browser.storage.local. */
export const AutodartsToolsTrainingHistoryMigrated: WxtStorageItem<boolean, any> = storage.defineItem(
  "local:training-history-migrated-v1",
  {
    defaultValue: false,
  },
);

/**
 * Map to track locks for each config key to prevent concurrent updates
 */
const configLocks = new Map<keyof IConfig, number>();

/**
 * Utility function to check if a config section has changed
 * @param currentConfigSection The current config section from storage
 * @param newConfigSection The new config section from the component
 * @returns boolean indicating if the config sections are different
 */
export function hasConfigChanged<T>(currentConfigSection: T, newConfigSection: T): boolean {
  return JSON.stringify(currentConfigSection) !== JSON.stringify(newConfigSection);
}

/**
 * Updates the config only if the specified section has changed
 * @param currentConfig The current config from storage
 * @param newConfig The new config from the component
 * @param configKey The key of the config section to check
 * @returns Promise<void>
 */
export async function updateConfigIfChanged<K extends keyof IConfig>(
  currentConfig: IConfig,
  newConfig: IConfig | undefined,
  configKey: K,
): Promise<void> {
  if (!newConfig) return;

  /**
   * This is needed because sometimes the config is updated multiple times in a row
   * because of updated hooks from input fields getting triggered.
   */
  // Check if this config key is currently locked
  const lockTime = configLocks.get(configKey);
  if (lockTime && Date.now() - lockTime < 100) {
    // Config is locked, skip update
    return;
  }

  // Set lock for this config key
  configLocks.set(configKey, Date.now());

  if (!hasConfigChanged(currentConfig[configKey], newConfig[configKey])) return;

  console.log("Autodarts Tools: Updating config", configKey, newConfig[configKey]);

  // Get the latest config to ensure we have the most up-to-date values
  const latestConfig = await AutodartsToolsConfig.getValue();

  // Only update the specific section that changed
  // Deep clone but preserve array types
  const preserveArrays = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => preserveArrays(item));
    }

    if (typeof obj === "object") {
      const result: any = {};
      for (const key in obj) {
        result[key] = preserveArrays(obj[key]);
      }
      return result;
    }

    return obj;
  };

  const test = {
    ...latestConfig,
    [configKey]: preserveArrays(newConfig[configKey]),
  };

  await AutodartsToolsConfig.setValue(toRaw(test));
}
