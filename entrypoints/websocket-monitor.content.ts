/**
 * Content script that injects the WebSocket capture script
 */
import { processWebSocketMessage } from "@/utils/websocket-helpers";

export default defineContentScript({
  matches: [ "*://play.autodarts.io/*", "*://play.autodarts.com/*" ],
  runAt: "document_start",
  async main(ctx) {
    console.log("Injecting WebSocket capture script...");

    // Set up event listeners BEFORE injecting the script to avoid race conditions
    // This is critical for WXT 0.20.13+ where injectScript waits for script to load
    ctx.addEventListener(window, "websocket-incoming", (event: Event) => {
      const customEvent = event as CustomEvent;
      const { data } = customEvent.detail;

      // Only process string data that can be parsed as JSON
      if (typeof data === "string") {
        try {
          // Try to parse JSON data
          const jsonData = JSON.parse(data);
          console.log("[Content Script] Parsed JSON data:", jsonData);
          processWebSocketMessage(jsonData.channel, jsonData.data).catch(console.error);
        } catch (e) {
          // Not JSON data, don't log
        }
      }
    });

    // Listen for outgoing WebSocket messages
    ctx.addEventListener(window, "websocket-outgoing", (event: Event) => {
      const customEvent = event as CustomEvent;
      const { data } = customEvent.detail;

      // Only process string data that can be parsed as JSON
      if (typeof data === "string") {
        try {
          // Try to parse JSON data
          const jsonData = JSON.parse(data);
          // Commented out logging for outgoing messages
          // console.log("[Content Script] Sent Parsed JSON:", jsonData);
        } catch (e) {
          // Not JSON data, don't log
        }
      }
    });

    // v2.9.87 — Verbindungsstatus in storage.local schreiben, Popup + UI lesen davon.
    // Werte: 'connected' | 'disconnected' | 'error'.
    ctx.addEventListener(window, "autodarts-ws-status", (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      try {
        browser.storage.local.set({
          'adt-ws-status': {
            status: detail.status ?? 'unknown',
            openSockets: detail.openSockets ?? 0,
            when: detail.when ?? Date.now(),
            info: detail.info ?? null,
          },
        }).catch(() => {});
      } catch { /* ignore */ }

      // Bei Disconnect zusätzlich Toast auf autodarts.io anzeigen
      if (detail.status === 'disconnected') {
        showWsDisconnectToast(detail.info ?? '');
      } else if (detail.status === 'connected') {
        hideWsDisconnectToast();
      }
    });

    try {
      // Inject the script into the page after event listeners are ready
      await injectScript("/websocket-capture.js", {
        keepInDom: true,
      });

      console.log("WebSocket capture script injected successfully");
    } catch (error) {
      console.error("Failed to inject WebSocket capture script:", error);
    }
  },
});

// ── v2.9.87 — WS-Disconnect-Toast (in-page) ─────────────────────────────────

let wsToastEl: HTMLDivElement | null = null;

function showWsDisconnectToast(info: string): void {
  if (typeof document === 'undefined' || !document.body) return;
  if (wsToastEl && document.body.contains(wsToastEl)) return;
  wsToastEl = document.createElement('div');
  wsToastEl.id = 'adt-ws-disconnect-toast';
  wsToastEl.setAttribute('data-testid', 'adt-ws-disconnect-toast');
  wsToastEl.style.cssText = [
    'position: fixed', 'bottom: 20px', 'left: 20px', 'z-index: 2147483647',
    'background: #1a1a1f', 'color: #e8eaf0',
    'border: 1px solid #EF4444', 'border-radius: 6px',
    'padding: 12px 14px',
    'font-family: -apple-system, "Segoe UI", Roboto, sans-serif',
    'font-size: 12px', 'line-height: 1.5',
    'box-shadow: 0 6px 24px rgba(0,0,0,0.5)',
    'max-width: 320px', 'min-width: 240px',
  ].join('; ');
  wsToastEl.innerHTML = `
    <div style="font-weight:800; color:#EF4444; display:flex; align-items:center; gap:6px;">
      🔴 Board getrennt
    </div>
    <div style="margin-top:4px; opacity:0.9;">
      Die WebSocket-Verbindung zu autodarts.io ist unterbrochen (${escapeHtmlStr(info).slice(0, 80)}).
      Die Extension kann jetzt keine Live-Daten mehr lesen.
    </div>
    <div style="margin-top:10px; display:flex; gap:6px; justify-content:flex-end;">
      <button data-testid="adt-ws-reload" style="background:#EF4444; color:#fff; border:none; border-radius:4px; padding:5px 12px; cursor:pointer; font-size:11px; font-weight:800;">Seite neu laden</button>
      <button data-testid="adt-ws-dismiss" style="background:#2a2a30; color:#e8eaf0; border:1px solid #444; border-radius:4px; padding:5px 12px; cursor:pointer; font-size:11px;">Ausblenden</button>
    </div>`;
  wsToastEl.querySelector<HTMLButtonElement>('[data-testid="adt-ws-reload"]')?.addEventListener('click', () => location.reload());
  wsToastEl.querySelector<HTMLButtonElement>('[data-testid="adt-ws-dismiss"]')?.addEventListener('click', () => hideWsDisconnectToast());
  document.body.appendChild(wsToastEl);
}

function hideWsDisconnectToast(): void {
  wsToastEl?.remove();
  wsToastEl = null;
}

function escapeHtmlStr(s: string): string {
  return s.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] || ch));
}
