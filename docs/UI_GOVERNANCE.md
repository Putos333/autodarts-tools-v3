# UI-Governance — AUTODARTS ELITE UI MASTER 1.0

Verbindliche Regeln für alle Oberflächen von AUTODARTS ELITE. Sie verhindern Design-Drift: Dashboard, Menü,
Match Center, Training, Settings und spätere Module müssen erkennbar aus **demselben** System stammen.

Stand: UI-1 (Design-System-Fundament). Diese Datei beschreibt den **verifizierten Ist-Zustand** und die
verbindlichen Regeln; Abschnitt 14 listet bekannte Abweichungen und offene Entscheidungen offen auf.

## 0. Geltungsbereich und Quellen der Wahrheit

| Was | Wo |
|---|---|
| Design-Tokens (`--cc-*`) | `assets/design-tokens.css` — **einzige** Definition |
| Chakra-Kompatibilitäts-/Host-Shim | `entrypoints/controlcenter/style.css` (bewusst getrennt) |
| `cc-*`-Designklassen der Control-Center-Seite | `entrypoints/controlcenter/style.css` |
| Drift-Schutz | `tests/design-governance.test.ts` (läuft in `yarn test`, damit im Required Check „Control Center PR Gates“) |
| Visual-QA-Viewports | `tests/e2e/helpers/viewports.ts` |
| Visual-Baselines Control Center | `tests/e2e/cc-shell-visual.spec.ts` |

**Zwei Stilwelten, nicht vermischen:**

1. **Control-Center-Seite** (`entrypoints/controlcenter`, eigene Extension-Seite): hat die `--cc-*`-Tokens und kein Fremd-CSS.
2. **Content-Script-Overlays auf play.autodarts.io:** dort existiert `--cc-*` **nicht**; es gelten die Chakra-Variablen des Hosts.
   Tailwind läuft mit `preflight: false`, damit die Host-Seite nicht zerstört wird.

Folge: Tailwind-Klassen dürfen **nicht** auf `--cc-*` zeigen, solange sie auch in Host-Overlays genutzt werden
(`tailwind.config.ts` bleibt in UI-1 unverändert). Gemeinsam genutzte `App*`-Komponenten bleiben auf den Chakra-Variablen (Shim).
`--cc-*` wird in `cc-*`-Klassen und in `components/ControlCenter/**` genutzt.

## 1. Designsprache (unveränderlich, außer per bewusster Entscheidung)

- **Near-black Basis** (`--cc-bg`), Glass-Surfaces (`--cc-surface*`), kein generisches Admin-Dashboard-Layout.
- **Rot** (`--cc-accent`) = lokaler Spieler · **Blau** (`--cc-blue`) = Gegner — **nie vertauschen**.
- **Gold** (`--cc-gold`) ausschließlich Pokale / Rang / Achievements / Sieger (Ausnahme Fokus: siehe Abschnitt 14).
- **Grün** (`--cc-ok`) ausschließlich Erfolg / Online / Checkout-Erfolg.
- **Glow** zurückhaltend: nur auf Live-Indikatoren, aktiven Zuständen, Badges — nie auf Fließtext.
- **Schriften:** Barlow Condensed (Display), Open Sans (Body). Hinweis: im Ist-Zustand nicht gebündelt (Abschnitt 14).
- Premium-Charakter: wenige, klare Ebenen; Zahlen (Scores) sind die Hauptakteure; Dekoration folgt der Information.

Die Anker (Farbwerte, Schriftnamen, Dark-Schema, Hit-Target) sind im Test festgenagelt. Eine Änderung ist eine
**Design-Entscheidung** und braucht Freigabe, nicht nur einen angepassten Test.

## 2. Token-Regeln

