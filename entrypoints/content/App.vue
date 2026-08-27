<template>
  <div v-if="configVisible" id="autodarts-tools-config" class="mx-auto w-full p-4 pr-8 lg:pr-4">
    <PageConfig />
  </div>
</template>

<script setup lang="ts">
import PageConfig from "@/components/PageConfig.vue";
import { AutodartsToolsConfig, AutodartsToolsUrlStatus, defaultConfig } from "@/utils/storage";

const menuIcon = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"><path fill=\"currentColor\" d=\"M8.8 21H5q-.825 0-1.412-.587T3 19v-3.8q1.2 0 2.1-.762T6 12.5q0-1.175-.9-1.937T3 9.8V6q0-.825.588-1.412T5 4h4q0-1.05.725-1.775T11.5 1.5q1.05 0 1.775.725T14 4h4q.825 0 1.413.588T20 6v4q1.05 0 1.775.725T22.5 12.5q0 1.05-.725 1.775T20 15v4q0 .825-.587 1.413T18 21h-3.8q0-1.25-.787-2.125T11.5 18q-1.125 0-1.912.875T8.8 21\"/></svg>";

// MutationObserver-basiertes waitForElement (kein setInterval)
function waitForElement(selector: string, timeout = 15000): Promise<HTMLElement> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) { resolve(existing as HTMLElement); return; }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) { obs.disconnect(); if (timer) clearTimeout(timer); resolve(el as HTMLElement); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    if (timeout > 0) {
      timer = setTimeout(() => { obs.disconnect(); reject(new Error(`Timeout: "${selector}"`)); }, timeout);
    }
  });
}

let observer = new MutationObserver(() => {});
const currentUrl = ref();
const configVisible = ref(false);
const isConfigPage = ref(true);
const navigationCheckInterval = ref();
const isMobileNav = ref();
const lastVisitedUrl = useStorage("adt:last-visited-url", "");
// BUGFIX v2.9.44: Verhindert dass die Tools-Ansicht während des Öffnens (SPA
// wechselt kurzzeitig auf /settings) sofort wieder geschlossen wird.
let toolsOpeningGuardUntil = 0;

watch(currentUrl, async (newURL, oldURL) => {
  lastVisitedUrl.value = newURL;

  if (newURL && newURL.startsWith("https")) {
    await AutodartsToolsUrlStatus.setValue(newURL.split("#")[0] || "undefined");
  }

  if (newURL !== oldURL && oldURL) {
    useGlobalEvent("url:changed", newURL);

    if (newURL.includes("/tools") && !configVisible.value) {
      configVisible.value = true;
    } else if (!newURL.includes("/tools") && configVisible.value) {
      // Guard: Während des Tools-Öffnens (settingsButton.click() → pushState) NICHT
      // sofort auto-schließen – sonst race-condition zwischen /settings und /tools.
      if (Date.now() < toolsOpeningGuardUntil) return;
      configVisible.value = false;
    }

    // P0-FIX: Nach SPA-Navigation auf eine Seite MIT Sidebar (Match/Lobby/Boards)
    // initMenu() erneut aufrufen, damit der Sidebar-Eintrag "Tools" nachgerüstet wird.
    // Auf der Login-Seite gab es keinen Settings-Link → nur FAB. Nach Login existiert
    // die Sidebar, aber initMenu() lief nie wieder.
    const isMainAppPage = /\/(matches|boards|lobbies|lobbynew|history|tournament)(?:\/|$)/i.test(newURL);
    if (isMainAppPage) {
      initMenu().catch(console.error);
    }
  }
});

watch(configVisible, async (newVal, oldVal) => {
  if (newVal === oldVal) return;
  const pageContentElement = await waitForElement("#root > div > div:nth-of-type(2)", 15000).catch(() => null);
  if (!pageContentElement) return;
  const contentElements = Array.from(pageContentElement.children).filter(el => el.tagName !== "AUTODARTS-TOOLS-WXT") as HTMLElement[];

  if (newVal) {
    contentElements.forEach((el) => {
      el.dataset.adtPrevDisplay = el.style.display || "";
      el.style.display = "none";
    });
  } else {
    contentElements.forEach((el) => {
      const prev = el.dataset.adtPrevDisplay;
      el.style.display = (prev !== undefined && prev !== "") ? prev : "";
      delete el.dataset.adtPrevDisplay;
    });
  }
});

