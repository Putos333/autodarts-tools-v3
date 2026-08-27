<script setup lang="ts">
import { ref } from "vue";

const easterEggClicks = ref(0);
const showEasterEgg = ref(false);
const version = "2.9.98"; // synchron mit package.json halten
const buildDate = "Juni 2025";

function handleLogoClick() {
  easterEggClicks.value++;
  if (easterEggClicks.value >= 7) {
    showEasterEgg.value = true;
  }
}

const changelog = [
  { version: "2.3.1", date: "Jun 2025", changes: ["Multi-Provider TTS (Browser, ElevenLabs, Google, Azure, OpenAI)", "AES-256 verschlüsselte API-Key Speicherung", "Direktlinks zur Anbieter-Registrierung"] },
  { version: "2.3.0", date: "Jun 2025", changes: ["Liga-System auf Share-Code (ohne Registrierung) umgebaut", "Firefox-Kompatibilität (Manifest V2)", "Service Worker Keep-Alive"] },
  { version: "2.2.9", date: "Jun 2025", changes: ["Liga-Einladungslink (Ane-Click Beitritt via WhatsApp/URL)", "Auto-Join beim Klick auf Einladungslink"] },
  { version: "2.2.8", date: "Jun 2025", changes: ["Trainings-Modus mit Zielvorgaben und Verlauf", "Party-Buzzer mit QR-Code Handy-Interface"] },
  { version: "2.2.0", date: "Jun 2025", changes: ["KI-Kommentator (OpenAI TTS)", "Bogey-Number Warnung & Checkout-Vorschläge", "Erweiterungs-Manager Dashboard-Widget"] },
  { version: "2.1.0", date: "Jun 2025", changes: ["TV-Style Statistiken (First 9 Avg, Doppelquote)", "Liga-System mit Supabase Zurückend", "Head-to-Head Statistiken"] },
  { version: "2.0.0", date: "Jun 2025", changes: ["Einlauf Songs mit PDC-Presets und MP3-Hochladen", "Crowd & Atmosphäre System (Jubel, Raunen, Pfeifen)", "Freundesliste mit Ane-Click Einladung"] },
  { version: "1.x.x", date: "Original", changes: ["Basis-Features von creazy231 (tools-for-autodarts)"] },
];
</script>

