# PRE-LIVE FREEZE — Autodarts Tools V3 (Live-Match / Dashboard, Phasen 1–3.5)

**Erstellt:** 2026-08-28, 13:56 CEST
**Zweck:** Reproduzierbarer, dokumentierter Einfrierpunkt des technisch verifizierten Arbeitsstandes nach Phase 3.5 (Pre-Live Hardening) — als Referenz-Baseline für alle weiteren Arbeiten und für den ausstehenden Human Live Test.
**Wichtiger Hinweis:** Dies ist eine reine Dokumentations-/Baseline-Phase. Es wurde **kein** echter Human Live Test durchgeführt. Alle Aussagen unten sind technisch (Unit-/Lifecycle-/Typecheck-/Build-Ebene) verifiziert, nicht durch reales Spiel auf einem Board.

---

## 1. Git-Zustand

| Feld | Wert |
|---|---|
| Branch | `consolidate/final-runtime-2.9.98` |
| HEAD-SHA | `2707ae9b08cc488e290f53a53ac69dc895a4f005` |
| Worktree | **NICHT clean** — siehe Diff unten. Alle Änderungen sind uncommitted. |
| Commits seit letzter bekannter stabiler Baseline | **0** — HEAD ist identisch zu `PRE_LIVE_SNAPSHOT.md` (2026-08-28, 08:14 CEST). Phase 1–3.5 wurden ausschließlich im Arbeitsverzeichnis umgesetzt, nichts wurde committet. |
| Push-Status | Kein Push erfolgt |

**Vorherige bekannte stabile Baseline:** `PRE_LIVE_SNAPSHOT.md` (2026-08-28, 08:14 CEST, selber HEAD-SHA, Worktree damals clean). Alles in diesem Dokument beschreibt den **zusätzlichen**, seither im Worktree entstandenen Stand (Phase 1–3.5, Live-Match/Dashboard-Arbeit).

### Geänderte Dateien (tracked, `git diff --stat`)

```
CLAUDE.md                                |  56 +++++++++
components/ControlCenter/CcMatchHero.vue |   7 ++
entrypoints/controlcenter/style.css      | 196 +++++++++++++++++++++++++++++++
tests/live-throw.test.ts                 |  45 ++++++-
utils/live-throw.ts                      |  14 ++-
5 files changed, 311 insertions(+), 7 deletions(-)
```

### Neue (untracked) Dateien — Live-Match/Dashboard-relevant

```
components/ControlCenter/CcLiveBoard.vue      (173 Zeilen)
utils/dartboard-geometry.ts                   (259 Zeilen)
tests/dartboard-geometry.test.ts              (402 Zeilen)
tests/phase3-5-hardening.test.ts              (471 Zeilen)
```

### Sonstige untracked Einträge (Tooling/Agent-Infrastruktur, Doku — kein Anwendungscode dieser Phasen)

`.agents/`, `.claude-flow/`, `.claude/`, `.claudeignore`, `.codex/`, `.github/workflows/opencode.yml`, `.mcp.json`, `.projectatlas/`, `.ruflo/`, `.ruvector/`, `.swarm/`, `runtime-artifacts/`, `HUMAN_LIVE_TEST_CHECKLIST.md`, `LIVE_TEST_RESULT_TEMPLATE.md`, `POST_LIVE_DIAGNOSTIC_MATRIX.md`, `PRE_LIVE_SNAPSHOT.md` — bereits vor Beginn dieser Phasen im Worktree vorhanden, nicht Teil der Phase-1–3.5-Arbeit.

**`CLAUDE.md` (M, +56):** war bereits zu Sessionbeginn als geändert markiert, wurde in Phase 1–3.5 nicht angefasst — Ursprung liegt außerhalb dieser Arbeit.

---

## 2. Phase-1/2/3/3.5-Änderungen — Inventar

### PRODUCTION CHANGES

