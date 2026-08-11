import "~/assets/tailwind.css";
import { createApp } from "vue";

import Takeout from "./Takeout.vue";
import Zoom from "./Zoom.vue";
import Animations from "./Animations.vue";
import StreamingMode from "./StreamingMode.vue";
import QuickCorrection from "./QuickCorrection.vue";
import InstantReplay from "./InstantReplay.vue";
import Gotcha from "./Gotcha.vue";

import { waitForElement, waitForElementWithTextContent } from "@/utils";
import {
  AutodartsToolsConfig,
  AutodartsToolsUrlStatus,
} from "@/utils/storage";
import { fetchWithAuth, isSafari, isiOS } from "@/utils/helpers";
import { processWebSocketMessage } from "@/utils/websocket-helpers";
import { AutodartsToolsGameData } from "@/utils/game-data-storage";

// v2.9.68 – Bundle-Splitting / Lazy Feature Loading
// -------------------------------------------------
// Alle statischen Feature-Imports wurden auf dynamische `await import()`
// umgestellt. WXT + MV3 kompiliert Content-Scripts als IIFE (kein echtes
// Chunk-Splitting möglich), aber der TOP-LEVEL MODUL-CODE deaktivierter
// Features wird jetzt NICHT mehr eager ausgeführt.
//
// Konsequenzen:
//   • ~200-400 ms schnellerer initMatch()-Cold-Path bei ausgeschalteten
//     Features (kein Vue-Reaktivitäts-Setup für ungenutzte Composables,
//     keine WebAudio-Context-Initialisierung, keine Event-Listener).
//   • Sauberes Cleanup-Registry-Pattern: jedes Feature registriert seine
//     OnRemove-Funktion nach dem Lazy-Load statt statisch verdrahtet.
//   • Bessere Tree-Shaking-Chancen für Vite/esbuild.

let matchInitialized = false;
let activeMatchObserver: MutationObserver | null = null;
let gameDataWatcher: any;

// Vue-Shadow-Root Instanzen (Referenzen für Cleanup)
const shadowUis = {
  streamingMode: null as any,
  takeout: null as any,
  animations: null as any,
  zoom: null as any,
  quickCorrection: null as any,
  instantReplay: null as any,
  gotcha: null as any[] | null,
};

// Registry aller aktiven Feature-Cleanups. Jedes lazy-loaded Feature
// pushet hier seine OnRemove-Funktion. Wird bei clearMatch() ausgeführt.
const featureCleanups: Array<() => void | Promise<void>> = [];

function registerCleanup(fn: () => void | Promise<void>) {
  if (typeof fn === "function") featureCleanups.push(fn);
}

async function runCleanups() {
  const fns = featureCleanups.splice(0);
  for (const fn of fns) {
    try {
      await fn();
    } catch (e) {
      console.error("Autodarts Tools: cleanup error", e);
    }
  }
}

