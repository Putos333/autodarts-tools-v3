# Autodarts Tools V3 – Runtime Test

Diese Anleitung ist für jeden verständlich, auch ohne Programmier-Kenntnisse.
Du brauchst: einen Computer mit Firefox, ein Autodarts-Board (oder Zugriff auf
einen bestehenden Autodarts-Account mit Boardsimulator), und etwas Zeit.

Gehe die Tests der Reihe nach durch. Bei jedem Test steht:

- **VORAUSSETZUNG** – was vorher erledigt sein muss
- **AKTION** – was du klickst/tust
- **ERWARTET** – was danach passieren sollte
- **FEHLERBILD** – wie es aussieht, wenn etwas nicht funktioniert
- **WAS NOTIEREN** – was du aufschreiben sollst, wenn etwas schiefgeht (am besten mit Screenshot)

Wenn ein Test fehlschlägt: mach trotzdem mit dem nächsten Test weiter und
notiere den Fehler. Am Ende hast du eine Liste aller echten Probleme.

---

## Vorbereitung

1. Öffne Firefox.
2. Rufe `about:debugging#/runtime/this-firefox` auf.
3. Klicke auf "Temporäres Add-on laden…" und wähle die Datei
   `.output/firefox-mv2/manifest.json` aus diesem Projekt-Ordner.
4. Öffne die Browser-Konsole (Taste `F12` → Tab "Konsole"), damit du bei
   Bedarf rote Fehlermeldungen siehst. Du musst sie nicht verstehen — nur
   ein Foto/Screenshot davon machen, falls etwas rot erscheint.

## Extension laden

**VORAUSSETZUNG:** Firefox ist offen, das Add-on wurde wie oben geladen.
**AKTION:** Klicke auf das Erweiterungs-Symbol oben rechts in Firefox.
**ERWARTET:** Das Autodarts-Tools-Icon erscheint in der Symbolleiste.
**FEHLERBILD:** Icon fehlt, oder Firefox zeigt eine Fehlermeldung beim Laden.
**WAS NOTIEREN:** Screenshot der Fehlermeldung, falls vorhanden.

## Control Center öffnen

**VORAUSSETZUNG:** Extension ist geladen, du bist auf `play.autodarts.io`
eingeloggt.
**AKTION:** Öffne einen neuen Tab und rufe die Control-Center-Seite der
Extension auf (über das Erweiterungsmenü oder die im Popup angezeigte URL).
**ERWARTET:** Das Dashboard lädt, zeigt Verbindungsstatus, Board-Status usw.
**FEHLERBILD:** Weiße/leere Seite, Ladebalken hängt endlos, Konsole zeigt rote
Fehler.
**WAS NOTIEREN:** Screenshot + Konsolen-Fehler.

---

## Test A — Board Connection

**VORAUSSETZUNG:** Board ist eingeschaltet und mit Autodarts verbunden.
**AKTION:** Öffne das Control Center, schaue auf die Board-Karte.
**ERWARTET:** Board wird als "verbunden" angezeigt, Board-Name/-Status stimmt.
**FEHLERBILD:** Board zeigt "getrennt", obwohl es verbunden ist (oder umgekehrt).
**WAS NOTIEREN:** Was die Karte anzeigt vs. was tatsächlich der Fall ist.

## Test B — Normal Match

**VORAUSSETZUNG:** Board verbunden, kein Match aktiv.
**AKTION:** Starte ein normales X01-Match (z. B. 501) auf play.autodarts.io.
**ERWARTET:** Match-Ansicht/Overlay im Extension-UI zeigt Spielername, Score,
aktueller Spieler korrekt an, kurz nach Matchstart.
**FEHLERBILD:** Overlay bleibt leer, zeigt falschen Spieler, oder Score ist 0
obwohl das Match läuft.
**WAS NOTIEREN:** Was angezeigt wird vs. was das echte Match zeigt.

## Test C — Three Throws

**VORAUSSETZUNG:** Match läuft (siehe Test B).
**AKTION:** Wirf 3 Darts nacheinander (normale Camera-Erkennung abwarten).
**ERWARTET:** Nach jedem Dart aktualisiert sich der angezeigte Score in
Echtzeit (kein Rückstand von mehreren Sekunden, keine falschen Zahlen).
**FEHLERBILD:** Score aktualisiert sich verzögert, springt auf falsche Werte,
oder ein Dart "verschwindet" (wird nicht gezählt).
**WAS NOTIEREN:** Welcher Dart betroffen war, welcher Score angezeigt wurde.

