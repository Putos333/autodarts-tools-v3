/**
 * ELO-Consent: Das Gate in utils/elo-client.ts (bgFetch) darf ohne
 * ausdrückliche Zustimmung KEINE Netzwerkanfrage auslösen (fail closed).
 *
 * Geprüft wird der echte Produktionscode von elo-client.ts gegen die
 * WXT-Globals-Nachbildung (tests/support/wxt-globals-mock.ts). Der einzige
 * Netzwerkpfad ist `browser.runtime.sendMessage({ type: "FETCH_JSON" })`; er
 * wird hier durch einen Zähler ersetzt. "kein Submit" heißt: sendMessage
 * wird nicht aufgerufen.
 *
 * Bestehende Gates (identity.submitEnabled) gelten unverändert zusätzlich:
 * ACCEPTED ersetzt sie nicht.
 */

import { strict as assert } from "node:assert";
import { beforeEach, describe, it } from "node:test";

import { installWxtGlobals, type MockStorageHandle } from "./support/wxt-globals-mock";

const handle: MockStorageHandle = installWxtGlobals();

const CONSENT_KEY = "adt-elo-consent";
const IDENTITY_KEY = "adt-elo-identity";
const BACKEND = "https://backend.example.test";

interface Sent { type: string; payload: { url: string; method: string; body?: string } }
let sent: Sent[] = [];
let responder: (msg: Sent) => unknown;

function installRuntime(): void {
  sent = [];
  responder = (msg) => {
    if (msg.payload.url.endsWith("/api/elo/submit")) {
      return { ok: true, status: 200, data: { ok: true, old_rating: 1000, new_rating: 1012, delta: 12, rank: 3, total_players: 10 } };
    }
    if (msg.payload.url.includes("/api/elo/leaderboard")) return { ok: true, status: 200, data: [{ rank: 1 }] };
    if (msg.payload.url.includes("/api/elo/me/")) return { ok: true, status: 200, data: { rating: 1012 } };
    return { ok: false, status: 404, data: null };
  };
  (globalThis as any).browser.runtime.sendMessage = async (msg: Sent) => {
    sent.push(msg);
    return responder(msg);
  };
}

const match = { displayName: "Tester", result: 1 as const, matchAvg: 55.5, total180: 2, highFinish: 120 };

async function elo() {
  return await import("../utils/elo-client");
}

/** Führt alle drei Netzwerkfunktionen aus und liefert ihre Rückgaben. */
async function useAllNetworkFunctions() {
  const c = await elo();
  return {
    submit: await c.submitMatch(BACKEND, match),
    board: await c.fetchLeaderboard(BACKEND, 10),
    self: await c.fetchSelf(BACKEND),
  };
}

beforeEach(() => {
  handle.reset();
  installRuntime();
});

describe("ELO-Consent: Zustandsmodell", () => {
  it("fehlender Eintrag = unknown", async () => {
    const c = await elo();
    assert.equal(await c.getEloConsent(), "unknown");
  });

  it("setEloConsent speichert ausschließlich unter eigenem Key mit Version und Zeitstempel", async () => {
    const c = await elo();
    assert.equal(await c.setEloConsent("accepted"), true);
    const raw = handle.raw(CONSENT_KEY) as { state: string; at: number; v: number };
    assert.equal(raw.state, "accepted");
    assert.equal(raw.v, c.ELO_CONSENT_VERSION);
    assert.equal(typeof raw.at, "number");
    assert.equal(handle.raw("config-2-0-0"), undefined, "Consent darf nicht in der Config landen");
  });

  it("ungültiger Zustand wird an der Schnittstelle abgelehnt und nichts geschrieben", async () => {
    const c = await elo();
    assert.equal(await c.setEloConsent("maybe" as any), false);
    assert.equal(handle.raw(CONSENT_KEY), undefined);
  });
});

