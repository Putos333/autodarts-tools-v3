# Datenschutzerklärung — Tools for Autodarts

_Stand: 23. Juli 2026 · Version 2.9.87_

## Kurzfassung

**Tools for Autodarts erhebt keine personenbezogenen Daten und sendet
keine Telemetrie an Dritte.** Die Extension arbeitet ausschließlich lokal
im Browser des Nutzers und kommuniziert, abgesehen von einer
Statusabfrage (siehe Abschnitt 3), nur mit ausdrücklich vom Nutzer
aktivierten bzw. – beim ELO-Ladder – ausdrücklich zugestimmten Diensten.

## Welche Daten werden verarbeitet?

### 1. Lokal im Browser (browser.storage.local)

Nur im Browser des Nutzers gespeichert, niemals an externe Server gesendet:

- **Einstellungen** aller Extension-Features (Caller, Crowd, Animationen,
  Karriere-Fortschritt, Turnier-Modus etc.).
- **Karriere-Daten**: Preisgeld, absolvierte Turniere, Match-Historie,
  180er-Zähler, Highest-Checkout — reine Fortschritts-Statistik.
- **Anpassungen**: Bot-Umbenennungen, Skin-Auswahl, Sponsor-Fortschritt.

Diese Daten können jederzeit im Toolbar-Popup exportiert (JSON-Backup),
importiert oder durch Deinstallation der Extension vollständig gelöscht
werden.

### 2. Kommunikation mit play.autodarts.io (Nutzer-initiiert)

Die Extension liest ausschließlich auf den Seiten von
**play.autodarts.io** DOM-Inhalte und WebSocket-Nachrichten aus, um
Features wie Caller-Aussagen, Crowd-Reaktionen und Karriere-Auswertung
zu ermöglichen. Es findet keine Weitergabe dieser Daten statt.

### 3. Optionale externe Dienste (Opt-In)

Die folgenden Dienste sind **standardmäßig deaktiviert** und werden erst
nach expliziter Aktivierung durch den Nutzer verwendet:

| Dienst | Wofür | Welche Daten |
|--------|-------|--------------|
| AI-Kommentator | Live-Kommentar (Claude Sonnet, via Emergent-LLM-Proxy) | Spielstand + Wurf-Werte (anonym) |
| ELO-Ladder | Optionale globale Rangliste (nur nach ausdrücklicher Zustimmung, siehe unten) | Zufällige Kennung (UUID), Anzeigename, Ergebnis (Sieg/Niederlage), Average, Anzahl 180er, höchstes Finish |
| Marathon-Leaderboard | Optionale Speedrun-Rangliste | Turnier-Zeit + gewählter Anzeigename |
| Face-to-Face WebRTC | Peer-to-Peer Video-Chat mit Freunden | Video/Audio-Stream direkt zum Peer (nicht gespeichert) |
| Discord-Webhook | Match-Ankündigungen | Nur die von *dir* konfigurierte Webhook-URL wird verwendet |

**Keine dieser Verbindungen wird aufgebaut, solange die entsprechende
Funktion nicht ausdrücklich aktiviert wurde.**

**ELO-Ladder – Zustimmung:** Ohne ausdrückliche Zustimmung im ELO-Bereich
der Einstellungen findet keine ELO-Übertragung statt: weder das Senden von
Ergebnissen noch der Abruf von Rangliste oder eigenem Rang (bei diesem Abruf
wird die zufällige Kennung übermittelt). Solange keine Entscheidung
getroffen wurde – auch nach Schließen des Dialogs ohne Auswahl – und nach
einer Ablehnung wird nichts übertragen. Ein aktivierter Schalter für das
automatische Senden nach Match-Ende gilt allein nicht als Zustimmung. Die
Entscheidung wird lokal im Browser gespeichert und kann im ELO-Bereich
jederzeit geändert oder widerrufen werden. Der Marathon-Modus ist davon
getrennt und nicht Bestandteil dieser Zustimmung.

**Statusabfrage:** Beim Öffnen des Toolbar-Popups und des Control Centers
sendet die Extension unabhängig von den oben genannten Diensten eine
Statusabfrage (`GET /api/marathon/health`) an den konfigurierten
Backend-Host, um dessen Erreichbarkeit anzuzeigen. Die Anfrage hat weder
einen Body noch Parameter.

## Werden Daten mit Dritten geteilt?

**Nein.** Die Extension enthält:

- ❌ **kein Tracking / Analytics** (kein Google Analytics, Amplitude, Mixpanel usw.)
- ❌ **keine Werbe-Frameworks**
- ❌ **keinen Fingerprinting-Code**
- ❌ **keinen Verkauf von Nutzerdaten**

Kommunikation mit den unter Punkt 3 genannten Emergent-Backend-Endpoints
(`*.emergent.host` bzw. `*.preview.emergentagent.com`) erfolgt für die vom
Nutzer aktivierten bzw. genutzten Features (ELO-Ladder nur nach Zustimmung,
siehe Punkt 3) sowie für die dort beschriebene Statusabfrage.

## Rechtsgrundlagen (DSGVO Art. 6)

- **Art. 6 Abs. 1 lit. a (Einwilligung)** für alle Opt-In-Features
  (AI-Kommentator, ELO-Ladder, Marathon-Board, Face-to-Face, Discord).
- **Art. 6 Abs. 1 lit. f (berechtigtes Interesse)** für die reine
  In-Browser-Verarbeitung von Autodarts-Match-Daten zur Bereitstellung
  der Kern-Features.

## Kontakt

Fragen zur Datenverarbeitung:  
**E-Mail:** support@autodarts-tools.emergent.host  
**Projekt:** https://autodarts-tools.emergent.host  
**Code (Open Source):** https://github.com/…/autodarts-tools

## Änderungen

Diese Erklärung kann bei neuen Features aktualisiert werden. Die jeweils
aktuelle Fassung findet sich unter:  
**https://autodarts-tools.emergent.host/privacy**

_Wenn wesentliche neue Datenverarbeitungen hinzukommen, wird der User im
Toolbar-Popup einmalig informiert._
