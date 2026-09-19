# Store-Submission Kit — Tools for Autodarts v2.9.87

Dieses Verzeichnis enthält alle Assets & Texte, die für die
Einreichung im **Chrome Web Store** und auf **Firefox AMO** benötigt
werden. Als Autor bringst du deine eigenen Developer-Accounts mit.

## Übersicht

| Datei                    | Zweck                                                             |
|--------------------------|-------------------------------------------------------------------|
| `README.md` (diese Datei)| Roadmap für die Einreichung + Checkliste                          |
| `PRIVACY_POLICY.md`      | Datenschutzerklärung (auf Website hosten, URL beim Store angeben) |
| `CHROME_STORE.md`        | Listing-Texte (EN + DE) für Chrome Web Store                      |
| `FIREFOX_AMO.md`         | Listing-Texte (EN + DE) für addons.mozilla.org                    |
| `PERMISSIONS.md`         | Rechtfertigung jeder Permission (Chrome erfordert das)            |
| `SCREENSHOT_PLAN.md`     | 5 Screenshot-Setups + Kompositions-Hinweise                       |
| `promo/`                 | Promo-Tiles (SVG-Quelle + PNG für Upload)                         |

## Vor der Einreichung – Checkliste

- [ ] **Backend-Domain deployed**  
   Aktuell zeigt `getBackendUrl()`-Fallback auf `preview.emergentagent.com`.  
   In Emergent → Deploy → Production den Host `autodarts-tools.emergent.host` scharfschalten.  
   Danach in `utils/backend-url.ts` die Zeile `return FALLBACK_BACKEND_URL;` auf `return PRIMARY_BACKEND_URL;` umstellen und neu bauen.
- [ ] **Privacy Policy hosten**  
   `PRIVACY_POLICY.md` als HTML unter z.B. `https://autodarts-tools.emergent.host/privacy` veröffentlichen.
- [ ] **Support-E-Mail bereithalten**  
   Sowohl Chrome als auch AMO fragen nach einer Support-Adresse.
- [ ] **Icons prüfen**  
   Chrome verlangt 128×128 im ZIP + 128×128 als „Store Icon" separat. Beides in `promo/`.
- [ ] **Promo-Tiles**  
   Chrome: Small Promo Tile 440×280 (Pflicht). Optional 1400×560 Marquee.  
   AMO: 4:3 oder 16:9 Screenshots reichen, Promo-Tile nicht Pflicht.
- [ ] **5 Screenshots** anfertigen (siehe `SCREENSHOT_PLAN.md`).  
   Empfohlene Größe für **beide** Stores: **1280×800**.
- [ ] **Chrome Developer-Account** (einmalig 5 USD Registration).
- [ ] **Firefox Developer-Account** (kostenlos, AMO-Account).
- [ ] **AMO Signing**  
   Firefox lehnt unsignierte XPIs außerhalb "Developer Edition" ab. AMO signiert beim Upload automatisch, sobald das Add-on genehmigt ist. **Bis dahin** funktioniert die aktuelle `.xpi` weiterhin über `about:debugging` als Temporary Add-on.

## Nach der Freigabe

1. **Chrome:** Store-Link (`https://chrome.google.com/webstore/detail/…`)
   ins `homepage_url` des Manifests + auf die Landing-Page übernehmen.
2. **Firefox:** AMO-Link (`https://addons.mozilla.org/firefox/addon/…`)
   auf der Landing-Page als Primär-Button einblenden.
3. Landing-Page `Direct-Install .xpi` als **Legacy-Option** unter
   "Manuell installieren" verstecken (Firefox lädt AMO ohnehin bevorzugt).
