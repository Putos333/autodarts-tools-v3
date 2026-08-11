# Permission-Rechtfertigung — Chrome Web Store

Chrome verlangt für jede angeforderte Permission eine Begründung im
„Privacy practices"-Formular. Diese Texte 1:1 einfügen.

## Permission: `storage`

    Store user's preferences, career progress, custom bot names,
    caller/crowd settings and match history locally in the user's
    browser (browser.storage.local). Never synced to any server.

## Permission: `activeTab`

    Trigger the toolbar popup and provide the "Open Autodarts" button.
    We do NOT read tabs the user is not currently viewing.

## Host Permission: `*://play.autodarts.io/*`

    Core functionality: enhance the Autodarts play page. Required for
    every feature (caller, crowd, career, share, WebRTC panel).

## Host Permission: `*://api.autodarts.io/*`

    Read match & tournament metadata from Autodarts' own REST API to
    populate the bot renamer and career module. Read-only.

## Host Permission: `*://darts-downloads.peschi.org/*` + `*://autodarts.x10.mx/*`

    Third-party community voice-pack CDNs. Only used when the user
    explicitly chooses one of these voice packs in the Caller settings.

## Host Permission: `*://adt-socket.tobias-thiele.de/*`

    Optional signaling relay for the Face-to-Face WebRTC feature.
    Contacted only when the user activates video chat.

## Host Permission: `*://discord.com/api/webhooks/*`

    Send match-announcements to a user-provided Discord webhook.
    Contacted only when the user configures a webhook URL. We never
    send data to Discord servers we don't have an explicit URL for.

## Host Permission: `*://*.emergent.host/*`

    Contact our own Emergent-hosted micro-services:
    - AI Commentator LLM proxy (opt-in)
    - ELO ladder submission (opt-in)
    - Marathon leaderboard (opt-in)
    - Face-to-Face WebRTC signaling (opt-in)

## Host Permission: `*://*.preview.emergentagent.com/*`

    Fallback URL of the same Emergent backend during migration to the
    production host. Will be removed after the production deployment
    (see `utils/backend-url.ts::PRIMARY_BACKEND_URL`).

## Remote Code / Injected Scripts

    None. No `eval`, no dynamic-loaded scripts. All executable code
    is bundled by the WXT/Vite build and included in the uploaded ZIP.
    The one exception is the file `websocket-capture.js`, which is
    also part of the extension bundle (web_accessible_resource) and
    inspected by store reviewers.
