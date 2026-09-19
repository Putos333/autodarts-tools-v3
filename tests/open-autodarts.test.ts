/**
 * Tests für die Origin-Auflösung des Control-Center-"Autodarts öffnen"-Helfers.
 *
 * Läuft ohne zusätzliche Abhängigkeit über den Node-eigenen Test-Runner:
 *
 *   node --import tsx --test "tests/*.test.ts"
 *
 * normalizeOrigin() ist rein (kein browser/window-Zugriff im Modul-Top-Level),
 * daher unter dem reinen Node-Testrunner sicher importierbar.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { normalizeOrigin } from "../components/ControlCenter/open-autodarts";

describe("normalizeOrigin", () => {
  it("1. fehlender Origin (undefined) fällt auf play.autodarts.io zurück", () => {
    assert.equal(normalizeOrigin(undefined), "https://play.autodarts.io");
  });

  it("2. null fällt auf play.autodarts.io zurück", () => {
    assert.equal(normalizeOrigin(null), "https://play.autodarts.io");
  });

  it("3. leerer String fällt auf play.autodarts.io zurück (kein Match)", () => {
    assert.equal(normalizeOrigin(""), "https://play.autodarts.io");
  });

  it("4. gültige .io-URL wird als Origin übernommen", () => {
    assert.equal(normalizeOrigin("https://play.autodarts.io/matches/abc-123"), "https://play.autodarts.io");
  });

  it("5. gültige .com-URL wird als Origin übernommen (nicht auf .io umgeschrieben)", () => {
    assert.equal(normalizeOrigin("https://play.autodarts.com/lobbies/xyz"), "https://play.autodarts.com");
  });

  it("6. http (nicht https) wird ebenfalls erkannt", () => {
    assert.equal(normalizeOrigin("http://play.autodarts.io/"), "http://play.autodarts.io");
  });

  it("7. fremde Domain fällt auf play.autodarts.io zurück (kein offener Redirect)", () => {
    assert.equal(normalizeOrigin("https://evil.example.com/"), "https://play.autodarts.io");
  });

  it("8. Groß-/Kleinschreibung im Protokoll wird toleriert", () => {
    assert.equal(normalizeOrigin("HTTPS://play.autodarts.io/"), "HTTPS://play.autodarts.io");
  });
});
