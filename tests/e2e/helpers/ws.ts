import type { BrowserContext, Page, WebSocketRoute, Worker } from "@playwright/test";

import { FAKE_AUTODARTS_HTML } from "../fixtures/fake-page";

export const AUTODARTS_URL = "https://play.autodarts.io/e2e-fake-page";
export const WS_URL = "wss://e2e-fake.autodarts.invalid/ws";
/** Wird an die echte Netzwerkschicht weitergereicht und scheitert dort (".invalid" ist nie auflösbar). */
export const UNREACHABLE_WS_URL = "wss://e2e-unreachable.autodarts.invalid/ws";
export const TOAST = "[data-testid=\"adt-ws-disconnect-toast\"]";

/** Letzte Log-Zeile von entrypoints/websocket-capture.ts, nachdem der Hook vollständig installiert ist. */
const HOOK_READY_LOG = "[WebSocket Capture] Initialized successfully";

export interface WsStatus {
  status: string;
  openSockets: number;
  when: number;
  info: string | null;
}

export interface FakeAutodarts {
  page: Page;
  /** Serverseitige Gegenstellen in Reihenfolge der Verbindungsaufbauten (Index = Rückgabe von open()). */
  routes: WebSocketRoute[];
  /** Öffnet einen neuen (gefälschten) WebSocket aus der Seite und wartet auf `open`. Gibt den Socket-Index zurück. */
  open: () => Promise<number>;
  /** Schließt die serverseitige Gegenstelle des Sockets `index` (Standard: zuletzt geöffneter). */
  closeFromServer: (index?: number, code?: number) => void;
  /** Sendet eine Textnachricht serverseitig an den Socket `index` (Standard: zuletzt geöffneter). */
  sendFromServer: (data: string, index?: number) => void;
  /** Versucht eine nicht erreichbare Verbindung und liefert die beobachtete Ereignisfolge (z. B. ["error","close"]). */
  connectUnreachable: () => Promise<string[]>;
  /** `autodarts-ws-status`-Events des Hooks im Seitenkontext (Status-Strings in Reihenfolge). */
  statusEvents: () => Promise<string[]>;
  /** Vom Seitenskript per `event.data` gelesene Nachrichten. */
  receivedMessages: () => Promise<string[]>;
  /** `websocket-incoming`-Events der Extension (detail-Objekte). */
  incomingEvents: () => Promise<Array<{ url: string; data: string }>>;
}

/**
 * Lädt die kontrollierte Ersatzseite für play.autodarts.io, wartet bis der WebSocket-Hook der Extension
 * installiert ist und stellt Steuerung für gefälschte Sockets bereit. Kein echter Server, kein Netzwerk.
 */
export async function openFakeAutodarts(context: BrowserContext): Promise<FakeAutodarts> {
  await context.route("https://play.autodarts.io/**", route => route.fulfill({
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: FAKE_AUTODARTS_HTML,
  }));

  const page = await context.newPage();
  const routes: WebSocketRoute[] = [];
  await page.routeWebSocket(WS_URL, ws => {
    routes.push(ws);
  });

  await page.routeWebSocket(UNREACHABLE_WS_URL, ws => {
    ws.connectToServer();
  });

  // Vor goto registrieren, sonst kann die Meldung verpasst werden.
  const hookReady = page.waitForEvent("console", {
    predicate: message => message.text().includes(HOOK_READY_LOG),
    timeout: 15_000,
  });
  await page.goto(AUTODARTS_URL, { waitUntil: "domcontentloaded" });
  await hookReady;

  await page.evaluate(() => {
    const w = window as any;
    w.__e2eSockets = [];
    w.__e2eMessages = [];
    w.__e2eIncoming = [];
    w.__e2eStatus = [];
    window.addEventListener("websocket-incoming", event => {
      w.__e2eIncoming.push((event as CustomEvent).detail);
    });
    window.addEventListener("autodarts-ws-status", event => {
      w.__e2eStatus.push((event as CustomEvent).detail.status);
    });
  });

  const last = () => routes.length - 1;

  return {
    page,
    routes,
    open: () => page.evaluate(url => new Promise<number>((resolve, reject) => {
      const w = window as any;
      const ws = new WebSocket(url);
      w.__e2eSockets.push(ws);
      const index = w.__e2eSockets.length - 1;
      ws.addEventListener("message", event => {
        w.__e2eMessages.push(event.data);
      });
      ws.addEventListener("open", () => resolve(index), { once: true });
      ws.addEventListener("error", () => reject(new Error("fake websocket error")), { once: true });
      setTimeout(() => reject(new Error("fake websocket open timeout")), 8_000);
    }), WS_URL),
    connectUnreachable: () => page.evaluate(url => new Promise<string[]>(resolve => {
      const events: string[] = [];
      const ws = new WebSocket(url);
      for (const type of [ "open", "error", "close" ]) {
        ws.addEventListener(type, () => {
          events.push(type);
          if (type === "close") resolve(events);
        });
      }
      setTimeout(() => resolve(events), 10_000);
    }), UNREACHABLE_WS_URL),
    closeFromServer: (index = last(), code = 1001) => {
      routes[index].close({ code, reason: "e2e simulated disconnect" });
    },
    sendFromServer: (data, index = last()) => {
      routes[index].send(data);
    },
    statusEvents: () => page.evaluate(() => (window as any).__e2eStatus as string[]),
    receivedMessages: () => page.evaluate(() => (window as any).__e2eMessages as string[]),
    incomingEvents: () => page.evaluate(() => (window as any).__e2eIncoming as Array<{ url: string; data: string }>),
  };
}

/**
 * Simuliert, dass ein NEUERES Content-Script gleichen Namens startet. WXT invalidiert daraufhin das alte
 * (node_modules/wxt/dist/utils/content-script-context.mjs: stopOldScripts / listenForNewerScripts).
 * Der Ereignisname ist WXT-intern: `${extensionId}:${entrypoint}:wxt:content-script-started`.
 */
export async function simulateNewerContentScript(page: Page, extensionId: string): Promise<void> {
  await page.evaluate(id => {
    document.dispatchEvent(new CustomEvent(`${id}:websocket-monitor:wxt:content-script-started`, {
      detail: { contentScriptName: "websocket-monitor", messageId: "e2e-newer-script" },
    }));
  }, extensionId);
}

/** Zeichnet ab jetzt jede Änderung des Schlüssels `adt-ws-status` (nur den Status-String) im Service Worker auf. */
export async function startWsStatusLog(serviceWorker: Worker): Promise<() => Promise<string[]>> {
  await serviceWorker.evaluate(() => {
    const g = globalThis as any;
    g.__adtStatusLog = [];
    g.chrome.storage.onChanged.addListener((changes: any, area: string) => {
      if (area === "local" && changes["adt-ws-status"]?.newValue) {
        g.__adtStatusLog.push(changes["adt-ws-status"].newValue.status);
      }
    });
  });
  return () => serviceWorker.evaluate(() => (globalThis as any).__adtStatusLog as string[]);
}

/** Liest den von websocket-monitor.content.ts geschriebenen Schlüssel `adt-ws-status` aus storage.local. */
export async function readWsStatus(serviceWorker: Worker): Promise<WsStatus | undefined> {
  return serviceWorker.evaluate(async () => {
    const stored = await (globalThis as any).chrome.storage.local.get("adt-ws-status");
    return stored["adt-ws-status"] as WsStatus | undefined;
  });
}