export default defineContentScript({
  matches: [ "*://play.autodarts.io/*" ],
  cssInjectionMode: "ui",
  async main(ctx: any) {
    AutodartsToolsUrlStatus.watch(async (url: string) => {
      if (!url && (isiOS() || isSafari())) url = window.location.href;

      if (/\/(matches|boards)\/([0-9a-f-]+)/.test(url) && !url.includes("history")) {
        // Warte auf Match-Container – mehrere Selektoren als Fallback (School/Normal/Boards)
        await waitForElement(
          [
            "#root > div > div:nth-of-type(2)",
            "#root > div > div",
            "[class*='match']",
            "[class*='game']",
            "#root > div",
          ],
          15000,
        ).catch(() => { /* Timeout ignorieren – trotzdem fortfahren */ });

        // Extract lobby ID from URL and fetch lobby data
        let matchId = url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0];
        if (matchId) {
          try {
            console.log("Autodarts Tools: Fetching match data with cookie authentication...");

            if (url.includes("boards")) {
              const apiUrl = `https://api.autodarts.io/bs/v0/boards/${matchId}`;
              const response = await fetchWithAuth(apiUrl);

              if (response.ok) {
                matchId = (await response.json()).matchId;
              }
            }

            console.log("Autodarts Tools: Match ID:", matchId);

            const apiUrl = `https://api.autodarts.io/gs/v0/matches/${matchId}/state`;
            const response = await fetchWithAuth(apiUrl);

            console.log("Autodarts Tools: Response status:", response.status);

            if (response.ok) {
              const matchData = await response.json();
              console.log("Autodarts Tools: Match Data:", matchData);
              await processWebSocketMessage("autodarts.matches", matchData);
            } else {
              console.error("Autodarts Tools: Failed to fetch match data", response.status, response.statusText);
            }
          } catch (error) {
            console.error("Autodarts Tools: Error fetching match data:", error);
          }
        }

        const activeMatch = window.location.href.includes("boards") ? !(await waitForElementWithTextContent("h2", [ "Board has no active match", "Board hat kein aktives Spiel", "Bord heeft geen actieve wedstrijd" ], 1000).catch(() => undefined)) : true;

        if (activeMatch) {
          console.log("Autodarts Tools: Match found, initializing match");
          initMatch(ctx, url, matchId).catch(console.error);

          if (!gameDataWatcher) {
            gameDataWatcher = AutodartsToolsGameData.watch(async (value, oldValue) => {
              if (oldValue?.match?.variant === "Bull-off" && value?.match?.variant !== "Bull-off") {
                // Get current URL and matchId instead of using closure values
                const currentUrl = window.location.href;
                const currentMatchId = value?.match?.id || currentUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0];
                clearMatch(true);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return initMatch(ctx, currentUrl, currentMatchId);
              }
            });
          }
        } else {
          console.log("Autodarts Tools: No Active Match found, waiting for match to start");
        }

        // Disconnect existing observer before creating a new one
        activeMatchObserver?.disconnect();
        activeMatchObserver = startActiveMatchObserver(ctx);
      } else {
        clearMatch();
      }
    });
  },
});

/**
 * Lazy-Load Helper: Führt fn() nach dynamischem Modul-Import aus und
 * registriert die zugehörige onRemove-Funktion im Cleanup-Registry.
 *
 * @param loader   () => import("./feature")  – dynamischer Import
 * @param mainKey  Name der Init-Funktion im Modul (default: erste Fn)
 * @param removeKey Name der Cleanup-Funktion (optional)
 * @param url      current URL für Race-Guard in initScript()
 */
async function lazy<T extends Record<string, any>>(
  loader: () => Promise<T>,
  mainKey: keyof T,
  removeKey: keyof T | null,
  url?: string,
) {
  try {
    const mod = await loader();
    const mainFn = mod[mainKey];
    if (typeof mainFn !== "function") {
      console.warn(`Autodarts Tools: Lazy module missing key "${String(mainKey)}"`);
      return;
    }
    if (url !== undefined) {
      if (window.location.href !== url) return;
      await mainFn();
    } else {
      await mainFn();
    }
    if (removeKey && typeof mod[removeKey] === "function") {
      registerCleanup(mod[removeKey] as () => void);
    }
  } catch (e) {
    console.error(`Autodarts Tools: lazy load failed for ${String(mainKey)}`, e);
  }
}

