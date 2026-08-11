# Build-Instructions für AMO-Reviewer

Diese Datei erklärt Mozilla-Reviewer:innen, wie sie den Firefox-Add-on-
Build aus dem hier beigefügten Source-Code reproduzieren können.

## Voraussetzungen

- **Node.js 20 LTS** (`node --version` sollte `v20.x` melden)
- **Yarn 1.22+** (Classic Yarn — nicht Yarn Berry)
- **~4 Minuten Bauzeit** auf einem Standard-Laptop

## Reproduktions-Kommandos

```bash
# 1. Dependencies installieren
yarn install --frozen-lockfile

# 2. Firefox-Build erzeugen (MV2)
yarn build:firefox
#    → Output: .output/firefox-mv2/  (unpacked extension)

# 3. XPI/ZIP erzeugen
yarn zip:firefox
#    → Output: .output/autodarts-tools-2.9.88-firefox.zip
```

## Erwartetes Ergebnis

- **Dateigröße:** ~1,55 MB
- **Manifest-Version:** 2 (Firefox MV2)
- **Version:** 2.9.88

Die entstandene `.zip` hat exakt den Inhalt der eingereichten
`autodarts-tools-2.9.88-firefox.zip` bis auf ggf. abweichende Reihenfolge
der Dateien und Timestamp-Metadaten (nichts Sicherheitsrelevantes).

## Architektur

- **Framework:** WXT 0.20 (https://wxt.dev/) mit Vite + Vue 3 + TypeScript.
- **Kein Obfuskator, kein `eval`, kein dynamisch geladenes Remote-Code.**
- Alle 3rd-party Assets (Crowd-Samples aus `public/sounds/crowd/*.mp3`)
  sind Public-Domain (siehe `public/sounds/crowd/ATTRIBUTIONS.md`).
- Einziges monkey-patchendes Script: `websocket-capture.ts` — es
  wrappt den nativen `WebSocket`-Konstruktor, um `open`/`close`-Events
  im Content-Script empfangen zu können. Kein Netzwerk-Traffic wird
  umgeleitet, ausschließlich Metadaten (Verbindungsstatus).

## Externe Services (Opt-In)

Diese werden nur kontaktiert, wenn der Nutzer das jeweilige Feature in
den Einstellungen aktiviert:

| Feature | Endpoint |
|---|---|
| AI Commentator | `https://darts-caller-ext.emergent.host/api/coach/*` |
| ELO Ladder | `https://darts-caller-ext.emergent.host/api/elo/*` |
| Marathon Leaderboard | `https://darts-caller-ext.emergent.host/api/marathon/*` |
| Face-to-Face WebRTC | `wss://darts-caller-ext.emergent.host/api/face/ws` |
| Discord Webhook | vom User selbst konfigurierte URL |

Alle Endpoints senden keine PII außer dem vom Nutzer selbst gewählten
Anzeigenamen (rein virtuell, kein Klarname erforderlich).

## Kontakt für Rückfragen

**E-Mail:** support@darts-caller-ext.emergent.host  
**Homepage:** https://darts-caller-ext.emergent.host  
**Privacy Policy:** https://darts-caller-ext.emergent.host/privacy.html