watch(isMobileNav, (value, oldValue) => {
  if (oldValue === null || oldValue === undefined) return;
  initMenu();
});

onMounted(async () => {
  const url = await AutodartsToolsUrlStatus.getValue();
  // BUGFIX v2.9.43: `wasLastInTools` darf NUR die erneute Tools-Ansicht triggern,
  // wenn der Nutzer sich gerade nicht in einer echten Autodarts-Seite (Match/
  // Board/Lobby) befindet. Sonst wird ein Match-Start ("/matches/<uuid>") vom
  // persistierten alten /tools-Wert weggerissen und die Seite landet über den
  // /tools→/settings-Redirect wieder auf dem Startbildschirm.
  const currentHref = window.location.href;
  const isOnAutodartsPage = /\/(matches|boards|lobbies|lobbynew|history)(?:\/|$)/.test(currentHref)
    || /\/tournament/i.test(currentHref);
  const wasLastInTools = lastVisitedUrl.value.includes("/tools") && !isOnAutodartsPage;

  AutodartsToolsUrlStatus.setValue("");
  await nextTick();
  AutodartsToolsUrlStatus.setValue(url);

  currentUrl.value = "";
  await nextTick();
  currentUrl.value = window.location.href;
  isConfigPage.value = url.includes("/tools") || wasLastInTools;

  // BUGFIX v2.9.44: Beim initialen Mount die Tools-Ansicht direkt einschalten,
  // wenn wir auf /tools sind – der Watcher weiter oben feuert nicht, weil er
  // erst bei `oldURL !== undefined` reagiert.
  if (isConfigPage.value) {
    configVisible.value = true;
    window.history.pushState(null, "", "/tools");
    await nextTick();
    isConfigPage.value = false;
  }

  startObserver();
  initMenu().catch(console.error);

  await waitForElement("#root > div > div > .chakra-stack", 15000).catch(() => {});

  const collapseButton = document.querySelector("button[aria-label='Collapse side bar']") as HTMLButtonElement | null;
  if (collapseButton) collapseButton.addEventListener("click", initMenu);

  const config = await AutodartsToolsConfig.getValue();
  await AutodartsToolsConfig.setValue({
    ...JSON.parse(JSON.stringify(defaultConfig)),
    ...JSON.parse(JSON.stringify(config)),
  });
});

onBeforeUnmount(() => {
  disposed = true;
  observer.disconnect();
  clearInterval(navigationCheckInterval.value);
  const collapseButton = document.querySelector("button[aria-label='Collapse side bar']") as HTMLButtonElement | null;
  if (collapseButton) collapseButton.removeEventListener("click", initMenu);
  // v2.9.96: FAB-Wrapper (inkl. Schnellmenü) entfernen wenn Content-Script deaktiviert wird.
  document.getElementById("adt-tools-fab-wrap")?.remove();
});

// Re-Entrancy-Guard (N1, PR #16 Review): initMenu() wird von mehreren
// unabhängigen Quellen ausgelöst (onMounted, URL-Watcher, isMobileNav-Watcher,
// Collapse-Button) und hat mehrere `await waitForElement(...)`-Wartepunkte
// (bis 4s je Selektor). Zwei sich überlappende Aufrufe konnten dadurch beide
// bis zum `menu.appendChild(menuItem)` durchlaufen — Ergebnis: ein doppelter
// Sidebar-Eintrag (zweite `id="autodarts-tools-menu-item"`-Node) und ein
// geleaktes `setInterval`, weil der zweite Aufruf `navigationCheckInterval`
// überschreibt, bevor der erste sein eigenes Intervall je abräumen kann.
// Gleiches Muster wie `matchGeneration` in match.content/index.ts. `disposed`
// deckt zusätzlich Mount→Unmount→Mount ab (ein noch laufender Aufruf einer
// bereits unmounteten Instanz darf nichts mehr in die reale Seite schreiben).
let menuInitGeneration = 0;
let disposed = false;

