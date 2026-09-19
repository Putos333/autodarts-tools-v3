# PRE-LIVE-SNAPSHOT — Autodarts Tools V3

**Erstellt:** 2026-08-28, 08:14 CEST
**Zweck:** Technischer Stand unmittelbar vor dem Human Live Test heute Abend.

---

## Git-Zustand

| Feld | Wert |
|---|---|
| Branch | `consolidate/final-runtime-2.9.98` |
| HEAD-SHA | `2707ae9b08cc488e290f53a53ac69dc895a4f005` |
| Worktree (tracked files) | **CLEAN** — keine offenen Änderungen an versionierten Dateien |
| Push-Status | Kein Push erfolgt (8 Commits vor `origin`) |
| Untracked (ignoriert für diese Bewertung) | `.agents/`, `.claude-flow/`, `.claude/`, `.codex/`, `.mcp.json`, `.projectatlas/`, `.ruflo/`, `.ruvector/`, `.swarm/`, `runtime-artifacts/`, `.claudeignore`, `.github/workflows/opencode.yml` — Tooling/Agent-Infrastruktur, kein Anwendungscode |

## Heutige Commits (PRE-LIVE-STABILITY-AUDIT, chronologisch)

| SHA | Zeit | Fix |
|---|---|---|
| `cafc473` | 05:05 | WLED-Debounce → FIFO-Queue (verwarf Transitionen <200ms) |
| `6163b40` | 05:12 | Caller/SoundFx-Debounce (identischer Bug wie WLED) |
| `eb662be` | 05:55 | Shuffle-Players-Hang bei doppelten Spieler-/Bot-Namen |
| `684ed3a` | 05:59 | `useConfirmDialog` → `useAppConfirmDialog` (Build-Warnung behoben) |
| `094735b` | 06:06 | Share-Card `wasFinished`-Sentinel-Bug (Feature feuerte nie) |
| `501460b` | 06:11 | AI-Commentator "Game On" fehlte bei ~50% der Matches |
| `51e7513` | 07:46 | Liga-Auto-Submit las nichtexistente `gameData`-Felder — Feature war komplett tot |
| `ca37740` | 07:49 | QuickCorrection: akkumulierender `keydown`-Listener-Leak pro Match |
| `2707ae9` | 07:51 | Enhanced-Scoring-Display: unbedingtes Hot-Path-Console-Log entfernt |

Geschützter Scoring-Kern (`canonical-match-result.ts`, `canonical-match-result-storage.ts`,
`event-dedupe.ts`, `websocket-helpers.ts`) — **unverändert**, keiner der Fixes berührt diese Dateien.
Friends Presence / CCPARTY N2 — **unverändert**, weiterhin paused/deferred.

## Finale Verifikation (unmittelbar vor Build, 2026-08-28 ~08:00–08:14)

| Prüfung | Ergebnis |
|---|---|
| Unit-Test-Suite (`yarn test`) | **363/363 PASS** |
| Lifecycle-Contract-Tests (`yarn test:lifecycle`) | **36/36 PASS** |
| TypeScript Compile (`vue-tsc --noEmit`) | **0 Fehler** |
| Firefox MV2 Build (`yarn build:firefox`) | **PASS** — 11,7s, 4,28 MB, keine Fehler/unerwarteten Warnungen |
| Chrome MV3 Build (`yarn build`) | **PASS** — 11,7s, 4,28 MB, keine Fehler/Warnungen |

**Build-Konsistenz gegen HEAD verifiziert:**
- Worktree war vor jedem Build sauber (kein uncommitteter Drift möglich)
- Stichprobe im gebündelten Output: `"Liga-Ergebnis gespeichert"` (Liga-Fix) vorhanden;
  `"Enhanced Scoring Display - Game data changed"` (entfernter Spam-Log) korrekt **nicht** mehr vorhanden
- Build-Zeitstempel (08:11) konsistent mit Build-Lauf

## Manifest-Verifikation (Firefox MV2)

| Feld | Wert |
|---|---|
| `manifest_version` | 2 |
| `version` | 2.9.98 |
| `name` | Tools for Autodarts |
| `background` | `{"scripts":["background.js"]}` |
| `content_scripts` | 2 Einträge — Haupt-Bundle (boards/content/lobby/lobbynew/match, 5 Dateien) + `websocket-monitor.js` (`document_start`) |
| Icons | 16/24/48/96/128 px — alle vorhanden |
| `web_accessible_resources` | 7 Einträge, alle referenzierten Pfade vorhanden |
| Alle referenzierten JS-Dateien | Vorhanden, geprüft einzeln (boards.js, content.js, lobby.js, lobbynew.js, match.js, websocket-monitor.js) |
| ZIP-Integrität (`unzip -t`) | Keine Fehler |

## Test-Installationsartefakte

| Artefakt | Pfad | Größe |
|---|---|---|
| **Firefox-Installationspaket (ZIP)** | `/home/arnonym2302/autodarts-tools-v3/.output/autodarts-tools-2.9.98-firefox.zip` | 1,7 MB |
| Unverpacktes Build (für "Load Temporary Add-on") | `/home/arnonym2302/autodarts-tools-v3/.output/firefox-mv2/` | 4,5 MB |
| AMO-Sources-ZIP (nur falls Signierung/Review nötig) | `/home/arnonym2302/autodarts-tools-v3/.output/autodarts-tools-2.9.98-sources.zip` | 8,2 MB |
| Chrome MV3 (parallel gebaut, nicht Fokus heute Abend) | `/home/arnonym2302/autodarts-tools-v3/.output/chrome-mv3/` | 4,3 MB |

**Installation in Firefox für den Live-Test:**
`about:debugging#/runtime/this-firefox` → „Temporäres Add-on laden" → `manifest.json` aus
`.output/firefox-mv2/` wählen (kein Signing nötig, Browser-Neustart entfernt das temporäre Add-on wieder).

## Gesamtstatus

**SAFE TO START HUMAN LIVE TEST: JA**
Kein bekannter, unbehobener P0-Bug außerhalb des geschützten Kerns. Alle in dieser Session gefundenen
Kandidaten sind entweder gefixt (9) oder aus Impact-/Risiko-Gründen bewusst zurückgestellt und dokumentiert
(siehe Session-Verlauf: `discord-webhooks.ts` Doppel-PATCH, `triggerPatterns.ranges`-Sortierung).
**SAFE TO PUSH: Kein Push angefordert, keiner erfolgt.**
