# STATISTICS DATA CONTRACT — Autodarts Tools V3

**Zweck:** Diese Datei legt fest, welche Daten für eine zukünftige Statistics-
Funktion verwendet werden dürfen — bevor ein einziges UI-Pixel dafür gebaut
wird. **Keine Statistics-UI ist Teil dieser Mission.** Diese Datei ist die
Grundlage, damit eine spätere Statistics-Arbeit ohne erneuten
Architektur-Audit starten kann.

**Kern-Prinzip:** Statistics liest **ausschließlich** aus
`local:canonical-match-results-v1` (CMR). Niemals aus Live-`game-data`,
niemals aus Vue-Component-State, niemals aus Control-Center-UI-State. CMR ist
die einzige autorisierte historische Quelle.

## Erlaubte CMR-V1-Felder (Stand heute, `utils/canonical-match-result.ts`)

| Feld | Typ | Bedeutung |
|---|---|---|
| `matchId` | string | eindeutige Match-ID |
| `revision` | number | Korrektur-Zähler |
| `quality` | "MINIMAL"\|"PARTIAL"\|"COMPLETE" | Datenqualität dieses Records |
| `createdAt` | string? | von Autodarts, optional |
| `recordedAt` | string | lokaler Zeitpunkt der Speicherung — **NICHT** als Match-Ende-Zeitpunkt verwenden |
| `variant`/`gameMode`/`type` | string? | Spielmodus-Metadaten |
| `finished` | boolean | Match beendet? |
| `winnerIndex` | number? | bounds-checked gegen `players.length` |
| `players[].index` | number | Positions-Index |
| `players[].name` | string? | Anzeigename |
| `players[].userId` | string? | Autodarts-Account-ID, falls vorhanden |
| `players[].isBot` | boolean? | tri-state (auch `undefined` = unbekannt) |
| `players[].legs`/`.sets` | number? | nur falls Variante das Feld führt |
| `players[].average` | number? | |
| `players[].checkoutPoints` | number? | **höchster Einzel-Checkout, keine kumulierte Zahl** (Codebase-Konvention, nicht API-verifiziert) |
| `players[].total180` | number? | |
| `players[].dartsThrown` | number? | |
| `players[].first9Average` | number? | nicht Teil des COMPLETE-Quality-Gates |

## Die 5 garantiert korrekt berechenbaren Metriken

Diese 5 dürfen als Erste implementiert werden, sobald Statistics offiziell
gestartet wird — kein CMR V2, keine weitere Voraussetzung nötig:

1. **Match Count** — `records.length` (ggf. gefiltert nach `finished`)
2. **Average** — `players[].average`, nur über Records mit `quality === "COMPLETE"` mitteln
3. **180-Häufigkeit** — `sum(players[].total180)`
4. **Darts geworfen (gesamt/Ø)** — `players[].dartsThrown`
5. **Bester Average** — `max(players[].average)` über COMPLETE-Records

Alle 5 sind **SAFE**, weil sie direkt aus verpflichtend für die
COMPLETE-Qualitätsstufe vorhandenen oder klar definierten Feldern kommen und
keine Interpretation/Annahme erfordern (außer Highest-Checkout, siehe unten).

## Was CMR V2 braucht (heute NICHT verfügbar)

| Metrik | Fehlendes Feld | Grund |
|---|---|---|
| Checkout % | `checkoutPercent` | live in `IStats` vorhanden, nie ins CMR-Schema übernommen |
| Checkout-Versuche/-Treffer | `checkouts`/`checkoutsHit` | dito |
| 100+ / 140+ / 170+ | `plus100`/`plus140`/`plus170` | dito |
| Match-Dauer | ein echter Match-Ende-Zeitstempel | `recordedAt` ist **kein** verlässlicher Ersatz (Zeitpunkt der lokalen Speicherung, nicht des Match-Endes) |
| Korrektur-Historie in der UI | Exposition des bereits vorhandenen `revision`-Felds | Daten existieren, nur nicht UI-aufbereitet |

## Was Throw-Level-Daten braucht (bewusst NICHT in CMR V1, Scope-Entscheidung)

- Bestes Leg / Leg-Dauer
- 9-Darter-Erkennung
- Segment-Hits, Doubles/Trebles-Trefferquote
- alles, was `IMatch.turns`/`round` bräuchte — CMR v1 klammert diese Felder
  bewusst aus ("Semantik unverifiziert", siehe Modul-Docstring in
  `utils/canonical-match-result.ts`)

## Was Player Identity braucht (heute nur PARTIAL)

- **Win/Loss, Recent Form** — heute technisch berechenbar, aber
  **UNSAFE**: `match-history-view.ts` nimmt aktuell an, dass der Nutzer immer
  Spieler-Index 0 ist, statt gegen die echte `userId` zu prüfen. Diese
  Annahme ist nachweislich falsch, sobald der Nutzer nicht an Position 0
  sitzt (z. B. als Gast in fremder Lobby). **Muss vor Aktivierung dieser
  Metriken behoben werden** (siehe `ROADMAP_DEPENDENCIES.md`, Phase
  "Player Identity Fix").
- **H2H** — braucht zusätzlich stabile `userId` bei beiden Spielern; Gäste
  ohne stabile ID müssen ausgeschlossen werden.

## Was niemals aus Control-Center-UI-State berechnet werden darf

- Live-`game-data`/`board-data`/`lobby-data` (transient, nicht historisch,
  kann durch Multi-Tab-Überschreibung falsch sein)
- Trainings-Live-Overlay-Werte (`liveAvg` etc. in `training-mode.ts`) — das
  sind Zwischenstände während eines laufenden Matches, keine finalen Daten
- irgendein Vue-Component-`ref`, der nicht direkt aus CMR gelesen wurde

**Warum:** Diese Quellen sind entweder ephemer (verschwinden bei Reload),
nicht historisch persistiert, oder (bei Multi-Tab) potenziell durch einen
anderen Tab überschrieben. Eine Statistik, die auf ihnen basiert, wäre nicht
reproduzierbar und würde stillschweigend falsche Zahlen zeigen.

## Empfohlene Architektur bei Umsetzung (nicht heute gebaut)

```
CMR (local:canonical-match-results-v1)
   → reine Stat-Funktionen (z. B. utils/statistics/*.ts, analog zu
     match-history-view.ts: kein Vue, kein Storage, voll unit-testbar)
   → Aggregation
   → View-Model
   → UI (Control-Center-View, rein darstellend)
```

Explizit **nicht**: eine Vue-Komponente, die selbst über CMR-Records iteriert
und dabei Statistik berechnet — das würde das bereits bewährte, getestete
`match-history-view.ts`-Muster durchbrechen.