## Test D — 140+

**VORAUSSETZUNG:** Match läuft, Trainings-Modus optional aktiviert
(Einstellungen → Training).
**AKTION:** Wirf drei Darts, die zusammen ≥140 Punkte ergeben (z. B. Treble 20,
Treble 20, Doppel 20 oder ähnlich).
**ERWARTET:** Falls Trainings-Overlay aktiv: 140+-Zähler erhöht sich um 1.
Falls Sound-FX/Caller aktiv: entsprechende Ansage/Sound (falls konfiguriert).
**FEHLERBILD:** Zähler erhöht sich nicht, erhöht sich um einen falschen Betrag,
oder Sound spielt gar nicht/mehrfach.
**WAS NOTIEREN:** Angezeigter Zählerstand vor/nach dem Wurf.

## Test E — 180

**VORAUSSETZUNG:** Match läuft, Trainings-Modus optional aktiviert.
**AKTION:** Wirf ein 180er (3× Treble 20).
**ERWARTET:** 180-Zähler (Training-Overlay bzw. Match-Card) erhöht sich um 1.
Falls Crowd-Sounds aktiv: 180-Sound/Ansage spielt.
**FEHLERBILD:** Zähler bleibt gleich, oder Sound spielt nicht/verzögert.
**WAS NOTIEREN:** Zählerstand vor/nach dem Wurf, ob Sound abgespielt wurde.

## Test F — Checkout

**VORAUSSETZUNG:** Match läuft, du bist nah am Leg-Ende (Restscore ≤ 170,
idealerweise ein glattes Finish wie 40 oder 32).
**AKTION:** Spiele das Leg zu Ende (erfolgreicher Doppel-Checkout).
**ERWARTET:** Leg endet korrekt, Checkout-Punktzahl wird im Overlay/History
später korrekt als "Bester Checkout" angezeigt (nicht als Prozentwert).
**FEHLERBILD:** Leg endet nicht, obwohl Checkout getroffen wurde; falscher
Checkout-Wert wird angezeigt.
**WAS NOTIEREN:** Tatsächlich geworfener Checkout-Wert vs. angezeigter Wert.

## Test G — Checkout Miss

**VORAUSSETZUNG:** Match läuft, Trainings-Modus aktiv mit sichtbarem
"Checkout-Fehlversuche"-Ziel.
**AKTION:** Wirf gezielt einen Doppel-Versuch, der danebengeht (Checkout nicht
getroffen, Leg läuft weiter).
**ERWARTET:** "Checkout-Fehlversuche"-Zähler im Training-Overlay erhöht sich.
**FEHLERBILD:** Zähler erhöht sich nicht, oder erhöht sich bei jedem Wurf
(nicht nur bei verpassten Doppeln).
**WAS NOTIEREN:** ⚠️ Dieser Wert ist aktuell nur eine Annäherung
(`Checkout-Versuche minus getroffene Checkouts`, kein direktes Autodarts-Feld
dafür). Notiere genau: wie viele Doppel-Versuche insgesamt, wie viele davon
verpasst, und was die Extension anzeigt — das ist der wichtigste Test, um zu
prüfen, ob diese Annäherung in der Praxis stimmt oder nicht.

## Test H — Undo

**VORAUSSETZUNG:** Match läuft, mindestens ein Dart wurde geworfen.
**AKTION:** Nutze die "Undo"/Korrektur-Funktion in Autodarts selbst (nicht in
der Extension), um den letzten Wurf rückgängig zu machen.
**ERWARTET:** Score in der Extension-Anzeige aktualisiert sich auf den
Zustand vor dem rückgängig gemachten Wurf.
**FEHLERBILD:** Extension zeigt weiterhin den alten (falschen) Score, obwohl
Autodarts selbst schon den korrigierten Stand zeigt.
**WAS NOTIEREN:** Wie lange es dauert, bis die Extension nachzieht (Sekunden),
und ob sie am Ende überhaupt nachzieht.

## Test I — Correction

