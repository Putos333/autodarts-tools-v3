# Screenshot-Plan — 5 Motive für beide Stores

Empfohlene Größe für Chrome & AMO: **1280×800 px**.
Aufnahme via Firefox (Extension geladen) auf play.autodarts.io.
Nach Aufnahme mit Photoshop / GIMP / Krita ein 32px-Padding + 20px
Untertitel-Bar unten anfügen (Marketing-Impact).

---

## Screenshot 1 · Toolbar-Popup (v2.9.86+)

**Setup:** Beliebige Seite (auch autodarts.io Startseite), Toolbar-Icon
öffnen — Popup ist geöffnet, alle 5 Quick-Toggles auf AN, Backend-LED
grün mit Latenz-Anzeige, WS-LED grün.

**Untertitel:** "Toolbar-Popup mit Live-Status & 5 Quick-Toggles"

---

## Screenshot 2 · Karriere-Modus + Marathon-Board

**Setup:** `/app/frontend`-Landing im Firefox öffnen, Karriere-Panel
aktiv. Zeige Sponsor-Übersicht, 3 absolvierte Turniere, aktueller
Wochenkalender rechts. Overlay-Modul mit Marathon-Bestzeit.

**Untertitel:** "Karriere-Modus mit Turnierkalender & Speedrun-Ladder"

---

## Screenshot 3 · Live-Match (Caller + Crowd + Animation)

**Setup:** Ein Bot-Match starten, kurz vor einem 180er. In-Match
Quick-Menu unten aufgeklappt (Caller-Slider, Crowd-Slider,
Kommentator-Toggle sichtbar). Anzeige einer 180-Animation im
Overlay-Layer.

**Untertitel:** "Ally-Pally-Crowd bei einem 180er — 6 Venues wählbar"

---

## Screenshot 4 · Precision Map (KI-Coach)

**Setup:** Precision-Map-Panel öffnen. Board-Heatmap mit vergangenen
Würfen sichtbar, KI-Coach-Text mit personalisierten Trainings-Tipps
rechts.

**Untertitel:** "Precision Map & KI-Coach analysieren jeden Wurf"

---

## Screenshot 5 · Settings-Hub (7 Tabs)

**Setup:** In-Page-Settings-Hub. Tab „Karriere" aktiv, links Tabs-Liste
sichtbar (Caller, Crowd, Animations, Screenshot, Karriere, KI, Venues).
Karriere-Kartenübersicht mit 83 Bot-Skins.

**Untertitel:** "Vollständig deutsche UI · 7 Feature-Sektionen"

---

## Promo Tiles

### Chrome Web Store

| Tile              | Größe     | Pflicht? |
|-------------------|-----------|----------|
| Small promo tile  | 440×280   | **Ja**   |
| Marquee promo     | 1400×560  | Optional (empfohlen für Sichtbarkeit im Store-Featured) |

**Motiv-Vorschlag Small Tile 440×280:** dunkler Ally-Pally-Look
(#0d1b2a Hintergrund), gelber Dart-Silhouette links (60% Höhe), rechts:
```
TOOLS FOR
AUTODARTS
🎯 CALLER · CROWD · CAREER
```
Font: „Barlow Condensed" 900, farbe #F5C842.

**Motiv-Vorschlag Marquee 1400×560:** wie Small, aber links großes
Foto einer PDC-artigen Bühne, mittig Extension-Screenshot als
Composited Browser-Frame, rechts der Text-Block wie oben.

### Firefox AMO

AMO braucht kein Promo-Tile — nur die 5 Screenshots. Verwende dort
die gleichen 1280×800-Bilder.

---

## Aufnahme-Workflow

1. Firefox / Chrome mit `v2.9.87` laden (aus `.output/…-firefox.zip` oder
   `-chrome.zip`).
2. `about:debugging` → Load Temporary Add-on (Firefox) bzw.
   `chrome://extensions` → „Load unpacked" (Chrome).
3. Zoom auf 100 %, Fenster auf 1280×800 skalieren (Firefox
   Menü → Web-Entwickler-Werkzeuge → Responsive-Design-Modus → 1280×800).
4. Für Karriere-Screens vorher `POPUP → Backup importieren` mit dem
   Demo-Backup aus `submission/promo/demo-career-backup.json`
   (siehe unten).
5. Native Screenshot-Funktion des OS (macOS ⌘+Shift+4, Ubuntu
   `gnome-screenshot -a`) und in `submission/promo/screenshots/` ablegen.
