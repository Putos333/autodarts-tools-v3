# Autodarts Tools v3

Private development repository for the modular Autodarts Tools v3 rewrite.

## Current baseline

**v3.0.0 Alpha 4**

The v2.9.98 extension remains the compatibility layer while v3 modules are migrated one by one.

### Implemented v3 foundation

- Core module registry and lifecycle
- Central event bus
- WebSocket core
- Semantic match engine
- Feature dispatcher
- Performance diagnostics
- Compatibility bridge
- WLED Engine v3 (safe shadow mode by default)

## Roadmap

1. Alpha 5 — Sound FX Engine v3
2. Alpha 6 — Caller Engine v3
3. Controlled removal of replaced legacy watchers
4. Training / League / AI / UI modularization
5. Automated tests and Firefox packaging
6. Beta and stable v3.0

## Safety strategy

Legacy functionality is not removed until its v3 replacement has been tested. New hardware-facing modules start in a non-destructive/shadow mode where practical.

> This repository is currently under active development and is not a stable release.