**VORAUSSETZUNG:** Match läuft.
**AKTION:** Nutze die Autodarts-eigene Korrektur-Funktion, um einen Wurf
manuell auf einen anderen Wert zu ändern (z. B. Treble 20 → Single 20).
**ERWARTET:** Extension übernimmt den korrigierten Wert im Live-Overlay und
später auch im Verlauf (Match History).
**FEHLERBILD:** Extension zeigt weiterhin den alten, falschen Wert — auch
nach mehreren Sekunden.
**WAS NOTIEREN:** Alter Wert, korrigierter Wert, was die Extension zeigt
(sofort und nach 10/30 Sekunden).

## Test J — Leg End

**VORAUSSETZUNG:** Match mit mehreren Legs (z. B. Best of 3 Legs).
**AKTION:** Spiele ein Leg zu Ende.
**ERWARTET:** Leg-Zähler erhöht sich korrekt, nächstes Leg startet sauber,
alte Wurf-Historie wird nicht mit dem neuen Leg vermischt.
**FEHLERBILD:** Leg-Zähler falsch, Score aus dem alten Leg "hängt" im neuen
Leg noch kurz nach.
**WAS NOTIEREN:** Was genau falsch/verzögert angezeigt wurde.

## Test K — Match End

**VORAUSSETZUNG:** Match kurz vor dem Ende (letztes Leg/Set).
**AKTION:** Beende das Match komplett (Gewinner steht fest).
**ERWARTET:** Sieger wird korrekt angezeigt, Match verschwindet aus der
"aktives Match"-Anzeige, Ergebnis erscheint kurz danach im Verlauf
(Match History, siehe Test N).
**FEHLERBILD:** Falscher Sieger, Match bleibt als "aktiv" stehen, kein
Verlaufs-Eintrag erscheint.
**WAS NOTIEREN:** Angezeigter Sieger vs. echter Sieger, ob/wann der
Verlaufs-Eintrag erscheint.

## Test L — Training Summary

**VORAUSSETZUNG:** Trainings-Modus aktiviert (Einstellungen → Training →
Ziele gesetzt, "Auswertung nach dem Match einblenden" angehakt).
**AKTION:** Spiele ein komplettes Match zu Ende, während Trainings-Modus
aktiv ist.
**ERWARTET:** Nach Matchende erscheint eine Zusammenfassung mit Average,
140+, 180er, Checkout-Rate — mit **echten, plausiblen Werten** (nicht 0,
nicht "NaN").
**FEHLERBILD:** Zusammenfassung erscheint gar nicht, oder zeigt 0/NaN bei
Werten, obwohl du z. B. tatsächlich Average > 0 gespielt hast.
**WAS NOTIEREN:** ⚠️ Wichtigster Test dieser Runde — vergleiche jeden
angezeigten Wert (Average, 140+, 180er, Checkout-Rate) mit dem, was
Autodarts selbst für dieses Match anzeigt.

## Test M — Training History

**VORAUSSETZUNG:** Test L wurde mindestens einmal erfolgreich durchgeführt.
**AKTION:** Öffne Einstellungen → Training → Tab "Verlauf". Klicke
"Aktualisieren".
**ERWARTET:** Der gerade gespielte Trainings-Durchlauf erscheint als neuer
Eintrag oben in der Liste, mit denselben Werten wie in Test L.
**FEHLERBILD:** Liste bleibt leer, zeigt eine Fehlermeldung, oder die Werte
weichen von der Zusammenfassung aus Test L ab.
**WAS NOTIEREN:** Ob der Eintrag erscheint, und ob die Zahlen mit Test L
übereinstimmen.

## Test N — Match History

**VORAUSSETZUNG:** Mindestens ein komplettes Match wurde gespielt (Test K).
**AKTION:** Öffne Control Center → Verlauf.
**ERWARTET:** Das Match erscheint oben in der Liste (neueste zuerst), mit
korrektem Gegner, Sieger, Modus, Legs/Sets, Average.
**FEHLERBILD:** Match fehlt, erscheint doppelt, oder zeigt falsche/vertauschte
Spieler.
**WAS NOTIEREN:** Was fehlt oder falsch ist, mit Screenshot.

## Test O — Reload During Match

