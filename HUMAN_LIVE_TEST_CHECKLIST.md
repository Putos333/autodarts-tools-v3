# HUMAN LIVE TEST CHECKLISTE — heute Abend

**Basis:** `PRE_LIVE_SNAPSHOT.md` — HEAD `2707ae9`, Branch `consolidate/final-runtime-2.9.98`
**Artefakt:** `.output/firefox-mv2/` via `about:debugging#/runtime/this-firefox` → „Temporäres Add-on laden" (manifest.json)

Vor dem Start: Firefox-DevTools-Konsole offen halten (F12 → Konsole), während des gesamten Tests auf **neue** Errors achten (nicht auf die bekannten Baseline-Logs).

---

## 1. Normales Match starten/beenden
- [ ] Match von der Autodarts-Lobby aus starten
- [ ] Bull-off durchlaufen lassen (beide Reihenfolgen testen, falls möglich: einmal Spieler 1 beginnt, einmal Spieler 2)
- [ ] Match bis zum Ende durchspielen
- [ ] Winner-Anzeige erscheint korrekt

## 2. Mehrere schnelle Würfe
- [ ] Bewusst schnell hintereinander werfen (<200ms zwischen Snapshots simulieren, z. B. schnelle Dart-Folge)
- [ ] Prüfen: keine übersprungenen Effekte/Ansagen bei schneller Wurffolge (Bezug: WLED/Caller/SoundFx-Fix)

## 3. Spielerwechsel
- [ ] Spielerwechsel innerhalb eines Legs beobachten
- [ ] **Speziell testen:** Match, in dem Spieler 2 (nicht Spieler 1) das Bull-off gewinnt und beginnt → "Game On"-Ansage muss trotzdem kommen (Bezug: ai-commentator-Fix)

## 4. Winner/Match-Ende
- [ ] Match-Ende-Erkennung korrekt (Winner-Overlay, Sound)
- [ ] Falls Share-Card aktiviert: Card erscheint jetzt tatsächlich nach Matchende (Bezug: share-card-Fix, feuerte vorher nie)
- [ ] Falls Liga-Feature mit Share-Code aktiv: Ergebnis wird nach Matchende automatisch übermittelt, Bestätigungs-Toast erscheint (Bezug: liga-api-Fix, feuerte vorher nie)

## 5. Quick Correction
- [ ] Korrektur über Klick auf einen Wurf öffnen, per Ziffernblock/Numpad korrigieren
- [ ] **Speziell testen:** Numpad-Kurzbefehle `/`, `*`, `-` zum Öffnen der Korrektur für Throw 1/2/3 — über MEHRERE Matches hinweg testen (2-3 Matches nacheinander spielen), prüfen ob die Shortcuts weiterhin nur EINMAL pro Tastendruck reagieren (Bezug: Listener-Leak-Fix)

## 6. Caller/SoundFX
- [ ] Ansagen bei 180, Checkout, Bust etc. korrekt und ohne Aussetzer
- [ ] Keine doppelten/überlappenden Ansagen bei schnellen Wurffolgen

## 7. WLED (falls Gerät vorhanden)
- [ ] Lichteffekte reagieren auf Score-Trigger
- [ ] Keine ausgelassenen Effekte bei schneller Wurffolge

## 8. Enhanced Scoring Display
- [ ] Score-Anzeige aktualisiert sich korrekt bei jedem Wurf
- [ ] **Konsole prüfen:** kein Log-Spam mehr bei jedem Tick (nur noch bei tatsächlicher Wurf-/Spielerwechsel-Änderung)

## 9. Control Center
- [ ] Dashboard lädt, zeigt Live-Match-Status
- [ ] Verlauf (History) zeigt abgeschlossene Matches
- [ ] Stats-Ansicht lädt ohne Fehler

## 10. Training
- [ ] Trainingsmodus starten, Übung durchführen
- [ ] Ergebnis wird in Historie gespeichert

## 11. Mobile Navigation
- [ ] Control Center bei schmaler Fensterbreite / auf Mobilgerät öffnen
- [ ] Bottom-Navigation erscheint korrekt, alle Sections erreichbar
- [ ] Live-Match-Widget in der Bottom-Nav sichtbar, falls Match aktiv

## 12. Verhalten bei schnellem Zustandswechsel
- [ ] Schnell zwischen mehreren Matches wechseln (Match verlassen → neues Match starten) und auf hängende/verzögerte Reaktionen achten
- [ ] Seite neu laden während eines laufenden Matches — Status danach korrekt

## 13. Console auf neue Errors prüfen
- [ ] Während des gesamten Tests: DevTools-Konsole im Blick behalten
- [ ] Jeden **neuen, unerwarteten** Error/Stacktrace notieren (Datei, Zeile, Kontext — welche Aktion hat ihn ausgelöst)
- [ ] Bekannte, harmlose Logs (Info-Level `console.log` von Feature-Initialisierungen) sind KEIN Befund

---

## Bei einem gefundenen Problem
1. Kontext notieren: welcher Schritt oben, exakte Aktion, Konsolen-Fehler falls vorhanden
2. **Nicht selbst beheben** während des Live-Tests — Befund sammeln, danach gemeinsam auswerten
3. Geschützten Scoring-Kern und Friends/Party-Bereich weiterhin nicht anfassen ohne expliziten Auftrag
