import { expect, test } from "./fixtures/extension";
import { openFakeAutodarts, TOAST } from "./helpers/ws";

/**
 * Einziger Screenshot-Test: Disconnect-Toast. Viewport ist durch den Context fest auf 1280x800 gesetzt
 * (tests/e2e/fixtures/extension.ts); Text und Host des Toasts sind deterministisch (e2e-fake.autodarts.invalid, code=1001).
 *
 * Baseline neu erzeugen (bewusst, nach Sichtprüfung): yarn test:e2e:update tests/e2e/toast-visual.spec.ts
 * Die Baseline-Datei trägt die Plattform im Namen (…-chromium-extension-linux.png); sie gilt nur für Linux.
 *
 * Referenzumgebung der Baseline: Linux Mint 22.3 (Kernel 7.0), Chrome for Testing 151.0.7922.34 (Playwright 1.62.1,
 * Revision chromium-1234), headed unter Xvfb, Viewport 1280x800, Device-Scale-Faktor 1 (PNG 350x136 = CSS-Maß).
 * Schriftstapel des Toasts: -apple-system, "Segoe UI", Roboto, sans-serif -> auf dieser Maschine ist keine davon
 * installiert; fontconfig löst auf Noto Sans (Regular) auf. Auf Systemen mit anderer Standard-Sans-Schrift kann der
 * Vergleich abweichen. Dann Umgebung prüfen, nicht die Toleranz (maxDiffPixelRatio) erhöhen.
 */
test.describe("toast-visual", () => {
  test("Disconnect-Toast entspricht der Baseline", async ({ context }) => {
    const board = await openFakeAutodarts(context);
    board.closeFromServer(await board.open(), 1001);

    const toast = board.page.locator(TOAST);
    await expect(toast).toBeVisible();
    await expect(toast).toHaveScreenshot("disconnect-toast.png");
  });
});
