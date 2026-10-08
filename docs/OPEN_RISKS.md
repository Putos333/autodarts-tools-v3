# Offene Risiken (Stand 2026-10-08, nach Merge von PR #32 und #33)

Quelle: Review-, Test- und Preview-Läufe zu Runtime Hardening R2 und zum Preview-System. Wird vom Preview-System (`yarn preview`) in die `SUMMARY.md` übernommen. Bei jeder größeren Bauphase aktualisieren.

| Risiko | Einschätzung | Status |
|---|---|---|
| Live-QA für den R2-Resync (Reconnect mit echter Verbindung, Timeout-Verhalten) | nicht offline prüfbar | AUSSTEHEND |
| Ein `apply` über 15 s (Queue-Timeout `MESSAGE_TASK_TIMEOUT_MS`) kann einen älteren Resync-Snapshot nach einer Live-Nachricht schreiben; Schreibpfad liegt im Protected Core (`utils/websocket-helpers.ts`) | geringes Risiko (Randfall); als Charakterisierungstest P3-4 (`tests/components/r2-offline-restpunkte.component.test.ts`) auf `main` (`fc3a046`) reproduziert: Ergebnis `[5, 4]` | BEKANNTER FEHLER, OFFEN, Entscheidung nötig (Protected-Core-Freigabe) |
| Der 15-s-Randfall gegen `main` | Test P3-4 läuft auf `main` nach Merge von PR #32 und bestätigt das Verhalten offline | OFFLINE VERIFIZIERT (live nicht) |
| Preview-Screenshots zeigen nur den leeren Standardzustand (kein Datenseed; ein Seed in geschützten Bereichen ist nicht freigegeben) | Aussagekraft begrenzt, Pixelvergleich erkennt nur UI-Änderungen am Leerzustand | OFFEN |
| Der CI-Job „Preview Screenshots“ | läuft seit PR #33 grün auf PR und auf `main` (Lauf 37764177037); Artefakt-Inhalt am PR geprüft: 18 Screenshots plus Summary | ERLEDIGT |
| In CI gibt es keinen Vorgängerlauf für den Pixelvergleich | Vergleich dort nur „Ausgangsstand“; lokal per `--compare` | OFFEN |
| Lokales Gate `scripts/gate.mjs run` ist durch den Node-Guard blockiert (erwartet Node 22, lokal Node 24); Gates werden einzeln ausgeführt | bekannt, kein Defekt dieser Änderung | BEKANNT |
