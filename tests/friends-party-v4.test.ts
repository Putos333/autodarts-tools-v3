/**
 * Friends & Party Center V4 — Produktions-Regressionstests.
 *
 * Reine Quelltext-Assertions (wie bei den bestehenden "Elite Home Dashboard —
 * Regression"- und "Wave 2 Slice … — Regression"-Suiten): kein Vue-Test-
 * Tooling im Projekt vorhanden, daher werden Architektur- und
 * Ehrlichkeits-Garantien hier als Textmuster über den produktiven Quellcode
 * abgesichert.
 *
 *   node --import tsx --test "tests/*.test.ts"
 */

import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Friends & Party V4 — Regression", () => {
  it("CcParty.vue referenziert die abgelösten V2/V3-Komponenten nicht mehr", async () => {
    const text = await source("components/ControlCenter/views/CcParty.vue");
    assert.doesNotMatch(text, /CcFriendsCard|CcFriendRow|CcPartyCard\.vue/);
  });

  it("die abgelösten V2/V3-Dateien existieren nicht mehr", async () => {
    for (const path of [
      "components/ControlCenter/CcFriendsCard.vue",
      "components/ControlCenter/CcFriendRow.vue",
      "components/ControlCenter/CcPartyCard.vue",
    ]) {
      await assert.rejects(() => source(path), `${path} sollte gelöscht sein`);
    }
  });

  it("keine Mockup-Illustrationsnamen aus dem V4-Artifact tauchen als hartkodierte Werte in Produktionscode auf", async () => {
    const files = [
      "components/ControlCenter/CcFriendsHero.vue",
      "components/ControlCenter/CcOnlineFriendCard.vue",
      "components/ControlCenter/CcOnlineFriends.vue",
      "components/ControlCenter/CcChallengeZone.vue",
      "components/ControlCenter/CcFriendDetail.vue",
      "components/ControlCenter/CcPartyLobby.vue",
      "components/ControlCenter/CcPartyMultiInvite.vue",
      "components/ControlCenter/CcRecentOpponentsPanel.vue",
      "components/ControlCenter/views/CcParty.vue",
    ];
    const forbidden = /Falke_23|MoonlightMike|Steel_Sarah|DartVader|Robin_180|Foxtrot_Finn|Quiver_Queen|lobby-mock-771/;
    for (const file of files) {
      const text = await source(file);
      assert.doesNotMatch(text, forbidden, `${file} darf keine V4-Mockup-Beispieldaten enthalten`);
    }
  });

  it("CcChallengeZone.vue schützt das Senden durch einen echten Zwei-Klick-Zustand (kein Emit beim ersten Klick)", async () => {
    const text = await source("components/ControlCenter/CcChallengeZone.vue");
    assert.match(text, /const armed = ref\(false\)/);
    // Erster Klick darf NUR "armed" setzen und danach return, nicht senden.
    assert.match(text, /if\s*\(!armed\.value\)\s*\{\s*armed\.value = true;\s*return;\s*\}/);
  });

  it("CcChallengeZone.vue zeigt Match-Setup nur als Read-out der echten quickPlay()-Standardwerte, kein Auswahl-Control", async () => {
    const text = await source("components/ControlCenter/CcChallengeZone.vue");
    assert.doesNotMatch(text, /<select/i);
    assert.match(text, /import \{ DEFAULT_LOBBY_SETTINGS/);
  });

  it("Herausforderungs-Erfolgsmeldung behauptet keinen unbestätigten Folgezustand", async () => {
    const files = [
      "components/ControlCenter/CcChallengeZone.vue",
      "components/ControlCenter/views/CcParty.vue",
    ];
    const forbidden = /angenommen|wartet auf Antwort|checkt ein|Gegner wurde benachrichtigt|Match startet gleich/i;
    for (const file of files) {
      const text = await source(file);
      assert.doesNotMatch(text, forbidden, `${file} darf keinen unbestätigten Einladungsstatus behaupten`);
    }
  });

  it("CcFriendDetail.vue nutzt getH2HStats() nicht und benennt den H2H-Zustand als ungeprüft/pending", async () => {
    const text = await source("components/ControlCenter/CcFriendDetail.vue");
    assert.doesNotMatch(text, /getH2HStats/);
    assert.match(text, /ungeprüft\/pending/);
  });

  it("CcFriendsHero.vue zeigt \"online\" nur, wenn onlineStatusAvailable tatsächlich true ist (kein \"0 online\" als Rateergebnis)", async () => {
    const text = await source("components/ControlCenter/CcFriendsHero.vue");
    assert.match(text, /v-if="state === 'ready' && onlineStatusAvailable"/);
    assert.match(text, /Online-Status unbekannt/);
  });

  it("Party-Multi-Invite (quickPlayGroup) wird nur gezeigt, wenn KEINE aktive Lobby besteht — erstellt immer eine neue Lobby", async () => {
    const text = await source("components/ControlCenter/views/CcParty.vue");
    assert.match(text, /<CcPartyLobby\s+v-if="hasLobby"/);
    assert.match(text, /<CcPartyMultiInvite\s+v-else/);
  });

  it("CcPartyLobby.vue erfindet keinen Ready-Status je Spieler (kein isReady/ready-Feld)", async () => {
    const text = await source("components/ControlCenter/CcPartyLobby.vue");
    assert.doesNotMatch(text, /isReady|player\.ready/i);
  });

  it("useControlCenterFriends.challengeGroup() nutzt die bestehende quickPlayGroup()-Funktion, keine zweite Implementierung", async () => {
    const text = await source("composables/useControlCenterFriends.ts");
    assert.match(text, /quickPlayGroup\(friendIds\)/);
  });

  it("getRecentOpponents() löst Identität weiterhin ausschließlich per userId auf, kein Index-0-Fallback", async () => {
    const text = await source("utils/dashboard-activity.ts");
    assert.doesNotMatch(text, /players\[0\]|players\[me\.index \+ 1\]/);
    assert.match(text, /resolveMe\(match, myUserId\)/);
  });

  it("sections.ts registriert den party-Eintrag unverändert (kein Routing-Bruch durch die V4-Implementierung)", async () => {
    const text = await source("components/ControlCenter/sections.ts");
    assert.match(text, /id: "party"/);
  });

  it("Realtest 2: CcParty.vue lädt die Freundesliste beim Öffnen der dedizierten Seite selbst — der globale Aktualisieren-Button (CcTopBar) rührt useControlCenterFriends() nicht an", async () => {
    const party = await source("components/ControlCenter/views/CcParty.vue");
    assert.match(party, /onMounted\(async \(\) => \{[\s\S]*void load\(\);[\s\S]*\}\);/);
    const topbar = await source("components/ControlCenter/CcTopBar.vue");
    assert.doesNotMatch(topbar, /useControlCenterFriends/);
  });

  it("Realtest 3: getOnlineFriendIds() ruft /as/v0/friends/online-status NICHT mehr auf (Endpoint liefert die eigene Sichtbarkeit, keine Freundesliste — per Autodarts-Bundle verifiziert) und liefert ehrlich ein leeres Set statt erfundener Werte", async () => {
    const text = await source("utils/friends-api.ts");
    const fnMatch = text.match(/async function getOnlineFriendIds\(\)[\s\S]*?\n\}/);
    assert.ok(fnMatch, "getOnlineFriendIds() nicht gefunden");
    assert.doesNotMatch(fnMatch![0], /fetchWithAuth/);
    assert.match(fnMatch![0], /return new Set\(\);/);
  });

  it("Realtest 3: getFriendsDiagnostic() macht keinen Netzwerk-Call gegen /as/v0/friends/online-status mehr und setzt onlineStatusAvailable nicht mehr auf true", async () => {
    const text = await source("utils/friends-api.ts");
    const fnMatch = text.match(/export async function getFriendsDiagnostic\(\)[\s\S]*$/);
    assert.ok(fnMatch, "getFriendsDiagnostic() nicht gefunden (Regex ggf. anpassen)");
    assert.doesNotMatch(fnMatch![0], /fetchWithAuth\(`\$\{API_BASE\}\/as\/v0\/friends\/online-status`\)/);
    assert.doesNotMatch(fnMatch![0], /onlineStatusAvailable = true/);
  });

  it("Realtest 4: processWebSocketMessage() wertet den Kanal autodarts.friends aus — kein neuer Endpoint, keine zweite Socket-Verbindung, nur ein zusätzlicher case im bestehenden Dispatcher", async () => {
    const text = await source("utils/websocket-helpers.ts");
    assert.match(text, /case "autodarts\.friends": \{/);
    // Nur echte Status-Events (Online/Offline/Incognito) werden übernommen —
    // kein erfundener Wert für Activity-Events oder fehlende Felder.
    assert.match(text, /KNOWN_STATUSES = \[ "Online", "Offline", "Incognito" \]/);
    assert.match(text, /AutodartsToolsFriendPresence\.setValue/);
    // Kein neuer WebSocket/`new WebSocket(`-Aufruf, keine zweite Verbindung.
    assert.doesNotMatch(text, /new WebSocket\(/);
  });

  it("Checkpoint-Review: autodarts.friends-Case verwirft __proto__/constructor/prototype als userId, bevor er als Objekt-Key verwendet wird (Prototype-Pollution-Härtung gegen externes WS-JSON)", async () => {
    const text = await source("utils/websocket-helpers.ts");
    const friendsCase = text.match(/case "autodarts\.friends": \{[\s\S]*?\n {4}\}\n/);
    assert.ok(friendsCase, "case \"autodarts.friends\" nicht gefunden");
    assert.match(friendsCase![0], /UNSAFE_KEYS = \[ "__proto__", "constructor", "prototype" \]/);
    assert.match(friendsCase![0], /UNSAFE_KEYS\.includes\(userId\)/);
  });

  it("Realtest 4: das [AD-ELITE PRESENCE]-Diagnose-Log enthält userId/status/source, niemals Token- oder Cookie-Inhalte", async () => {
    const text = await source("utils/websocket-helpers.ts");
    assert.match(text, /\[AD-ELITE PRESENCE\]\\nuserId=\$\{userId\}\\nstatus=\$\{status\}\\nsource=autodarts\.friends/);
    // Nur die tatsächlichen console.log(...)-Aufrufe prüfen, nicht die
    // Kommentare (die "Token" dokumentierend erwähnen dürfen, warum KEINER
    // geloggt wird).
    const friendsCase = text.match(/case "autodarts\.friends": \{[\s\S]*?\n {4}\}\n/);
    assert.ok(friendsCase, "case \"autodarts.friends\" nicht gefunden");
    const logCalls = friendsCase![0].match(/console\.log\([^;]*\);/g) ?? [];
    assert.ok(logCalls.length >= 2, "erwartete mindestens 2 console.log-Aufrufe im autodarts.friends-Zweig");
    for (const call of logCalls) {
      assert.doesNotMatch(call, /token|cookie|bearer|authorization/i);
    }
  });

  it("Realtest 4: useControlCenterFriends() überlagert die REST-Freundesliste mit der Live-Presence aus local:friend-presence, ohne die Freundesliste selbst zu verändern", async () => {
    const text = await source("composables/useControlCenterFriends.ts");
    assert.match(text, /AutodartsToolsFriendPresence\.watch/);
    assert.match(text, /rawFriends\.value = result\.friends;/);
    // Online nur bei bestätigtem "Online"-Event, Offline bei Offline/Incognito,
    // alles andere bleibt unangetastet ("Status unbekannt").
    assert.match(text, /entry\.status === "Online" \? true : \(entry\.status === "Offline" \|\| entry\.status === "Incognito" \? false : friend\.online\)/);
  });
});