describe("ELO-Consent: Gate blockiert jede Netzwerkanfrage ohne Zustimmung", () => {
  it("1. frische Installation (unknown): kein Submit, keine Rangliste, kein /me", async () => {
    const r = await useAllNetworkFunctions();
    assert.equal(r.submit, null);
    assert.deepEqual(r.board, []);
    assert.equal(r.self, null);
    assert.equal(sent.length, 0);
  });

  it("3. unknown -> declined: kein Submit", async () => {
    const c = await elo();
    await c.setEloConsent("declined");
    const r = await useAllNetworkFunctions();
    assert.equal(r.submit, null);
    assert.equal(sent.length, 0);
  });

  it("6. bestehender Nutzer (Identität vorhanden) ohne Consent-Eintrag: kein Submit", async () => {
    handle.seed(IDENTITY_KEY, { playerId: "pl-existing", displayName: "Anonymous_ABCD", createdAt: 1 });
    const r = await useAllNetworkFunctions();
    assert.equal(r.submit, null);
    assert.equal(sent.length, 0);
  });

  it("7. bestehender Nutzer mit identity.submitEnabled=true, aber ohne Consent-Eintrag: kein Submit", async () => {
    handle.seed(IDENTITY_KEY, { playerId: "pl-existing", displayName: "Anonymous_ABCD", createdAt: 1, submitEnabled: true });
    const r = await useAllNetworkFunctions();
    assert.equal(r.submit, null);
    assert.equal(sent.length, 0);
  });

  it("8. ungültige Consent-Werte werden als unknown behandelt (fail closed)", async () => {
    const c = await elo();
    const invalid: unknown[] = [
      "accepted", true, 1, null, [], {},
      { state: "accepted" },                 // Version fehlt
      { state: "accepted", v: 0 },           // falsche Version
      { state: "accepted", v: 999 },         // unbekannte (künftige) Version
      { state: "ACCEPTED", v: c.ELO_CONSENT_VERSION },
      { state: "yes", v: c.ELO_CONSENT_VERSION },
      { state: true, v: c.ELO_CONSENT_VERSION },
      { v: c.ELO_CONSENT_VERSION },
    ];
    for (const value of invalid) {
      handle.seed(CONSENT_KEY, value);
      assert.equal(await c.getEloConsent(), "unknown", `Wert ${JSON.stringify(value)} muss unknown sein`);
      const r = await useAllNetworkFunctions();
      assert.equal(r.submit, null);
      assert.equal(sent.length, 0, `Wert ${JSON.stringify(value)} darf nichts senden`);
    }
  });

  it("9a. Lesefehler nur beim Consent-Eintrag (Identität lesbar): unknown, kein Submit", async () => {
    const c = await elo();
    await c.setEloConsent("accepted");
    handle.seed(IDENTITY_KEY, { playerId: "pl-x", displayName: "Anonymous_X", createdAt: 1, submitEnabled: true });
    const local = (globalThis as any).browser.storage.local;
    const originalGet = local.get;
    local.get = async (key: unknown) => {
      if (key === CONSENT_KEY) throw new Error("storage unavailable");
      return originalGet(key);
    };
    try {
      assert.equal(await c.getEloConsent(), "unknown");
      const r = await useAllNetworkFunctions();
      assert.equal(r.submit, null);
      assert.deepEqual(r.board, []);
      assert.equal(r.self, null);
      assert.equal(sent.length, 0);
    } finally {
      local.get = originalGet;
    }
  });

  it("9a-2. kompletter Storage-Ausfall: getEloConsent liefert unknown, keine Anfrage entsteht", async () => {
    const c = await elo();
    await c.setEloConsent("accepted");
    const local = (globalThis as any).browser.storage.local;
    const originalGet = local.get;
    local.get = async () => { throw new Error("storage unavailable"); };
    try {
      assert.equal(await c.getEloConsent(), "unknown");
      // Die Identitätsfunktionen dürfen hier selbst werfen (bestehendes Verhalten);
      // entscheidend ist, dass keine einzige Anfrage entsteht.
      for (const call of [
        () => c.submitMatch(BACKEND, match),
        () => c.fetchLeaderboard(BACKEND, 10),
        () => c.fetchSelf(BACKEND),
      ]) {
        try { await call(); } catch { /* erlaubt */ }
      }
      assert.equal(sent.length, 0);
    } finally {
      local.get = originalGet;
    }
  });

  it("9b. Schreibfehler: setEloConsent meldet false, Zustand bleibt unknown, kein Submit", async () => {
    const c = await elo();
    handle.seed(IDENTITY_KEY, { playerId: "pl-x", displayName: "Anonymous_X", createdAt: 1, submitEnabled: true });
    const local = (globalThis as any).browser.storage.local;
    const originalSet = local.set;
    local.set = async () => { throw new Error("quota"); };
    try {
      assert.equal(await c.setEloConsent("accepted"), false);
      assert.equal(await c.getEloConsent(), "unknown");
      const r = await useAllNetworkFunctions();
      assert.equal(r.submit, null);
      assert.equal(sent.length, 0);
    } finally {
      local.set = originalSet;
    }
  });

  it("9c. Schreiben wird nicht bestätigt (Zurücklesen scheitert): false, kein Submit", async () => {
    const c = await elo();
    const local = (globalThis as any).browser.storage.local;
    const originalSet = local.set;
    local.set = async () => { /* schreibt still nichts */ };
    try {
      assert.equal(await c.setEloConsent("accepted"), false);
      await useAllNetworkFunctions();
      assert.equal(sent.length, 0);
    } finally {
      local.set = originalSet;
    }
  });
});