1. Jede Farbe, Größe, Dauer, Ebene und jeder Radius kommt aus einem Token. Neue Werte werden **zuerst** als Token im Token-File angelegt.
2. `--cc-*` wird nur in `assets/design-tokens.css` definiert (Test). Komponenten dürfen es nur **verwenden**, nicht neu definieren.
3. `entrypoints/controlcenter/main.ts` lädt `design-tokens.css` **vor** `style.css` (Test).
4. Teil 1 der Datei sind Bestandstokens (Werte nie ohne Design-Entscheidung ändern). Teil 2 sind additive Tokens, abgeleitet aus Bestandswerten.
5. Keine Hardcode-Farben in neuem Code. Bestand wird kontrolliert abgebaut: Ratchets in `tests/design-governance.test.ts`
   (`BASELINE`: Farb-Literale in `style.css`, in `components/ControlCenter`, Text unter 12px). Werte dürfen **nur sinken**.
6. Token-Gruppen: Farben/Surfaces/Status · Typografie (`--cc-fs-*`, `--cc-fw-*`, `--cc-lh-*`, Fonts) · Spacing (`--cc-space-1…5`) ·
   Radius · Borders · Schatten/Glow/Elevation · Motion (`--cc-dur-*`, `--cc-ease-*`) · Ebenen (`--cc-z-*`) · Fokus · Hit-Target.

## 3. Komponentenregeln

- Neue UI wird aus vorhandenen Bausteinen gebaut: `App*` (Button, Input, Modal, Tabs, …) und `Cc*` (Shell, Card, HeroBand, EmptyState,
  PlayerBadge, MatchCenterShell, …). Neue Basiskomponenten nur nach Review, wenn kein Baustein passt.
- Die Navigation stammt aus **einer** Quelle: `components/ControlCenter/sections.ts` (Sidebar, Top-Bar-Titel, Hash-Routing, mobile Bottom-Nav).
- Views sind Seiten-Zusammenstellungen, keine Stil-Quellen: Stil kommt aus Tokens/`cc-*`-Klassen.
- Struktur nach `.eslintrc.cjs` (Reihenfolge template → script → style).
- **Protected Core:** `components/Settings/PrecisionMap.vue` ist geschützt (zusammen mit vier `utils/`-Dateien). Kein UI-Paket ändert sie ohne
  ausdrückliche Freigabe (`permissions.ask`, Git-Trailer-Guard, `docs/PROTECTED_CORE_ENFORCEMENT.md`). UI-Arbeit dort: stoppen und berichten.

## 4. Layout-/Grid-Regeln

- Seiten-Shell: Sidebar (`--cc-sidebar-w` 244px, Rail `--cc-sidebar-w-rail` 76px) + Content; Top-Bar; auf Mobil Bottom-Navigation.
- Inhaltsraster: 12-Spalten-Grid (`.cc-grid`), Abstand `--cc-space-4`.
- Abstände ausschließlich aus der Skala `--cc-space-1…5` (4/8/12/18/24px).
- **Match-Fokus:** Score und Hauptaktion stehen oben und sind bei 390×844 ohne Scrollen sichtbar; Kernaktionen sind höchstens 2 Interaktionen tief.
- **Layout-Shifts vermeiden:** Platz für asynchron geladene Inhalte reservieren (Skeleton/Empty-State mit fester Höhe), Zielwert CLS ≤ 0,1.
- Z-Ebenen nur über `--cc-z-*`.

## 5. Responsive-Regeln

Mobile-First gedacht, Desktop-Premium-Erlebnis. **Verbindliche Visual-QA-Viewports:**

| Name | Größe | Rolle |
|---|---|---|
| `mobile` | 390×844 | Phone, Bottom-Navigation |
| `tablet` | 768×1024 | Tablet, Sidebar als Rail |
| `desktop` | 1280×720 | Laptop, volle Sidebar |
| `wide` | 1920×1080 | Großbild/TV |

**Breakpoints** (Dokumentation; CSS-Variablen sind in `@media` nicht nutzbar):
dokumentiert `640`, `1280`, `1800`. **Legacy** (Bestand, nicht neu verwenden, werden bildschirmweise auf die dokumentierten migriert):
`480`, `720`, `780`, `860`, `980`, `1080`, `1440`. Der Test lässt keine **neuen** Werte zu.

Regeln: kein horizontales Scrollen der Seite in allen vier Viewports (E2E-geprüft); Touch-Ziele ≥ `--cc-hit-min` (44px);
Inhalte brechen um statt abzuschneiden; Tabellen/Listen haben eine mobile Darstellung.

