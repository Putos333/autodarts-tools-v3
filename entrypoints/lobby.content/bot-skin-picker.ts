/**
 * bot-skin-picker.ts – Floating Bot-Skin-Picker in der Autodarts-Lobby (v2.9.78)
 *
 * Zeigt in jeder Lobby einen kleinen Button „🎭 PDC-Skin", der beim Klick
 * eine sortier- und filterbare Liste aller PDC/PDC-Europe-Profis öffnet.
 * Ein Klick auf einen Spieler:
 *   1. Legt eine synthetische `career-active-match`-Konfiguration im Storage an
 *      (die der bestehende Bot-Renamer kennt).
 *   2. Ruft den Renamer sofort auf → Bot wird umbenannt, Slider auf realistischer
 *      PPR gesetzt.
 *
 * Läuft KOMPLETT unabhängig vom Karriere-/Turnier-Modus.
 */

import { AutodartsToolsConfig } from "@/utils/storage";
import {
  getAllSkinTemplates,
  filterSkinTemplates,
  pprForSkin,
  type SkinTemplate,
  type SkinFilter,
} from "@/utils/pdc-skin-templates";

const BUTTON_ID = "adt-skin-picker-btn";
const MODAL_ID = "adt-skin-picker-modal";
const STORAGE_LAST_SKIN = "local:last-bot-skin-id";
const ACTIVE_MATCH_KEY_LOCAL = "local:career-active-match";

let currentFilter: SkinFilter = "top32";
let currentSearch = "";
let currentDifficulty = 0.85; // 0.4 Amateur, 0.65 Fortgeschritten, 0.85 Profi, 1.0 Elite

export async function botSkinPicker(): Promise<void> {
  const cfg = await AutodartsToolsConfig.getValue();
  if (cfg.botSkinPicker?.enabled === false) return;
  mountButton();
}

export function botSkinPickerOnRemove(): void {
  document.getElementById(BUTTON_ID)?.remove();
  document.getElementById(MODAL_ID)?.remove();
}