async function initMatch(ctx, url: string, matchId?: string) {
  if (matchInitialized) return;
  matchInitialized = true;

  console.log("Autodarts Tools: Initializing match");

  const config = await AutodartsToolsConfig.getValue();

  // ─── IMMER AKTIV (Kern-Features) ──────────────────────────────────────
  // Quick-Menu: Zeigt Caller/Sound/Crowd Controls unabhängig von Feature-Enable
  lazy(() => import("./quick-menu"), "initQuickMenu", "onRemoveQuickMenu").catch(console.error);

  // Auto-Ergebnis-Erkennung Freunde-Turnier (no-op wenn kein FT läuft)
  lazy(
    () => import("./ft-auto-result"),
    "initFriendsTournamentAutoResult",
    "cleanupFriendsTournamentAutoResult",
  ).catch(console.error);

  // Match-Sticker (nur bei Match-Ende aktiv, keine Kosten wenn ausgeschaltet)
  lazy(() => import("./match-card"), "initMatchCard", "cleanupMatchCard").catch(console.error);

  // Venue-Theming (reagiert auf Storage-Events; kein Overhead ohne Venue)
  lazy(() => import("./venue-theming"), "initVenueTheming", "cleanupVenueTheming").catch(console.error);

  // v2.9.91: Board-Theme-System (manueller Override; nur aktiv bei mode='manual')
  lazy(() => import("./board-theme"), "initBoardTheme", "cleanupBoardTheme").catch(console.error);

  // Native-Caller-Mute (Guard, nur aktiv wenn eigene Sounds laufen)
  lazy(() => import("./mute-native-caller"), "initMuteNativeCaller", "cleanupMuteNativeCaller").catch(console.error);

  // v2.9.71: Screenshot-Export (floating 📸-Button unten rechts)
  lazy(() => import("./screenshot-export"), "initScreenshotExport", "cleanupScreenshotExport").catch(console.error);

  // ─── FEATURE-GATED (Config-abhängig; Modul-Code läuft nur bei Enable) ──
  if (config.hideMenuInMatch.enabled) {
    lazy(() => import("./hide-menu-in-match"), "hideMenuInMatch", "hideMenuInMatchOnRemove", url).catch(console.error);
  }

  if (config.automaticFullscreen.enabled) {
    lazy(() => import("./automatic-fullscreen"), "automaticFullscreen", "automaticFullscreenOnRemove", url).catch(console.error);
  }

  if (config.streamingMode.enabled) {
    initStreamingMode(ctx).catch(console.error);
  }

  if (config.colors.enabled) {
    lazy(() => import("./color-change"), "colorChange", "onRemove", url).catch(console.error);
  }

  if (config.takeout.enabled) {
    initTakeout(ctx).catch(console.error);
  }

  if (config.nextPlayerOnTakeOutStuck.enabled) {
    lazy(() => import("./next-player-on-take-out-stuck"), "nextPlayerOnTakeOutStuck", "nextPlayerOnTakeOutStuckOnRemove", url).catch(console.error);
  }

  if (config.automaticNextLeg.enabled) {
    lazy(() => import("./automatic-next-leg"), "automaticNextLeg", "automaticNextLegOnRemove", url).catch(console.error);
  }

  if (config.smallerScores.enabled) {
    lazy(() => import("./smaller-scores"), "smallerScores", null, url).catch(console.error);
  }

  if (config.largerLegsSets.enabled) {
    lazy(() => import("./larger-legs-sets"), "largerLegsSets", null, url).catch(console.error);
  }

  if (config.largerPlayerMatchData.enabled) {
    lazy(() => import("./larger-player-match-data"), "largerPlayerMatchData", null, url).catch(console.error);
  }

  if (config.largerPlayerNames.enabled) {
    lazy(() => import("./larger-player-names"), "largerPlayerNames", null, url).catch(console.error);
  }

  if (config.winnerAnimation.enabled) {
    lazy(() => import("./winner-animation"), "winnerAnimation", "winnerAnimationOnRemove", url).catch(console.error);
  }

  if (config.zoom.enabled) {
    initZoom(ctx).catch(console.error);
  }

  if (config.quickCorrection.enabled) {
    initQuickCorrection(ctx).catch(console.error);
  }

  if (config.instantReplay.enabled) {
    initInstantReplay(ctx).catch(console.error);
  }

  if (config.gotcha?.enabled) {
    initGotcha(ctx).catch(console.error);
  }

  if (matchId && config.discord.autoStartAfterTimer?.stream) {
    if (config.discord.autoStartAfterTimer?.matchId === matchId || config.discord.autoStartAfterTimer?.matchId?.includes(matchId)) {
      lazy(() => import("./discord-stream"), "discordStream", "discordStreamOnRemove", url).catch(console.error);
    }
  }

  // ─── Walk-On (vor Caller starten) ────────────────────────────────────
  if (config.walkon?.enabled) {
    lazy(() => import("./walk-on"), "walkOn", "walkOnOnRemove", url).catch(console.error);
  }

  // ─── Crowd & Atmosphäre (WebAudio + Convolution Reverb — schwer!) ─────
  if (config.crowd?.enabled) {
    lazy(() => import("./crowd"), "crowd", "crowdOnRemove", url).catch(console.error);
  }

  // ─── Bogey-Number Warnung ────────────────────────────────────────────
  if (config.bogeyWarning?.enabled) {
    lazy(() => import("./bogey-warning"), "bogeyWarning", "bogeyWarningOnRemove", url).catch(console.error);
  }

  // ─── v2.9.74 – Precision Map (immer aktiv wenn enabled) ─────────────
  if (config.precisionMap?.enabled) {
    lazy(() => import("./precision-tracker"), "precisionTracker", "precisionTrackerOnRemove", url).catch(console.error);
    lazy(() => import("./share-card"), "shareCard", "shareCardOnRemove", url).catch(console.error);
  }

  // ─── v2.9.81 – Face-to-Face (WebRTC-Video) ─────────────────────────
  if (config.faceToFace?.enabled) {
    lazy(() => import("./face-to-face"), "faceToFace", "faceToFaceOnRemove", url).catch(console.error);
  }

  // ─── KI-Kommentator (LLM Duo ODER TTS-Api-Key) ───────────────────────
  if (config.aiCommentator?.enabled && (config.aiCommentator?.apiKey || config.aiCommentator?.duoMode)) {
    lazy(() => import("./ai-commentator"), "aiCommentator", "aiCommentatorOnRemove", url).catch(console.error);
  }

  if (config.enhancedScoringDisplay.enabled) {
    lazy(() => import("./enhanced-scoring-display"), "enhancedScoringDisplay", "enhancedScoringDisplayOnRemove", url).catch(console.error);
  }

  if (config.animations.enabled) {
    initAnimations(ctx).catch(console.error);
  }

  // ─── Caller (Voice-Packs, TTS — schwer!) ──────────────────────────────
  if (config.caller.enabled) {
    lazy(() => import("./caller"), "caller", "callerOnRemove", url).catch(console.error);
  }

  // ─── Sound FX (~2000 LOC, das größte Feature) ─────────────────────────
  if (config.soundFx.enabled) {
    lazy(() => import("./sound-fx"), "soundFx", "soundFxOnRemove", url).catch(console.error);
  }

  if (config.wledFx.enabled) {
    lazy(() => import("./wled"), "wledFx", "wledFxOnRemove", url).catch(console.error);
  }

  // ─── TV-Style Statistiken ────────────────────────────────────────────
  if (config.tvStats?.enabled) {
    lazy(() => import("./tv-stats"), "tvStats", "tvStatsOnRemove", url).catch(console.error);
  }

  // ─── Liga Auto-Submit ────────────────────────────────────────────────
  if (config.liga?.enabled && config.liga?.autoSubmit) {
    (async () => {
      try {
        const mod = await import("@/utils/liga-api");
        await mod.ligaAutoSubmit();
        if (typeof mod.ligaAutoSubmitOnRemove === "function") registerCleanup(mod.ligaAutoSubmitOnRemove);
      } catch (e) { console.error(e); }
    })();
  }

  // ─── Trainings-Modus ─────────────────────────────────────────────────
  if (config.training?.enabled) {
    lazy(() => import("./training-mode"), "trainingMode", "trainingModeOnRemove", url).catch(console.error);
  }

  // ─── Party-Buzzer ────────────────────────────────────────────────────
  if (config.buzzer?.enabled) {
    lazy(() => import("./buzzer"), "buzzer", "buzzerOnRemove", url).catch(console.error);
  }

  // ─── Soundboard ──────────────────────────────────────────────────────
  if (config.soundboard?.enabled) {
    lazy(() => import("./soundboard"), "soundboard", "soundboardOnRemove", url).catch(console.error);
  }

  // ─── Dart-Aufprall-Sound ─────────────────────────────────────────────
  if (config.dartImpact?.enabled) {
    lazy(() => import("./dart-impact"), "dartImpact", "dartImpactOnRemove", url).catch(console.error);
  }

  // ─── Clutch Moments ──────────────────────────────────────────────────
  if (config.clutch?.enabled) {
    (async () => {
      try {
        const mod = await import("./clutch-moments");
        mod.initClutchMoments();
        registerCleanup(mod.cleanupClutchMoments);
      } catch (e) { console.error(e); }
    })();
  }

  // ─── PDC Karriere-Modus Controller (v2.8.0) ──────────────────────────
  // Startet automatisch wenn ein Karriere-Match im Storage aktiv ist
  (async () => {
    try {
      const mod = await import("./career-controller");
      await mod.initCareerController();
      registerCleanup(mod.cleanupCareerController);
    } catch (e) { console.error(e); }
  })();

  // ─── Handicap Cleanup (defensiv registrieren) ────────────────────────
  registerCleanup(async () => {
    try {
      const mod = await import("./handicap");
      mod.cleanupHandicap();
    } catch { /* ignore – not loaded */ }
  });
}