async function initMenu() {
  const generation = ++menuInitGeneration;
  if (disposed) return;

  if (navigationCheckInterval.value) clearInterval(navigationCheckInterval.value);

  const existingMenuItem = document.getElementById("autodarts-tools-menu-item");
  if (existingMenuItem) existingMenuItem.remove();

  // v2.9.95 Robustheit: Autodarts kann die Sidebar-DOM-Struktur ändern.
  // Wir probieren mehrere Selektor-Kandidaten hintereinander und protokollieren
  // welchen wir erfolgreich gefunden haben.
  const SIDEBAR_SELECTORS = [
    "#root > div > div > .chakra-stack",         // Original v2.9.x
    "#root > div > div:first-child > .chakra-stack",
    "#root .chakra-stack:has(a[href='/settings'])",   // findet nur die Sidebar mit dem Settings-Link
    "nav.chakra-stack",
    "aside .chakra-stack",
  ];
  let menu: HTMLElement | null = null;
  let usedSelector = "";
  for (const sel of SIDEBAR_SELECTORS) {
    try {
      const el = await waitForElement(sel, 4000).catch(() => null);
      // Ein neuerer initMenu()-Aufruf (oder Unmount) hat diesen überholt —
      // ab hier nichts mehr an der echten Seite verändern.
      if (disposed || generation !== menuInitGeneration) return;
      if (el && el.querySelector("a[href='/settings']")) {
        menu = el;
        usedSelector = sel;
        break;
      }
    } catch (_) { /* nächsten Selektor probieren */ }
  }
  if (disposed || generation !== menuInitGeneration) return;
  if (!menu) {
    console.warn("[ADT] Sidebar-Menü nicht gefunden — Fallback-FAB übernimmt den Einstieg.");
    // Wir montieren trotzdem den Floating-Action-Button, damit der Nutzer die
    // Tools erreichen kann.
    mountToolsFab();
    return;
  }
  console.log(`[ADT] Sidebar gefunden per '${usedSelector}', hänge Tools-Eintrag an.`);

  const menuItemTemplate = menu.lastElementChild;
  if (!menuItemTemplate) { mountToolsFab(); return; }

  const menuItem = menuItemTemplate.cloneNode(true) as HTMLElement;
  menuItem.removeAttribute("href");
  const withText = menuItem.innerText.length > 0;
  menuItem.id = "autodarts-tools-menu-item";
  menuItem.innerHTML = "";
  menuItem.style.cursor = "pointer";
  menuItem.innerHTML += menuIcon;

  if (withText) {
    menuItem.innerHTML += "Tools";
    menuItem.querySelector("svg")!.style.marginRight = "0.5rem";
  }

  menuItem.addEventListener("click", (e) => {
    // BUGFIX v2.9.44: Guard-Fenster setzen BEVOR SPA-Navigation ausgelöst wird –
    // damit die kurzzeitige /settings-URL nicht die Tools-Ansicht zurücksetzt.
    toolsOpeningGuardUntil = Date.now() + 1500;
    configVisible.value = true;
    console.log("[ADT] Tools-Menü-Klick verarbeitet, Overlay wird geöffnet");
    const settingsButton = document.querySelector("a[href='/settings']") as HTMLAnchorElement | null;
    if (settingsButton) {
      settingsButton.click();
    } else {
      console.warn("[ADT] Sidebar-Link a[href='/settings'] nicht gefunden — nutze pushState-Fallback");
    }
    window.history.pushState(null, "", "/tools");
    currentUrl.value = window.location.href;
    e?.stopPropagation();
  });

  menu.appendChild(menuItem);
  navigationCheckInterval.value = setInterval(checkNavigation, 1000);

  // v2.9.95 Backup: FAB immer zusätzlich zeigen (auch wenn Sidebar-Eintrag da
  // ist), aber nur solange der Nutzer NICHT bereits in der Tools-Ansicht ist.
  mountToolsFab();
}