## 6. Motion-Regeln

- Nur `transform` und `opacity` animieren (keine Layout-Eigenschaften).
- Dauern aus `--cc-dur-*` (instant 120 · fast 150 · base 200 · slow 300 · emphasis 400 ms); Mikro-Interaktionen ≤ 300 ms.
- Easing `--cc-ease-standard`; Spring (`--cc-ease-spring`) sparsam für Bestätigungen.
- `prefers-reduced-motion: reduce` ist zu respektieren (im Bestand 2 Blöcke; jede neue Animation bringt ihren Reduced-Motion-Fall mit).
- Bewegung transportiert Information (Zustandswechsel, Live-Ereignis), nie reine Dekoration. Playwright deaktiviert Animationen für Baselines.

## 7. Icon-Regeln

- Quelle: Iconify-Klassen über `addDynamicIconSelectors()` (`tailwind.config.ts`), Set `pixelarticons`
  (Schreibweise im Bestand: `icon-[pixelarticons--dashboard]`). `material-symbols` ist nur Dev-Abhängigkeit vorhanden.
- Ein Set pro Oberfläche (Pixelarticons für Control Center); keine Emoji als UI-Icons (Ausnahme: bestehende Inhalte).
- Icons tragen `currentColor`; rein dekorative Icons sind für Screenreader zu verbergen, bedeutungstragende haben einen Text-Namen.
- Icon-Buttons haben einen zugänglichen Namen und Hit-Target ≥ 44px.

## 8. Chart-/Grafik-Regeln

- Im Projekt ist **keine** Chart-Bibliothek vorhanden (`package.json`); Grafiken sind SVG/CSS (z. B. Live-Board). Keine neue Bibliothek ohne Analyse und Freigabe.
- Farben ausschließlich aus Tokens und mit fester Bedeutung: Rot = lokal, Blau = Gegner, Gold nur Rang/Sieger, Grün nur Erfolg.
- Information nie nur über Farbe: zusätzlich Form, Beschriftung oder Wert.
- Jede Grafik hat eine Textalternative (Zusammenfassung des Werts) und lesbare Beschriftungen (≥ `--cc-fs-xs`).
- Leere/fehlende Daten nutzen den vorhandenen Empty-State, keine leere Fläche.

## 9. Accessibility-Regeln

Ziel: WCAG 2.2 Level AA.

- **Kontrast:** Text ≥ 4,5:1, große Texte und UI-Elemente ≥ 3:1. Der Token-Kontrast ist im Test geprüft; bekannte Ausnahmen in Abschnitt 14.
- **Tastatur:** alle Funktionen per Tastatur erreichbar; sichtbarer Fokus (`--cc-focus-*`); logische Tab-Reihenfolge; kein Fokusfang.
- **Semantik:** native Elemente zuerst (`button`, `nav`, `main`); ARIA nur, wo nötig. Das sichtbare Label ist Teil des Accessible Name (WCAG 2.5.3,
  im Bestand in `sections.ts` dokumentiert). Dialoge/Tabs über die vorhandenen Bausteine (`AppModal`, `AppTabs`); `radix-vue` ist als Abhängigkeit vorhanden, im Bestand aber nur in `StreamingMode.vue` genutzt — Tastatur- und ARIA-Verhalten dieser Bausteine ist vor Wiederverwendung zu prüfen.
- **Text:** neuer Text mindestens 12px (`--cc-fs-xs`); Bestand unter 12px wird per Ratchet abgebaut.
- **Zielgröße:** ≥ 44px (Projektziel, strenger als WCAG 2.2 AA mit 24px).
- **Bewegung:** siehe Abschnitt 6. **Zoom/Reflow:** Layout bleibt bei 390px Breite ohne horizontales Scrollen bedienbar.
- **Automatisierte Prüfung:** *Bekannte, nicht blockierende Lücke.* Es gibt kein axe-Gate (`@axe-core/playwright` ist **nicht** installiert).
  Bis zu einer separaten Analyse und Freigabe gilt: Review mit dem Skill `ecc:accessibility`, Token-Kontrast-Test, Playwright-eigene Mittel
  (Rollen-/Namens-Locator, `toMatchAriaSnapshot`, Tastatur-Tests). Eine Dependency wird nur nach ausdrücklicher Freigabe installiert.

