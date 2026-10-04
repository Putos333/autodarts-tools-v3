import { defineConfig } from "@playwright/test";

/**
 * Browser-E2E für die gebaute Chrome-MV3-Extension (.output/chrome-mv3).
 *
 * Voraussetzungen:
 *  - Build vorhanden: `yarn wxt build`
 *  - Playwright-Chromium (Revision zu @playwright/test 1.62.1) im lokalen Cache
 *  - Display: ohne $DISPLAY z. B. `xvfb-run -a yarn test:e2e`
 *
 * Bewusst minimal: ein Worker, keine Parallelität, kein Retry, keine
 * Multi-Browser-Matrix, keine CI-Sonderlogik. Die Extension wird in
 * tests/e2e/fixtures/extension.ts per Persistent-Context geladen.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.01,
    },
  },
  reporter: [ [ "list" ] ],
  use: {
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
    trace: "off",
  },
  projects: [
    { name: "chromium-extension" },
  ],
});