// ─── Floating-Action-Button + Schnellmenü (v2.9.96) ────────────────────────
// Der rote Kreis-Button unten rechts öffnet ein aufklappbares Panel mit
// Direkt-Toggles für unsere wichtigsten Features (Caller, Crowd, Walk-On,
// Animationen usw.). Läuft unabhängig vom Sidebar-Klon-Trick und ist damit
// ein robuster Zweit-Einstiegspunkt zu den Tools.
interface QuickToggleDef {
  path: string;         // Config-Pfad, z.B. "walkon.enabled"
  icon: string;
  label: string;
}

const QUICK_MENU_SECTIONS: Array<{ title: string; toggles: QuickToggleDef[] }> = [
  {
    title: "Immersion",
    toggles: [
      { path: "caller.enabled",            icon: "🎙️", label: "Caller" },
      { path: "crowd.enabled",             icon: "📣", label: "Crowd" },
      { path: "walkon.enabled",            icon: "🎵", label: "Walk-On" },
      { path: "animations.enabled",        icon: "✨", label: "Animationen" },
      { path: "soundFx.enabled",           icon: "🔊", label: "Sound-FX" },
      { path: "winnerAnimation.enabled",   icon: "🏆", label: "Sieger-Animation" },
    ],
  },
  {
    title: "Match-Hilfe",
    toggles: [
      { path: "bogeyWarning.enabled",      icon: "⚠️", label: "Bogey-Warnung" },
      { path: "aiCommentator.enabled",     icon: "🤖", label: "KI-Kommentator" },
      { path: "quickCorrection.enabled",   icon: "✏️", label: "Schnellkorrektur" },
      { path: "instantReplay.enabled",     icon: "🎥", label: "Instant Replay" },
    ],
  },
  {
    title: "Oberfläche",
    toggles: [
      { path: "automaticFullscreen.enabled", icon: "🖥️", label: "Vollbild-Auto" },
      { path: "streamingMode.enabled",       icon: "📺", label: "Streaming-Modus" },
      { path: "hideMenuInMatch.enabled",     icon: "🙈", label: "Menü im Match aus" },
      { path: "botSkinPicker.enabled",       icon: "🎭", label: "Bot-Skin" },
    ],
  },
];