## 10. Visual-Baseline-Regeln

- Playwright `toHaveScreenshot`, Konfiguration in `playwright.config.ts` (`animations: disabled`, `maxDiffPixelRatio: 0.01`). **Keine Toleranz erhöhen** —
  bei Abweichung Umgebung prüfen.
- Vier Viewports aus `tests/e2e/helpers/viewports.ts`, **keine** globale Projektmatrix (bestehende Tests laufen nicht ×4).
- Baselines nur **bewusst** erneuern: nach Sichtprüfung `yarn test:e2e:update <spec>`, Diff im PR sichtbar machen. Nie „blind“ aktualisieren.
- Determinismus: externe Requests stubben, dynamische Bereiche maskieren (z. B. Versions-Badge), auf Endzustand warten statt raten.
- Referenzumgebung: Linux, Playwright-Chromium (Chrome for Testing 151, Playwright 1.62.1), headed unter Xvfb, `fonts-noto-core` — Schriften siehe Abschnitt 14.
- Eine UI-Änderung ohne Baseline gilt nicht als fertig.

## 11. Review-Regeln

- `code-review`-Skill vor jedem Merge (Primary Owner); `security-review` nur bei sicherheitsrelevanten Änderungen.
- Required Checks bleiben: „Control Center PR Gates“ und „Playwright E2E“.
- Jeder UI-PR nennt: berührte Screens, Token-Änderungen, Baseline-Änderungen (mit Bildvergleich), Accessibility-Befunde.
- Schreibende Änderungen laufen über die Hauptsitzung (Single-Owner-Regel), Subagents analysieren/reviewen.

## 12. Design-Drift-Schutz (technisch)

`tests/design-governance.test.ts` prüft robust, ohne Kosmetik festzunageln:

1. `--cc-*` nur im Token-File definiert; `main.ts` lädt Tokens vor `style.css`.
2. Jedes benutzte `var(--cc-*)` ist definiert; alle Pflicht-Token-Gruppen sind vorhanden.
3. Designsprache-Anker (Akzentfarben, Basis, Schriften, Hit-Target).
4. Ratchets: Farb-Literale, Text unter 12px — dürfen nur sinken; nur dokumentierte oder bestehende Breakpoints.
5. Kontrast der Text-/Status-Tokens gegen `--cc-bg` und `--cc-bg-elev`, bekannte Ausnahmen explizit benannt.

## 13. Definition of Done

Ein Screen/eine Komponente ist **fertig**, wenn **alle** acht Punkte erfüllt sind:

**DESIGN + UX + RESPONSIVE + ACCESSIBILITY + FUNCTION + TEST + VISUAL BASELINE + REVIEW**

| Stufe | Nachweis |
|---|---|
| DESIGN | nur Tokens/vorhandene Bausteine, Designsprache (Abschnitt 1) eingehalten |
| UX | Match-Fokus, Informationshierarchie, geringe Interaktionskosten |
| RESPONSIVE | alle vier Viewports, kein horizontales Scrollen |
| ACCESSIBILITY | Regeln aus Abschnitt 9, Kontrast, Tastatur, Zielgröße |
| FUNCTION | Verhalten unverändert bzw. wie spezifiziert |
| TEST | `yarn compile`, `yarn test`, `yarn test:components`, `yarn gate run` PASS |
| VISUAL BASELINE | Baseline je Viewport bewusst geprüft und committet |
| REVIEW | `code-review` ohne offene Befunde, Required Checks grün |

Messbare Zielwerte (Quality Bar): CLS ≤ 0,1 · INP ≤ 200 ms · Kontrast ≥ 4,5:1 / 3:1 · Touch-Ziele ≥ 44px · Animationen ≤ 300 ms (Mikro) ·
kein Größen-Regress gegenüber der in UI-2 erhobenen Build-Baseline. CLS/INP sind Zielwerte, in UI-1 **nicht gemessen**.

