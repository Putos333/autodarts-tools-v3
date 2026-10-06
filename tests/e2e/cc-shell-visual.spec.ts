import { expect, test } from "./fixtures/extension";
import { VIEWPORTS } from "./helpers/viewports";

/**
 * Control-Center-Shell (Dashboard) in den vier verbindlichen Visual-QA-Viewports
 * (tests/e2e/helpers/viewports.ts, docs/UI_GOVERNANCE.md). Kein Pixel-Ersatz für Funktionstests,
 * sondern Regressionsschutz für das Design-System (Tokens, Shell, Navigation, Responsive).
 *
 * Determinismus (vorab im Spike belegt: identische Hashes über Frames und Sessions):
 *  - Die Seite ruft extern `…/api/marathon/health` (KI-Backend) auf. Der Request wird auf 404 gestubbt
 *    (entspricht dem bisher beobachteten Zustand „KI-Backend nicht erreichbar“) und der Test wartet auf
 *    genau diesen Endzustand, bevor er den Screenshot macht.
 *  - Das Versions-Badge wird maskiert, damit ein Versions-Bump keine Baselines bricht.
 *  - Animationen sind per Konfiguration deaktiviert (playwright.config.ts).
 *
 * Schriften: `entrypoints/controlcenter/style.css` deklariert Barlow Condensed / Open Sans, bündelt sie aber
 * NICHT (kein @font-face). Auf dieser Umgebung löst fontconfig beide auf Noto Sans auf (fonts-noto-core,
 * identisch zur CI). Die Baselines halten also den Fallback-Zustand fest; wenn Schriften gebündelt werden,
 * sind sie bewusst nach Sichtprüfung zu erneuern. Umgebung prüfen, nicht die Toleranz erhöhen.
 *
 * Baseline neu erzeugen (bewusst, nach Sichtprüfung): yarn test:e2e:update tests/e2e/cc-shell-visual.spec.ts
 */
test.describe("cc-shell-visual", () => {
  for (const viewport of VIEWPORTS) {
    test(`Dashboard ${viewport.name} ${viewport.width}x${viewport.height}`, async ({ context, extensionId }) => {
      await context.route("**/api/marathon/health", route => route.fulfill({ status: 404, body: "" }));

      const page = await context.newPage();
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`chrome-extension://${extensionId}/controlcenter.html`);

      // Endzustand abwarten, statt zu raten.
      await expect(page.getByText("KI-Backend nicht erreichbar")).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();

      // Responsive-Grundregel: kein horizontales Scrollen der Seite.
      const overflowsHorizontally = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflowsHorizontally).toBe(false);

      await expect(page).toHaveScreenshot(`cc-dashboard-${viewport.name}-${viewport.width}x${viewport.height}.png`, {
        mask: [ page.locator(".cc-topbar-version") ],
      });
    });
  }
});
