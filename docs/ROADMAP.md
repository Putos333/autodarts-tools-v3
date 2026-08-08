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