function readConfigPath(cfg: any, path: string): boolean {
  const parts = path.split(".");
  let cur: any = cfg;
  for (const p of parts) { if (cur == null) return false; cur = cur[p]; }
  return cur === true;
}
function writeConfigPath(cfg: any, path: string, value: boolean): void {
  const parts = path.split(".");
  let cur: any = cfg;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function mountToolsFab() {
  if (document.getElementById("adt-tools-fab-wrap")) return;

  const wrap = document.createElement("div");
  wrap.id = "adt-tools-fab-wrap";
  wrap.style.cssText = `
    position: fixed; bottom: 20px; right: 20px;
    z-index: 2147483000;
    font-family: 'Barlow Condensed','Arial Narrow',Arial,sans-serif;
    pointer-events: none;
  `;
  wrap.innerHTML = `
    <style>
      #adt-tools-fab-wrap > * { pointer-events: auto; }
      #adt-fab-panel {
        display: none;
        background: #0D1B2A;
        border: 1px solid #1e3050;
        border-top: 3px solid #E8002D;
        border-radius: 10px;
        width: 320px;
        max-height: 78vh;
        overflow: hidden;
        margin-bottom: 10px;
        box-shadow: 0 12px 44px rgba(0,0,0,0.85);
        flex-direction: column;
        animation: adt-fab-pop 0.18s ease-out;
      }
      #adt-tools-fab-wrap.open #adt-fab-panel { display: flex; }
      @keyframes adt-fab-pop {
        from { opacity: 0; transform: translateY(6px) scale(0.98); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      .adt-fab-header {
        position: sticky; top: 0;
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px 10px;
        background: linear-gradient(180deg, #0D1B2A 0%, rgba(13,27,42,0.98) 100%);
        border-bottom: 1px solid #1e3050;
        z-index: 2;
      }
      .adt-fab-title {
        font-size: 12px; font-weight: 900; letter-spacing: 3px;
        color: #E8002D; text-transform: uppercase;
      }
      .adt-fab-close {
        background: rgba(232,0,45,0.12);
        border: 1px solid rgba(232,0,45,0.5);
        color: #FFF; width: 32px; height: 32px;
        border-radius: 6px; cursor: pointer;
        font-size: 16px; line-height: 1;
        display: inline-flex; align-items: center; justify-content: center;
        transition: background 0.15s, transform 0.1s;
      }
      .adt-fab-close:hover { background: #E8002D; transform: scale(1.05); }

      .adt-fab-body {
        overflow-y: auto;
        padding: 6px 16px 12px;
        scrollbar-width: thin;
        scrollbar-color: #1e3050 transparent;
      }
      .adt-fab-body::-webkit-scrollbar { width: 6px; }
      .adt-fab-body::-webkit-scrollbar-thumb { background: #1e3050; border-radius: 3px; }

      .adt-fab-section {
        font-size: 10px; font-weight: 700; letter-spacing: 2px;
        color: #556677; text-transform: uppercase;
        margin: 12px 0 4px;
        padding-bottom: 4px;
        border-bottom: 1px solid #1e3050;
      }
      .adt-fab-section:first-child { margin-top: 6px; }

      .adt-fab-row {
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #0f2030;
      }
      .adt-fab-row:last-child { border-bottom: none; }
      .adt-fab-label {
        font-size: 14px; font-weight: 700; color: #c0ccd8;
        display: flex; align-items: center; gap: 10px;
      }
      .adt-fab-icon { font-size: 17px; }

      .adt-fab-switch { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
      .adt-fab-switch input { display: none; }
      .adt-fab-track {
        position: absolute; inset: 0;
        background: #1e3050; border-radius: 12px; cursor: pointer;
        border: 1px solid #2a3f5a;
        transition: background 0.2s;
      }
      .adt-fab-switch input:checked + .adt-fab-track { background: #E8002D; }
      .adt-fab-thumb {
        position: absolute; top: 3px; left: 3px;
        width: 14px; height: 14px;
        background: #fff; border-radius: 50%;
        transition: transform 0.2s;
        pointer-events: none;
      }
      .adt-fab-switch input:checked ~ .adt-fab-thumb { transform: translateX(18px); }

      .adt-fab-footer {
        padding: 10px 16px 14px;
        border-top: 1px solid #1e3050;
        background: #0a1520;
      }
      .adt-fab-tools-btn {
        width: 100%;
        padding: 10px;
        background: linear-gradient(90deg, #F5C842, #E8002D);
        color: #0D1B2A;
        border: none; border-radius: 6px;
        font-weight: 900; letter-spacing: 1.5px;
        text-transform: uppercase; font-size: 12px;
        cursor: pointer;
        transition: transform 0.15s ease;
        font-family: inherit;
      }
      .adt-fab-tools-btn:hover { transform: translateY(-1px); }

      #adt-fab-toggle {
        width: 52px; height: 52px;
        background: #0D1B2A;
        border: 2px solid #E8002D;
        border-radius: 50%;
        cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        font-size: 22px; color: #FFF;
        box-shadow: 0 4px 20px rgba(232,0,45,0.4);
        transition: transform 0.2s, box-shadow 0.2s, opacity 0.15s, visibility 0.15s;
        margin-left: auto;
        user-select: none;
      }
      #adt-fab-toggle:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 30px rgba(232,0,45,0.7);
      }
      /* Toggle bei offenem Panel unsichtbar → verhindert Kollision mit Close-Button */
      #adt-tools-fab-wrap.open #adt-fab-toggle {
        opacity: 0; visibility: hidden; pointer-events: none;
      }
    </style>

    <div id="adt-fab-panel" role="dialog" aria-labelledby="adt-fab-heading" aria-modal="false">
      <div class="adt-fab-header">
        <span id="adt-fab-heading" class="adt-fab-title">🎯 Autodarts-Tools · Schnellmenü</span>
        <button type="button" class="adt-fab-close" id="adt-fab-close-btn"
                aria-label="Schnellmenü schließen" title="Schließen (Esc)"
                data-testid="adt-fab-close-btn">✕</button>
      </div>
      <div class="adt-fab-body" id="adt-fab-body"></div>
      <div class="adt-fab-footer">
        <button type="button" id="adt-fab-open-tools" class="adt-fab-tools-btn"
                data-testid="adt-fab-open-tools">Alle Einstellungen öffnen</button>
      </div>
    </div>

    <button type="button" id="adt-fab-toggle"
            aria-label="Autodarts-Tools Schnellmenü öffnen"
            aria-haspopup="dialog" aria-expanded="false"
            title="Autodarts-Tools · Schnellmenü"
            data-testid="adt-tools-fab">🎯</button>
  `;
  document.body.appendChild(wrap);

  const panel = wrap.querySelector("#adt-fab-panel") as HTMLElement;
  const toggle = wrap.querySelector("#adt-fab-toggle") as HTMLElement;
  const closeBtn = wrap.querySelector("#adt-fab-close-btn") as HTMLElement;
  const body = wrap.querySelector("#adt-fab-body") as HTMLElement;
  const toolsBtn = wrap.querySelector("#adt-fab-open-tools") as HTMLElement;

  // Menü-Inhalt initial rendern.
  renderQuickMenu(body);

  const setOpen = (open: boolean) => {
    if (open) wrap.classList.add("open");
    else wrap.classList.remove("open");
    toggle.setAttribute("aria-expanded", String(open));
  };

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!wrap.classList.contains("open"));
  });
  closeBtn.addEventListener("click", (e) => { e.stopPropagation(); setOpen(false); });

  // Klick außerhalb schließt (Shadow-DOM-sicher via composedPath).
  const outsideHandler = (ev: Event) => {
    if (!wrap.classList.contains("open")) return;
    const path = (ev as any).composedPath?.() as EventTarget[] | undefined;
    const inside = path ? path.includes(wrap) : wrap.contains(ev.target as Node);
    if (!inside) setOpen(false);
  };
  document.addEventListener("click", outsideHandler, true);
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && wrap.classList.contains("open")) setOpen(false);
  });

  // Button „Alle Einstellungen öffnen" → volle Tools-Ansicht.
  toolsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(false);
    toolsOpeningGuardUntil = Date.now() + 1500;
    configVisible.value = true;
    console.log("[ADT] FAB → Tools-Ansicht öffnen");
    const settingsButton = document.querySelector("a[href='/settings']") as HTMLAnchorElement | null;
    if (settingsButton) settingsButton.click();
    window.history.pushState(null, "", "/tools");
    currentUrl.value = window.location.href;
  });

  // Panel bleibt sichtbar auch wenn die Tools-Ansicht offen ist — der Nutzer
  // kann das Schnellmenü als schnellen Toggle-Zugang unabhängig nutzen.
  watch(configVisible, () => { /* keine automatische Ausblendung mehr */ }, { immediate: true });
}