describe("ELO-Consent: Zustimmung erlaubt Übertragung nur zusätzlich zu den bisherigen Gates", () => {
  it("2. unknown -> accepted: Submit, Rangliste und /me laufen", async () => {
    const c = await elo();
    assert.equal(await c.setEloConsent("accepted"), true);
    const r = await useAllNetworkFunctions();
    assert.equal(r.submit?.new_rating, 1012);
    assert.equal(r.board.length, 1);
    assert.equal(r.self.rating, 1012);
    assert.equal(sent.length, 3);
    const submit = sent.find(s => s.payload.url.endsWith("/api/elo/submit"))!;
    assert.equal(submit.payload.url, `${BACKEND}/api/elo/submit`);
    assert.equal(submit.payload.method, "POST");
    const body = JSON.parse(submit.payload.body!);
    assert.match(body.player_id, /^pl-/);
    assert.equal(body.result, 1);
  });

  it("accepted ersetzt das bestehende Gate nicht: identity.submitEnabled=false blockiert weiterhin", async () => {
    const c = await elo();
    handle.seed(IDENTITY_KEY, { playerId: "pl-x", displayName: "Anonymous_X", createdAt: 1, submitEnabled: false });
    await c.setEloConsent("accepted");
    assert.equal(await c.submitMatch(BACKEND, match), null);
    assert.equal(sent.length, 0);
  });

  it("accepted ersetzt das bestehende Gate nicht: leere Backend-URL sendet nichts", async () => {
    const c = await elo();
    await c.setEloConsent("accepted");
    assert.equal(await c.submitMatch("", match), null);
    assert.deepEqual(await c.fetchLeaderboard("", 10), []);
    assert.equal(sent.length, 0);
  });

  it("4. accepted -> declined: danach kein Submit mehr", async () => {
    const c = await elo();
    await c.setEloConsent("accepted");
    assert.notEqual(await c.submitMatch(BACKEND, match), null);
    const before = sent.length;
    await c.setEloConsent("declined");
    assert.equal(await c.submitMatch(BACKEND, match), null);
    assert.equal(sent.length, before, "nach dem Widerruf darf keine weitere Anfrage entstehen");
  });

  it("5. declined -> accepted: Submission wieder möglich", async () => {
    const c = await elo();
    await c.setEloConsent("declined");
    assert.equal(await c.submitMatch(BACKEND, match), null);
    assert.equal(sent.length, 0);
    await c.setEloConsent("accepted");
    assert.notEqual(await c.submitMatch(BACKEND, match), null);
    assert.equal(sent.length, 1);
  });

  it("accepted: Netzwerkfehler beim Senden liefert weiterhin null (bestehendes Verhalten)", async () => {
    const c = await elo();
    await c.setEloConsent("accepted");
    (globalThis as any).browser.runtime.sendMessage = async () => { throw new Error("offline"); };
    assert.equal(await c.submitMatch(BACKEND, match), null);
  });
});

describe("ELO-Consent: lokale ELO-Funktion ohne Übertragung", () => {
  it("11. Identität anlegen, ändern und zurücksetzen funktioniert ohne Zustimmung und ohne Netzwerk", async () => {
    const c = await elo();
    const id1 = await c.getIdentity();
    assert.match(id1.playerId, /^pl-/);
    assert.match(id1.displayName, /^Anonymous_/);
    const changed = await c.updateIdentity({ displayName: "MeinName" });
    assert.equal(changed.displayName, "MeinName");
    const id2 = await c.resetIdentity();
    assert.notEqual(id2.playerId, id1.playerId);
    assert.equal(sent.length, 0);
    assert.equal(await c.getEloConsent(), "unknown", "Identitäts-Reset ändert den Consent nicht");
  });
});
