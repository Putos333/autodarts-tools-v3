# addons.mozilla.org — Listing Content

Copy-paste-fertige Texte für das AMO Developer Portal.

---

## Add-on Name

    Tools for Autodarts

## Summary (max 250 chars, EN)

    Adds voice caller, real crowd sounds, career mode, ELO ladder, social
    share cards, an AI commentator, WebRTC face-to-face video, 6 authentic
    venues and 40+ more features to play.autodarts.io. Fully local by
    default — no tracking.

## Zusammenfassung (max 250 chars, DE)

    Voice-Caller, echte Crowd-Sounds, Karriere-Modus, ELO-Ladder,
    Share-Karten, KI-Kommentator, Face-to-Face WebRTC, 6 authentische
    Venues und 40+ weitere Features für play.autodarts.io. Standardmäßig
    komplett lokal — kein Tracking.

---

## Detailed Description (EN)

Verwende exakt den Text aus `CHROME_STORE.md → Detailed Description (EN)`.
AMO akzeptiert Emojis und Zeilenumbrüche identisch.

## Ausführliche Beschreibung (DE)

Verwende exakt den Text aus `CHROME_STORE.md → Ausführliche Beschreibung (DE)`.

---

## Categories

- **Sports & Games**
- **Alerts & Updates**

## Tags

`autodarts` `darts` `sports` `caller` `crowd` `pdc` `elo` `webrtc`
`tournament` `voice` `commentary` `ai`

## License

Choose one:
- **MPL-2.0** (falls du das Repo unter MPL veröffentlichst — Mozilla-freundlich)
- **MIT** (breite Kompatibilität)
- **Custom** (dann Text-Link zu deiner Lizenz)

## Homepage

    https://autodarts-tools.emergent.host

## Support Website / Email

- **Website:** https://autodarts-tools.emergent.host
- **Email:** support@autodarts-tools.emergent.host

---

## Source Code Submission (AMO-spezifisch)

AMO verlangt bei Add-ons mit Bundlern/Transpilern (WXT + Vite) einen
Source-Code-Upload. Als ZIP mit:

- `/extension/`-Ordner (kompletter WXT-Sourcecode)
- `package.json` + `yarn.lock`
- `README.build.md` mit exakten Build-Kommandos:

  ```
  yarn install
  yarn build:firefox     # baut nach .output/firefox-mv2/
  yarn zip:firefox       # erstellt autodarts-tools-2.9.87-firefox.zip
  ```

Reviewer sollen den Build reproduzieren können. Node-Version dokumentieren
(Node 20 LTS empfohlen).

---

## Content Rating

- **PG (General Audience)** — kein anstößiges Material.  
- Enthält Bot-Skins prominent bekannter PDC-Spieler; für die Verwendung
  im Karriere-Modus werden nur die Namen als _Anpassungs-Vorschläge_
  angeboten. Kein offizielles Sponsoring impliziert.

## Age Rating

    No age restriction.

---

## Discovery / Preview Text (max 250 chars)

    Die Extension, die aus play.autodarts.io ein Bühnen-Erlebnis macht —
    Ally-Pally-Crowd, Sky-Sports-Kommentator und Karrieremodus inklusive.
