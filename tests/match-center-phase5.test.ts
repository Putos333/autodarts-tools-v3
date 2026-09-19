/**
 * Match Center — Phase 5 (Real Game Verification) — Produktions-Regressionstests.
 *
 * Reine Quelltext-Assertions (wie bei den bestehenden "Friends & Party V4 —
 * Regression"- und "Elite Home Dashboard — Regression"-Suiten): kein
 * Vue-Test-Tooling im Projekt vorhanden, daher werden Architektur- und
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

describe("Match Center Phase 5 — Regression", () => {
  it("CcMatch.vue nutzt CcMatchHero.vue (das vollständigere, bisher nie eingebundene Match-Hero) statt des schmaleren CcMatchScoreboard.vue", async () => {
    const text = await source("components/ControlCenter/views/CcMatch.vue");
    assert.match(text, /import CcMatchHero from "\.\.\/CcMatchHero\.vue"/);
    assert.match(text, /<CcMatchHero \/>/);
    // Kommentare dürfen CcMatchScoreboard zur Historie erwähnen — es darf nur
    // kein Import und kein <CcMatchScoreboard-Tag mehr übrig sein.
    assert.doesNotMatch(text, /import CcMatchScoreboard/);
    assert.doesNotMatch(text, /<CcMatchScoreboard/);
  });

  it("processWebSocketMessage() loggt [AD-ELITE MATCH] für den Kanal autodarts.matches, niemals Token-/Cookie-Inhalte", async () => {
    const text = await source("utils/websocket-helpers.ts");
    assert.match(text, /\[AD-ELITE MATCH\]\\nevent=\$\{event\}\\nmatchId=/);
    const matchesCase = text.match(/case "autodarts\.matches": \{[\s\S]*?\n {4}\}\n {4}case "autodarts\.boards"/);
    assert.ok(matchesCase, "case \"autodarts.matches\" nicht gefunden");
    const logCalls = matchesCase![0].match(/console\.log\(\s*`[^;]*\);/g) ?? [];
    assert.ok(logCalls.length >= 1, "erwartete mindestens einen console.log-Aufruf im autodarts.matches-Zweig");
    for (const call of logCalls) {
      assert.doesNotMatch(call, /token|cookie|bearer|authorization/i);
    }
  });

  it("CcMatchHumanTestPanel.vue behauptet im gerenderten Template nirgends automatisch PASS/bestanden und leitet jeden Checkpoint aus useControlCenterStatus() ab, kein zweiter Datenpfad", async () => {
    const text = await source("components/ControlCenter/CcMatchHumanTestPanel.vue");
    const templateOnly = text.match(/<template>[\s\S]*?<\/template>/)?.[0] ?? "";
    assert.ok(templateOnly.length > 0, "<template>-Block nicht gefunden");
    // Nur das gerenderte Template darf keine PASS-Behauptung enthalten — der
    // Script-Kommentar darf dokumentieren, dass genau das vermieden wird.
    assert.doesNotMatch(templateOnly, /\bPASS\b|bestanden|erfolgreich abgeschlossen/i);
    assert.match(text, /useControlCenterStatus\(\)/);
    assert.doesNotMatch(text, /new WebSocket\(|fetchWithAuth/);
  });

  it("CcMatchHumanTestPanel.vue deckt alle neun geforderten Live-Test-Checkpoints ab", async () => {
    const text = await source("components/ControlCenter/CcMatchHumanTestPanel.vue");
    for (const label of [
      "Match erkannt",
      "Spieler erkannt",
      "Erster Wurf erkannt",
      "Score aktualisiert",
      "Spielerwechsel erkannt",
      "Leg-Ende erkannt",
      "Zweites Leg erkannt",
      "Match-Ende erkannt",
      "Ergebnis gespeichert",
    ]) {
      assert.match(text, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Checkpoint fehlt: ${label}`);
    }
  });

  it("CcMatch.vue bindet das temporäre Human-Test-Panel ein", async () => {
    const text = await source("components/ControlCenter/views/CcMatch.vue");
    assert.match(text, /import CcMatchHumanTestPanel from "\.\.\/CcMatchHumanTestPanel\.vue"/);
    assert.match(text, /<CcMatchHumanTestPanel/);
  });

  it("Friends & Party bleibt von der Phase-5-Match-Center-Arbeit unberührt (keine der Presence-/Friends-Dateien im selben Commit-Umfang geändert)", async () => {
    // Reiner Existenz-/Inhalts-Sanity-Check: die Realtest-3/4-Endpunkte und
    // die Presence-Case-Auswertung müssen unverändert vorhanden bleiben.
    const friendsApi = await source("utils/friends-api.ts");
    assert.match(friendsApi, /await fetchWithAuth\(`\$\{API_BASE\}\/as\/v0\/friends\/`\)/);
    const wsHelpers = await source("utils/websocket-helpers.ts");
    assert.match(wsHelpers, /case "autodarts\.friends": \{/);
    assert.match(wsHelpers, /KNOWN_STATUSES = \[ "Online", "Offline", "Incognito" \]/);
  });

  it("Checkpoint-Review: CcMatchHero.vue zeigt den Fortschritts-Punkte-Streifen bei Best-of-Sets-Matches als Sets statt fest als Legs (Regression aus dem CcMatchScoreboard→CcMatchHero-Swap behoben)", async () => {
    const text = await source("components/ControlCenter/CcMatchHero.vue");
    assert.match(text, /anySets,/, "anySets muss aus useControlCenterStatus() destrukturiert werden");
    assert.match(text, /const progressDotsLeft = computed\(\(\) => \(anySets\.value \? heroPair\.value\?\.left\.sets : heroPair\.value\?\.left\.legs\) \?\? 0\);/);
    assert.match(text, /const progressDotsRight = computed\(\(\) => \(anySets\.value \? heroPair\.value\?\.right\.sets : heroPair\.value\?\.right\.legs\) \?\? 0\);/);
    assert.match(text, /\{\{ anySets \? "Sets" : "Legs" \}\}/);
    // Der alte, fest auf .legs verdrahtete Fortschritts-Streifen darf nicht mehr vorkommen.
    assert.doesNotMatch(text, /v-for="n in \(heroPair\.left\.legs \?\? 0\)"/);
  });
});
