# ROADMAP DEPENDENCIES — Autodarts Tools V3

**Stand:** 2026-08-17. Aus dem tatsächlichen Code-Zustand abgeleitet, nicht
aus Wunschdenken. Kein Feature in dieser Datei wird heute gebaut.

## Kategorien

- **FOUNDATION** — Zuverlässigkeit der Kern-Datenpipeline
- **CORE GAMEPLAY** — direkt matchbezogene Features
- **ANALYTICS** — History/Statistics/Charts
- **INTEGRATIONS** — Caller/Sounds/WLED (parallel, nicht in der Kette)
- **SOCIAL** — Friends/Party/H2H
- **COMPETITIVE** — Rating/Tournaments/Leagues

## Abhängigkeitskette

```
Autodarts Integration                                    [FOUNDATION]
   │  READY (Autodarts bleibt alleinige Scoring-Autorität, verifiziert)
   ▼
Board/Match Reliability                                  [FOUNDATION]
   │  PARTIAL — Blocker: Late/Out-of-Order-Events unprotected (geschützter
   │  Kern), kein WS-Auto-Reconnect, Multi-Tab ohne Schutz
   ▼
CMR (Canonical Match Result)                              [FOUNDATION]
   │  READY (Schema v1, idempotent, getestet — siehe STATISTICS_DATA_CONTRACT.md)
   ├──────────────────────────────┐
   ▼                              ▼
History                    Training Results               [ANALYTICS / CORE GAMEPLAY]
   │  READY                    │  READY (R1/R7 verifiziert)
   │                           ▼
   │                    Solo Challenges                    [CORE GAMEPLAY]
   │                       │  PARTIAL — nur 3 Challenge-Typen mit heutigen
   │                       │  Daten möglich (Average/180/Checkout-Rate-Ziele),
   │                       │  Rest blockiert durch fehlende Leg-genaue Daten
   ▼
Statistics                                                 [ANALYTICS]
   │  BLOCKED — Blocker: nur 5 Metriken SAFE (siehe STATISTICS_DATA_CONTRACT.md),
   │  Rest braucht CMR V2 (checkoutPercent, plus100/140/170, Duration)
   ▼
Charts                                                     [ANALYTICS]
   │  BLOCKED — Blocker: Statistics selbst noch nicht gestartet, einige
   │  Charts (Duration, Leg Performance) brauchen zusätzlich CMR V2
   ▼
Achievements                                                [ANALYTICS]
   │  BLOCKED — Blocker: CMR V2 (mehr Rohfelder), Correction-Recalculation-
   │  Konzept fehlt komplett (ein Achievement könnte durch eine nachträgliche
   │  Korrektur ungültig werden — heute nirgends vorgesehen)

Player Identity                                            [SOCIAL, Voraussetzung]
   │  PARTIAL — Blocker: Win/Loss nutzt aktuell eine Index-0-Annahme statt
   │  echter userId (nachweislich falsch, sobald Nutzer nicht Position 0 ist).
   │  Kleinster, isoliertester Fix der gesamten Roadmap.
   ├─────────────┬─────────────┐
   ▼             ▼             ▼
Friends        H2H          Rating                         [SOCIAL / COMPETITIVE]
READY          PARTIAL      BLOCKED
(ehrliches     (braucht     — Blocker: Correction/Abandonment-Handling fehlt,
 Diagnose-      Player-      Anti-Abuse fehlt, Server-Autorität fehlt.
 Modell         Identity-    Vier Stufen (Local Skill Trend → Unranked H2H →
 verifiziert)   Fix)         Private Rating → Public Rating), nur Stufe 1
                             heute möglich.
                                │
                                ▼
                          Tournaments                       [COMPETITIVE]
                             │  BLOCKED — kein Domänenmodell vorhanden
                             │  (`tournament-data-storage.ts` ist nur
                             │  `{event, body, tournamentId}`, kein
                             │  Bracket/Teilnehmer-Modell)
                                ▼
                          Leagues                            [COMPETITIVE]
                             BLOCKED (praktisch) / PARTIAL (technisch) —
                             `liga-api.ts` funktioniert bereits über
                             jsonbin.io, aber ohne echte Authentifizierung;
                             für echten Ausbau braucht es ein Rollen-/
                             Rechte-Modell (Server-seitig)
```

## Integrationen (parallel, nicht Teil der Kette)

| Integration | Status | Blocker |
|---|---|---|
| Caller | READY (isoliert, kann Scoring nicht beeinflussen — verifiziert) | bekannte, akzeptierte Cleanup-Lücken (Blob-Interval, unlockAudio-Listener) |
| Sounds | READY | keine |
| Crowd | READY | keine |
| WLED | PARTIAL | R2-Bug (`.boardId`-Zugriff), Debounce-Bug — beide isoliert, kein Scoring-Risiko |

## Feature-Status-Zusammenfassung

| Feature | Status | Blocker |
|---|---|---|
| Board/Match Reliability | PARTIAL | Late-Events, Reconnect, Multi-Tab |
| CMR | READY | — |
| History | READY | — |
| Training | READY | Checkout-Misses/Medal-Progress (kleine, isolierte Lücken) |
| Solo Challenges | PARTIAL | Leg-genaue Daten fehlen für die meisten Varianten |
| Statistics | BLOCKED | CMR V2 |
| Charts | BLOCKED | Statistics + teilweise CMR V2 |
| Achievements | BLOCKED | CMR V2 + Correction-Recalculation-Konzept |
| Player Identity | PARTIAL | Index-0-Annahme (kleinster Fix der ganzen Roadmap) |
| Friends | READY | — |
| Party/Lobby | PARTIAL | kein Dedupe, globale Storage-Keys |
| H2H | PARTIAL | Player-Identity-Fix |
| Rating | BLOCKED | Correction/Abandonment/Anti-Abuse/Server-Autorität |
| Tournaments | BLOCKED | kein Domänenmodell |
| Leagues | BLOCKED (Ausbau) / PARTIAL (heutiger Umfang) | Auth-Modell |
| Caller/Sounds/WLED | READY/PARTIAL | siehe Tabelle oben |

## Wichtigster Einzelbefund dieser Kette

**Der Player-Identity-Fix (Index-0 → echte `userId`) ist der Fix mit dem
größten Hebel im gesamten Baum** — er entsperrt gleichzeitig korrekte
Win/Loss-Statistiken, Recent Form, H2H und ist Grundvoraussetzung für jede
spätere Rating-Stufe. Er ist außerdem der kleinste, isolierteste Fix
(`utils/match-history-view.ts`, keine geschützten Dateien betroffen).
