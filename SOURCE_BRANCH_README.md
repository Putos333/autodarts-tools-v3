# Source Branch – Autodarts Tools v2.9.98

Dieser Branch enthält den **vollständigen TypeScript-Quellcode** der Firefox-
Extension `Tools for Autodarts` in der Version **2.9.98**. Er dient als
**Entwicklungsbasis** und ist so aufgebaut, dass sich daraus die
XPI-Datei **reproduzierbar** neu bauen lässt.

## Beziehung zu anderen Branches

| Branch | Zweck | Inhalt |
|---|---|---|
| `baseline/v2.9.98` | **UNVERÄNDERT** — Referenz-Build-Artefakte | Nur kompiliertes Output (`manifest.json`, `background.js`, `content-scripts/*`, …) |
| `source/v2.9.98` | **Read-only Tag-artig** — dieser Branch | Vollständiger TS/Vue-Quellcode |
| `develop` | Aktive Entwicklung | Wird von `source/v2.9.98` abgezweigt |
| `main` | v3-Skelett (früherer Experiment-Rewrite) | Wird von uns aktuell nicht verändert |

## Voraussetzungen (lokaler Build)

- **Node.js 22** (siehe `.nvmrc`) oder mindestens Node 20 LTS
- **Yarn 1.22+** (Yarn Classic, siehe `packageManager` in `package.json`)

## Reproduzierbarer Build

```bash
yarn install --frozen-lockfile
yarn zip:firefox
```

**Output:**
- `.output/autodarts-tools-2.9.98-firefox.zip` – das eigentliche XPI (~1,59 MB)
- `.output/autodarts-tools-2.9.98-sources.zip` – Sourcen-Bundle für AMO-Reviewer

**Verifizierung gegen `baseline/v2.9.98`:** Die folgenden Datei-Größen aus
dem entstehenden `firefox-mv2/`-Ordner müssen exakt mit denen im Branch
`baseline/v2.9.98` übereinstimmen (byte-identisch getestet am 2026-02):

| Datei | Größe |
|---|---|
| `manifest.json` | 1310 B |
| `background.js` | 17097 B |
| `auth-cookie.js` | 2370 B |
| `websocket-capture.js` | 2585 B |
| `socket.io.min.js` | 46830 B |
| `popup.html` | 379 B |

Content-Script- und Chunk-Größen sind ebenfalls deterministisch, sofern
Node-Version, Yarn-Lockfile und WXT-Version identisch bleiben (siehe
`package.json` → `packageManager` und `wxt` Version).

## CI-Build

Der Workflow `.github/workflows/build-firefox.yml` erzeugt bei jedem Push
auf `source/**` oder `develop` automatisch das XPI + Sources-Bundle und
lädt beide als GitHub-Actions-Artefakte hoch (30 Tage Retention). Kein
Apple-Secret erforderlich — läuft rein auf `ubuntu-latest`.

Der bestehende Workflow `release.yml` (iOS/macOS/AltStore, iOS-Signing)
wird durch diesen neuen Workflow **nicht** verändert und läuft weiterhin
nur auf `main` bzw. `tools-2.0.0`.

## Was ist gegenüber der Upstream-Vorlage anders?

Diese Version basiert auf dem Upstream-Fork `creazy231/tools-for-autodarts`
in Version 2.9.98, enthält aber die auf Emergent entwickelten Erweiterungen
(u. a. KI-Duo-Kommentator, ELO-Ladder, Face-to-Face, Board-Themes,
Quick-Menu-FAB, Security-Härtung durch `escapeHtml` in allen
`innerHTML`-Zuweisungen). Siehe `CHANGELOG.md` für Details.

## Sicherheit / Reviewer-Hinweise

Siehe `BUILD_FOR_REVIEWERS.md`.
