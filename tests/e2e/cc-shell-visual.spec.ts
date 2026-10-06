import { expect, test } from "./fixtures/extension";
import { openControlCenter } from "./helpers/control-center";
import { VIEWPORTS } from "./helpers/viewports";

/**
 * Control-Center-Shell (Dashboard) in den vier verbindlichen Visual-QA-Viewports
 * (tests/e2e/helpers/viewports.ts, docs/UI_GOVERNANCE.md). Kein Pixel-Ersatz für Funktionstests,
 * sondern Regressionsschutz für das Design-System (Tokens, Shell, Navigation, Responsive).
 *
 * Determinismus (vorab im Spike belegt: identische Hashes über Frames und Sessions):
 *  - Stub des externen KI-Backend-Requests und Warten auf den Endzustand: tests/e2e/helpers/control-center.ts.
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
      const page = await openControlCenter(context, extensionId, { viewport });

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
