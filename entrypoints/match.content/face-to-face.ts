/**
 * face-to-face.ts – Floating Video-Overlay (Face-to-Face) für Autodarts (v2.9.81).
 *
 * Zeigt einen "PDC-Fliq"-Style Picture-in-Picture-View:
 *   - Remote-Video (Gegner) links unten, groß.
 *   - Eigenes Vorschau-Video rechts unten, klein.
 *   - Buttons: Raum erstellen / Beitreten, Kamera aus, Mikro aus, Auflegen.
 *
 * Läuft parallel zum Match, kein autodarts.io-Konto der beiden Peers nötig
 * (Raum-Code teilen reicht).
 */

import { AutodartsToolsConfig } from "@/utils/storage";
import { FaceSession, createFaceRoom, type FaceEvents } from "@/utils/face-to-face-client";
import { getBackendUrl } from "@/utils/backend-url";

let panelEl: HTMLDivElement | null = null;
let session: FaceSession | null = null;

export async function faceToFace(): Promise<void> {
  const cfg = await AutodartsToolsConfig.getValue();
  if (!cfg.faceToFace?.enabled) return;
  mountPanel(getBackendUrl(cfg.faceToFace?.backendUrl));
}

export function faceToFaceOnRemove(): void {
  session?.stop();
  session = null;
  panelEl?.remove();
  panelEl = null;
}

function mountPanel(backendUrl: string) {
  if (panelEl) return;

  panelEl = document.createElement("div");
  panelEl.id = "adt-face-panel";
  panelEl.setAttribute("data-testid", "face-panel");
  panelEl.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    z-index: 99998;
    background: rgba(13, 27, 42, 0.94);
    color: #e8eaf0;
    font-family: 'Barlow Condensed', sans-serif;
    padding: 12px;
    border-radius: 8px;
    border: 2px solid #E8002D;
    min-width: 280px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  `;

  renderIdle(backendUrl);
}

function renderIdle(backendUrl: string) {
  if (!panelEl) return;
  panelEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
      <div style="font-size:14px; font-weight:800; letter-spacing:2px; text-transform:uppercase; color:#F5C842;">📹 Face-to-Face</div>
      <button data-testid="face-close-btn" title="Schließen" style="background:none;border:none;color:#8899aa;cursor:pointer;font-size:18px;">×</button>
    </div>
    <div style="display:flex; gap:6px; margin-bottom:8px;">
      <button data-testid="face-create-btn" style="flex:1; padding:10px; background:linear-gradient(135deg,#00C853,#009d40); color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:800; font-size:12px; letter-spacing:1px; text-transform:uppercase;">➕ Raum erstellen</button>
    </div>
    <div style="display:flex; gap:6px;">
      <input data-testid="face-code-input" placeholder="6-stelliger Raum-Code"
        maxlength="6"
        style="flex:1; padding:8px 10px; background:#0a1520; color:#e8eaf0; border:1px solid #1e3a5f; border-radius:4px; font-family:monospace; letter-spacing:2px; font-size:14px; text-align:center;" />
      <button data-testid="face-join-btn" style="padding:8px 14px; background:#E8002D; color:#fff; border:none; border-radius:4px; cursor:pointer; font-weight:800; font-size:12px; letter-spacing:1px; text-transform:uppercase;">Beitreten</button>
    </div>
    <div data-testid="face-status" style="margin-top:8px; font-size:11px; color:#8899aa; text-align:center; min-height:14px;"></div>
  `;

  panelEl.querySelector('[data-testid="face-close-btn"]')?.addEventListener("click", () => faceToFaceOnRemove());
  panelEl.querySelector('[data-testid="face-create-btn"]')?.addEventListener("click", async () => {
    setStatus("Erstelle Raum…");
    const code = await createFaceRoom(backendUrl);
    if (!code) return setStatus("❌ Raum-Erstellung fehlgeschlagen");
    startSession(backendUrl, code);
  });
  panelEl.querySelector('[data-testid="face-join-btn"]')?.addEventListener("click", async () => {
    const input = panelEl!.querySelector('[data-testid="face-code-input"]') as HTMLInputElement;
    const code = input.value.trim();
    if (!/^\d{6}$/.test(code)) return setStatus("❌ Ungültiger Code (6 Ziffern)");
    startSession(backendUrl, code);
  });
}