function clearMatch(fromBullOff: boolean = false) {
  console.log("Autodarts Tools: Clearing match");

  // Always disconnect the observer when clearing
  activeMatchObserver?.disconnect();
  activeMatchObserver = null;

  // Clean up gameDataWatcher
  if (gameDataWatcher) {
    gameDataWatcher();
    gameDataWatcher = null;
  }

  // Shadow-Root UI cleanup
  shadowUis.streamingMode?.remove();
  shadowUis.takeout?.remove();
  shadowUis.animations?.remove();
  shadowUis.zoom?.remove();
  shadowUis.gotcha?.forEach((e: any) => e.remove());
  shadowUis.quickCorrection?.remove();
  shadowUis.instantReplay?.remove();
  shadowUis.streamingMode = null;
  shadowUis.takeout = null;
  shadowUis.animations = null;
  shadowUis.zoom = null;
  shadowUis.gotcha = null;
  shadowUis.quickCorrection = null;
  shadowUis.instantReplay = null;

  // fromBullOff: hideMenuInMatchOnRemove / automaticFullscreenOnRemove
  // NICHT ausführen. Wir filtern das direkt bei den Cleanup-Callbacks.
  runCleanups().catch(console.error);

  // TODO(fromBullOff): fromBullOff wird nur beim Bull-Off-Übergang gesetzt,
  // um hide-menu-in-match und automatic-fullscreen NICHT zu entfernen (weil
  // sie beim Match selbst wieder aktiviert werden). Da wir jetzt alle Cleanups
  // durchführen und die Features gleich wieder lazy-geladen werden, ist das
  // Verhalten funktional identisch (kurzes Aufblitzen möglich).
  void fromBullOff;

  matchInitialized = false;
}

