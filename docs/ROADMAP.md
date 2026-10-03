# Autodarts Tools v3 Roadmap

## Architecture

`Autodarts WebSocket -> WebSocket Core -> Match Engine -> Feature Dispatcher -> Feature Modules`

## Completed

### Alpha 1
- Core event bus
- Module lifecycle
- Compatibility bridge
- Performance diagnostics

### Alpha 2
- Central WebSocket pipeline
- Dedupe/state tracking
- Semantic game events

### Alpha 3
- Match Engine
- Feature Dispatcher
- Caller / Sound / WLED dispatch boundaries

### Alpha 4
- WLED Engine v3
- Shadow/live modes
- Trigger ranges and board filters
- Serial request queue and timeout
- Legacy WLED config discovery/import

## Next

### Alpha 5 — Sound FX Engine v3
- Single audio service
- Event-to-sound mapping
- Preload/cache
- Volume and mute controls
- Anti-overlap / queue policy
- Shadow mode during legacy coexistence
- Diagnostics

### Alpha 6 — Caller Engine v3
- Semantic caller events
- Voice provider abstraction
- Local/cache-first playback
- Cancellation and priority policy
- Checkout / bust / game / match announcements

## Migration rule

A legacy watcher is disabled only after its v3 replacement has passed real-match testing.

## Status 2026-10-02 (Ergänzung, historische Abschnitte oben unverändert)

Die Abschnitte „Completed" und „Next" stammen vom 2026-08-08 und wurden nicht
erneut gegen den Code geprüft. Verifizierter Projektstand auf `main`, HEAD
`7688352`:

- Setup 2.0: Entwicklungs-/Agent-Setup bis Paket D8 committet; Referenz:
  `docs/SETUP_2_0_DEV_AGENT_SETUP.md`.
- Gatekeeper (`yarn gate`, Commit `fa9b9f3`) vorhanden; Gate 8/8 PASS unter
  Node v22.23.2 (Commit `7688352`).
- Lifecycle-Härtung (Commit `7688352`): Next-Player-on-Take-Out-Stuck und
  Discord (Webhooks/Stream), inkl. neuem Verhaltenstest für Next-Player.
- Offen, nicht live-abhängig: TEMP-DIAG-Bereinigung, Protected-Core-Erzwingung
  (Entscheidung), MCP-Konsolidierung, WebSocket-Auto-Resync, Multi-Tab-Schutz, Out-of-Order-Event-Test,
  Dokumentations-/Push-Entscheidungen.
- Abgeschlossen (2026-10-02): Gate-Paket `lifecycle-fixes-20261002b` CLOSED; claude-mem-
  Setup-Blocker CLOSED (Belege: `MASTER_AUTODARTS_ELITE.md` Abschnitt 20).
- Deferred: Full Statistics / CMR v2, Solo Challenges (teilweise), Party/Lobby.
- Human Live QA: DEFERRED; kein Release-Gate bestanden.

## Status 2026-10-03 (Ergänzung, HEAD `1b65b55`)

Der Block „Status 2026-10-02" oben (HEAD `7688352`, Alt-Hash, heute `12279ff`) ist historisch und in
folgenden Punkten überholt. Details: `MASTER_AUTODARTS_ELITE.md` Abschnitt 21.

- **CURRENT_VERIFIED:** HEAD = `origin/main` = `1b65b55`, 0/0 (gepusht). GitHub-CI `pr-control-center` auf `main` für `1b65b55`: `success`. `core-guard range origin/main..HEAD`: Exit 0. Remote-Tags: 0.
- **P40 (ELO-Consent):** IMPLEMENTED, PUSHED, POST_PUSH_VERIFIED, ORIGIN_MAIN_SYNCHRONIZED (`79a5034`, Doku `8d79d04`, Consent-Host-Bindung `1b65b55`).
- **Erledigt seit 2026-10-02:** PKG-1 (WebSocket-Characterization-Tests, `a9d6a3a`), PKG-7 (Protected-Core-Erzwingung, siehe `docs/PROTECTED_CORE_ENFORCEMENT.md`), Discord-Teardown-Härtung (`5fc8cde`, `524a74d`).
- **HISTORICAL_VERIFIED_NOT_RERUN_ON_1b65b55:** Gate 8/8, Tests 531/531, Components 90/90, Firefox-/Chrome-Build, `vue-tsc`.
- **OPEN:** CURRENT-HEAD RE-VERIFICATION; TEMP-DIAG-Bereinigung (Core-Block BLOCKED ohne Freigabe); MCP-Konsolidierung; WebSocket-Auto-Resync; Multi-Tab-Schutz; Branch-Protection; Herkunft `.ruvector/`/`ruvector.db`.
- **OPEN_DECISION:** Autor-Identität `du@example.com` (121 Commits, gepusht).
- **BLOCKED:** Human Live QA / Release-Gate (Hardware).
