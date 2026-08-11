# Autodarts Tools v2.9.98 — Reference Baseline

This directory is reserved for the verified Firefox v2.9.98 baseline supplied as `FIREFOX-autodarts-tools-v2.9.98.xpi`.

## Policy

- Treat v2.9.98 as the stable reference for optimization work.
- Do not rewrite working features without a measured or testable benefit.
- Changes should be isolated, reviewed, and regression-tested.
- The previous v3 work remains preserved separately as prototype/research work.

## Optimization order

1. Gate debug logging without functional changes.
2. Introduce a v2-compatible semantic match event bus incrementally.
3. Migrate only selected GameData watchers first and measure behavior.
4. Harden listener/observer cleanup.
5. Consolidate audio caching/deduplication where proven useful.
6. Optimize WLED only where measurements or reproducible issues justify it.
7. Build an XPI and validate with a real 501 match.

## Source artifact

The authoritative source artifact for this baseline is the user-supplied Firefox XPI. Binary assets and the complete extracted artifact must be preserved byte-for-byte when imported; this marker commit does not claim that the full XPI payload has already been mirrored into GitHub.