function mountButton() {
  if (document.getElementById(BUTTON_ID)) return;
  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.setAttribute("data-testid", "bot-skin-picker-btn");
  btn.textContent = "🎭 PDC-Skin";
  btn.title = "PDC-Skin wählen und Bot automatisch umbenennen";
  btn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 99998;
    padding: 10px 16px;
    background: linear-gradient(135deg, #E8002D 0%, #b40024 100%);
    color: white;
    border: none;
    border-radius: 24px;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0,0,0,0.4);
    transition: transform 0.15s, box-shadow 0.15s;
  `;
  btn.onmouseenter = () => { btn.style.transform = "translateY(-2px)"; btn.style.boxShadow = "0 6px 20px rgba(0,0,0,0.5)"; };
  btn.onmouseleave = () => { btn.style.transform = "translateY(0)"; btn.style.boxShadow = "0 4px 14px rgba(0,0,0,0.4)"; };
  btn.onclick = () => openModal();
  document.body.appendChild(btn);
}

async function openModal() {
  document.getElementById(MODAL_ID)?.remove();

  const last = await browser.storage.local.get(STORAGE_LAST_SKIN);
  const lastSkinId = last?.[STORAGE_LAST_SKIN] as string | undefined;
  const templates = getAllSkinTemplates();

  const overlay = document.createElement("div");
  overlay.id = MODAL_ID;
  overlay.setAttribute("data-testid", "bot-skin-picker-modal");
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 999999;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    box-sizing: border-box;
    font-family: 'Barlow Condensed', sans-serif;
    color: #e8eaf0;
  `;

  const modal = document.createElement("div");
  modal.style.cssText = `
    background: #0D1B2A;
    border: 2px solid #E8002D;
    border-radius: 10px;
    width: 100%;
    max-width: 900px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;

  modal.innerHTML = `
    <div style="padding: 16px 20px; border-bottom: 2px solid #E8002D; display:flex; align-items:center; gap:12px;">
      <span style="font-size:22px;">🎭</span>
      <div style="flex:1;">
        <div style="font-size:20px; font-weight:800; letter-spacing:2px; text-transform:uppercase; color:#F5C842;">PDC Bot-Skin-Picker</div>
        <div style="font-size:12px; color:#8899aa;">${templates.length} PDC + PDC-Europe Spieler · Ein Klick zum Umbenennen</div>
      </div>
      <button data-testid="skin-picker-close" style="background:none;border:none;color:#8899aa;font-size:28px;cursor:pointer;">×</button>
    </div>

    <div style="padding: 12px 16px; display:flex; gap:10px; flex-wrap:wrap; border-bottom:1px solid #1e3a5f;">
      <input data-testid="skin-picker-search" placeholder="🔍 Name, Nickname, Land …" value="${escapeHtml(currentSearch)}"
        style="flex:1; min-width:220px; background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:8px 12px; border-radius:4px; font-size:14px;" />
      <select data-testid="skin-picker-difficulty" style="background:#1e3a5f; color:#e8eaf0; border:1px solid #2a4a7f; padding:8px 12px; border-radius:4px; font-size:12px;">
        <option value="0.4"${currentDifficulty === 0.4 ? " selected" : ""}>😌 Amateur (0.4x PPR)</option>
        <option value="0.65"${currentDifficulty === 0.65 ? " selected" : ""}>📺 Fortgeschritten (0.65x)</option>
        <option value="0.85"${currentDifficulty === 0.85 ? " selected" : ""}>🎯 Profi (0.85x)</option>
        <option value="1.0"${currentDifficulty === 1.0 ? " selected" : ""}>🔥 Elite (1.0x)</option>
      </select>
    </div>

    <div style="padding: 8px 16px; display:flex; gap:6px; flex-wrap:wrap; border-bottom:1px solid #1e3a5f;">
      ${(["top16","top32","pdc_europe","german","female","legend","all"] as SkinFilter[]).map(f => `
        <button data-testid="skin-filter-${f}" data-filter="${f}"
          style="padding:6px 10px; cursor:pointer; border-radius:4px; font-size:11px; font-weight:700; letter-spacing:1px; text-transform:uppercase;
          border: ${currentFilter === f ? '2px solid #E8002D' : '1px solid #1e3a5f'};
          background: ${currentFilter === f ? '#E8002D' : '#0a1520'};
          color: ${currentFilter === f ? '#fff' : '#8899aa'};">
          ${filterLabel(f)}
        </button>
      `).join("")}
    </div>

    <div data-testid="skin-list" style="flex:1; overflow-y:auto; padding: 12px 16px;">
      ${renderList(templates, currentFilter, currentSearch, lastSkinId)}
    </div>

    <div style="padding: 10px 16px; border-top: 1px solid #1e3a5f; font-size: 11px; color: #556677; text-align: center;">
      💡 Der Skin wird auf den Bot in der aktuellen Lobby angewandt · Renamer läuft anschließend automatisch
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  modal.querySelector('[data-testid="skin-picker-close"]')?.addEventListener("click", () => overlay.remove());

  const searchInput = modal.querySelector('[data-testid="skin-picker-search"]') as HTMLInputElement;
  searchInput?.addEventListener("input", () => {
    currentSearch = searchInput.value;
    updateList(modal, lastSkinId);
  });

  const diffSelect = modal.querySelector('[data-testid="skin-picker-difficulty"]') as HTMLSelectElement;
  diffSelect?.addEventListener("change", () => {
    currentDifficulty = parseFloat(diffSelect.value);
    updateList(modal, lastSkinId);
  });

  modal.querySelectorAll("[data-filter]").forEach((el) => {
    el.addEventListener("click", () => {
      currentFilter = el.getAttribute("data-filter") as SkinFilter;
      overlay.remove();
      openModal();
    });
  });

  attachCardHandlers(modal, overlay);
}

function updateList(modal: HTMLElement, lastSkinId?: string) {
  const list = modal.querySelector('[data-testid="skin-list"]') as HTMLElement;
  const templates = getAllSkinTemplates();
  list.innerHTML = renderList(templates, currentFilter, currentSearch, lastSkinId);
  attachCardHandlers(modal, modal.parentElement as HTMLElement);
}

function attachCardHandlers(modal: HTMLElement, overlay: HTMLElement) {
  modal.querySelectorAll<HTMLElement>("[data-skin-id]").forEach((card) => {
    card.addEventListener("click", async () => {
      const id = card.getAttribute("data-skin-id");
      const tpl = getAllSkinTemplates().find(t => t.id === id);
      if (!tpl) return;
      await applySkin(tpl);
      overlay.remove();
    });
  });
}

function renderList(all: SkinTemplate[], filter: SkinFilter, search: string, lastSkinId?: string): string {
  const list = filterSkinTemplates(all, filter, search);
  if (!list.length) {
    return `<div style="text-align:center; padding:40px; color:#8899aa;">Keine Spieler gefunden.</div>`;
  }
  return `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:10px;">
    ${list.map(t => renderCard(t, t.id === lastSkinId)).join("")}
  </div>`;
}

