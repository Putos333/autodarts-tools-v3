import "~/assets/tailwind.css";
import { createApp } from "vue";

import App from "./App.vue";
import { migrationConfig } from "./migration-config";
import { initOnboarding } from "./onboarding";

import { AutodartsToolsConfig, AutodartsToolsGlobalStatus, AutodartsToolsUrlStatus, defaultConfig } from "@/utils/storage";
import { isiOS } from "@/utils/helpers";
import { handleLigaInviteLink } from "@/utils/liga-api";
import Migration from "@/components/Migration.vue";

let migrationModalUI: any;
let appMounted = false;

// BUGFIX v2.9.45: Autodarts hat `#root > div > div` als SIDEBAR und
// `#root > div > div:nth-of-type(2)` als MAIN-CONTENT. Wir wollen die
// Tools-UI IM Hauptbereich mounten (dort wo Autodarts auch seine Inhalte
// rendert), nicht in die Sidebar quetschen.
const MAIN_SELECTOR = "#root > div > div:nth-of-type(2)";
const SIDEBAR_SELECTOR = "#root > div > div:nth-of-type(1)";

/**
 * Wartet auf ein Element via MutationObserver.
 */
function waitForElementObserver(selector: string, timeout = 15000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) { resolve(existing as HTMLElement); return; }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        if (timer) clearTimeout(timer);
        resolve(el as HTMLElement);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    if (timeout > 0) {
      timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`[ADT] Timeout: "${selector}"`));
      }, timeout);
    }
  });
}

