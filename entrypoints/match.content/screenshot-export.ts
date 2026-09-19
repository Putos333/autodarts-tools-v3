// v2.9.71 – Screenshot-Export für den Match-Screen
// ─────────────────────────────────────────────────────────────────
// Ein floating 📸-Button rechts unten im Match nimmt via
// `browser.tabs.captureVisibleTab` (native WebExtension-API) ein PNG
// auf und triggert den Download mit einem sprechenden Dateinamen.
//
// Vorteile gegenüber html2canvas:
//   • Kein Library-Overhead (spart >100 KB Bundle)
//   • Vollständiges Rendering inkl. Autodarts-React-Portale, Shadow-DOM,
//     Extension-Overlays (Venue-Header, Match-Sticker etc.)
//   • Funktioniert in Chrome MV3 + Firefox MV2 identisch

const BTN_ID = "adt-screenshot-btn";
const TOAST_ID = "adt-screenshot-toast";

let mounted = false;

function tsSlug(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function toast(msg: string, ok = true) {
  document.getElementById(TOAST_ID)?.remove();
  const t = document.createElement("div");
  t.id = TOAST_ID;
  t.setAttribute("data-testid", "screenshot-toast");
  t.style.cssText = `
    position: fixed; bottom: 90px; right: 24px; z-index: 2147483647;
    background: ${ok ? "linear-gradient(135deg, #059669, #10B981)" : "linear-gradient(135deg, #B91C1C, #EF4444)"};
    color: #fff; padding: 10px 16px; border-radius: 6px;
    font-family: 'Barlow Condensed', 'Arial Narrow', Arial, sans-serif;
    font-weight: 700; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;
    box-shadow: 0 6px 20px rgba(0,0,0,0.35);
    transition: opacity 0.3s ease;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; }, 2200);
  setTimeout(() => { t.remove(); }, 2600);
}

async function takeScreenshot() {
  const btn = document.getElementById(BTN_ID) as HTMLButtonElement | null;
  if (btn) { btn.disabled = true; btn.style.opacity = "0.5"; }

  try {
    const resp = await browser.runtime.sendMessage({ type: "CAPTURE_SCREENSHOT" }) as
      { ok: boolean; dataUrl?: string; error?: string } | undefined;

    if (!resp?.ok || !resp.dataUrl) {
      toast(`✗ Fehler: ${resp?.error ?? "Unbekannt"}`, false);
      return;
    }

    // DataURL → Blob → Download
    const blob = await (await fetch(resp.dataUrl)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `autodarts-match-${tsSlug()}.png`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast("📸 Screenshot gespeichert");
  } catch (e) {
    console.error("[Screenshot] failed:", e);
    toast(`✗ Fehler: ${(e as Error).message.slice(0, 40)}`, false);
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = "1"; }
  }
}

function mountButton() {
  if (document.getElementById(BTN_ID)) return;

  const btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.setAttribute("data-testid", "screenshot-export-btn");
  btn.setAttribute("aria-label", "Match-Screenshot exportieren");
  btn.setAttribute("title", "Screenshot als PNG speichern");
  btn.innerHTML = `<span style="font-size:20px; line-height:1;">📸</span>`;
  btn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483646;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #1a2e45 0%, #0D1B2A 100%);
    border: 2px solid rgba(245, 200, 66, 0.6);
    color: #F5C842;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    transition: transform 0.15s ease, border-color 0.15s ease;
    padding: 0;
  `;
  btn.addEventListener("mouseenter", () => {
    btn.style.transform = "scale(1.08)";
    btn.style.borderColor = "#F5C842";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.transform = "scale(1)";
    btn.style.borderColor = "rgba(245, 200, 66, 0.6)";
  });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    takeScreenshot();
  });
  document.body.appendChild(btn);
}

export function initScreenshotExport() {
  if (mounted) return;
  mounted = true;
  mountButton();
}

export function cleanupScreenshotExport() {
  document.getElementById(BTN_ID)?.remove();
  document.getElementById(TOAST_ID)?.remove();
  mounted = false;
}