function renderCard(t: SkinTemplate, isLast: boolean): string {
  const ppr = pprForSkin(t, currentDifficulty);
  const rankBadge = t.worldRanking && t.worldRanking <= 32
    ? `<span style="background:#E8002D; color:#fff; padding:2px 6px; border-radius:3px; font-size:9px; font-weight:800;">#${t.worldRanking}</span>`
    : (t.isPdcEurope ? `<span style="background:#1e3a5f; color:#F5C842; padding:2px 6px; border-radius:3px; font-size:9px; font-weight:800;">EUROPE</span>` : "");
  const nickname = t.nickname
    ? `<div style="font-size:11px; color:#F5C842; font-style:italic; margin-top:2px;">„${escapeHtml(t.nickname)}"</div>`
    : "";
  return `<button
    data-testid="skin-card-${t.id}"
    data-skin-id="${t.id}"
    style="
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 6px;
      background: ${isLast ? "linear-gradient(135deg, #1a3020 0%, #0a1520 100%)" : "#0a1520"};
      border: 1px solid ${isLast ? "#00C853" : "#1e3a5f"};
      color: #e8eaf0; cursor: pointer; text-align: left; font-family: inherit;
      transition: transform 0.1s, border-color 0.15s;
    "
    onmouseover="this.style.borderColor='#E8002D'; this.style.transform='translateY(-1px)';"
    onmouseout="this.style.borderColor='${isLast ? "#00C853" : "#1e3a5f"}'; this.style.transform='translateY(0)';"
  >
    <div style="font-size:26px; line-height:1;">${t.flag}</div>
    <div style="flex:1; min-width:0;">
      <div style="display:flex; align-items:center; gap:6px;">
        <span style="font-weight:800; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(t.name)}</span>
        ${rankBadge}
      </div>
      ${nickname}
      <div style="font-size:11px; color:#8899aa; margin-top:4px;">
        Ziel-PPR: <b style="color:#00C853;">${ppr}</b> · Bereich ${t.averageMin}–${t.averageMax}
      </div>
    </div>
  </button>`;
}

async function applySkin(skin: SkinTemplate) {
  const targetPpr = pprForSkin(skin, currentDifficulty);

  // Synthetische CareerMatchConfig ins Storage schreiben – der bestehende
  // Bot-Renamer (career-bot-hint.ts) beobachtet diesen Key und übernimmt.
  const cfg = {
    tournamentId: `skin-${skin.id}`,
    tournamentName: `PDC-Skin: ${skin.name}`,
    round: "Match",
    opponent: {
      id: skin.id,
      name: skin.name,
      country: skin.country,
      averageMin: targetPpr - 2,
      averageMax: targetPpr + 2,
      checkoutRateMin: skin.checkoutRateMin,
      checkoutRateMax: skin.checkoutRateMax,
      worldRanking: skin.worldRanking,
      isNemesis: false,
      rivalryWins: 0,
      rivalryLosses: 0,
    },
    format: "first-to-legs",
    inMode: "double-in",
    outMode: "double-out",
    isTvMatch: false,
    isWalkOnEnabled: false,
    prizeMoneyWin: 0,
    prizeMoneyLoss: 0,
    orderOfMeritPoints: 0,
    isTournament: true,
    difficulty: "profi",
  };

  await browser.storage.local.set({ [ACTIVE_MATCH_KEY_LOCAL]: cfg });
  await browser.storage.local.set({ [STORAGE_LAST_SKIN]: skin.id });

  showToast(`🎭 ${skin.flag} ${skin.name} · PPR ${targetPpr}`);

  // Renamer neu initialisieren (falls Lobby-Content-Script bereits geladen ist)
  const evt = new CustomEvent("adt:skin-applied", { detail: { skinId: skin.id, cfg } });
  window.dispatchEvent(evt);

  // Als zusätzliche Sicherheit: nach 500 ms nochmal Lobby-Reload triggern
  setTimeout(() => {
    if (window.location.href.includes("/lobbies/")) {
      window.dispatchEvent(new Event("focus")); // triggert manche Watchers
    }
  }, 500);
}

function showToast(text: string) {
  const t = document.createElement("div");
  t.setAttribute("data-testid", "skin-applied-toast");
  t.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 999999;
    padding: 12px 24px;
    background: linear-gradient(135deg, #00C853 0%, #009d40 100%);
    color: #fff;
    font-family: 'Barlow Condensed', sans-serif;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 1.5px;
    border-radius: 6px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.4);
    animation: adt-toast-in 0.3s ease-out;
  `;
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.style.opacity = "0", 3200);
  setTimeout(() => t.remove(), 3800);
}

function filterLabel(f: SkinFilter): string {
  switch (f) {
    case "top16": return "⭐ Top 16";
    case "top32": return "🏆 Top 32";
    case "pdc_europe": return "🇪🇺 PDC Europe";
    case "german": return "🇩🇪 Deutsche";
    case "female": return "♀ Frauen";
    case "legend": return "👑 Legenden";
    case "all": return "📚 Alle";
  }
}

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
