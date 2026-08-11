/**
 * WebSocket capture script to be injected into the main world
 */

export default defineUnlistedScript(() => {
  console.log("[WebSocket Capture] Starting initialization");

  // v2.9.87 — Verbindungs-Zustand nach Draußen kommunizieren. Wir owned die
  // Sockets NICHT (autodarts.io tut das), aber wir können `open` und `close`
  // Events monkey-patchen und dem Rest der Extension einen Live-Status geben.
  //
  // Der `websocket-monitor.content.ts` (unser Content-Script) hört auf
  // `autodarts-ws-status`-Events und schreibt den Zustand in
  // browser.storage.local (Key: 'adt-ws-status') — Popup + In-Page-UI lesen
  // von dort.
  let openSockets = 0;
  function announce(status: 'connected' | 'disconnected' | 'error', detail?: string) {
    try {
      window.dispatchEvent(new CustomEvent('autodarts-ws-status', {
        detail: { status, openSockets, when: Date.now(), info: detail ?? null },
      }));
    } catch (_) { /* ignore */ }
  }

  try {
    const OriginalWS = WebSocket;
    // Wrapper-Konstruktor, damit wir Zustandsänderungen live sehen
    const WrappedWS: any = function (url: string | URL, protocols?: string | string[]) {
      const ws = protocols !== undefined ? new OriginalWS(url as any, protocols) : new OriginalWS(url as any);
      const host = (() => { try { return new URL(String(url)).host; } catch { return String(url).slice(0, 40); } })();

      ws.addEventListener('open', () => {
        openSockets = Math.max(1, openSockets + 1);
        announce('connected', host);
      });
      ws.addEventListener('close', (ev: CloseEvent) => {
        openSockets = Math.max(0, openSockets - 1);
        announce(openSockets === 0 ? 'disconnected' : 'connected', `${host} · code=${ev.code}`);
      });
      ws.addEventListener('error', () => {
        announce('error', host);
      });
      return ws;
    };
    // Prototype-Chain erhalten, damit `instanceof WebSocket` weiter greift
    WrappedWS.prototype = OriginalWS.prototype;
    WrappedWS.CONNECTING = OriginalWS.CONNECTING;
    WrappedWS.OPEN = OriginalWS.OPEN;
    WrappedWS.CLOSING = OriginalWS.CLOSING;
    WrappedWS.CLOSED = OriginalWS.CLOSED;
    (window as any).WebSocket = WrappedWS;
  } catch (e) {
    console.warn('[WebSocket Capture] WS-Wrapper konnte nicht installiert werden:', e);
  }

  try {
    // Get the original data property descriptor
    const property = Object.getOwnPropertyDescriptor(
      MessageEvent.prototype,
      "data",
    );

    if (!property || !property.get) {
      console.error("[WebSocket Capture] Could not get data property descriptor");
      return;
    }

    const originalGetter = property.get;

    // Create a wrapper function that intercepts the getter
    function interceptMessageData(this: MessageEvent) {
      // Check if this is a WebSocket message
      const isWebSocket = this.currentTarget instanceof WebSocket;

      if (!isWebSocket) {
        return originalGetter.call(this);
      }

      // Get the original message data
      const messageData = originalGetter.call(this);

      try {
        // Only dispatch event, no logging here
        if (typeof messageData === "string") {
          try {
            // Try to parse JSON data to validate it's JSON
            JSON.parse(messageData);
            // No logging here, only in content script
          } catch (e) {
            // Not valid JSON, don't process
          }
        }

        // Dispatch a custom event with the message data
        window.dispatchEvent(new CustomEvent("websocket-incoming", {
          detail: {
            url: (this.currentTarget as WebSocket).url,
            data: typeof messageData === "string" ? messageData : "(binary data)",
            timestamp: new Date().toISOString(),
          },
        }));
      } catch (error) {
        console.error("[WebSocket Capture] Error processing message:", error);
      }

      // Return the original message data without trying to modify the property
      return messageData;
    }

    // Replace the getter with our interceptor
    property.get = interceptMessageData;
    Object.defineProperty(MessageEvent.prototype, "data", property);

    // Also intercept WebSocket.send to capture outgoing messages
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function (
      this: WebSocket,
      data: string | ArrayBufferLike | Blob | ArrayBufferView,
    ) {
      try {
        // Only dispatch event, no logging here
        if (typeof data === "string") {
          try {
            // Try to parse JSON data to validate it's JSON
            JSON.parse(data);
            // No logging here, only in content script
          } catch (e) {
            // Not valid JSON, don't process
          }
        }

        // Dispatch a custom event with the outgoing message
        window.dispatchEvent(new CustomEvent("websocket-outgoing", {
          detail: {
            url: this.url,
            data: typeof data === "string" ? data : "(binary data)",
            timestamp: new Date().toISOString(),
          },
        }));
      } catch (error) {
        console.error("[WebSocket Capture] Error intercepting send:", error);
      }

      // Call the original send method
      return originalSend.call(this, data);
    };

    console.log("[WebSocket Capture] Initialized successfully");
  } catch (error) {
    console.error("[WebSocket Capture] Initialization failed:", error);
  }
});