| Datei | Status | Phase | Inhalt |
|---|---|---|---|
| `utils/dartboard-geometry.ts` | neu | 1 | Board-Geometrie/Koordinaten-Transformation, 1:1 aus `components/Settings/PrecisionMap.vue` extrahiert (Quelle unverändert). Liefert `resolveLiveDartPoint()`: echte `coords` haben Vorrang, sonst deterministischer Segment-Fallback (`parseSegmentLabel`/`segmentFallbackToCanvasPoint`), sonst kein Marker. |
| `components/ControlCenter/CcLiveBoard.vue` | neu | 1 | Reine Präsentationskomponente: grafische Live-Dartscheibe (SVG), max. 3 Dart-Marker-Slots, keine WebSocket-/Match-State-/API-Logik, Props-only. |
| `utils/live-throw.ts` | geändert (+14/-0) | 2 | `ICcLiveDart` um `coords: {x,y} \| null` erweitert; `deriveLiveThrow()` gibt `IThrow.coords` verbatim durch (nie geraten/gerundet). |
| `components/ControlCenter/CcMatchHero.vue` | geändert (+7/-0) | 2 | Bindet `<CcLiveBoard :darts="liveThrow.darts" />` ausschließlich im Live-Throw-Zweig ein (nie im Checkout-Route-Zweig — ein physischer Slot, siehe bestehender Wave-2-Kommentar im Code). |
| `entrypoints/controlcenter/style.css` | geändert (+196/-0) | 3 + 3.5 | **Phase 3:** allgemeiner Aktiver-Spieler-Glow (`.cc-hero-side.is-active-side`, vorher nur während Checkout), `.cc-hero-board-visual` zu Glass-Panel mit gestufter Größe (Mobile 96px → Desktop 150–190px → TV 250px) aufgewertet. **Phase 3.5:** neuer `@media (max-width: 480px)`-Block für `.cc-hero-body` (Badge/Name/Score/Tag-Verkleinerung + `min-width:0`/`overflow-wrap:anywhere` auf `.cc-tag`) — behebt einen per DOM-Messung nachgewiesenen Overlap-Bug bei 360–430px. Rein additiv, keine Selektoren entfernt, keine Struktur-/Logikänderung. |

### TEST-ONLY CHANGES

| Datei | Status | Phase | Inhalt |
|---|---|---|---|
| `tests/dartboard-geometry.test.ts` | neu (402 Zeilen) | 1/2 | Geometrie-Tests: Segmentwinkel, `pointOnCircle`/`describeAnnularSector`, `liveDartToCanvasPoint`, `parseSegmentLabel`, `segmentFallbackToCanvasPoint`, `resolveLiveDartPoint`, Regressionsschutz (keine zweite Board-Engine, `PrecisionMap.vue` unverändert genutzt). |
| `tests/live-throw.test.ts` | geändert (+45/-?) | 2 | `deriveLiveThrow`-Tests inkl. coords-Fälle, Wave-2-Regressionsschutz (ein physischer Slot, `CcLiveBoard` nur im Live-Throw-Zweig, Bottom-Nav unangetastet). |
| `tests/phase3-5-hardening.test.ts` | neu (471 Zeilen) | 3.5 | **Rein synthetisch, test-only, kein Produktionscode hängt davon ab.** 20 deterministische Fixtures A–T (Match-Start, 1–3 Darts mit coords, Segment-Fallback, Mischung, Single/Double/Triple/25/Bull, nicht interpretierbares Label, Spieler-/Turn-Wechsel, niedriger Restscore, fehlender Name, unvollständige/kaputte Daten, leerer `throws`-Array, `coords: null`, ungewöhnliche typgültige Daten) + 8 Live-Board-Invarianten (max. 3 Marker, coords-Priorität, Fallback nur bei fehlenden coords, keine NaN/Off-Board-Marker, keine stale Marker, keine Duplikate) + 5 Robustheitstests (leere Zustände, schneller Turn-/Spielerwechsel, 3 aufeinanderfolgende Dart-Updates, Idempotenz). |

### DOCUMENTATION

| Datei | Status | Inhalt |
|---|---|---|
| `PRE_LIVE_FREEZE.md` | **neu (dieses Dokument)** | Baseline-Freeze nach Phase 3.5. Einzige in diesem Freeze-Schritt erstellte/geänderte Datei. |
| `PRE_LIVE_SNAPSHOT.md` | bereits vorhanden, unverändert | Frühere, unabhängige Pre-Live-Bewertung (08:14 CEST, vor Beginn der Live-Match/Dashboard-Phasen) — bleibt als eigenständige Referenz gültig. |

