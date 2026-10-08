# Lokales Preview-System

Erzeugt echte Screenshots der gebauten Extension (Control Center) in Desktop und Mobil, eine `SUMMARY.md` und einen Pixelvergleich mit dem vorherigen Lauf. Rein lokal, ohne zusätzliche Abhängigkeiten.

```bash
yarn preview                      # baut, nimmt auf, vergleicht mit dem vorherigen Lauf
yarn preview --fast-build         # Build per `wxt build` (wie CI, ohne preflight compile + test)
yarn preview --no-build           # vorhandenen Build verwenden (Aktualität nicht geprüft)
yarn preview --with-tests         # zusätzlich compile, test, test:lifecycle, test:components
yarn preview --e2e                # zusätzlich Playwright E2E (lang)
yarn preview --compare <ordner>   # gegen einen bestimmten früheren Lauf vergleichen
```

Ergebnisse liegen unter `docs/preview/<YYYYMMDD>-<sha>[-dirty][-n]/` (git-ignoriert; nur diese README und `.gitignore` sind versioniert):

- `screens/` – echte Screenshots (`<bereich>-<ansicht>-<breite>x<höhe>.png`)
- `diff/` – Pixel-Diffs gegen den Vergleichsstand (nur bei Abweichungen)
- `SUMMARY.md` / `summary.json` – Status, Bildliste, Vorher/Nachher, offene Risiken, Commit-SHA

Hinweise: Zustand ist der leere Standardzustand (keine Daten injiziert); der einzige externe Aufruf der Seite wird auf 404 gestubbt. Ohne `$DISPLAY` startet sich das Skript selbst unter `xvfb-run`. Ein vorhandener Ordner wird nie überschrieben (Suffix `-2`, `-3`, …). Die Risikoliste stammt aus `docs/OPEN_RISKS.md`.

CI: Der Job „Preview Screenshots“ in `.github/workflows/pr-control-center.yml` führt `yarn preview --fast-build` aus und lädt `docs/preview/` als Artefakt `preview-<sha>` hoch (14 Tage). Er ist kein Pflicht-Check. In CI gibt es keinen Vorgängerlauf; der Vergleich ist dort „Ausgangsstand“. Für einen Vergleich das Artefakt eines früheren Laufs entpacken und lokal `--compare <ordner>` nutzen.
