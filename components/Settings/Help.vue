<template>
  <div class="help-container">
    <!-- Header -->
    <div class="help-header">
      <div class="help-header-links">
        <span class="help-icon">❓</span>
        <div>
          <h1 class="help-title">HILFE & ANLEITUNG</h1>
          <p class="help-subtitle">Autodarts Tools – Extended Edition by Arnonym2302</p>
        </div>
      </div>
      <div class="help-search">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="🔍 Feature suchen..."
          class="help-search-input"
        />
      </div>
    </div>

    <!-- Feature Navigation -->
    <div class="help-nav">
      <button
        v-for="feature in filteredFeatures"
        :key="feature.id"
        :class="['help-nav-btn', { active: activeFeature === feature.id }]"
        @click="activeFeature = feature.id"
      >
        <span class="help-nav-icon">{{ feature.icon }}</span>
        <span class="help-nav-label">{{ feature.title }}</span>
      </button>
    </div>

    <!-- Feature Content -->
    <div v-for="feature in filteredFeatures" :key="feature.id" v-show="activeFeature === feature.id" class="help-content">

      <!-- Feature Header -->
      <div class="feature-header">
        <div class="feature-header-icon">{{ feature.icon }}</div>
        <div>
          <h2 class="feature-title">{{ feature.title }}</h2>
          <p class="feature-desc">{{ feature.description }}</p>
        </div>
        <div class="feature-badge" :class="feature.badgeClass">{{ feature.badge }}</div>
      </div>

      <!-- Steps -->
      <div class="steps-container">
        <div v-for="(step, index) in feature.steps" :key="index" class="step-card">
          <div class="step-number">{{ index + 1 }}</div>
          <div class="step-content">
            <h3 class="step-title">{{ step.title }}</h3>
            <p class="step-text">{{ step.text }}</p>
            <div v-if="step.tip" class="step-tip">
              <span class="tip-icon">💡</span>
              <span>{{ step.tip }}</span>
            </div>
            <div v-if="step.warning" class="step-warning">
              <span class="warning-icon">⚠️</span>
              <span>{{ step.warning }}</span>
            </div>
            <div v-if="(step as any).code" class="step-code">{{ (step as any).code }}</div>
          </div>
        </div>
      </div>

      <!-- FAQ -->
      <div v-if="feature.faq && feature.faq.length" class="faq-section">
        <h3 class="faq-title">❓ Häufige Fragen</h3>
        <div v-for="(item, index) in feature.faq" :key="index" class="faq-item">
          <button class="faq-question" @click="toggleFaq(feature.id, index)">
            <span>{{ item.q }}</span>
            <span class="faq-arrow">{{ openFaqs[`${feature.id}-${index}`] ? '▲' : '▼' }}</span>
          </button>
          <div v-show="openFaqs[`${feature.id}-${index}`]" class="faq-answer">
            {{ item.a }}
          </div>
        </div>
      </div>

    </div>

    <!-- Empty State -->
    <div v-if="filteredFeatures.length === 0" class="help-empty">
      <p>Kein Feature gefunden für "{{ searchQuery }}"</p>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from "vue";

const searchQuery = ref("");
const activeFeature = ref("installation");
const openFaqs = reactive<Record<string, boolean>>({});

function toggleFaq(featureId: string, index: number) {
  const key = `${featureId}-${index}`;
  openFaqs[key] = !openFaqs[key];
}