## 14. Bekannte Abweichungen und offene Entscheidungen (Stand UI-1)

Verifizierte Befunde, absichtlich nicht in UI-1 behoben (kein visueller Diff am Bestand):

1. **Schriften nicht gebündelt.** `style.css` deklariert Barlow Condensed/Open Sans, es gibt aber kein `@font-face`; auf dem Prüfsystem löst
   fontconfig beide auf Noto Sans auf. Die Visual-Baselines halten diesen Fallback fest. Beim Bündeln der Schriften sind sie bewusst zu erneuern.
2. **Kontrast:** `--cc-text-faint` (≈ 4,15:1 auf `--cc-bg`, ≈ 3,66:1 auf `--cc-bg-elev`) und `--cc-accent` als Text (≈ 4,20:1 / 3,70:1)
   liegen unter 4,5:1; beide sind im Test als bekannte Ausnahme (Untergrenze 3:1) geführt. Behebung = sichtbare Design-Änderung (UI-2, mit Baseline).
3. **Fokus uneinheitlich:** Bestand mischt Gold-Outline (2px/2px) und `--cc-accent-soft`-Ring. `--cc-focus-color` ist vorläufig Gold (häufigster Fall);
   das kollidiert mit „Gold nur Pokal/Rang“ — einheitliche Fokusfarbe ist eine **offene Design-Entscheidung** für UI-2.
4. **Kleine Schrift:** 86 Schriftgrößen unter 12px (Ratchet fixiert den Stand).
5. **Hardcodes:** 152 Farb-Literale in `style.css`, 21 in `components/ControlCenter`; `components/Settings` (inkl. Protected-Core-Datei) ist **nicht** Teil der Ratchets.
6. **Breakpoints uneinheitlich** (7 Legacy-Werte), Migration bildschirmweise.
7. **Externer Request:** die Control-Center-Seite ruft `…/api/marathon/health` (KI-Backend). Die Visual-Spec stubbt ihn; im Betrieb bleibt er unverändert.
8. **Accessibility-Gate:** siehe Abschnitt 9 (kein axe).
9. **Nicht gemessen:** CLS, INP, Bundle-Größen-Baseline, Lighthouse auf Extension-Seiten (UNKNOWN).

## 15. Shell-Muster (seit UI-2A)

Verbindliche Muster für App-Shell und Header (`CcShell`, `CcTopBar`); Desktop-Navigation siehe Abschnitt 16, Tablet-Rail und mobile Bottom-Navigation siehe Abschnitt 17.

1. **Skip-Link:** erstes fokussierbares Element der Seite (`.cc-skip-link`), außerhalb des Grid-Flusses, bis zum Fokus per `transform` aus dem Viewport
   geschoben, ohne Transition. Er fokussiert `<main id="cc-content" tabindex="-1">` programmatisch — **kein** Hash-Sprung, weil der Hash der Router ist.
2. **Fokus-Management:** Nach einem Bereichswechsel wandert der Fokus auf die `<h1>` (`tabindex="-1"`, kein eigener Fokusring). **Nicht** beim Erstladen oder
   Deep-Link (der Hash-Wechsel in `ControlCenter.vue` ist keine Nutzeraktion). `main` und `h1` sind programmatische Ziele, nicht Teil der Tab-Reihenfolge.
3. **Header-Aktionen:** eigener Cluster (`.cc-topbar-actions`), Zielgröße mindestens `--cc-hit-min` (44px), sichtbarer Tastaturfokus über die Fokus-Tokens
   (`--cc-focus-*`). Der **Wert** der Fokusfarbe wird zentral im Token-File entschieden (offene Entscheidung, Abschnitt 14), nicht in Komponenten.
4. **Phone (≤ 640px):** Header nicht sticky (ein dauerhafter Header von rund einem Viertel der Viewport-Höhe verdeckt sonst Inhalt); Nebenaktionen werden
   quadratische Icon-Buttons (`.cc-btn-compact`). Das Label bleibt im DOM und wird nur **visuell** versteckt, kein `aria-label` — sichtbarer und zugänglicher
   Name sind identisch (WCAG 2.5.3, Test in `tests/components/CcTopBar.component.test.ts`).