### PROTECTED / UNCHANGED CORE

Verifiziert unverändert (Phase 1 bis inkl. diesem Freeze), `git status` zu diesen Pfaden ist leer:

- `utils/canonical-match-result.ts`
- `utils/websocket-helpers.ts`
- `utils/event-dedupe.ts`
- `components/Settings/PrecisionMap.vue`

`utils/dartboard-geometry.ts` liest aus `PrecisionMap.vue` nur die (unveränderten) Konstanten/Werte ab — keine geteilte, zweite Board-Mathematik, keine Rückwirkung auf die Datei selbst.

---

## 3. Testzahlen & Build-Status (letzter verifizierter Lauf, Phase 3.5)

Diese Zahlen stammen aus dem zuletzt tatsächlich ausgeführten Lauf am Ende von Phase 3.5, in derselben Session, auf demselben Worktree-Stand wie oben — seither wurde **keine Produktionsdatei verändert**, siehe Konsistenzprüfung unten. Kein erneuter Lauf in diesem Freeze-Schritt (Vermeidung unnötiger Wiederholung wegen Wochenlimit, wie angefordert).

| Prüfung | Ergebnis |
|---|---|
| Targeted Tests (`live-throw`, `dartboard-geometry`, `phase3-5-hardening`) | **97/97 PASS** |
| Vollständige Unit-Test-Suite (`yarn test`) | **446/446 PASS**, 67 Suiten |
| Lifecycle-Contract-Tests (`yarn test:lifecycle`) | **36/36 PASS** |
| TypeScript (`vue-tsc --noEmit`) | **PASS**, 0 Fehler |
| Firefox MV2 Build (`yarn build:firefox`) | **PASS** — ~13,6s, 4,29 MB, keine Fehler |
| Chrome MV3 Build (`yarn build`) | **PASS** — ~13,1s, 4,29 MB, keine Fehler |

Zusätzlich in Phase 3.5 verifiziert (Chrome DevTools MCP, statisches Style-Preview-Harness + isolierter lokaler Test-Server für DOM-Messung — **kein** Human Live Test):

| Breite/Frame | Ergebnis |
|---|---|
| 360px | PASS (nach Fix: 0 Overlaps, DOM-vermessen) |
| 390px | PASS |
| 430px | PASS |
| 768px | PASS |
| 1280px | PASS |
| 1920px | PASS |
| TV 16:9 (1920×1080) | PASS — Board vollständig sichtbar, kein Overflow |

---

## 4. Bekannte verbleibende Einschränkungen