const features = [ // @ts-ignore

  // ═══════════════════════════════════════════════════════════════════════
  //  v2.9.64: 1v1-Support + Venue-Theming + Native-Mute
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "one-vs-one-support",
    icon: "⚔️",
    title: "Alle Features im 1v1 & Self-Lobbies",
    description: "Sämtliche Extension-Features funktionieren automatisch in normalen 1v1-Matches — kein separater Modus nötig",
    badge: "NEU · v2.9.64",
    badgeClass: "badge-green",
    steps: [
      {
        title: "Wo greifen die Features?",
        text: "Alle Content-Scripts sind auf sämtliche play.autodarts.io-Seiten registriert und triggern bei URL-Match von /matches/xxx ODER /boards/xxx — komplett unabhängig davon, ob das Match aus einer Saison, einem Turnier, einem Freunde-Turnier oder einer selbst erstellten Lobby stammt.",
      },
      {
        title: "Was funktioniert im 1v1?",
        text: "🎯 Caller (Voice-Packs) · 👥 Crowd (mit Venue-Reverb) · 🎪 Sound FX · 🏟️ Venue-Presets · 🎴 Match-Sticker (Trading Card) · 🔊 Quick-Menu · 🎬 Animationen · 📊 Statistiken · Alle Extras.",
        tip: "Nichts musst du extra einschalten — sobald du in ein Match wechselst, springen die Module an.",
      },
      {
        title: "Was ist tournament-spezifisch?",
        text: "Nur wenige Features sind bewusst nur im Turnier-Kontext aktiv: Auto-Ergebnis-Erkennung (Winner ins Bracket), Bot-Auto-Rename (Karriere-Bot bekommt PDC-Namen). Ohne aktives Turnier bleiben diese Module still — sie erzeugen keine Nebenwirkungen.",
      },
    ],
    faq: [
      { q: "Muss ich für 1v1-Matches etwas umkonfigurieren?", a: "Nein. Wähle Caller/Voice-Pack/Venue einmal in den Extension-Einstellungen — gilt für alle Match-Modi." },
      { q: "Funktioniert es auch in Ranked / öffentlichen Lobbies?", a: "Ja, überall wo /matches/UUID oder /boards/UUID in der URL steht." },
    ],
  },
  {
    id: "venue-theming",
    icon: "🎨",
    title: "Venue-Theming des Match-Bildschirms",
    description: "Match-Screen bekommt Farbakzent, Vignette und Board-Glow passend zum aktiven Venue",
    badge: "NEU · v2.9.64",
    badgeClass: "badge-green",
    steps: [
      {
        title: "Was wird visuell angepasst?",
        text: "Sobald ein Venue-Preset aktiv ist, injiziert die Extension eine CSS-Ebene: (1) obere Leiste in Venue-Farbe (Ally Pally rot, Utilita Arena violett, TV-Studio grau…), (2) sanfte radiale Vignette in Venue-Farbe, (3) Glow-Effekt auf dem Board-Element, (4) Venue-Badge unten links (z.B. „🏆 Ally Pally · Alexandra Palace”).",
      },
      {
        title: "Live-Update ohne Reload",
        text: "Wechselst du das Venue während einer Session (Tools → Crowd → Venue-Preset), aktualisiert sich das Theming live via storage.onChanged.",
      },
      {
        title: "Deaktivieren",
        text: "Wähle in Crowd → Venue-Preset „✕ Kein Venue” → CSS wird komplett entfernt, Match-Bildschirm sieht wieder aus wie Standard-Autodarts.",
      },
    ],
    faq: [
      { q: "Verändert das Autodarts's Layout?", a: "Nein — die Anpassungen sind reine Overlay-Layer (::before / ::after) und nicht-blockierende Filter (drop-shadow). Autodarts-UI bleibt voll funktional." },
      { q: "Sieht das im Screenshot / Match-Sticker gut aus?", a: "Der Match-Sticker (v2.9.62) hat sein eigenes Farbschema mit Rarity-System — der Venue-Rahmen ergänzt das visuell." },
    ],
  },
  {
    id: "mute-native-caller",
    icon: "🔇",
    title: "Autodarts-Caller automatisch stummschalten",
    description: "Verhindert Doppel-Ansagen: sobald deine eigenen Sound-Module aktiv sind, wird der native Autodarts-Caller gemutet",
    badge: "NEU · v2.9.64",
    badgeClass: "badge-green",
    steps: [
      {
        title: "Warum überhaupt?",
        text: "Autodarts.io spricht selbst standardmäßig die Scores an. Wenn du parallel unseren eigenen Caller / Sound FX / Crowd nutzt, hörst du zwei Ansagen gleichzeitig. Die Extension unterdrückt jetzt den nativen Autodarts-Caller automatisch.",
      },
      {
        title: "Wie erkennt die Extension „unsere” Sounds?",
        text: "Alle eigenen Audio-Dateien werden als `data:audio/mp3;base64,…` oder `blob:` URLs abgespielt. Autodarts-native-Audio kommt von deren CDN (autodarts.io oder Cloudfront). Der Play-Hook filtert nach URL-Prefix — data:/blob: durchlassen, alles andere muten.",
        tip: "Kein Auslesen von privaten Cookies, keine externen Requests — reines URL-Pattern-Matching auf Client-Seite.",
      },
      {
        title: "Standard aktiv",
        text: "Der Toggle ist standardmäßig AN, sobald mindestens eines von Caller / Sound FX / Crowd aktiv ist.",
      },
      {
        title: "Abschalten",
        text: "Tools → Sounds → Caller → neuer Toggle „Nativen Autodarts-Caller stummschalten” → ausschalten wenn du beide Caller parallel willst (z.B. zum A/B-Vergleich).",
      },
    ],
    faq: [
      { q: "Kann das Autodarts-Score-Feedback komplett kaputt gehen?", a: "Nein — nur die Audio wird stumm. Autodarts's UI-Feedback (Text-Anzeige, Score-Update) läuft weiter normal, weil das nichts mit Audio zu tun hat." },
      { q: "Was passiert wenn ich den eigenen Caller ausschalte?", a: "Sobald keiner unserer Sound-Module aktiv ist, deinstalliert die Extension den Play-Hook automatisch. Autodarts-native-Audio spielt wieder normal." },
      { q: "Warum manchmal kurze Verzögerung vor dem ersten Mute?", a: "Der Hook wird beim Match-Init installiert. Falls Autodarts vor dem Hook einen ersten Sound abspielt, hörst du diesen. Ab dem zweiten Sound gemutet — meist unauffällig." },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  v2.9.63: PDC-VENUE-ATMOSPHÄRE
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "venue-presets",
    icon: "🏟️",
    title: "PDC-Venue-Atmosphäre",
    description: "Ein-Klick-Preset für berühmte PDC-Locations mit passendem Hall, Deciding-Leg-Wahnsinn und Buhruf-Verhalten",
    badge: "NEU · v2.9.63",
    badgeClass: "badge-green",
    steps: [
      {
        title: "Was ist ein Venue-Preset?",
        text: "Ein Venue-Preset bestimmt drei Dinge: (1) Reverb-Signatur — Ally Pally-Bierzelt-Hall vs. TV-Studio-Trockenraum, (2) Grundlautstärken für Ambient und Publikum, (3) dynamische Boosts — Publikum wird lauter im Deciding-Leg und beim Match-Winning-Dart.",
        tip: "Der Reverb wird komplett synthetisch berechnet (Web Audio API Convolution) — keine externen Files, kein Copyright-Risiko.",
      },
      {
        title: "6 vorbereitete PDC-Hotspots",
        text: "🏆 Ally Pally (WM-Bierzelt), 🌊 Blackpool Winter Gardens (World Matchplay), 🏖️ Butlin's Minehead (Masters, entspannter), 🎪 Utilita Arena (Premier League Play-Offs, TV-Show), 📺 TV-Studio (Sky Sports, trocken), 🍺 Local Pub Night (deine Stammkneipe).",
      },
      {
        title: "Aktivieren",
        text: "Tools → Crowd & Atmosphäre → oben im Panel „PDC-Venue-Atmosphäre” → Klick auf eine der 6 Karten. Preset wird sofort angewendet — Crowd-Feature wird automatisch aktiviert falls es aus war.",
        tip: "„▶ Anhören”-Button auf jeder Karte spielt einen 3-Sekunden-Crowd-Roar mit dem venue-typischen Hall ab. So hörst du den Unterschied Ally Pally vs. TV-Studio sofort.",
      },
      {
        title: "Dynamische Loudness-Kurve",
        text: "Beim Deciding-Leg (Game/Match-Shot, Comeback-Leg) wird die Crowd um 18-40% lauter — genau wie im echten Leben. Der Match-Winning-Dart bekommt zusätzlich einen bis zu 70%igen Extra-Boost je nach Venue.",
        tip: "Beispiel Ally Pally: Deciding-Leg-Boost ×1.35, Match-Shot-Boost ×1.6 → gesamt bis zu ×2.0 Crowd-Volume gegenüber normalem Leg.",
      },
      {
        title: "Reverb-Effekt",
        text: "Der ausgewählte Venue-Reverb wird automatisch auf alle synthetischen Crowd-Sounds angewendet (Applaus, Buhrufe, 180er-Jubel, Ambient-Rauschen). Für hochgeladene eigene MP3s aktuell noch nicht — die spielen weiterhin trocken. Kommt in einer späteren Version.",
        warning: "Auf iOS/Safari kann die Web-Audio-Convolution je nach OS-Version fehlen — dann fällt das System stumm auf trockenen Sound zurück.",
      },
      {
        title: "Zurücksetzen",
        text: "Klick auf die letzte Karte „✕ Kein Venue” → Preset wird entfernt, Reverb-Bus wird abgebaut, Standardeinstellungen greifen wieder.",
      },
    ],
    faq: [
      { q: "Warum klingt Ally Pally so anders als TV-Studio?", a: "Reverb-Duration: Ally Pally 3.2s (Bierzelt-Hall), TV-Studio 0.35s (praktisch trocken). Plus deutlich lauter Ambient (55 vs. 22)." },
      { q: "Kann ich meine eigenen Venues definieren?", a: "Aktuell nur die 6 Built-Ins. Ein Community-Framework für ZIP-Import (wie bei Caller-Voice-Packs) ist auf der Roadmap — dann kannst du z.B. eine „Deine-Ligahalle”-Venue speichern und mit Freunden teilen." },
      { q: "Beeinflusst Venue meinen Caller?", a: "Nein — der Caller (180-Ansage etc.) läuft trocken. Der Reverb wirkt nur auf Crowd-Sounds. Das ist bewusst — das PDC-TV-Erlebnis mischt auch Studio-trockene Kommentatoren mit hallendem Publikum." },
      { q: "Kann ich den Reverb-Anteil selbst einstellen?", a: "Aktuell hardcoded pro Venue (0.08 bei TV-Studio bis 0.5 bei Utilita Arena). Wenn du selbst tweaken willst — sag Bescheid und wir bauen einen Slider dazu." },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  v2.9.62: KILLER-FEATURE — MATCH-STICKER (viral)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "match-sticker",
    icon: "🎴",
    title: "Match-Sticker (Trading Card)",
    description: "Automatisch generiertes 1080×1080-Sharebild nach jedem Match — mit Legendary-Gold-Karten bei Achievements",
    badge: "NEU · v2.9.62 · VIRAL",
    badgeClass: "badge-green",
    steps: [
      {
        title: "Match spielen — Sticker wird automatisch generiert",
        text: "Sobald ein Match beendet ist, blendet die Extension einen ganzseitigen Overlay ein mit einer schön gerenderten Karte: Beide Spielerfotos, Länderflagge, Final Score, 180er-Zähler, Highest Checkout, Best Average, Datum und ein #autodartstools-Watermark.",
        tip: "Jeder Match-Sticker wird nur EINmal automatisch gezeigt — dank interner Seen-Liste. Über den Extras-Bereich kannst du ihn jederzeit neu öffnen.",
      },
      {
        title: "5 Standard-Farbschemata",
        text: "PDC Classic (Rot/Nachtblau), Champions Blue, Fire Red, Neon Green, Retro Purple — würfeln per 🎲-Button bis dir eine gefällt.",
      },
      {
        title: "Seltene Karten (Rare & Legendary)",
        text: "Bestimmte Achievements schalten Farbschemata frei die sonst nicht erscheinen: 🎯 9-Darter oder 💯 100+ Average oder 🐋 170+ Checkout → Legendary Gold. 💥 5+ 180er oder ⭐ 90+ Avg → Rare Diamond Elite. 5% Zufalls-Chance auf Gold auch ohne Achievement (Panini-Feeling!).",
        tip: "Sammle alle Farben in der Gallery (browser.storage.local['adt-match-card-gallery'] — 30 letzte Karten).",
      },
      {
        title: "Teilen mit einem Klick",
        text: "4 Aktions-Buttons unter der Karte: 📥 Download PNG · 📋 In Zwischenablage kopieren · 🎲 Farbe würfeln · 💬 An Discord senden.",
        tip: "„An Discord” nutzt deinen bestehenden Webhook aus Tools → Lobby → Discord Webhooks. Kein Webhook → kein Problem, einfach das PNG runterladen und selbst posten.",
      },
      {
        title: "Viral-Effekt",
        text: "Jede geteilte Karte enthält oben und unten dezent den Extension-Namen (#autodartstools). Jeder Share bringt neue Spieler in die Community — bringt ohne Werbebudget Reichweite.",
        warning: "Bitte teile nur eigene Match-Karten oder Karten von Mitspielern die einverstanden sind — Spielerfotos sind öffentlich, aber Persönlichkeitsrechte gelten trotzdem.",
      },
    ],
    faq: [
      { q: "Warum sind manche Karten gold, andere nicht?", a: "Gold = LEGENDARY. Freischalten via: 9-Darter, 100+ Average, oder 170+ Checkout. Zusätzlich 5% Zufalls-Chance bei jedem Match (Panini-Sticker-Feeling)." },
      { q: "Werden die Karten dauerhaft gespeichert?", a: "Ja — die letzten 30 Karten liegen als Base64-PNGs im lokalen Storage. Kein Cloud-Sync (Datenschutz), keine Größenbeschränkung deiner Session." },
      { q: "Kann ich das automatische Anzeigen deaktivieren?", a: "Aktuell nicht per Toggle — wenn du es abschaltbar haben möchtest, sag Bescheid und wir bauen einen Config-Switch dazu." },
      { q: "Wie sende ich die Karte an Instagram/TikTok/Snapchat?", a: "📋 In Zwischenablage kopieren → in Instagram/TikTok App wechseln → in Story-Editor einfügen. Klappt in allen modernen Browsern die Clipboard-Bild-API unterstützen." },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  v2.9.57 – v2.9.61: NEUE FEATURES (Onboarding, Quick-Menü, Bracket-Auto,
  //  Bot-Rename, Wizard-Restart, Voice-Preview)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "setup-wizard",
    icon: "🚀",
    title: "Setup-Assistent",
    description: "3-Schritte-Wizard beim ersten Start — Voice-Pack & Sound-Profil in 60 Sekunden",
    badge: "NEU · v2.9.59",
    badgeClass: "badge-green",
    steps: [
      {
        title: "Erster Besuch von play.autodarts.io",
        text: "Nach Installation der Erweiterung erscheint der Wizard automatisch beim ersten Aufruf von play.autodarts.io — mittig auf dem Bildschirm, mit abgedunkeltem Hintergrund.",
        tip: "Der Wizard läuft garantiert nur EIN Mal. Wer sofort loslegen will, klickt oben rechts auf „Überspringen ✕”.",
      },
      {
        title: "Schritt 1 — Willkommen",
        text: "Feature-Übersicht in vier Kacheln: Caller, Saison & Turnier, Crowd & Sound FX, Match Quick-Menü. Klick „LOS GEHT'S →” führt zu Schritt 2.",
      },
      {
        title: "Schritt 2 — Voice-Pack",
        text: "Dropdown mit 6 empfohlenen Sprechern (Vicki DE, Daniel DE, Arthur UK, Amy UK, Joey US) plus „Kein Voice-Pack (später wählen)”. Der ▶ Anhören-Button gibt sofort eine Sprachprobe (siehe Feature Voice-Pack-Vorschau).",
        tip: "Deine Wahl wird gemerkt und beim ersten Öffnen von Tools → Sounds automatisch importiert (ca. 20 MB Download).",
      },
      {
        title: "Schritt 3 — Sound-Profil",
        text: "5 Voreinstellungen als Kacheln: 🏆 Turnier-Immersion, 📺 Live-TV-Style, 😌 Chill-Modus, 🗣️ Nur Caller, 🔇 Alles aus. Klick markiert die Kachel (roter Rahmen + Häkchen).",
        tip: "Turnier-Immersion ist der PDC-Modus mit Caller + Crowd + SFX + hoher Ambient-Lautstärke.",
      },
      {
        title: "Fertig!",
        text: "Klick „✓ FERTIG!” → grüner „Alles klar!”-Screen, schließt sich nach 4 Sekunden automatisch. Voice-Pack wandert in die Import-Warteschlange, Sound-Profil ist bereits aktiv.",
      },
    ],
    faq: [
      { q: "Wo starte ich den Wizard erneut?", a: "Öffne die Extension → oben rechts neben dem Einstellungs-Zahnrad ist ein „?”-Button — Klick und der Wizard erscheint wieder." },
      { q: "Was passiert wenn ich „Überspringen” klicke?", a: "Der Wizard wird als abgehakt markiert und erscheint nicht mehr automatisch. Über den „?”-Button kannst du ihn jederzeit erneut aufrufen." },
      { q: "Kann ich später ein anderes Voice-Pack wählen?", a: "Ja — Tools → Sounds → Caller → „Predefined Caller Sets” — dort findest du alle 25+ Voice-Packs mit Anhören-Funktion." },
    ],
  },
  {
    id: "voice-preview",
    icon: "🎧",
    title: "Voice-Pack-Vorschau",
    description: "Sprachprobe für jedes Caller-Pack ohne 20-MB-Download",
    badge: "NEU · v2.9.61",
    badgeClass: "badge-green",
    steps: [
      {
        title: "Wozu die Vorschau?",
        text: "Jedes Voice-Pack ist ca. 20 MB groß. Vor der Investition solltest du wissen ob die Sprache und Geschlecht/Ton zu dir passen — genau das liefert die Vorschau in 2 Sekunden.",
      },
      {
        title: "Wo finde ich sie?",
        text: "An zwei Stellen: (1) Im Setup-Wizard Schritt 2 direkt unter dem Dropdown — Button „▶ Anhören”. (2) In Tools → Sounds → Caller → im Dropdown „Predefined Caller Sets” — rechts im Feld ein grüner „▶ Anhören”-Button.",
      },
      {
        title: "So funktioniert es",
        text: "Klick auf ▶ Anhören → Browser spricht „Einhundertachtzig!” / „One hundred and eighty!” in der Sprache und dem Geschlecht des gewählten Packs. „■ Stop”-Klick bricht ab.",
        tip: "Die Vorschau nutzt die Sprachausgabe deines Browsers/OS. Das ist NICHT die exakte Sprecherstimme, gibt aber ein sehr gutes Gefühl für Sprache und Geschlecht.",
      },
      {
        title: "Sprachen & Geschlechter",
        text: "Deutsch (DE, AT), Englisch (UK, US), Niederländisch, Französisch, Spanisch — jeweils mit dem passenden Geschlecht des Original-Voice-Packs.",
        warning: "Auf Safari/iOS kann die Sprachauswahl eingeschränkt sein — hier wird ggf. die Systemstimme ohne exakten Sprachmatch verwendet.",
      },
    ],
    faq: [
      { q: "Warum klingt die Vorschau anders als der echte Sprecher?", a: "Weil die Vorschau die im Betriebssystem installierten TTS-Stimmen nutzt (Google/Apple/Windows). Das echte Voice-Pack von peschi.org sind Studio-Aufnahmen. Sprache und Geschlecht sind aber identisch — mehr ist zur Kaufentscheidung meistens nicht nötig." },
      { q: "Kann ich mehrere Vorschauen hintereinander abspielen?", a: "Ja. Jede neue Vorschau bricht die vorherige automatisch ab." },
    ],
  },
  {
    id: "quick-menu",
    icon: "🔊",
    title: "Match Quick-Menü",
    description: "Floating-Button im Match: Sound-Kontrolle, Test, Live-Voice-Import, Presets",
    badge: "NEU · v2.9.56/57",
    badgeClass: "badge-green",
    steps: [
      {
        title: "Wo erscheint das Quick-Menü?",
        text: "In jedem Match: unten rechts erscheint ein runder 🔊-Button. Klick öffnet das Panel — nochmaliger Klick oder ✕ schließt es.",
        tip: "Das Menü liegt außerhalb der Autodarts-UI und stört nicht das Board oder die Score-Anzeige.",
      },
      {
        title: "Presets — Ein-Klick-Setups",
        text: "Oben im Panel: 2×5-Grid mit 5 Built-in-Presets (Turnier-Immersion, Live-TV, Chill, Nur Caller, Alles aus) plus deinen Custom-Presets. Klick auf eine Kachel wendet Caller/SFX/Crowd-Toggle + Volumes an.",
        tip: "Über „➕ Aktuelles Setup als Preset speichern” merkst du dir dein persönliches Lieblings-Setup mit eigenem Namen.",
      },
      {
        title: "Feature-Toggles + Test-Button",
        text: "Für Caller, Sound FX und Crowd gibt's einen Schieber und daneben ein „▶ Test”-Button. Test spielt einen zufälligen Sound aus deinem Pool ab (bei Caller bevorzugt „180” wenn vorhanden).",
      },
      {
        title: "Lautstärke-Slider",
        text: "Zwei Slider (Ambient + Crowd Fx), 0–100. Änderungen wirken sofort — auch während ein Sound läuft.",
      },
      {
        title: "Live-Voice-Pack-Wechsel",
        text: "Dropdown mit 8 empfohlenen Voice-Packs. „Import” schreibt die URL in die Queue und öffnet /tools#sounds — dort startet Caller den Import automatisch.",
        tip: "So kannst du mitten in der Session ein anderes Voice-Pack testen, ohne die Extension-Einstellungen zu öffnen.",
      },
    ],
    faq: [
      { q: "Bleibt das Quick-Menü zwischen Matches erhalten?", a: "Ja — es wird beim Match-Start eingeblendet und beim Verlassen des Matches automatisch entfernt." },
      { q: "Wie viele Custom-Presets kann ich speichern?", a: "Beliebig viele. Sie liegen im lokalen Browser-Storage (Key: adt-sound-presets)." },
    ],
  },
  {
    id: "friends-auto-result",
    icon: "🤖",
    title: "Auto-Ergebnis Freunde-Turnier",
    description: "Winner wird nach dem Match automatisch ins Bracket eingetragen",
    badge: "NEU · v2.9.58",
    badgeClass: "badge-green",
    steps: [
      {
        title: "Bracket erstellen",
        text: "Tools → Turniere → Freunde-Turnier → Größe (4/8/16), Legs, Sets, Freunde auswählen → „Turnier starten”. Das Bracket wird gemischt und angezeigt.",
      },
      {
        title: "Match starten",
        text: "In deinem Match auf „▶ Lobby & Spielen” klicken — Extension erstellt automatisch eine Lobby, lädt deinen Gegner ein und öffnet die Lobby-URL.",
        tip: "Bei Matches zwischen zwei anderen Freunden musst du das Ergebnis manuell eintragen (die spielen ja ohne dich).",
      },
      {
        title: "Match spielen — Ergebnis wird beobachtet",
        text: "Sobald das Autodarts-Match endet und einen Winner meldet, erkennt die Extension das per WebSocket-Feed. Der Winner wird primär über die User-ID zugeordnet (zuverlässig), Namen als Fallback.",
        warning: "Voraussetzung: das Match muss durch das Freunde-Turnier gestartet worden sein (via Lobby & Spielen). Externe Matches werden nicht gematched.",
      },
      {
        title: "Rückkehr ins Bracket",
        text: "Wenn du zurück zu Tools → Freunde-Turnier navigierst, ist der Winner bereits eingetragen — grüne Markierung + 🤖 AUTO-ERKANNT-Badge. Runde geht automatisch weiter, sobald alle Matches der Runde abgeschlossen sind.",
      },
    ],
    faq: [
      { q: "Kann ich das automatische Ergebnis überstimmen?", a: "Ja — die manuellen Sieger-Buttons bleiben verfügbar. Klick auf den anderen Namen überschreibt das Ergebnis." },
      { q: "Was wenn die Extension crasht während des Matches?", a: "Kein Problem — das Ergebnis wird beim nächsten Extension-Reload aus dem Storage geholt und angewendet." },
    ],
  },
  {
    id: "bot-autorename",
    icon: "⚡",
    title: "Bot-Auto-Add & Auto-Rename (Saison/Turnier)",
    description: "In der Karriere-/Turnier-Lobby wird der Bot AUTOMATISCH hinzugefügt und auf den PDC-Gegnernamen umbenannt",
    badge: "NEU · v2.9.54/58/65",
    badgeClass: "badge-green",
    steps: [
      {
        title: "Saison- oder Turnier-Match starten",
        text: "Tools → Saison (oder Turniere) → „Match starten”. Die Extension speichert deinen PDC-Gegner (z.B. „Luke Humphries”, Avg 98) — jetzt IMMER awaited, sodass die Lobby-Seite die Config sicher findet.",
      },
      {
        title: "Lobby öffnet — Bot wird AUTOMATISCH hinzugefügt (NEU v2.9.65)",
        text: "Sobald die Lobby-Seite lädt und die Extension einen leeren Bot-Slot erkennt (WebSocket zeigt nur den User), klickt sie automatisch den „Add Bot”-Button. Kein manueller Klick mehr nötig.",
        tip: "Auto-Add läuft nur EINmal pro Lobby und respektiert vorhandene Bots — wenn schon einer da ist, passiert nichts.",
      },
      {
        title: "Auto-Rename direkt danach",
        text: "Sobald der Bot in der Lobby erscheint (WebSocket-Bot-Detection via cpuPPR-Flag), wird der Name auf den PDC-Gegner umgeschrieben und der empfohlene Durchschnitt am Slider gesetzt.",
      },
      {
        title: "Status-Anzeige",
        text: "Overlay zeigt Live-Status: ⏳ Warte auf Bot → 🤖 Füge Bot hinzu → 🔄 Benenne um → ✅ Bot „Name” · Avg XX.",
      },
    ],
    faq: [
      { q: "Warum wurde der Bot vor v2.9.65 nicht automatisch hinzugefügt?", a: "Die Extension hat nur den bereits vorhandenen Bot umbenannt — Add-Klicken war manuell. Ab v2.9.65 komplett hands-off." },
      { q: "Funktioniert es auch wenn schon ein Freund in der Lobby ist?", a: "Ja — wenn 2+ Spieler in der Lobby sind (2 Menschen), überspringt die Extension das Auto-Add." },
      { q: "Was wenn der Add-Bot-Button anders heißt?", a: "Der Selektor akzeptiert 'Add Bot', 'Bot hinzufügen' und aria-label-Varianten. Autodarts-DOM-Änderungen könnten das brechen — dann fallback auf manuellen Klick." },
      { q: "Kann ich den Bot manuell umbenennen?", a: "Klar — klicke direkt in der Lobby auf den Bot-Namen und tippe den gewünschten. Das Overlay bleibt zur Info sichtbar." },
    ],
  },
  {
    id: "restart-wizard",
    icon: "🔁",
    title: "Wizard-Restart-Button",
    description: "Setup-Assistent jederzeit erneut aufrufen — z.B. um Freunden die Extension zu zeigen",
    badge: "NEU · v2.9.60",
    badgeClass: "badge-green",
    steps: [
      {
        title: "Wo ist der Button?",
        text: "Öffne die Extension (Tools). Oben rechts im Header, direkt vor dem Einstellungs-Zahnrad, sitzt ein rundes „?”-Symbol.",
      },
      {
        title: "Klick startet den Wizard",
        text: "Ein Klick entfernt intern das „Wizard-schon-gesehen”-Flag und blendet den 3-Schritte-Wizard mittig ein.",
        tip: "Perfekt um jemandem den Funktionsumfang der Extension zu zeigen — oder um schnell ein anderes Voice-Pack + Sound-Profil aufzuspielen.",
      },
    ],
    faq: [
      { q: "Muss ich die Wahl erneut treffen?", a: "Nein — im Wizard ausgewählte Presets werden nur angewendet wenn du bis „FERTIG” durchklickst. „Überspringen” bricht ohne Änderungen ab." },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════
  //  BESTEHENDE FEATURES (Installation, Walkon, Crowd, KI, ...)
  // ═══════════════════════════════════════════════════════════════════════
  {
    id: "installation",
    icon: "📦",
    title: "Installation",
    description: "Erweiterung in Chrome, Edge, Brave oder Firefox laden",
    badge: "ERSTE SCHRITTE",
    badgeClass: "badge-green",
    steps: [
      {
        title: "ZIP-Datei herunterladen",
        text: "Lade die bereitgestellte ZIP-Datei herunter. Für Chrome/Edge/Brave nutze die Chrome-Version, für Firefox die Firefox-Version.",
        tip: "Speichere die Datei an einem festen Ort, z.B. Dokumente/Autodarts-Tools."
      },
      {
        title: "ZIP-Datei entpacken",
        text: "Klicke mit der rechten Maustaste auf die ZIP-Datei und wähle 'Hier entpacken'. Es entsteht ein Ordner mit einer manifest.json-Datei darin.",
        warning: "Den entpackten Ordner niemals verschieben oder löschen – sonst muss die Erweiterung neu geladen werden!"
      },
      {
        title: "Entwicklermodus aktivieren (Chrome/Edge/Brave)",
        text: "Öffne den Browser und gib in die Adresszeile chrome://extensions ein. Aktiviere oben rechts den Schalter 'Entwicklermodus'.",
        tip: "Bei Microsoft Edge lautet die Adresse edge://extensions"
      },
      {
        title: "Erweiterung laden",
        text: "Klicke auf 'Entpackte Erweiterung laden' und wähle den entpackten Ordner aus (den Ordner, in dem die manifest.json liegt).",
      },
      {
        title: "Fertig!",
        text: "Das Autodarts Tools Icon erscheint oben rechts im Browser. Öffne play.autodarts.io und klicke auf das Icon, um das Menü zu öffnen.",
        tip: "Für Firefox: Gehe zu about:debugging → Dieser Firefox → Temporäres Hinzufügen-on laden → manifest.json auswählen."
      }
    ],
    faq: [
      { q: "Kann ich die Original-Erweiterung gleichzeitig nutzen?", a: "Ja! Beide Erweiterungen können gleichzeitig aktiv sein. Über den Erweiterungs-Manager (🎯-Button auf der Startseite) kannst du jederzeit eine davon deaktivieren." },
      { q: "Muss ich die Erweiterung nach einem Browser-Update neu laden?", a: "Nein. Solange du den Ordner nicht verschiebst, bleibt die Erweiterung auch nach Browser-Updates aktiv." },
      { q: "Funktioniert die Erweiterung auch auf dem Handy?", a: "Nein, Browser-Erweiterungen werden auf mobilen Browsern nicht unterstützt. Für den Party-Buzzer können Mitspieler aber ihr Handy nutzen." }
    ]
  },
  {
    id: "walkon",
    icon: "🎵",
    title: "Einlaufmusik",
    description: "Einlauf Songs für jeden Spieler festlegen",
    badge: "ATMOSPHÄRE",
    badgeClass: "badge-gold",
    steps: [
      {
        title: "Menü öffnen",
        text: "Öffne play.autodarts.io, klicke auf das Erweiterungs-Icon und navigiere zum Tab 'Sound & Caller'."
      },
      {
        title: "Einlaufmusik aktivieren",
        text: "Scrolle zum Bereich 'Einlaufmusik' und aktiviere den Schalter. Dort siehst du zwei Slots: einen für den Heimspieler und einen für den Gastspieler."
      },
      {
        title: "Song auswählen",
        text: "Option A: Ziehe eine MP3-Datei per Drag & Drop in das Feld oder klicke darauf, um eine Datei auszuwählen. Option B: Wähle einen PDC-Preset-Song aus der Liste (z.B. 'Seven Nation Army' oder 'Mr. Brechtsside').",
        tip: "Unterstützte Formate: MP3, WAV, OGG, M4A, FLAC"
      },
      {
        title: "Lautstärke einstellen",
        text: "Stelle mit dem Schieberegler die gewünschte Lautstärke ein. 80% ist ein guter Startwert."
      },
      {
        title: "Testenen",
        text: "Starte ein Match auf autodarts.io. Beim Spielstart wird das Licht (falls WLED verbunden) gedimmt und der Song für 15 Sekunden abgespielt, bevor der Caller 'Game An!' ruft."
      }
    ],
    faq: [
      { q: "Wie groß darf die MP3-Datei sein?", a: "Die Erweiterung unterstützt Dateien bis zu ca. 50 MB. Für einen 15-Sekunden-Ausschnitt reichen aber meist 1–3 MB." },
      { q: "Kann ich den Song auf einen bestimmten Zeitpunkt starten lassen?", a: "Aktuell spielt der Song immer vom Anfang an. Eine 'Startzeit'-Funktion ist für eine zukünftige Version geplant." }
    ]
  },
  {
    id: "crowd",
    icon: "👥",
    title: "Stadionatmosphäre",
    description: "Dynamische Crowd-Reaktionen auf deine Würfe",
    badge: "ATMOSPHÄRE",
    badgeClass: "badge-gold",
    steps: [
      {
        title: "Crowd-System aktivieren",
        text: "Gehe im Menü zu 'Sound & Caller' → 'Stadionatmosphäre' und aktiviere den Hauptschalter."
      },
      {
        title: "Reaktionen konfigurieren",
        text: "Du kannst jede Reaktion einzeln ein- oder ausschalten und die Lautstärke separat regeln: Hintergrundgemurmel, 180er Jubel, Überworfen Raunen und Checkout-Druck Pfeifen."
      },
      {
        title: "Eigene Sounds hochladen (optional)",
        text: "Klicke auf das Hochladen-Symbol neben jeder Reaktion, um eine eigene MP3-Datei hochzuladen. So kannst du z.B. Aufnahmen echter Turniere verwenden.",
        tip: "Ohne eigene Datei verwendet die Erweiterung einen eingebauten synthetischen Sound."
      }
    ],
    faq: [
      { q: "Der Crowd-Sound bricht mitten im Match ab. Was tun?", a: "Das kann passieren, wenn der Browser-Tab in den Hintergrund geht. Stelle sicher, dass der autodarts.io Tab im Vordergrund bleibt. Der eingebaute Keep-Alive Mechanismus sollte das verhindern." },
      { q: "Kann ich die Reaktionen auf eigene Sounds anpassen?", a: "Ja! Neben jedem Reaktions-Regler gibt es ein Hochladen-Symbol. Lade dort deine eigene MP3-Datei hoch." }
    ]
  },
  {
    id: "ki",
    icon: "🤖",
    title: "KI-Kommentator",
    description: "Dynamischer Echtzeit-Kommentator mit Text-to-Speech",
    badge: "KI-FEATURE",
    badgeClass: "badge-red",
    steps: [
      {
        title: "KI-Kommentator aktivieren",
        text: "Gehe im Menü zum Tab 'KI-Kommentator' und aktiviere den Hauptschalter."
      },
      {
        title: "TTS-Anbieter wählen",
        text: "Wähle deinen bevorzugten Sprachsynthese-Anbieter. 'Browser (Kostenlos)' funktioniert sofort ohne Anmeldung. Für bessere Qualität empfehlen wir ElevenLabs (10.000 Zeichen/Monat kostenlos)."
      },
      {
        title: "Bei Premium-Anbieter registrieren",
        text: "Klicke auf den roten 'Zur Webseite'-Button neben dem gewählten Anbieter. Du wirst direkt zur Registrierungsseite weitergeleitet. Erstelle einen kostenlosen Account.",
        tip: "ElevenLabs: elevenlabs.io → Sign Up → Free Plan wählen"
      },
      {
        title: "API-Key eintragen",
        text: "Nach der Registrierung findest du deinen API-Key im Profil-Bereich der jeweiligen Webseite. Kopiere ihn und füge ihn in das Feld in der Erweiterung ein.",
        warning: "Der API-Key wird verschlüsselt (AES-256) lokal in deinem Browser gespeichert und niemals an Dritte weitergegeben."
      },
      {
        title: "Testenen",
        text: "Klicke auf 'Testen Abspielen'. Du solltest einen Testensatz hören. Wenn ja, ist alles korrekt eingerichtet.",
        tip: "Falls kein Sound kommt, überprüfe ob der API-Key korrekt kopiert wurde (keine Leerzeichen am Anfang/Ende)."
      }
    ],
    faq: [
      { q: "Was passiert, wenn mein API-Kontingent aufgebraucht ist?", a: "Die Erweiterung schaltet automatisch auf den kostenlosen Browser-TTS um. Der Kommentator verstummt also nie." },
      { q: "Kann ich die Sprache des Kommentators ändern?", a: "Ja, in den Einstellungen kannst du zwischen Deutsch und Englisch wählen. Der KI-Kommentator spricht dann in der gewählten Sprache." }
    ]
  },
  {
    id: "tvstats",
    icon: "📊",
    title: "TV-Statistiken",
    description: "Live-Stats und Bogey-Warnung wie im TV",
    badge: "PROFI-FEATURE",
    badgeClass: "badge-blue",
    steps: [
      {
        title: "TV-Statistiken aktivieren",
        text: "Gehe im Menü zum Tab 'Match' → 'TV-Statistiken' und aktiviere den Schalter."
      },
      {
        title: "Position wählen",
        text: "Wähle, wo das Stats-Overlay angezeigt werden soll: Unten links (Standard), Unten rechts, Oben links oder Oben rechts."
      },
      {
        title: "Bogey-Warnung konfigurieren",
        text: "Aktiviere die Bogey-Warnung. Stehst du auf einer Bogey-Number (169, 168, 166, 165, 163, 162, 159), erscheint ein rotes Banner: 'Kein Doppel-Finish möglich!'",
        tip: "Bogey-Numbers sind Punktestände, die sich nicht mit einem Dart auf ein Doppel auschecken lassen."
      },
      {
        title: "Checkout-Vorschläge",
        text: "Aktiviere die Checkout-Vorschläge. Unter 170 Punkten zeigt das System den optimalen Weg zum Finish an (z.B. 'T20 · T19 · Bull = 167')."
      }
    ],
    faq: [
      { q: "Die Statistiken stimmen nicht. Was tun?", a: "Die Stats werden direkt von der autodarts.io API geladen. Stelle sicher, dass du mit deinem Account eingeloggt bist." }
    ]
  },
  {
    id: "clutch",
    icon: "❤️",
    title: "Clutch Moments",
    description: "Dramatischer Herzschlag-Modus bei Match-Darts",
    badge: "GAMEPLAY",
    badgeClass: "badge-red",
    steps: [
      {
        title: "Clutch Moments aktivieren",
        text: "Gehe im Menü zum Tab 'Gameplay Extras' → 'Clutch Moments' und aktiviere den Schalter."
      },
      {
        title: "Intensität einstellen",
        text: "Stelle ein, ab wann der Clutch-Modus aktiviert wird: 'Nur beim letzten Match-Dart' (Standard) oder 'Bei jedem Doppel zum Leg-Gewinn'."
      },
      {
        title: "Erleben",
        text: "Wenn du oder dein Gegner auf einem entscheidenden Match-Dart stehen, verdunkeln sich die Bildschirmränder, das Publikum verstummt und ein Herzschlag ertönt. Triffst du, explodiert die Halle!",
        tip: "Der Herzschlag-Sound wird direkt im Browser generiert – kein API-Key nötig."
      }
    ],
    faq: [
      { q: "Kann ich den Herzschlag-Sound deaktivieren, aber den Vignetten-Effekt behalten?", a: "Ja, in den Einstellungen kannst du Sound und visuellen Effekt unabhängig voneinander ein- und ausschalten." }
    ]
  },
  {
    id: "friends",
    icon: "👥",
    title: "Freundesliste",
    description: "Ane-Click-Einladung und Head-to-Head Statistiken",
    badge: "MULTIPLAYER",
    badgeClass: "badge-green",
    steps: [
      {
        title: "Freundesliste öffnen",
        text: "Gehe im Menü zum Tab 'Freunde'. Die Liste lädt automatisch deine Autodarts-Freunde und zeigt ihren Anline-Status."
      },
      {
        title: "Freund herausfordern",
        text: "Klicke neben einem online Freund auf den roten 'SPIELEN'-Button. Die Erweiterung erstellt automatisch eine Lobby mit deinen Standard-Einstellungen und schickt die Einladung."
      },
      {
        title: "Head-to-Head ansehen",
        text: "Klicke auf das Statistik-Icon neben einem Freund, um eure direkte Bilanz zu sehen: Siege, Niederlagen, Durchschnitt-Vergleich und die letzten 5 Matches."
      },
      {
        title: "Erzrivale",
        text: "Nach 5 oder mehr engen Matches wird ein Freund automatisch als 'ERZRIVALE' markiert. Der KI-Kommentator erwähnt das beim nächsten Aufeinandertreffen!",
        tip: "Ein Erzrivale ist ein Gegner, gegen den du zwischen 40% und 60% der Matches gewonnen hast."
      }
    ],
    faq: [
      { q: "Mein Freund sieht die Einladung nicht. Was tun?", a: "Stelle sicher, dass dein Freund auf play.autodarts.io eingeloggt ist. Die Einladung erscheint als Benachrichtigung auf der Webseite." }
    ]
  },
  {
    id: "liga",
    icon: "🏆",
    title: "Liga-System",
    description: "Eigene Liga ohne Registrierung – nur mit Share-Code",
    badge: "MULTIPLAYER",
    badgeClass: "badge-green",
    steps: [
      {
        title: "Neue Liga erstellen",
        text: "Gehe im Menü zum Tab 'Liga' und klicke auf 'Neue Liga erstellen'. Gib einen Namen ein (z.B. 'Keller-Liga 2025') und bestätige."
      },
      {
        title: "Freunde einladen",
        text: "Die Erweiterung generiert einen 6-stelligen Share-Code und einen Einladungslink. Klicke auf 'Via WhatsApp teilen', um eine fertige Nachricht mit dem Link zu verschicken."
      },
      {
        title: "Freunde treten bei",
        text: "Deine Freunde klicken auf den Link in WhatsApp. Die Erweiterung erkennt den Code automatisch und zeigt eine Bestätigung: 'Liga beigetreten!'. Kein manuelles Eintragen nötig.",
        tip: "Der Link funktioniert nur, wenn die Erweiterung auf dem PC des Freundes installiert ist."
      },
      {
        title: "Spiele und Tabelle",
        text: "Nach jedem Match werden die Ergebnisse automatisch an die Ligatabelle gesendet (falls 'Auto-Submit' aktiviert ist). Die Tabelle zeigt Siege, Niederlagen, Leg-Differenz und Durchschnitt."
      }
    ],
    faq: [
      { q: "Wo werden die Liga-Daten gespeichert?", a: "Die Daten werden auf einem kostenlosen, anonymen Cloud-Speicher (jsonbin.io) gespeichert. Es ist keine Registrierung nötig." },
      { q: "Was passiert, wenn ich den Share-Code verliere?", a: "Den Code findest du jederzeit im Liga-Tab unter 'Meine Liga' → 'Liga teilen'." }
    ]
  },
  {
    id: "training",
    icon: "🎯",
    title: "Trainings-Modus",
    description: "Ziele setzen und Fortschritt verfolgen",
    badge: "TRAINING",
    badgeClass: "badge-blue",
    steps: [
      {
        title: "Trainings-Modus aktivieren",
        text: "Gehe im Menü zum Tab 'Training' und aktiviere den Schalter."
      },
      {
        title: "Ziele definieren",
        text: "Lege deine Trainingsziele fest: Mindest-Durchschnitt (z.B. 65), Mindestanzahl 140er Würfe (z.B. 3) oder eine Ziel-Checkout-Rate (z.B. 30%)."
      },
      {
        title: "Match spielen",
        text: "Starte ein normales Match. Ein dezentes Overlay zeigt dir während des Spiels Fortschrittsbalken für jedes Ziel."
      },
      {
        title: "Auswertung ansehen",
        text: "Nach dem Match erscheint eine Zusammenfassung: Welche Ziele hast du erreicht (✅) und welche nicht (❌)?"
      },
      {
        title: "Verlauf verfolgen",
        text: "Im Unter-Tab 'Verlauf' siehst du ein Diagramm deiner Durchschnitt-Entwicklung über die letzten 50 Trainingseinheiten.",
        tip: "Regelmäßiges Training mit klaren Zielen verbessert deinen Durchschnitt deutlich schneller als freies Spielen."
      }
    ],
    faq: [
      { q: "Werden die Trainingsdaten mit der Liga synchronisiert?", a: "Nein, Trainingsdaten sind lokal und privat. Nur offizielle Match-Ergebnisse fließen in die Liga ein." }
    ]
  },
  {
    id: "tourcard",
    icon: "🎫",
    title: "Tour Card",
    description: "Schritt für Schritt zur PDC Tour Card im Karriere-Modus",
    badge: "KARRIERE",
    badgeClass: "badge-red",
    steps: [
      {
        title: "Neue Karriere starten",
        text: "Gehe im Menü zum Tab '🏆 Karriere' und klicke auf 'Karriere starten'. Gib deinen Namen ein und wähle die Schwierigkeit. Anfänger starten ohne Tour Card auf Rang 200 – das ist der echte PDC-Weg von ganz unten.",
        tip: "Tipp: Wähle 'Profi' oder 'Elite', wenn du bereits eine starke Checkout-Rate über 35% hast. Diese Schwierigkeiten starten direkt mit Tour Card."
      },
      {
        title: "Q-School spielen",
        text: "Ohne Tour Card siehst du im Turnierkalender die 'Q-School' (Januar). Das ist das Qualifikationsturnier für die PDC Tour Card. Klicke auf die Q-School und starte das Match. Das Format ist Best of 7 Legs – 4 Tage, je ein Tagessieger erhält eine Tour Card.",
        warning: "Die Q-School ist das einzige Turnier, das ohne Tour Card spielbar ist. Alle anderen Events sind gesperrt bis du qualifiziert bist."
      },
      {
        title: "Q-School gewinnen",
        text: "Gewinne das Q-School Match. Im Karriere-Modus entspricht ein Sieg dem Gewinn der Tour Card. Nach dem Sieg wird deine Karriere automatisch aktualisiert: 'Tour Card aktiv' erscheint grün im Dashboard.",
        tip: "Falls du verlierst, kannst du die Q-School erneut versuchen – in der Realität gibt es 4 Tage mit je einem Tagessieger."
      },
      {
        title: "Tour Card bestätigt – Pro Tour freigeschalten",
        text: "Mit aktiver Tour Card öffnen sich alle Pro Tour Events im Turnierkalender: Players Championship 1–32, European Tour Events und alle Majors bis zu deinem aktuellen Weltranglisten-Rang. Im Dashboard siehst du oben rechts '✓ Tour Card aktiv' in Grün.",
        tip: "Dein Weltranglisten-Rang bestimmt, welche Majors du spielen kannst. Für die WM musst du unter Rang 32 sein."
      },
      {
        title: "Aufsteigen und Majors erreichen",
        text: "Spiele Pro Tour Events (Players Championships), um Preisgeld und Order of Merit Punkte zu sammeln. Je besser du abschneidest, desto höher steigt dein Weltranglisten-Rang. Ab Rang 64 qualifizierst du dich für das Players Championship Finals, ab Rang 32 für World Grand Prix und European Championship.",
        tip: "Das Ziel: Rang 1 der Weltrangliste und Sieger der PDC World Darts Championship im Alexandra Palace!"
      },
      {
        title: "Tour Card verlieren und erneuern",
        text: "In der Realität gilt eine Tour Card 2 Jahre. Im Karriere-Modus bleibt sie aktiv solange du spielst. Nach einer neuen Saison musst du dich erneut qualifizieren, falls du unter die Ranglisten-Grenze fällst.",
        warning: "Wenn du eine neue Karriere startest, wird die aktuelle Karriere gelöscht. Exportiere deine Daten vorher über den 'Export'-Button oben rechts!"
      }
    ],
    faq: [
      { q: "Ich sehe nur die Q-School im Kalender. Warum?", a: "Du hast noch keine Tour Card. Gewinne die Q-School, um alle Pro Tour Events freizuschalten. Im Turnierkalender sind gesperrte Events mit einem Schloss-Symbol (🔒) markiert." },
      { q: "Welche Schwierigkeit empfiehlt sich für Anfänger?", a: "'Einsteiger' (Rang 200, kein Tour Card) ist der authentischste Weg. 'Profi' und 'Elite' starten direkt mit Tour Card für Spieler, die den Q-School-Weg überspringen möchten." },
      { q: "Kann ich die Tour Card verlieren?", a: "Im aktuellen Karriere-Modus bleibt die Tour Card dauerhaft aktiv, sobald sie einmal erworben wurde. Das entspricht dem 2-Jahres-Modell der echten PDC." },
      { q: "Was ist der Unterschied zwischen Tour Card und Weltrangliste?", a: "Die Tour Card berechtigt zur Teilnahme an Pro Tour Events. Die Weltrangliste (Order of Merit) bestimmt, für welche Majors und TV-Events du qualifiziert bist. Beide sind notwendig für eine erfolgreiche Karriere." }
    ]
  },
  {
    id: "boards",
    icon: "🎯",
    title: "Board speichern",
    description: "Externe Boards speichern und per Klick aufrufen",
    badge: "BOARDS",
    badgeClass: "badge-blue",
    steps: [
      {
        title: "Feature aktivieren",
        text: "Öffne play.autodarts.io, klicke auf das Extension-Icon und wechsle zum Tab 'Boards'. Suche die Karte 'Externe Boards' und aktiviere den Schalter. Das Feature ist jetzt bereit.",
        tip: "Nach der Aktivierung erscheint die 'External Boards' Sektion automatisch auf der play.autodarts.io/boards Seite."
      },
      {
        title: "Board-ID herausfinden",
        text: "Gehe auf play.autodarts.io/boards und klicke auf das Board, das du speichern möchtest. Die Board-ID steht in der URL: play.autodarts.io/boards/BOARD-ID/stats. Kopiere die ID aus der URL.",
        tip: "Du kannst auch den Board-Besitzer bitten, seine Board-ID aus der URL abzulesen und dir zu schicken."
      },
      {
        title: "Board speichern",
        text: "Scrolle auf play.autodarts.io/boards nach unten zur 'External Boards' Sektion. Trage im Formular einen eigenen Namen ein (z.B. 'Keller', 'Vereinsheim' oder 'Markus') und füge die Board-ID ein. Klicke auf den grünen Bestätigen-Button (✓).",
        tip: "Der Name ist frei wählbar und wird nur lokal in der Extension gespeichert — nicht auf autodarts.io."
      },
      {
        title: "Gespeichertes Board verwenden",
        text: "Das Board erscheint als Karte in der Liste. Über die drei Buttons kannst du: Statistiken des Boards aufrufen (📊), dem Board folgen um Matches live zu verfolgen (📌), oder das Board aus der Liste löschen (🗑️ rot).",
        tip: "'Folgen' öffnet die Follow-Seite des Boards — ideal um Matches eines Freundes live mitzuverfolgen."
      },
      {
        title: "Bis zu 5 Boards verwalten",
        text: "Du kannst bis zu 5 externe Boards gleichzeitig speichern. Ideal für Vereinsspieler (mehrere Boards im Vereinsheim), Turnier-Veranstalter (4 Boards beim Turnier) oder Spieler die regelmäßig bei Freunden spielen.",
        warning: "In Firefox muss das Feature nach jedem Browser-Neustart erneut aktiviert werden, da temporäre Add-ons nicht dauerhaft gespeichert werden."
      }
    ],
    faq: [
      { q: "Wo finde ich die Board-ID meines eigenen Boards?", a: "Gehe auf play.autodarts.io/boards und klicke auf dein Board. Die ID steht in der URL: play.autodarts.io/boards/DEINE-ID/stats. Alles zwischen /boards/ und /stats ist deine Board-ID." },
      { q: "Kann ich einem Board folgen ohne es zu speichern?", a: "Ja, du kannst direkt auf play.autodarts.io/boards nach einem Board suchen und dort auf 'Follow' klicken. Das Speichern in der Extension ist nur für schnellen Zugriff ohne erneute Suche." },
      { q: "Was passiert wenn ich auf 'Statistiken' klicke?", a: "Du wirst direkt zu play.autodarts.io/boards/ID/stats weitergeleitet. Dort siehst du alle Matches, die auf diesem Board gespielt wurden, mit Durchschnitt, Checkout-Rate und Verlauf." },
      { q: "Werden die gespeicherten Boards mit anderen Geräten synchronisiert?", a: "Nein, die Boards werden lokal in der Extension gespeichert. Auf einem anderen PC musst du sie erneut eintragen." }
    ]
  },
  {
    id: "kalibrierung",
    icon: "📷",
    title: "Kamera-Kalibrierung",
    description: "Kameras richtig ausrichten und kalibrieren für maximale Erkennungsgenauigkeit",
    badge: "SETUP",
    badgeClass: "badge-blue",
    steps: [
      {
        title: "Autodarts Desktop Client öffnen",
        text: "Starte den Autodarts Desktop Client auf deinem PC. Falls noch nicht installiert: autodarts.io → Download → Desktop Client installieren. Melde dich mit deinem autodarts.io Account an.",
        tip: "Der Desktop Client ist notwendig für die Kalibrierung — play.autodarts.io allein reicht nicht."
      },
      {
        title: "Board Manager öffnen",
        text: "Im Desktop Client auf dein Board klicken → 'Config' → 'Calibrate'. Alternativ: play.autodarts.io/boards → dein Board → 'Board Manager' → Reiter 'Calibration'."
      },
      {
        title: "Kamera-Positionen prüfen",
        text: "Kontrolliere dass alle 3 Kameras korrekt positioniert sind: im 120°-Abstand um das Board. Empfohlen: eine Kamera bei Zahl 11, die anderen im 120°-Abstand. Vermeide eine Kamera direkt über der 20 — das erzeugt blinde Flecken bei steil geworfenen Pfeilen.",
        tip: "Im Kamerabild muss das Dartboard immer am unteren Bildrand erscheinen. Falls nicht: Kamera um 180° drehen oder in der Software spiegeln."
      },
      {
        title: "Automatische Kalibrierung starten",
        text: "Klicke auf 'Kalibrieren'. Der Algorithmus erkennt automatisch die 4 Referenzpunkte (äußere Ecken der Doppel-Segmente 20/1, 11/14, 10/6, 3/19). Das Feld '20' wird rot markiert.",
        tip: "Ab Desktop Client v0.24.0 wird Linsenverzerrung automatisch korrigiert — manuelle Verzerrungsanpassung ist nicht mehr nötig."
      },
      {
        title: "Manuelle Korrektur falls nötig",
        text: "Falls die automatische Erkennung das '20'-Feld nicht korrekt findet: Pfeiltasten unter der Kameraansicht verwenden um die Position manuell anzupassen. Links: echtes Kamerabild (Ellipse) — das ist die Basis für die Erkennung. Rechts: transformiertes 2D-Bild — nur für die Liveboard-Ansicht."
      },
      {
        title: "Schärfe und Auflösung prüfen",
        text: "Optimale Auflösung: 1280×720 oder 1280×960. Full HD (1920×1080) ist nicht optimal. Kamera scharf stellen: Linsenring minimal drehen bis das Board scharf erscheint. Vorsicht: nicht zu fest drehen — Sensor kann beschädigt werden.",
        tip: "Tipp zum Fokussieren: Papier mit Text zwischen Board und Surround klemmen, auf der dem Kamera gegenüberliegenden Seite. Text als Fokus-Referenz nutzen."
      },
      {
        title: "Erkennung testen",
        text: "Nach der Kalibrierung: Pfeile werfen und im Motion-Tab prüfen (Board Manager → Vision → Motion). Grün markierte Bereiche zeigen erkannte Pixelveränderungen. Hier lassen sich 90% aller Erkennungsprobleme diagnostizieren."
      },
      {
        title: "Häufige Fehlerquellen beheben",
        text: "Regenbogen-Effekt im Kamerabild: Streulicht trifft die Linse → Kamera-Deckel/Streulichtblende verwenden. Kamera verdreht: 180°-Fehler in der Software korrigierbar, 90°-Fehler muss mechanisch behoben werden. Takeout-Fehler: bewegliche Kabel oder wackelndes Board im Kamerafeld → Kabel hinter der Montage befestigen.",
        tip: "Dunkle Pfeile auf schwarzen Segmenten oder weiße Pfeile auf hellen Feldern erschweren die Erkennung. Kontrastreiche Pfeile (silber, bunte Flights) verwenden."
      }
    ],
    faq: [
      { q: "Muss ich nach jedem Board-Neustart neu kalibrieren?", a: "Nein. Die Kalibrierung wird gespeichert und bleibt erhalten. Nur bei physischer Veränderung der Kameraposition oder nach einem Reset neu kalibrieren." },
      { q: "Warum erkennt eine Kamera die Pfeile nicht?", a: "Häufigste Ursachen: Kamera nicht scharf gestellt, falsche Auflösung (nicht 720p), Linsenflare durch Streulicht, oder Kamera ist im Kalibrierungsschritt falsch zugewiesen." },
      { q: "Alle 3 Kameras müssen kalibriert werden?", a: "Ja. Autodarts benötigt alle 3 Kameras für präzise Erkennung. Mit 2 Kameras ist die Erkennung möglich aber ungenauer — besonders bei eng gruppierten Pfeilen." },
      { q: "Was bedeutet 'FPS mismatch'?", a: "Alle Kameras müssen mit derselben Framerate laufen. Falls eine Kamera weniger FPS liefert: FPS für alle Kameras auf den niedrigsten gemeinsamen Wert reduzieren." }
    ]
  },
  {
    id: "buzzer",
    icon: "🔔",
    title: "Party-Buzzer",
    description: "Bis zu 4 Spieler per Handy-Buzzer steuern",
    badge: "PARTY-MODUS",
    badgeClass: "badge-gold",
    steps: [
      {
        title: "Buzzer aktivieren",
        text: "Gehe im Menü zum Tab 'Gameplay Extras' → 'Party-Buzzer' und aktiviere den Schalter. Stelle die Anzahl der Spieler ein (2–4)."
      },
      {
        title: "QR-Code scannen",
        text: "Auf dem TV-Bildschirm erscheint ein QR-Code. Jeder Mitspieler scannt diesen Code mit der Handy-Kamera."
      },
      {
        title: "Colors wählen",
        text: "Auf dem Handy öffnet sich die Buzzer-App. Jeder Spieler wählt seine Colors (Rot, Blau, Grün oder Gelb)."
      },
      {
        title: "Buzzer drücken",
        text: "Wer zuerst auf dem Handy buzzt, dessen Name erscheint groß auf dem TV und er darf als Nächstes werfen. Allee anderen Buzzer werden kurz gesperrt.",
        tip: "Der Buzzer funktioniert auch per Klick auf dem PC, falls jemand kein Handy dabei hat."
      },
      {
        title: "Nächste Runde",
        text: "Nach dem Wurf klickt der Gastgeber auf 'Zurücksetzen' am PC. Die Buzzer sind wieder freigegeben."
      }
    ],
    faq: [
      { q: "Funktioniert der Buzzer ohne Internet?", a: "Nein, der QR-Code verbindet die Handys über das lokale Netzwerk. Allee Geräte müssen im selben WLAN sein." },
      { q: "Kann ich mehr als 4 Spieler haben?", a: "Aktuell sind maximal 4 Spieler unterstützt. Für mehr Spieler empfehlen wir, Teams zu bilden." }
    ]
  }
];

const filteredFeatures = computed(() => {
  if (!searchQuery.value) return features;
  const q = searchQuery.value.toLowerCase();
  return features.filter(f =>
    f.title.toLowerCase().includes(q) ||
    f.description.toLowerCase().includes(q) ||
    f.steps.some(s => s.title.toLowerCase().includes(q) || s.text.toLowerCase().includes(q))
  );
});
</script>

<style scoped>
.help-container {
  background: #0D1B2A;
  min-height: 100vh;
  color: #fff;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
}

.help-header {
  background: linear-gradient(135deg, #0D1B2A 0%, #1a2d42 100%);
  border-bottom: 3px solid #E8002D;
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.help-header-links {
  display: flex;
  align-items: center;
  gap: 16px;
}

.help-icon {
  font-size: 2.5rem;
}

.help-title {
  font-size: 1.8rem;
  font-weight: 900;
  letter-spacing: 3px;
  color: #fff;
  margin: 0;
  text-transform: uppercase;
}

.help-subtitle {
  font-size: 0.85rem;
  color: #F5C842;
  margin: 2px 0 0 0;
  letter-spacing: 1px;
}

.help-search-input {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 8px;
  padding: 10px 16px;
  color: #fff;
  font-size: 1rem;
  width: 280px;
  outline: none;
  transition: border-color 0.2s;
}

.help-search-input:focus {
  border-color: #E8002D;
}

.help-search-input::placeholder {
  color: rgba(255,255,255,0.4);
}

.help-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 16px 24px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.help-nav-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  color: rgba(255,255,255,0.7);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
}

.help-nav-btn:hover {
  background: rgba(232,0,45,0.2);
  border-color: #E8002D;
  color: #fff;
}

.help-nav-btn.active {
  background: #E8002D;
  border-color: #E8002D;
  color: #fff;
}

.help-nav-icon {
  font-size: 1rem;
}

.help-content {
  padding: 24px;
  max-width: 900px;
}

.feature-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 2px solid rgba(255,255,255,0.1);
}

.feature-header-icon {
  font-size: 3rem;
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.05);
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  flex-shrink: 0;
}

.feature-title {
  font-size: 2rem;
  font-weight: 900;
  letter-spacing: 2px;
  color: #fff;
  margin: 0 0 4px 0;
  text-transform: uppercase;
}

.feature-desc {
  color: rgba(255,255,255,0.6);
  font-size: 1rem;
  margin: 0;
}

.feature-badge {
  margin-left: auto;
  padding: 6px 14px;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 900;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  flex-shrink: 0;
}

.badge-green { background: rgba(0,200,83,0.2); color: #00C853; border: 1px solid #00C853; }
.badge-gold { background: rgba(245,200,66,0.2); color: #F5C842; border: 1px solid #F5C842; }
.badge-red { background: rgba(232,0,45,0.2); color: #E8002D; border: 1px solid #E8002D; }
.badge-blue { background: rgba(33,150,243,0.2); color: #2196F3; border: 1px solid #2196F3; }

.steps-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
}

.step-card {
  display: flex;
  gap: 16px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  padding: 18px 20px;
  transition: border-color 0.2s;
}

.step-card:hover {
  border-color: rgba(232,0,45,0.4);
}

.step-number {
  width: 36px;
  height: 36px;
  background: #E8002D;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 900;
  color: #fff;
  flex-shrink: 0;
  margin-top: 2px;
}

.step-content {
  flex: 1;
}

.step-title {
  font-size: 1.1rem;
  font-weight: 800;
  color: #F5C842;
  margin: 0 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.step-text {
  color: rgba(255,255,255,0.85);
  font-size: 1rem;
  line-height: 1.6;
  margin: 0;
}

.step-tip {
  margin-top: 10px;
  padding: 8px 12px;
  background: rgba(245,200,66,0.1);
  border-left: 3px solid #F5C842;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #F5C842;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.step-warning {
  margin-top: 10px;
  padding: 8px 12px;
  background: rgba(232,0,45,0.1);
  border-left: 3px solid #E8002D;
  border-radius: 4px;
  font-size: 0.9rem;
  color: #ff6b6b;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.step-code {
  margin-top: 10px;
  padding: 8px 12px;
  background: rgba(0,0,0,0.4);
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.9rem;
  color: #00ff88;
}

.faq-section {
  margin-top: 8px;
}

.faq-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin: 0 0 16px 0;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.faq-item {
  margin-bottom: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px;
  overflow: hidden;
}

.faq-question {
  width: 100%;
  background: rgba(255,255,255,0.04);
  border: none;
  padding: 14px 18px;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
}

.faq-question:hover {
  background: rgba(232,0,45,0.15);
}

.faq-arrow {
  color: #E8002D;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.faq-answer {
  padding: 14px 18px;
  background: rgba(0,0,0,0.2);
  color: rgba(255,255,255,0.75);
  font-size: 0.95rem;
  line-height: 1.6;
  border-top: 1px solid rgba(255,255,255,0.08);
}

.help-empty {
  padding: 60px 24px;
  text-align: center;
  color: rgba(255,255,255,0.4);
  font-size: 1.1rem;
}
</style>