**VORAUSSETZUNG:** Match läuft, mindestens 3 Darts geworfen.
**AKTION:** Drücke `F5` (Seite neu laden) mitten im laufenden Match.
**ERWARTET:** Nach dem Neuladen zeigt die Extension wieder den korrekten,
aktuellen Match-Stand (nicht den Stand von vor dem Reload).
**FEHLERBILD:** Alter/leerer Zustand bleibt stehen, Match wird als "beendet"
oder "kein Match" angezeigt, obwohl es weiterläuft.
**WAS NOTIEREN:** Was direkt nach dem Reload angezeigt wird, und wie lange es
dauert, bis der korrekte Stand erscheint (falls überhaupt).

## Test P — WebSocket Reconnect

**VORAUSSETZUNG:** Match läuft.
**AKTION:** Trenne kurz die Internetverbindung (WLAN aus/ein, oder Kabel
ziehen) für ca. 10 Sekunden, dann wieder verbinden.
**ERWARTET:** Extension zeigt einen Hinweis auf die Verbindungsunterbrechung.
Nach Wiederverbindung sollte der Match-Stand sich von selbst aktualisieren
ODER die Extension zeigt klar einen Hinweis "bitte neu laden".
**FEHLERBILD:** Keine Rückmeldung über die Trennung, Extension zeigt
stillschweigend einen veralteten Stand, ohne Hinweis.
**WAS NOTIEREN:** ⚠️ Bekannte Schwachstelle — es gibt aktuell keine
automatische Wiederverbindungs-Logik, nur einen manuellen "Seite neu
laden"-Hinweis. Notiere genau, ob dieser Hinweis erscheint und ob er
funktioniert.

## Test Q — Two Autodarts Tabs

**VORAUSSETZUNG:** Ein Match läuft in Tab A.
**AKTION:** Öffne einen zweiten Tab (Tab B), navigiere dort zu einer Lobby
oder einer anderen Autodarts-Seite (nicht das laufende Match). Schau dann in
Tab A und im Control Center nach, ob sich am Match-Status etwas geändert hat.
**ERWARTET:** Tab A zeigt weiterhin den korrekten Match-Stand. Control Center
kann höchstens den direkten "Match öffnen"-Link vorübergehend verlieren,
darf aber niemals einen falschen/fremden Match anzeigen.
**FEHLERBILD:** Tab A verliert den Match-Stand, oder Control Center zeigt
plötzlich Daten aus Tab B statt aus Tab A.
**WAS NOTIEREN:** ⚠️ Bekannte Schwachstelle (mehrere Tabs teilen sich
Speicher). Notiere genau, was in Tab A und im Control Center jeweils
angezeigt wird, bevor und nachdem Tab B navigiert.

## Test R — Control Center Reload

**VORAUSSETZUNG:** Match läuft in einem Autodarts-Tab, Control Center ist in
einem anderen Tab offen.
**AKTION:** Lade den Control-Center-Tab neu (`F5`).
**ERWARTET:** Control Center zeigt nach dem Neuladen wieder den korrekten,
aktuellen Zustand (Board, Match, Lobby) — ohne dass du im Autodarts-Tab
etwas tun musst.
**FEHLERBILD:** Control Center bleibt leer/lädt endlos, oder zeigt veraltete
Daten.
**WAS NOTIEREN:** Was angezeigt wird, wie lange es dauert.

## Test S — Browser Restart/Persistence

**VORAUSSETZUNG:** Mindestens ein Match wurde gespielt und ist im Verlauf
sichtbar (Test N), mindestens eine Trainingseinheit im Trainings-Verlauf
(Test M).
**AKTION:** Schließe Firefox komplett und starte es neu. Lade die Extension
ggf. erneut über `about:debugging` (temporäre Add-ons gehen beim
Firefox-Neustart verloren — das ist normal für diesen Test-Modus, kein
Extension-Fehler). Öffne Control Center → Verlauf und Einstellungen →
Training → Verlauf.
**ERWARTET:** Alle vorher gesehenen Match- und Trainings-Verlaufseinträge
sind weiterhin vorhanden.
**FEHLERBILD:** Verlauf ist leer, obwohl vorher Einträge da waren.
**WAS NOTIEREN:** Welche Einträge fehlen.

---

## Nach dem Testen

Fasse alle notierten Fehler in einer kurzen Liste zusammen (Test-Buchstabe +
was schiefging + Screenshot, falls vorhanden) und gib sie zurück an die
Entwicklung. Tests ohne Auffälligkeiten musst du nicht extra erwähnen — nur
die, bei denen etwas vom "ERWARTET"-Verhalten abgewichen ist.