export default defineContentScript({
  matches: [ "*://play.autodarts.io/*", "*://play.autodarts.com/*" ],
  // BUGFIX v2.9.45: Vorher "ui" → CSS wurde nur in Shadow-Root-UIs injiziert.
  // Da wir die App direkt in den DOM mounten, war Tailwind unbrauchbar
  // (unformatierter Text-Blob im Screenshot). "manifest" injiziert die
  // content.css automatisch in die Seite.
  cssInjectionMode: "manifest",
  async main(ctx) {
    console.log("[ADT] Content-Script gestartet, URL:", window.location.href);

    AutodartsToolsUrlStatus.setValue(window.location.href.split("#")[0] || "undefined");

    // v2.9.93: Liga-Einladungslink verarbeiten (früher lag dieser Aufruf im
    // inzwischen entfernten Erweiterungs-Manager). Nicht-blockierend.
    handleLigaInviteLink().then((res) => {
      if (res.joined) console.log(`[ADT] Liga automatisch beigetreten: ${res.ligaName ?? ''}`);
    }).catch((e) => console.warn("[ADT] Liga-Invite-Handling fehlgeschlagen", e));

    // Auth-Cookie Event Listener
    ctx.addEventListener(window, "auth-cookie-available", (event: Event) => {
      const customEvent = event as CustomEvent;
      const { authValue } = customEvent.detail;
      console.log("[Auth] Access Token erfasst");
      AutodartsToolsGlobalStatus.getValue().then((globalStatus) => {
        AutodartsToolsGlobalStatus.setValue({
          ...globalStatus,
          // v2.9.90: tokenAt-Zeitstempel für Freshness-Check in
          //          utils/auth-refresh.ts::ensureFreshAuthToken().
          auth: { token: authValue, tokenAt: Date.now() },
        });
      });
    });

    // Auth-Cookie Script injizieren via <script>-Tag (wie v2.9.29 - blockiert nicht in Firefox)
    try {
      const script = document.createElement("script");
      script.src = browser.runtime.getURL("/auth-cookie.js");
      (document.head || document.documentElement).appendChild(script);
      script.onload = () => script.remove();
      console.log("[Auth] auth-cookie.js injiziert");
    } catch (error) {
      console.warn("[Auth] auth-cookie.js Fehler:", error);
    }

    // BUGFIX v2.9.48: Vorher wurde bei /tools-URL das #root Element gekillt +
    // window.location.href = "/settings" gesetzt. Das ist eine harte Navigation,
    // die im Browser-bfcache eine leere Seite hinterlässt → beim Zurück-Navigieren
    // aus einer Karriere-Lobby zeigte die Seite nichts mehr an.
    // Neue Strategie: URL sanft via History API auf /settings korrigieren.
    // App.vue erkennt via lastVisitedUrl dass der Nutzer in Tools war und pusht
    // dann wieder auf /tools zurück (siehe wasLastInTools-Logik).
    if (window.location.href.includes("/tools")) {
      try {
        window.history.replaceState(null, "", "/settings");
      } catch (_) { /* fallback */ }
    }

    if (isiOS()) {
      document.querySelector("body")!.style!.minHeight = "calc(100vh + 1px)";
    }

    // Ladebalken
    const loadingBar = document.createElement("div");
    loadingBar.id = "adt-loading-bar";
    loadingBar.style.cssText = "position:fixed;top:0;left:0;width:0%;height:3px;background:linear-gradient(90deg,#E8002D,#ff6b6b);z-index:99999;transition:width 0.4s ease;border-radius:0 2px 2px 0";
    document.body.appendChild(loadingBar);
    let progress = 10;
    const barInterval = setInterval(() => {
      progress = Math.min(progress + (90 - progress) * 0.08, 88);
      loadingBar.style.width = progress + "%";
    }, 200);
    const finishBar = () => {
      clearInterval(barInterval);
      loadingBar.style.width = "100%";
      setTimeout(() => loadingBar.remove(), 500);
    };

    // Auf Haupt-Anker warten
    let anchorElement: HTMLElement | null = null;
    try {
      anchorElement = await waitForElementObserver(MAIN_SELECTOR, 15000);
      console.log("[ADT] Haupt-Anker gefunden:", MAIN_SELECTOR);
    } catch (e) {
      console.warn("[ADT] Haupt-Anker nicht gefunden, versuche Fallback...");
      anchorElement = document.querySelector("#root > div") as HTMLElement | null;
    }

    finishBar();

    if (!anchorElement) {
      console.error("[ADT] Kein Anker-Element gefunden");
      return;
    }

    if (appMounted) return;
    appMounted = true;

    const appContainer = document.createElement("autodarts-tools-wxt");
    (appContainer as HTMLElement).style.cssText = "display:contents";
    anchorElement.appendChild(appContainer);

    const app = createApp(App);
    app.mount(appContainer);
    console.log("[ADT] App erfolgreich gemountet");

    // Migration prüfen
    // v2.9.97 HOTFIX: NUR anzeigen wenn wirklich ein OLD-config-Payload da ist,
    // NICHT irgendein Shape unter dem Key "config". Vorher konnte das Modal
    // beim ersten Start (leere/aktuelle DB) einen unsichtbaren, klick-blockierenden
    // Shadow-DOM-Overlay über die ganze Seite legen → Maus reagiert nicht mehr.
    try {
      const storage = await browser.storage.local.get("config");
      const legacy = storage.config as any;
      const isRealLegacy = legacy
        && typeof legacy === "object"
        && typeof legacy.version === "number"
        && legacy.version > 0
        // Kern-Felder der ALTEN Struktur, die im neuen Storage NICHT existieren:
        && ("streamingMode" in legacy || "recentLocalPlayers" in legacy || "legsSetsLarger" in legacy);
      if (isRealLegacy) {
        console.log("[ADT] Legacy-Config erkannt (v=" + legacy.version + ") → Migration-Modal wird angezeigt");
        await initMigrationModal(ctx).catch(console.error);
      } else if (legacy) {
        // Falscher Trigger — alter Storage-Key ohne Legacy-Struktur → einfach entfernen,
        // damit der Fehler nicht weiterhin die Seite blockiert.
        console.log("[ADT] Storage-Key 'config' ohne Legacy-Struktur — wird entfernt");
        await browser.storage.local.remove("config").catch(() => {});
      }
    } catch (error) {
      console.error("[ADT] Fehler bei Migration:", error);
    }

    // v2.9.97 HOTFIX: Weltweiter Not-Ausgang für Modal-Overlays. ESC-Taste
    // schließt IMMER jedes Autodarts-Tools-Shadow-Modal — verhindert dass ein
    // stuck Overlay die Seite unbenutzbar macht.
    document.addEventListener("keydown", (ev) => {
      if (ev.key !== "Escape") return;
      const modalHost = document.querySelector("autodarts-tools-migration-modal") as HTMLElement | null;
      if (modalHost) {
        modalHost.remove();
        console.log("[ADT] Migration-Modal per ESC entfernt (Notausgang)");
      }
    });

    const config = await AutodartsToolsConfig.getValue();
    try {
      if (config && config.version !== defaultConfig.version) {
        await migrationConfig().catch(console.error);
      }
    } catch (error) {
      console.error("[ADT] Fehler bei migrationConfig:", error);
    }

    // v2.9.59: Onboarding-Wizard beim ersten Start
    setTimeout(() => { initOnboarding().catch(console.error); }, 800);
  },
});

async function initMigrationModal(ctx: any) {
  let anchorElement: HTMLElement | null = null;
  try {
    anchorElement = await waitForElementObserver(MAIN_SELECTOR, 10000);
  } catch (_) {
    anchorElement = document.querySelector("#root > div") as HTMLElement | null;
  }
  if (!anchorElement) return;

  migrationModalUI = await createShadowRootUi(ctx, {
    name: "autodarts-tools-migration-modal",
    position: "inline",
    anchor: anchorElement,
    onMount: (container) => {
      const migrationModal = createApp(Migration);
      migrationModal.mount(container);
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        container.classList.add("dark");
      }
      return migrationModal;
    },
    onRemove: (migrationModal) => {
      migrationModal?.unmount();
    },
  });
  migrationModalUI.mount();
}