function startActiveMatchObserver(ctx) {
  const targetNode = document.querySelector("#root > div > div:nth-of-type(2)");
  const observer = new MutationObserver(async () => {
    const url = window.location.href;
    // Check for match/board URL pattern and exclude history pages
    if (!(/\/(matches|boards)\/([0-9a-f-]+)/.test(url)) || url.includes("history")) return;

    // Check if the "Board has no active match" element no longer exists
    const activeMatch = window.location.href.includes("boards") ? !(await waitForElementWithTextContent("h2", [ "Board has no active match", "Board hat kein aktives Spiel", "Bord heeft geen actieve wedstrijd" ], 1000).catch(() => undefined)) : true;

    if (!activeMatch) {
      console.log("Autodarts Tools Observer: No Active Match found, waiting for match to start");
      if (matchInitialized) {
        matchInitialized = false;
        clearMatch();
      }
    } else {
      const url = await AutodartsToolsUrlStatus.getValue();
      let matchId = url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/)?.[0];

      if (url.includes("boards")) {
        const apiUrl = `https://api.autodarts.io/bs/v0/boards/${matchId}`;
        const response = await fetchWithAuth(apiUrl);

        if (response.ok) {
          matchId = (await response.json()).matchId;
        }
      }

      console.log("Autodarts Tools Observer: Match ID:", matchId);

      if (!matchInitialized && matchId) {
        console.log("Autodarts Tools Observer: Match found, initializing match because activeMatch is true");
        initMatch(ctx, url, matchId).catch(console.error);
      }
    }
  });

  // Add null check before observing
  if (targetNode) {
    observer.observe(targetNode, {
      childList: true,
      subtree: true,
    });
  }

  return observer;
}

// ============================================================================
// Vue Shadow-Root UI Initializers – bleiben statisch da eng an Ctx gekoppelt
// Sie werden aber nur bei aktivem Feature aufgerufen (via if in initMatch).
// ============================================================================

async function initTakeout(ctx) {
  shadowUis.takeout = await createShadowRootUi(ctx, {
    name: "autodarts-tools-takeout",
    position: "inline",
    anchor: "#root > div > div:nth-of-type(2)",
    onMount: (container) => {
      console.log("Autodarts Tools: Takeout initialized");
      const takeout = createApp(Takeout);
      takeout.mount(container);
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        container.classList.add("dark");
      }
      return takeout;
    },
    onRemove: (takeout) => {
      takeout?.unmount();
    },
  });
  shadowUis.takeout.mount();
}

async function initStreamingMode(ctx) {
  await waitForElement("#ad-ext-player-display");
  const { default: StreamingMode } = await import("./StreamingMode.vue");
  shadowUis.streamingMode = await createShadowRootUi(ctx, {
    name: "autodarts-tools-streaming-mode",
    position: "inline",
    anchor: "#root",
    onMount: (container: any) => {
      console.log("Autodarts Tools: Streaming Mode initialized");
      const app = createApp(StreamingMode);
      app.mount(container);
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        container.classList.add("dark");
      }
      return app;
    },
    onRemove: (app: any) => {
      app?.unmount();
      console.log("Autodarts Tools: Streaming Mode removed");
    },
  });

  shadowUis.streamingMode.mount();
}

