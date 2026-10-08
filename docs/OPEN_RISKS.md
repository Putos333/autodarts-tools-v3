# Offene Risiken (Stand 2026-10-08)

Quelle: Review-, Test- und Preview-Läufe zu Runtime Hardening R2 und zum Preview-System. Wird vom Preview-System (`yarn preview`) in die `SUMMARY.md` übernommen. Bei jeder größeren Bauphase aktualisieren.

| Risiko | Einschätzung | Status |
|---|---|---|
| Live-QA für den R2-Resync (Reconnect mit echter Verbindung, Timeout-Verhalten) | nicht offline prüfbar | AUSSTEHEND |
| Ein `apply` über 15 s (Queue-Timeout `MESSAGE_TASK_TIMEOUT_MS`) kann einen älteren Resync-Snapshot nach einer Live-Nachricht schreiben; Schreibpfad liegt im Protected Core (`utils/websocket-helpers.ts`) | geringes Risiko (Randfall), nur im Offline-Test auf dem Branch `test/r2-offline-restpunkte` reproduziert (Test P3-4) | OFFEN, Entscheidung nötig |
| Der 15-s-Randfall wurde nicht gegen `main` verifiziert: Die Reproduktion setzt den Timeout-Fix aus PR #32 voraus, der noch nicht in `main` ist | Aussage gilt für den Stand von PR #32, nicht belegt für `main` | NICHT VERIFIZIERT (`main`) |
| Preview-Screenshots zeigen nur den leeren Standardzustand (kein Datenseed; ein Seed in geschützten Bereichen ist nicht freigegeben) | Aussagekraft begrenzt, Pixelvergleich erkennt nur UI-Änderungen am Leerzustand | OFFEN |
| Der CI-Job „Preview Screenshots“ ist nur lokal auf Syntax und Workflow-Regeln geprüft, auf GitHub noch nicht gelaufen (kein Push) | Fehler beim ersten CI-Lauf möglich (Browser-Cache, Schriften, xvfb) | NICHT VERIFIZIERT (CI) |
| In CI gibt es keinen Vorgängerlauf für den Pixelvergleich | Vergleich dort nur „Ausgangsstand“; lokal per `--compare` | OFFEN |
| Lokales Gate `scripts/gate.mjs run` ist durch den Node-Guard blockiert (erwartet Node 22, lokal Node 24); Gates werden einzeln ausgeführt | bekannt, kein Defekt dieser Änderung | BEKANNT |
