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
  (Entscheidung), MCP-Konsolidierung, claude-mem-Neusession-Messung,
  WebSocket-Auto-Resync, Multi-Tab-Schutz, Out-of-Order-Event-Test,
  Dokumentations-/Push-Entscheidungen.
- Deferred: Full Statistics / CMR v2, Solo Challenges (teilweise), Party/Lobby.
- Human Live QA: DEFERRED; kein Release-Gate bestanden.