async function startSession(backendUrl: string, code: string) {
  setStatus("Kamera wird aktiviert…");
  const peerId = "peer-" + crypto.randomUUID().slice(0, 8);
  session?.stop();
  session = new FaceSession(
    { backendUrl, code, peerId, audio: true, video: true },
    {
      onLocalStream: (stream) => renderConnected(code, stream, null),
      onRemoteStream: (stream) => renderConnected(code, session!.getLocalStream(), stream),
      onPeerJoined: () => setStatus("✅ Gegner beigetreten"),
      onPeerLeft: () => { setStatus("👋 Gegner hat verlassen"); },
      onError: (e) => setStatus("❌ " + e),
      onConnectionState: (s) => {
        if (s === "connected") setStatus("✅ Verbunden");
        else if (s === "failed") setStatus("❌ Verbindung fehlgeschlagen");
      },
    },
  );
  try {
    await session.start();
  } catch {
    setStatus("❌ Start fehlgeschlagen");
  }
}

function renderConnected(code: string, localStream: MediaStream | null, remoteStream: MediaStream | null) {
  if (!panelEl) return;
  panelEl.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <div style="display:flex; flex-direction:column;">
        <div style="font-size:12px; font-weight:800; letter-spacing:2px; text-transform:uppercase; color:#F5C842;">📹 Face-to-Face</div>
        <div style="font-size:11px; color:#8899aa; font-family:monospace; letter-spacing:2px;" data-testid="face-code-display">Code: ${code}</div>
      </div>
      <button data-testid="face-hangup-btn" title="Auflegen" style="background:#E8002D; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; font-weight:800; font-size:11px; letter-spacing:1px; text-transform:uppercase;">📴 Ende</button>
    </div>
    <div style="position:relative; width:280px; height:210px; background:#000; border-radius:6px; overflow:hidden;">
      <video data-testid="face-remote-video" autoplay playsinline
        style="width:100%; height:100%; object-fit:cover; background:#000;"></video>
      <div data-testid="face-remote-waiting"
        style="position:absolute; inset:0; display:${remoteStream ? "none" : "flex"}; align-items:center; justify-content:center; background:rgba(0,0,0,0.6); color:#8899aa; font-size:12px; letter-spacing:2px; text-transform:uppercase;">
        Warte auf Gegner…
      </div>
      <video data-testid="face-local-video" autoplay muted playsinline
        style="position:absolute; bottom:6px; right:6px; width:88px; height:66px; border:2px solid #F5C842; border-radius:4px; object-fit:cover; background:#000;"></video>
    </div>
    <div style="display:flex; gap:6px; margin-top:8px;">
      <button data-testid="face-toggle-mic" style="flex:1; padding:6px; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; border-radius:4px; cursor:pointer; font-size:11px; font-weight:700;">🎤 Mikro</button>
      <button data-testid="face-toggle-cam" style="flex:1; padding:6px; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; border-radius:4px; cursor:pointer; font-size:11px; font-weight:700;">📷 Kamera</button>
    </div>
    <div data-testid="face-status" style="margin-top:6px; font-size:11px; color:#8899aa; text-align:center; min-height:14px;"></div>
  `;

  const rv = panelEl.querySelector('[data-testid="face-remote-video"]') as HTMLVideoElement;
  const lv = panelEl.querySelector('[data-testid="face-local-video"]') as HTMLVideoElement;
  if (rv && remoteStream) rv.srcObject = remoteStream;
  if (lv && localStream) lv.srcObject = localStream;

  panelEl.querySelector('[data-testid="face-hangup-btn"]')?.addEventListener("click", () => faceToFaceOnRemove());
  panelEl.querySelector('[data-testid="face-toggle-mic"]')?.addEventListener("click", (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    const on = session?.toggleAudio();
    btn.textContent = on ? "🎤 Mikro" : "🎤 Aus";
    btn.style.background = on ? "#1e3a5f" : "#E8002D";
  });
  panelEl.querySelector('[data-testid="face-toggle-cam"]')?.addEventListener("click", (ev) => {
    const btn = ev.currentTarget as HTMLButtonElement;
    const on = session?.toggleVideo();
    btn.textContent = on ? "📷 Kamera" : "📷 Aus";
    btn.style.background = on ? "#1e3a5f" : "#E8002D";
  });
}

function setStatus(text: string) {
  if (!panelEl) return;
  const el = panelEl.querySelector('[data-testid="face-status"]') as HTMLElement | null;
  if (el) el.textContent = text;
}
