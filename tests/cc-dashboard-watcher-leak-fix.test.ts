/**
 * Runtime-Test 2026-08-27 (Folge-Checkpoint) — dieselbe unguarded async-
 * onMounted()→watch()-Race, die in CcSettings.vue/CcToolsStatus.vue/
 * CcSound.vue/CcLighting.vue empirisch gegen den echten Extension-Build
 * nachgewiesen wurde (tests/elite-settings-integration.test.ts), bestand
 * identisch in acht weiteren Dateien (Code-Review-Fund, hier nachträglich
 * geschlossen): registriert eine Komponente ihren Storage-Watcher erst nach
 * einem `await` in `onMounted`, kann `onBeforeUnmount` dazwischen laufen und
 * einen nie wieder abgeräumten Watcher hinterlassen. Fix überall identisch:
 * ein synchron in `onBeforeUnmount` gesetztes `disposed`-Flag, das die
 * verspätete Registrierung nach dem `await` verhindert.
 *
 * Reine Quelltext-Assertions (Projektkonvention, kein Vue-Test-Tooling).
 *
 *   node --import tsx --test "tests/*.test.ts"
 */

import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

/** Prüft den Disposed-Guard für eine Komponente mit genau einer Watcher-Variable. */
function assertSingleWatcherGuard(text: string, varName: string): void {
  assert.match(text, /let disposed = false;/);
  const registerPattern = new RegExp(`if \\(disposed\\) return;\\s*${varName} = `);
  assert.match(text, registerPattern);
  const teardownPattern = new RegExp(`onBeforeUnmount\\(\\(\\) => \\{\\s*disposed = true;\\s*${varName}\\?\\.\\(\\);`);
  assert.match(text, teardownPattern);
}

describe("Elite Dashboard — Watcher-Leak-Guard-Regression 2026-08-27", () => {
  it("CcDashboardSummary.vue: disposed-Guard schützt beide Watcher (unwatchCmr, unwatchTraining)", async () => {
    const text = await source("components/ControlCenter/CcDashboardSummary.vue");
    assert.match(text, /let disposed = false;/);
    // Beide Registrierungen müssen NACH dem Guard stehen — nicht nur unwatchCmr
    // (Mutationstest bestätigt: ein isoliertes Match auf unwatchCmr allein lässt
    // eine vor den Guard verschobene unwatchTraining-Zeile unbemerkt durch).
    assert.match(
      text,
      /if \(disposed\) return;\s*unwatchCmr = AutodartsToolsCanonicalMatchResults\.watch\(\s*.*unwatchTraining = AutodartsToolsTrainingHistory\.watch/s,
    );
    assert.match(text, /onBeforeUnmount\(\(\) => \{\s*disposed = true;\s*unwatchCmr\?\.\(\);\s*unwatchTraining\?\.\(\);/);
  });

  it("CcSystemStatusFooter.vue: disposed-Guard schützt unwatchConfig", async () => {
    assertSingleWatcherGuard(await source("components/ControlCenter/CcSystemStatusFooter.vue"), "unwatchConfig");
  });

  it("CcHeroBand.vue: disposed-Guard schützt unwatchGlobalStatus", async () => {
    assertSingleWatcherGuard(await source("components/ControlCenter/CcHeroBand.vue"), "unwatchGlobalStatus");
  });

  it("CcRecentActivity.vue: disposed-Guard schützt unwatchCmr", async () => {
    assertSingleWatcherGuard(await source("components/ControlCenter/CcRecentActivity.vue"), "unwatchCmr");
  });

  it("CcPerformanceStrip.vue: disposed-Guard schützt unwatchCmr", async () => {
    assertSingleWatcherGuard(await source("components/ControlCenter/CcPerformanceStrip.vue"), "unwatchCmr");
  });

  it("CcHomeTraining.vue: disposed-Guard schützt unwatchTraining", async () => {
    assertSingleWatcherGuard(await source("components/ControlCenter/CcHomeTraining.vue"), "unwatchTraining");
  });

  it("CcHistory.vue: disposed-Guard schützt unwatch", async () => {
    assertSingleWatcherGuard(await source("components/ControlCenter/views/CcHistory.vue"), "unwatch");
  });

  it("CcStats.vue: disposed-Guard schützt unwatch", async () => {
    assertSingleWatcherGuard(await source("components/ControlCenter/views/CcStats.vue"), "unwatch");
  });
});
