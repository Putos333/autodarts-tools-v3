/**
 * Elite Settings — Integration bereits fertiger, bisher nicht eingebundener
 * Komponenten (CcConnectionCard.vue, CcToolsStatus.vue).
 *
 * Reine Quelltext-Assertions (wie bei den bestehenden "Match Center Phase 5"-
 * und "Friends & Party V4"-Regressionssuiten): kein Vue-Test-Tooling im
 * Projekt vorhanden.
 *
 *   node --import tsx --test "tests/*.test.ts"
 */

import { strict as assert } from "node:assert";
import { readdir, readFile } from "node:fs/promises";
import { describe, it } from "node:test";

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Elite Settings — Integration Regression", () => {
  it("CcSettings.vue bindet CcConnectionCard.vue und CcToolsStatus.vue ein — beide vorher in keiner View referenziert", async () => {
    const text = await source("components/ControlCenter/views/CcSettings.vue");
    assert.match(text, /import CcConnectionCard from "\.\.\/CcConnectionCard\.vue"/);
    assert.match(text, /import CcToolsStatus from "\.\.\/CcToolsStatus\.vue"/);
    assert.match(text, /<CcConnectionCard \/>/);
    assert.match(text, /<CcToolsStatus \/>/);
  });

  it("CcConnectionCard.vue nutzt ausschließlich useControlCenterStatus() — keine neue Datenquelle, kein neuer Endpoint", async () => {
    const text = await source("components/ControlCenter/CcConnectionCard.vue");
    assert.match(text, /useControlCenterStatus\(\)/);
    assert.doesNotMatch(text, /fetchWithAuth|new WebSocket\(/);
  });

  it("CcToolsStatus.vue liest AutodartsToolsConfig read-only und räumt seinen Config-Watcher beim Unmount auf (Lifecycle Contract)", async () => {
    const text = await source("components/ControlCenter/CcToolsStatus.vue");
    assert.match(text, /AutodartsToolsConfig\.watch/);
    assert.match(text, /onBeforeUnmount\(\(\) => \{\s*disposed = true;\s*unwatchConfig\?\.\(\);/);
    // Guard gegen Watcher-Leak: Registrierung nach dem initialen await darf nicht
    // mehr laufen, wenn die Komponente währenddessen bereits unmounted wurde.
    assert.match(text, /if \(disposed\) return;\s*unwatchConfig = AutodartsToolsConfig\.watch/);
    // Read-only: kein setValue()/set() auf die Config von hier aus.
    assert.doesNotMatch(text, /AutodartsToolsConfig\.setValue/);
  });

  it("CcPreviewSection.vue bleibt bewusst unintegriert (obsoleter MVP-1-Platzhalter, kein View importiert es)", async () => {
    const viewFiles = await readdir(new URL("../components/ControlCenter/views/", import.meta.url));
    const viewSources = await Promise.all(
      viewFiles.filter((file) => file.endsWith(".vue")).map((file) => source(`components/ControlCenter/views/${file}`)),
    );
    for (const text of viewSources) {
      assert.doesNotMatch(text, /CcPreviewSection/);
    }
  });
});

/**
 * Runtime-Test 2026-08-27 (echter Extension-Build, gemockte chrome.storage-
 * APIs, reale Storage-Transitions statt Quelltext-Simulation) hat zwei Bugs
 * gefunden, die dieselbe Watcher-Leak-Race betreffen wie oben bei
 * CcToolsStatus.vue — beide Regressionen unten fixiert, hier gegen erneutes
 * Auftreten gepinnt.
 */
describe("Elite Settings — Runtime-Test-Fixes 2026-08-27", () => {
  it("useControlCenterStatus.ts hält den Auth-Status (authTokenAt) live nach — ohne Watcher blieb 'Autodarts Auth' nach einem echten Login auf 'Kein Token' stehen", async () => {
    const text = await source("composables/useControlCenterStatus.ts");
    assert.match(text, /AutodartsToolsGlobalStatus\.watch\(\(value: IGlobalStatus\) => \{/);
    assert.match(text, /authTokenAt\.value = typeof tokenAt === "number" \? tokenAt : null;/);
    // Watcher muss auch tatsächlich abgeräumt werden (detach()-Teardown).
    assert.match(text, /\(\) => unwatchAuth\?\.\(\),/);
  });

  /** Dieselbe Disposed-Guard-Prüfung wie oben bei CcToolsStatus.vue, für die beiden anderen in CcSettings.vue eingebetteten Komponenten. */
  function assertDisposedGuard(text: string): void {
    assert.match(text, /let disposed = false;/);
    assert.match(text, /await loadConfig\(\);\s*if \(disposed\) return;\s*unwatch = AutodartsToolsConfig\.watch/);
    assert.match(text, /onBeforeUnmount\(\(\) => \{\s*disposed = true;\s*unwatch\?\.\(\);/);
  }

  it("CcSound.vue räumt seinen Config-Watcher auch bei Unmount während des initialen Ladens auf (Lifecycle Contract)", async () => {
    assertDisposedGuard(await source("components/ControlCenter/views/CcSound.vue"));
  });

  it("CcLighting.vue räumt seinen Config-Watcher auch bei Unmount während des initialen Ladens auf (Lifecycle Contract)", async () => {
    assertDisposedGuard(await source("components/ControlCenter/views/CcLighting.vue"));
  });
});