5. **Layout-stabile Status-Pills:** Auf Phones stehen die Pills untereinander. Nebeneinander umbrach die zweite Pill während der Backend-Prüfung
   („nicht geprüft“ → „wird geprüft …“ → Ergebnis) erst später und ließ den Header um ≈ 56px wachsen (gemessen, Layout-Shift ≈ 0,15–0,4). Regel: Layout darf
   nicht von der Länge dynamischer Texte abhängen.
6. **Reduced Motion:** Header-Aktionen und Navigationseinträge ohne Übergänge, kein Hover-Versatz, Reload-Icon dreht nicht.
7. **Prüfung:** `tests/e2e/cc-navigation.spec.ts` (je Viewport: Header-Anteil ≤ ⅓ der Höhe, Zielgrößen, Landmarks, Layout-Shift ≤ 0,1, Skip-Link, Fokusringe,
   Fokus nach Bereichswechsel, Deep-Link) und `tests/components/CcShell|CcTopBar.component.test.ts`; Pixelvergleich in `tests/e2e/cc-shell-visual.spec.ts`.

## 16. Desktop-Navigation (seit UI-2B)

Gilt für die volle Sidebar (ab 1081px, QA-Viewports 1280×720 und 1920×1080). Icon-Rail (≤ 1080px) und Bottom-Navigation: Abschnitt 17.

1. **Eine Quelle, Gruppen als Präsentation:** `components/ControlCenter/sections.ts` (`CC_SECTIONS`, `CC_SECTION_GROUPS`). Das Feld `group` gliedert nur die Sidebar
   (Live · Spielen · Auswertung · System); Section-IDs, Hash-Routing und Reihenfolge sind unverändert. Neue Bereiche brauchen eine `group`.
2. **Semantik:** `<nav aria-label>` → je Gruppe `role="group"` mit `aria-labelledby` (sichtbares Gruppenlabel, mindestens `--cc-fs-xs`) → `<ul role="list">` → `<li>` → `<button>`.
   Aktiver Eintrag: `aria-current="page"`. Icons sind `aria-hidden`. Das `title` bleibt: in der Icon-Rail ist das Label ausgeblendet, `title` ist dort der zugängliche Name.
3. **Aktiver Zustand:** rote Fläche (`--cc-accent-soft`), Rahmen (`--cc-accent-line`), Akzentbalken im Eintrag, Akzent-Icon, kräftigere Schrift. **Kein Gold** als Active-Fläche.
   Der Balken liegt innerhalb des Eintrags, weil `.cc-nav` (overflow) außenliegende Elemente abschneidet.
4. **Hover:** `--cc-surface-hover`, Text und Icon hellen auf; Dauer `--cc-dur-fast`, mit Reduced Motion ohne Übergang.
5. **Fokus:** Fokus-Tokens (`--cc-focus-*`) wie der Skip-Link (Header-Aktionen nutzen ebenfalls den Fokus-Outline); Ring **innen** (negativer Offset), weil ein äußerer Ring vom scrollenden Container abgeschnitten würde.
   Die Fokusfarbe bleibt die offene Entscheidung aus Abschnitt 14.
6. **Zielgröße und Höhe:** Einträge `min-height: var(--cc-hit-min)`, ohne vertikales Padding (sonst ~50px und 1280×720 passt nicht). Ohne Live-Match passt die gesamte Navigation ohne
   internen Scrollbalken in 1280×720; mit Live-Widget darf `.cc-nav` scrollen.
7. **Rail:** übernimmt Hover-, Fokus- und Aktivzustand dieser Sidebar (Abschnitt 17).
8. **Prüfung:** `tests/components/CcSidebar.component.test.ts`; `tests/e2e/cc-navigation.spec.ts` (Block „cc-desktop-nav“: Gruppen, Zielgrößen, kein Überlauf, aktiver Zustand, Hover,
   Tab-Reihenfolge, Fokusringe, Reduced Motion); Pixelvergleich Wide/Desktop in `tests/e2e/cc-shell-visual.spec.ts` (Baselines in UI-2B bewusst erneuert).

