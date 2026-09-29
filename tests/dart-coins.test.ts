/**
 * Gezielte Tests für Setup-2.0-Architektur-Audit Phase A (140+/180-Konsolidierung).
 *
 * `isScore180()`/`is140Plus()` in utils/dart-coins.ts ersetzen die zuvor in
 * crowd.ts, ai-commentator.ts und dart-coins.ts (`coinsForScore`) unabhängig
 * duplizierten Inline-Vergleiche `points === 180`/`points >= 140`. Diese Tests
 * verankern das exakte, unveränderte Schwellenwert-Verhalten.
 *
 *   node --import tsx --test "tests/*.test.ts"
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { coinsForScore, is140Plus, isScore180, COIN_REWARDS } from "@/utils/dart-coins";

describe("isScore180()", () => {
  it("true nur bei exakt 180", () => {
    assert.equal(isScore180(180), true);
  });

  it("false bei 179 und 181 (keine Rundung/Fuzzy-Logik)", () => {
    assert.equal(isScore180(179), false);
    assert.equal(isScore180(181), false);
  });

  it("false bei 0 und negativen Werten", () => {
    assert.equal(isScore180(0), false);
    assert.equal(isScore180(-1), false);
  });
});

describe("is140Plus()", () => {
  it("true bei genau 140 (untere Grenze, inklusiv)", () => {
    assert.equal(is140Plus(140), true);
  });

  it("false bei 139 (eine Zahl unter der Grenze)", () => {
    assert.equal(is140Plus(139), false);
  });

  it("true bei 180 — is140Plus schließt is180 mit ein (kein exklusives Band)", () => {
    assert.equal(is140Plus(180), true);
  });

  it("true bei Werten deutlich über 140 (z. B. 170)", () => {
    assert.equal(is140Plus(170), true);
  });
});

describe("coinsForScore() — Regression: identisches Verhalten nach der Umstellung auf isScore180()/is140Plus()", () => {
  it("180 -> scored180-Belohnung", () => {
    assert.equal(coinsForScore(180), COIN_REWARDS.scored180);
  });

  it("170 -> scored170-Belohnung (eigener Zweig, bewusst NICHT auf is140Plus umgestellt, da außerhalb Phase-A-Scope)", () => {
    assert.equal(coinsForScore(170), COIN_REWARDS.scored170);
  });

  it("140 -> scored140plus-Belohnung", () => {
    assert.equal(coinsForScore(140), COIN_REWARDS.scored140plus);
  });

  it("139 -> keine Belohnung (0)", () => {
    assert.equal(coinsForScore(139), 0);
  });

  it("0 -> keine Belohnung (0)", () => {
    assert.equal(coinsForScore(0), 0);
  });
});