- **Kein echter Human Live Test durchgeführt.** Alle obigen Ergebnisse sind synthetisch/technisch (Unit-Fixtures, statisches CSS-Preview-Harness, Typecheck, Build). Reales Verhalten mit einem physischen Board, echtem Autodarts-WebSocket-Stream und echten Timing-/Netzwerkbedingungen ist **nicht** geprüft.
- Das visuelle Preview-Harness aus Phase 3/3.5 verwendet Kopien der realen `cc-hero`/`cc-throw-zone`-Markup-Struktur mit synthetischen Beispieldaten und dem echten `style.css` — es ist **keine** Ausführung der echten Extension/des echten Control-Center-Bundles im Browser.
- Performance- und Accessibility-Bewertungen in Phase 3.5 waren **Read-only-Analysen** (keine belastbaren Messwerte von echter Ziel-Hardware, z. B. kein Lighthouse-/Runtime-Profiling unter realer Last).
- Die 20 synthetischen Fixtures (A–T) decken das bekannte `IMatch`/`ITurn`/`IThrow`-Schema ab, aber nicht jede denkbare reale Payload-Variante von Autodarts.
- Nur der Live-Match-Hero-Bereich (Home-Dashboard) wurde in Phase 3 gestaltet, nicht der separate große Scoreboard-Bereich (`.cc-sb-*`, „Match-Bereich"), um den Scope klein zu halten.

**Was erst im Human Live Test verifiziert werden kann:**
- Reales Timing von Live-Dart-Markern bei tatsächlichen Würfen (Latenz, Reihenfolge, Ablösung nach Turn-Wechsel)
- Tatsächliches Verhalten von `coords` vs. Segment-Fallback mit echten Autodarts-Board-Daten (nicht nur synthetisch nachgebildet)
- Visuelle Wirkung auf echter Hardware/echtem Display (Desktop-Browser, echtes Tablet/Phone, echtes TV-Display) statt emulierter Viewports
- Tatsächliche Performance/Ruckelfreiheit auf der genannten Nicht-High-End-Zielhardware unter echter Last
- Tatsächliche Bedienbarkeit der Mobile Bottom Navigation während eines laufenden echten Matches

---

## 5. Protected Core (weiterhin gültig, ab jetzt PRE-LIVE STABLE BASELINE)

```
utils/canonical-match-result.ts
utils/websocket-helpers.ts
utils/event-dedupe.ts
components/Settings/PrecisionMap.vue
```

Diese Dateien dürfen weiterhin nur READ-ONLY behandelt werden. Jede Änderungsabsicht muss vor der Umsetzung gemeldet werden.

---

## 6. Aktueller Git-Status (verbatim, zum Zeitpunkt dieses Freeze)

```
On branch consolidate/final-runtime-2.9.98

 M CLAUDE.md
 M components/ControlCenter/CcMatchHero.vue
 M entrypoints/controlcenter/style.css
 M tests/live-throw.test.ts
 M utils/live-throw.ts
?? .agents/
?? .claude-flow/
?? .claude/
?? .claudeignore
?? .codex/
?? .github/workflows/opencode.yml
?? .mcp.json
?? .projectatlas/
?? .ruflo/
?? .ruvector/
?? .swarm/
?? HUMAN_LIVE_TEST_CHECKLIST.md
?? LIVE_TEST_RESULT_TEMPLATE.md
?? POST_LIVE_DIAGNOSTIC_MATRIX.md
?? PRE_LIVE_FREEZE.md
?? PRE_LIVE_SNAPSHOT.md
?? components/ControlCenter/CcLiveBoard.vue
?? runtime-artifacts/
?? tests/dartboard-geometry.test.ts
?? tests/phase3-5-hardening.test.ts
?? utils/dartboard-geometry.ts
```

---

## 7. Recovery- / Referenzinformation

**Diese Baseline ist NICHT committet.** Es existiert kein Commit und kein Stash, der diesen exakten Stand allein referenzierbar macht. Die Baseline besteht ausschließlich aus:

1. **HEAD** `2707ae9b08cc488e290f53a53ac69dc895a4f005` auf Branch `consolidate/final-runtime-2.9.98` (identisch zur vorherigen `PRE_LIVE_SNAPSHOT.md`-Baseline), **plus**
2. den exakten Worktree-Diffs der 5 geänderten + 4 neuen Live-Match/Dashboard-Dateien, wie oben unter Abschnitt 1/2 gelistet.

Um diesen Stand zu reproduzieren: HEAD `2707ae9b` auschecken und exakt die in Abschnitt 2 gelisteten Dateien mit ihrem aktuellen Arbeitsverzeichnis-Inhalt wiederherstellen (z. B. aus einem Backup/Diff dieser Session). Da laut Vorgabe kein Commit/Stash angelegt werden durfte, ist diese Baseline **fragil gegenüber Datenverlust im Worktree** — jede destruktive Git-Operation (`reset --hard`, `clean`, `checkout .` etc.) auf diesem Stand würde sie unwiederbringlich zerstören. Es wird empfohlen, vor jeder potenziell riskanten Operation einen Commit oder Stash dieses Standes anzulegen (nur nach expliziter Nutzerfreigabe, siehe Freeze-Regeln).

---

## Status

| Feld | Wert |
|---|---|
| HUMAN LIVE TEST | **DEFERRED** |
| PRE-LIVE TECHNICAL READY | **YES** |
| PRE-LIVE STABLE BASELINE | **ESTABLISHED** (ab diesem Dokument) |