## 17. Responsive Navigation (seit UI-2C)

Tablet-Rail (≤ 1080px, QA-Viewport 768×1024) und mobile Bottom-Navigation (≤ 640px, QA-Viewport 390×844). Die Desktop-Sidebar (Abschnitt 16) ist unverändert; Section-IDs, Reihenfolge und Hash-Routing ebenfalls.

1. **Eine Quelle:** Rail und Bottom-Navigation lesen dieselbe Registry (`sections.ts`) und emittieren dasselbe `navigate`. Es gibt keine zweite Navigationslogik; die Gruppierung (Abschnitt 16) gilt für Sidebar und Rail, die Bottom-Navigation ist eine flache Liste.
2. **Rail übernimmt Desktop-Werte:** Zielgröße, Aktiv- und Fokuszustand der Rail sind die der Desktop-Sidebar; der Rail-Block in `style.css` enthält nur die Abweichungen (Breite `--cc-sidebar-w-rail`, zentrierte Einträge, Trennlinie zwischen Gruppen, Label ausgeblendet). Der frühere Reset-Block und `display:contents` entfallen: Gruppen bleiben echte Boxen mit `role="group"`.
3. **Labels in der Rail** (Eintrags- und Gruppenlabel) sind nur visuell versteckt (Visually-hidden-Muster wie `.cc-btn-label`), nicht per `display:none` — der Accessible Name hängt am sichtbaren Label, nicht nur an `title`. Das „bald“-Badge bleibt in der Rail ausgeblendet (Bestand, kein neues Badge).
4. **Bottom-Navigation scrollt horizontal:** neun Einträge passen bei 390px nicht in 44px-Ziele. Die Einträge liegen in `.cc-bottom-nav-scroll` (Scrollbalken ausgeblendet), das Live-Widget bleibt außerhalb. Einträge sind so breit wie ihr Label (nie abgeschnitten), mindestens `--cc-hit-min` plus `--cc-space-5`; dadurch bleibt rechts ein Eintrag angeschnitten sichtbar (Scroll-Hinweis). Eintragshöhe 56px, Safe-Area unten und die Platzreservierung in `.cc-content` bleiben unverändert. Label mindestens `--cc-fs-xs`.
5. **Sichtbar halten:** `CcSidebar.vue` stellt per `scrollLeft` (sofort, nicht animiert) sicher, dass der aktive Eintrag (z. B. Deep-Link `#settings`) und jeder fokussierte Eintrag vollständig sichtbar sind — der Browser scrollt einen nur teilweise sichtbaren Eintrag beim Fokussieren nicht nach. Ein `ResizeObserver` passt bei Breitenänderung (z. B. erscheinende Seiten-Scrollleiste) erneut an.
6. **Aktiver Zustand:** wie Desktop — `--cc-accent-soft`-Fläche, Akzent-Icon, kräftigere Schrift, Akzentlinie (Rail: seitlich, Bottom-Nav: oben) als Hinweis ohne Farbe. Kein Gold (das Gold-Punkt-Badge für „Vorschau“-Bereiche ist ein Status, kein Aktivzustand).
7. **Fokus:** Fokus-Tokens (`--cc-focus-*`), Ring innen (negativer Offset), weil der scrollende Container einen äußeren Ring abschneiden würde.
8. **Prüfung:** `tests/components/CcSidebar.component.test.ts`; `tests/e2e/cc-navigation.spec.ts` (Blöcke „cc-tablet-rail“ und „cc-bottom-nav“: Zielgrößen, Namen, Gruppen, Scrollbereich, Labels ungekürzt, kein Seiten-Überlauf, Tab-Reihenfolge, Fokusringe, Deep-Link, Reduced Motion); Pixelvergleich Tablet/Mobil in `tests/e2e/cc-shell-visual.spec.ts` (Baselines in UI-2C bewusst erneuert). Die Ratchets in `tests/design-governance.test.ts` sanken dabei (Farb-Literale `style.css` 152 → 150, Text unter 12px 86 → 85).
