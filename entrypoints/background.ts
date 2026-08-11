console.log("Background script loading...");

export default defineBackground({
  main() {
    console.log("Background script initialized!", { id: browser.runtime.id });

    // Keep track of download chunks for large files
    const downloadChunks = new Map<string, {
      chunks: string[];
      mimeType: string;
      completed: boolean;
    }>();

    // Handle messages from content scripts
    browser.runtime.onMessage.addListener(async (message, sender) => {
      console.log("Background: Received message", message.type, "from", sender?.tab?.url || "unknown");

      // Handle fetch requests with chunked download support
      if (message.type === "fetch") {
        try {
          // Extract the URL and options from the message
          const { url, options = {} } = message;
          console.log("Background fetch:", url);

          // For chunked downloads of large files (like ZIP)
          if (message.chunked) {
            // Handle chunk requests
            if (message.action === "start") {
              // Start a new chunked download
              return fetch(url, options).then(async (response) => {
                if (!response.ok) {
                  return {
                    ok: false,
                    status: response.status,
                    statusText: response.statusText,
                  };
                }

                // Generate download ID
                const downloadId = Math.random().toString(36).substring(2);

                // Get content type
                const contentType = response.headers.get("Content-Type") || "application/octet-stream";

                // Get blob data
                const blob = await response.blob();

                // Convert to base64
                const reader = new FileReader();
                reader.readAsDataURL(blob);

                // Store the chunks when the file is loaded
                return new Promise<{
                  ok: boolean;
                  downloadId: string;
                  totalChunks: number;
                  mimeType: string;
                }>((resolve) => {
                  reader.onload = () => {
                    const base64data = reader.result as string;

                    // Get base64 data only (remove the data:mimetype;base64, prefix)
                    const base64Content = base64data.split(",")[1];

                    // Split into chunks (2MB chunks to be safe)
                    const chunkSize = 2 * 1024 * 1024; // 2MB
                    const chunks: string[] = [];

                    for (let i = 0; i < base64Content.length; i += chunkSize) {
                      chunks.push(base64Content.slice(i, i + chunkSize));
                    }

                    // Store chunks in map
                    downloadChunks.set(downloadId, {
                      chunks,
                      mimeType: contentType,
                      completed: false,
                    });

                    resolve({
                      ok: true,
                      downloadId,
                      totalChunks: chunks.length,
                      mimeType: contentType,
                    });
                  };
                });
              });
            } else if (message.action === "getChunk") {
              // Return a specific chunk from a download
              const { downloadId, chunkIndex } = message;
              const download = downloadChunks.get(downloadId);

              if (!download) {
                return {
                  ok: false,
                  error: "Download not found",
                };
              }

              // Return the requested chunk
              return {
                ok: true,
                chunk: download.chunks[chunkIndex],
                isLast: chunkIndex === download.chunks.length - 1,
              };
            } else if (message.action === "complete") {
              // Clean up completed download
              const { downloadId } = message;

              if (downloadChunks.has(downloadId)) {
                downloadChunks.delete(downloadId);
              }

              return { ok: true };
            }
          }

          // For regular (non-chunked) fetches
          return fetch(url, options)
            .then(async (response) => {
              if (response.ok) {
                // If the response size is too large (>10MB), suggest chunked download
                const contentLength = response.headers.get("Content-Length");
                if (contentLength && Number.parseInt(contentLength, 10) > 10 * 1024 * 1024) {
                  return {
                    ok: true,
                    tooLarge: true,
                    suggestChunked: true,
                  };
                }

                const blob = await response.blob();
                // Convert blob to base64 to pass back to the content script
                const reader = new FileReader();
                return new Promise((resolve, reject) => {
                  reader.onload = () => {
                    const base64data = reader.result;
                    resolve({
                      ok: true,
                      status: response.status,
                      data: base64data,
                    });
                  };
                  reader.onerror = () => reject(reader.error);
                  reader.readAsDataURL(blob);
                });
              } else {
                return {
                  ok: false,
                  status: response.status,
                  statusText: response.statusText,
                };
              }
            })
            .catch((error) => {
              console.error("Error in background fetch:", error);
              return {
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              };
            });
        } catch (error) {
          console.error("Error in background fetch:", error);
          return {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }

      // ─── v2.9.73 – Backend-JSON-Proxy (Duo-Kommentator) ─────────────────────
      // Content-Scripts können in Firefox MV2 gegenüber fremden Domains
      // CORS-Beschränkungen unterliegen. Der Background-Fetch umgeht das
      // und liefert JSON strukturiert zurück.
      if (message.type === 'FETCH_JSON') {
        try {
          const { url, method, headers, body } = message.payload || {};
          const response = await fetch(url, { method: method || 'GET', headers, body });
          const text = await response.text();
          let data: any = null;
          try { data = text ? JSON.parse(text) : null; } catch { data = text; }
          return { ok: response.ok, status: response.status, data };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }

      // ─── NEU: OpenAI TTS Relay (CORS-Bypass für Content-Scripts) ────────────
      if (message.type === 'FETCH_TTS') {
        try {
          const { url, method, headers, body } = message.payload;
          const response = await fetch(url, { method, headers, body });

          if (!response.ok) {
            return { ok: false, error: `TTS API Fehler: ${response.status}` };
          }

          // Audio-Blob als Base64 zurückgeben
          const blob = await response.blob();
          const reader = new FileReader();
          return new Promise<any>((resolve) => {
            reader.onload = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve({ ok: true, audioBase64: base64 });
            };
            reader.onerror = () => resolve({ ok: false, error: 'FileReader Fehler' });
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }

      // ─── (Ehemaliger Erweiterungs-Manager entfernt in v2.9.93) ──────────────
      // Beide vormals hier verankerten Message-Handler (Extension-Info abfragen
      // und Extension enable/disable) wurden entfernt, weil der Manager ohne
      // installierte zweite Autodarts-Tools-Erweiterung witzlos war und die
      // vorhandenen Feature-Toggles anderswo besser erreichbar sind. Der Manager-
      // Content-Script wurde ebenfalls gelöscht.

      // ─── Career Storage (Content Scripts können storage in Firefox nicht direkt nutzen) ─
      if (message.type === 'CAREER_STORAGE_SET') {
        try {
          await browser.storage.local.set({ [message.key]: message.value });
          console.log('[Career Background] Storage SET:', message.key);
          return { ok: true };
        } catch (err) {
          console.error('[Career Background] Storage SET Fehler:', err);
          return { ok: false, error: String(err) };
        }
      }

      if (message.type === 'CAREER_STORAGE_GET') {
        try {
          const result = await browser.storage.local.get(message.key);
          console.log('[Career Background] Storage GET:', message.key, '->', result[message.key] ? 'gefunden' : 'leer');
          return { ok: true, value: result[message.key] ?? null };
        } catch (err) {
          console.error('[Career Background] Storage GET Fehler:', err);
          return { ok: false, error: String(err) };
        }
      }

      if (message.type === 'CAREER_STORAGE_REMOVE') {
        try {
          await browser.storage.local.remove(message.key);
          return { ok: true };
        } catch (err) {
          return { ok: false, error: String(err) };
        }
      }

      // ─── Tab öffnen (Content Scripts können tabs.create() nicht direkt aufrufen) ────────────
      if (message.type === 'OPEN_TAB') {
        try {
          await browser.tabs.create({ url: message.url });
          console.log('[Background] Tab geöffnet:', message.url);
          return { ok: true };
        } catch (err) {
          console.error('[Background] Tab öffnen fehlgeschlagen:', err);
          return { ok: false, error: String(err) };
        }
      }

      // ─── Keep-Alive Ping (verhindert, dass der Service Worker schläft) ────────
      if (message.type === 'KEEP_ALIVE_PING') {
        return { pong: true, ts: Date.now() };
      }

      return true; // Keep the message channel open for async responses
    });

    // ─── Service Worker Keep-Alive ────────────────────────────────────────────────────
    // Chrome MV3: Service Worker wird nach 30s Inaktivität beendet.
    // Alarm alle ~25s hält den Worker am Leben während eines Matches.
    browser.alarms.create('keepAlive', { periodInMinutes: 0.4 });
    browser.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'keepAlive') {
        console.debug('Autodarts Tools: Keep-alive tick');
      }
    });

    // ─── Firefox Autoplay-Policy Workaround ───────────────────────────────────────────
    // Firefox blockiert Audio ohne direkten Nutzerklick.
    // Wir senden beim Tab-Wechsel ein Signal an den Content-Script,
    // das den AudioContext entsperrt (genutzt von Walk-On und Crowd-Modul).
    browser.tabs.onActivated.addListener(async (activeInfo) => {
      try {
        const tab = await browser.tabs.get(activeInfo.tabId);
        if (tab?.url?.includes('play.autodarts.io')) {
          browser.tabs.sendMessage(activeInfo.tabId, { type: 'UNLOCK_AUDIO_CONTEXT' }).catch(() => {});
        }
      } catch {
        // Tab existiert evtl. nicht mehr – ignorieren
      }
    });

    // ─── v2.9.71 Screenshot-Export ─────────────────────────────────────────────
    // Content-Script fordert einen PNG-Screenshot des sichtbaren Tabs an.
    // Wir nutzen die native captureVisibleTab-API (Chrome MV3 + Firefox WebExtensions),
    // damit keine externe Library (html2canvas) nötig ist und Shadow-DOMs +
    // React-Portale sauber mitgerendert werden.
    browser.runtime.onMessage.addListener(async (message, sender) => {
      if (message?.type !== 'CAPTURE_SCREENSHOT') return;
      try {
        const windowId = sender?.tab?.windowId;
        const dataUrl = await (browser.tabs.captureVisibleTab as any)(
          windowId,
          { format: 'png' },
        );
        return { ok: true, dataUrl };
      } catch (e) {
        console.error('[Screenshot] captureVisibleTab failed:', e);
        return { ok: false, error: (e as Error).message };
      }
    });
  },
});