async function renderQuickMenu(body: HTMLElement) {
  const cfg = await AutodartsToolsConfig.getValue();
  body.innerHTML = "";

  // v2.9.98: Schnellstart-Sektion ganz oben — direkter Zugang zur Stammgruppe
  // ohne durch alle Einstellungen scrollen zu müssen.
  const shortcutSection = document.createElement("div");
  shortcutSection.className = "adt-fab-section";
  shortcutSection.textContent = "🚀 SCHNELLSTART";
  body.appendChild(shortcutSection);

  const shortcutRow = document.createElement("div");
  shortcutRow.style.cssText = "padding: 8px 12px 14px;";
  shortcutRow.innerHTML = `
    <button type="button"
            id="adt-fab-shortcut-stammgruppe"
            data-testid="adt-fab-shortcut-stammgruppe"
            style="width: 100%; padding: 10px 14px;
                   background: linear-gradient(90deg, #F5C842, #E8002D);
                   color: #0D1B2A; border: none; border-radius: 6px;
                   font-weight: 900; letter-spacing: 1px; font-size: 12px;
                   text-transform: uppercase; cursor: pointer;
                   transition: transform 0.15s, box-shadow 0.15s;
                   font-family: inherit;">
      ⭐ Mit Stammgruppe starten
    </button>
    <div style="font-size: 10px; color: #94A3B8; margin-top: 6px; text-align: center; letter-spacing: 0.5px;">
      Öffnet Freunde-Panel + Ein-Klick-Lobby
    </div>
  `;
  body.appendChild(shortcutRow);

  const shortcutBtn = shortcutRow.querySelector("#adt-fab-shortcut-stammgruppe") as HTMLButtonElement;
  shortcutBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    // Trigger: gleicher Weg wie „Alle Einstellungen", plus Scroll-Signal
    toolsOpeningGuardUntil = Date.now() + 1500;
    configVisible.value = true;
    (window as any).__adtScrollToFriends = true;
    const settingsButton = document.querySelector("a[href='/settings']") as HTMLAnchorElement | null;
    if (settingsButton) settingsButton.click();
    window.history.pushState(null, "", "/tools");
    currentUrl.value = window.location.href;
    // Nach kurzer Verzögerung ins Freunde-Panel scrollen
    setTimeout(() => {
      const panel = document.querySelector('[data-testid="regular-group-panel"]') as HTMLElement | null;
      panel?.scrollIntoView({ behavior: "smooth", block: "center" });
      panel?.animate([
        { boxShadow: "0 0 0 0 rgba(245,200,66,0)" },
        { boxShadow: "0 0 0 6px rgba(245,200,66,0.5)" },
        { boxShadow: "0 0 0 0 rgba(245,200,66,0)" },
      ], { duration: 1600 });
      (window as any).__adtScrollToFriends = false;
    }, 800);
    console.log("[ADT] FAB → Schnellstart-Stammgruppe");
  });

  for (const section of QUICK_MENU_SECTIONS) {
    const label = document.createElement("div");
    label.className = "adt-fab-section";
    label.textContent = section.title;
    body.appendChild(label);
    for (const t of section.toggles) {
      const row = document.createElement("div");
      row.className = "adt-fab-row";
      const checked = readConfigPath(cfg, t.path);
      row.innerHTML = `
        <div class="adt-fab-label">
          <span class="adt-fab-icon">${t.icon}</span>${t.label}
        </div>
        <label class="adt-fab-switch">
          <input type="checkbox" data-adt-path="${t.path}" ${checked ? "checked" : ""}
                 data-testid="adt-fab-toggle-${t.path.replace(/\./g, "-")}"/>
          <div class="adt-fab-track"></div>
          <div class="adt-fab-thumb"></div>
        </label>
      `;
      const input = row.querySelector("input") as HTMLInputElement;
      input.addEventListener("change", async () => {
        const current = await AutodartsToolsConfig.getValue();
        writeConfigPath(current, t.path, input.checked);
        await AutodartsToolsConfig.setValue(current);
        console.log(`[ADT] FAB-Toggle ${t.path} = ${input.checked}`);
      });
      body.appendChild(row);
    }
  }
}

function startObserver() {
  const targetNode = document.getElementById("root");
  if (!targetNode) return;
  observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "childList") {
        if (window.location.href !== currentUrl.value) {
          currentUrl.value = window.location.href;
        }
      }
    }
  });
  observer.observe(targetNode, { childList: true, subtree: true });
}

function checkNavigation() {
  const navigationElement = document.querySelector("#root > div > div");
  const width = navigationElement?.getBoundingClientRect().width;

  if (width && width < 170) {
    const menuItem = document.getElementById("autodarts-tools-menu-item");
    if (menuItem) menuItem.innerHTML = menuIcon;
    isMobileNav.value = false;
  } else if (width && width > 200) {
    const menuItem = document.getElementById("autodarts-tools-menu-item");
    if (menuItem) menuItem.innerHTML = menuIcon;
    isMobileNav.value = true;
  } else {
    const menuItem = document.getElementById("autodarts-tools-menu-item");
    if (menuItem) {
      menuItem.innerHTML = `${menuIcon} Tools`;
      menuItem.querySelector("svg")!.style.marginRight = "0.5rem";
    }
    isMobileNav.value = false;
  }
}
</script>