<template>
  <div style="font-family: 'Barlow Condensed', 'Barlow', sans-serif; color: #e8eaf0; background: #0D1B2A;">

    <!-- Header -->
    <div style="display:flex; align-items:center; gap:10px; padding: 16px 20px 12px; border-bottom: 2px solid #E8002D;">
      <span style="font-size:22px;">ℹ️</span>
      <span style="font-size:20px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:#F5C842;">
        Über diese Erweiterung
      </span>
    </div>

    <div style="padding: 16px; display:flex; flex-direction:column; gap:16px;">

      <!-- Haupt-Info Card -->
      <div style="background:#0a1520; border-radius:6px; padding:20px; border:1px solid #1e3a5f; text-align: center;">

        <!-- Logo / Easter-Egg Trigger -->
        <div @click="handleLogoClick"
          style="font-size:48px; cursor:pointer; user-select:none; margin-bottom:12px; display:inline-block;"
          :style="{ transform: easterEggClicks > 0 && easterEggClicks < 7 ? `rotate(${easterEggClicks * 15}deg)` : 'none' }">
          🎯
        </div>

        <div style="font-size:22px; font-weight:700; color:#F5C842; letter-spacing:2px; text-transform:uppercase;">
          Tools for Autodarts
        </div>
        <div style="font-size:13px; color:#E8002D; font-weight:700; letter-spacing:3px; text-transform:uppercase; margin-top:4px;">
          Extended Edition
        </div>
        <div style="font-size:13px; color:#8899aa; margin-top:8px;">
          Version {{ version }} &nbsp;·&nbsp; {{ buildDate }}
        </div>

        <!-- Herausgeber-Badge -->
        <div style="display:inline-flex; align-items:center; gap:8px; margin-top:14px; background:#0D1B2A; border:2px solid #E8002D; border-radius:4px; padding:8px 16px;">
          <span style="font-size:14px;">🎖️</span>
          <div>
            <div style="font-size:10px; color:#8899aa; letter-spacing:2px; text-transform:uppercase;">Herausgeber</div>
            <div style="font-size:16px; font-weight:700; color:#F5C842; letter-spacing:2px;">Arnonym2302</div>
          </div>
        </div>

        <div style="font-size:12px; color:#556677; margin-top:14px; line-height:1.6;">
          Basiert auf dem Original-Projekt
          <a href="https://github.com/creazy231/tools-for-autodarts" target="_blank"
            style="color:#E8002D; text-decoration:none; font-weight:700;">
            tools-for-autodarts von creazy231
          </a>
          (MIT-Lizenz).<br/>
          Erweitert mit Einlauf Songs, KI-Kommentator, Liga-System, Crowd-Sounds und mehr.
        </div>
      </div>

      <!-- Easter Egg -->
      <div v-if="showEasterEgg"
        style="background: linear-gradient(135deg, #1a0a10, #0D1B2A); border:2px solid #F5C842; border-radius:6px; padding:20px; text-align: center;">
        <div style="font-size:32px; margin-bottom:8px;">🏆🎯🏆</div>
        <div style="font-size:16px; font-weight:700; color:#F5C842; letter-spacing:2px; text-transform:uppercase;">
          Du hast das Easter Egg gefunden!
        </div>
        <div style="font-size:13px; color:#c8d4e0; margin-top:8px; line-height:1.6;">
          "The greatest dart player in the world is the one who has the most fun."<br/>
          <span style="color:#8899aa; font-size:11px;">— Arnonym2302, 2025</span>
        </div>
        <div style="font-size:24px; margin-top:12px;">🎉🍺🎉</div>
      </div>

      <!-- Feature-Übersicht -->
      <div style="background:#0a1520; border-radius:6px; padding:16px; border:1px solid #1e3a5f;">
        <div style="font-size:13px; font-weight:700; color:#F5C842; letter-spacing:1px; text-transform:uppercase; margin-bottom:12px;">
          🚀 Neue Features in dieser Edition
        </div>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <div v-for="(feat, i) in [
            { icon:'🎵', title:'Einlauf Songs', desc:'Eigene MP3s oder PDC-Presets pro Spieler' },
            { icon:'🎙️', title:'KI-Kommentator', desc:'Live-Kommentare via Browser, ElevenLabs, Google, Azure oder OpenAI' },
            { icon:'👥', title:'Crowd & Atmosphäre', desc:'Jubel, Raunen, Pfeifen – echtes Stadion-Feeling' },
            { icon:'👫', title:'Freundesliste', desc:'Ane-Click Einladung, Head-to-Head Statistiken' },
            { icon:'🏆', title:'Liga-System', desc:'Eigene Liga per Share-Code, kein Account nötig' },
            { icon:'📺', title:'TV-Style Statistiken', desc:'First 9 Avg, Doppelquote, Bogey-Warnung' },
            { icon:'🎯', title:'Trainings-Modus', desc:'Zielvorgaben, Live-Fortschritt, Verlauf' },
            { icon:'🔔', title:'Party-Buzzer', desc:'Bis zu 4 Spieler per QR-Code Handy-Buzzer' },
            { icon:'🌐', title:'DE/EN Menü', desc:'Vollständig zweisprachig umschaltbar' },
            { icon:'🦊', title:'Firefox & Chrome', desc:'Läuft auf beiden Browsern nativ' },
          ]" :key="i"
            style="display:flex; align-items:center; gap:10px; padding:8px 10px; background:#0D1B2A; border-radius:4px; border:1px solid #1e3a5f;">
            <span style="font-size:18px; flex-shrink:0;">{{ feat.icon }}</span>
            <div>
              <div style="font-size:13px; font-weight:700;">{{ feat.title }}</div>
              <div style="font-size:11px; color:#8899aa;">{{ feat.desc }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Changelog -->
      <div style="background:#0a1520; border-radius:6px; padding:16px; border:1px solid #1e3a5f;">
        <div style="font-size:13px; font-weight:700; color:#F5C842; letter-spacing:1px; text-transform:uppercase; margin-bottom:12px;">
          📋 Versions-Verlauf
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="(entry, i) in changelog" :key="i"
            style="border-left:3px solid #1e3a5f; padding-left:12px;"
            :style="{ borderColor: i === 0 ? '#E8002D' : '#1e3a5f' }">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
              <span style="font-size:13px; font-weight:700; color:#F5C842;">v{{ entry.version }}</span>
              <span style="font-size:11px; color:#556677;">{{ entry.date }}</span>
              <span v-if="i === 0"
                style="font-size:10px; background:#E8002D; color:#fff; padding:1px 6px; border-radius:3px; font-weight:700; letter-spacing:1px;">
                AKTUELL
              </span>
            </div>
            <ul style="margin:0; padding-left:16px; display:flex; flex-direction:column; gap:2px;">
              <li v-for="(change, j) in entry.changes" :key="j"
                style="font-size:11px; color:#8899aa; line-height:1.5;">
                {{ change }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align: center; font-size:11px; color:#334455; padding:8px 0;">
        Made with ❤️ and 🎯 by <strong style="color:#556677;">Arnonym2302</strong> &nbsp;·&nbsp;
        Basiert auf <a href="https://github.com/creazy231/tools-for-autodarts" target="_blank"
          style="color:#556677; text-decoration:none;">tools-for-autodarts</a> (MIT)
      </div>

    </div>
  </div>
</template>