async function initAnimations(ctx) {
  await waitForElement(["#root > div > div:nth-of-type(2)", "#root > div > div", "#root > div"], 15000).catch(() => {});
  shadowUis.animations = await createShadowRootUi(ctx, {
    name: "autodarts-tools-animations",
    position: "inline",
    anchor: "#root > div > div:nth-of-type(2)",
    onMount: (container: any) => {
      console.log("Autodarts Tools: Animations initialized");
      const app = createApp(Animations);
      app.mount(container);
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        container.classList.add("dark");
      }
      return app;
    },
    onRemove: (app: any) => {
      app?.unmount();
      console.log("Autodarts Tools: Animations removed");
    },
  });

  shadowUis.animations.mount();
}

async function initZoom(ctx) {
  await waitForElement(["#root > div > div:nth-of-type(2)", "#root > div > div", "#root > div"], 15000).catch(() => {});
  const config = await AutodartsToolsConfig.getValue();

  const selector = (config.zoom.position === "bottom-right" || config.zoom.position === "bottom-left") ? "#root > div > div:nth-of-type(2)" : "#root > div > div:nth-of-type(1)";

  shadowUis.zoom = await createShadowRootUi(ctx, {
    name: "autodarts-tools-zoom",
    position: "inline",
    anchor: selector,
    onMount: (container: any) => {
      console.log("Autodarts Tools: Zoom initialized");
      const app = createApp(Zoom);
      app.mount(container);
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        container.classList.add("dark");
      }
      return app;
    },
    onRemove: (app: any) => {
      app?.unmount();
      console.log("Autodarts Tools: Zoom removed");
    },
  });

  shadowUis.zoom.mount();
}

async function initGotcha(ctx) {
  const selector = "div.ad-ext-player";
  await waitForElement(selector);
  const elements = document.querySelectorAll(selector);
  const shadowRootPromises = Array.from(elements).map(async (e, index) => {
    if (!e.id) {
      e.id = `ad-ext-player-${index}`;
    }
    return await createShadowRootUi(
      ctx,
      {
        name: "autodarts-tools-gotcha",
        position: "inline",
        anchor: `#${e.id} .ad-ext-player-score`,
        onMount: (container: any) => {
          console.log("Autodarts Tools: Gotcha: initialized");
          const app = createApp(Gotcha, { playerIndex: index });
          app.mount(container);
          if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
            container.classList.add("dark");
          }
          return app;
        },
        onRemove: (app: any) => {
          app?.unmount();
          console.log("Autodarts Tools: Gotcha: removed");
        },
      }
    );
  });
  shadowUis.gotcha = await Promise.all(shadowRootPromises);
  shadowUis.gotcha.forEach((e) => e.mount());
}

async function initQuickCorrection(ctx) {
  await waitForElement(["#root > div > div:nth-of-type(2)", "#root > div > div", "#root > div"], 15000).catch(() => {});
  shadowUis.quickCorrection = await createShadowRootUi(ctx, {
    name: "autodarts-tools-quick-correction",
    position: "inline",
    anchor: "#root > div > div:nth-of-type(2)",
    onMount: (container: any) => {
      console.log("Autodarts Tools: Quick Correction initialized");
      const app = createApp(QuickCorrection);
      app.mount(container);
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        container.classList.add("dark");
      }
      return app;
    },
    onRemove: (app: any) => {
      app?.unmount();
      console.log("Autodarts Tools: Quick Correction removed");
    },
  });

  shadowUis.quickCorrection.mount();
}

async function initInstantReplay(ctx) {
  await waitForElement(["#root > div > div:nth-of-type(2)", "#root > div > div", "#root > div"], 15000).catch(() => {});
  shadowUis.instantReplay = await createShadowRootUi(ctx, {
    name: "autodarts-tools-instant-replay",
    position: "inline",
    anchor: "#root > div > div:nth-of-type(2)",
    onMount: (container: any) => {
      console.log("Autodarts Tools: Instant Replay initialized");
      const app = createApp(InstantReplay);
      app.mount(container);
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        container.classList.add("dark");
      }
      return app;
    },
    onRemove: (app: any) => {
      app?.unmount();
      console.log("Autodarts Tools: Instant Replay removed");
    },
  });

  shadowUis.instantReplay.mount();
}
