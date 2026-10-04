import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { chromium, expect, test as base, type BrowserContext, type Worker } from "@playwright/test";

/** Gebauter Extension-Pfad (aus `yarn wxt build`). Relativ zum Repo-Root, in dem Playwright läuft. */
export const EXTENSION_PATH = resolve(process.cwd(), ".output/chrome-mv3");

interface ExtensionFixtures {
  context: BrowserContext;
  serviceWorker: Worker;
  extensionId: string;
}

/**
 * Überschreibt den eingebauten `context` durch einen Persistent-Context mit geladener Extension.
 *
 * - `--disable-extensions` ist Playwright-Standard und muss für das Laden entfernt werden.
 * - Browser: standardmäßig das von @playwright/test verwaltete Chromium.
 *   Lokaler Fallback: ADT_E2E_CHROMIUM=/pfad/zu/chromium (System-Chromium).
 *   Google Chrome wird nicht unterstützt (lädt die Extension per --load-extension nicht).
 * - Headed (Standard); ohne $DISPLAY: `xvfb-run -a yarn test:e2e`.
 */
export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    if (!existsSync(join(EXTENSION_PATH, "manifest.json"))) {
      throw new Error(`Extension-Build fehlt: ${EXTENSION_PATH} (zuerst "yarn wxt build" ausführen)`);
    }
    const userDataDir = mkdtempSync(join(tmpdir(), "adt-e2e-"));
    const context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: process.env.ADT_E2E_CHROMIUM || undefined,
      headless: false,
      viewport: { width: 1280, height: 800 },
      ignoreDefaultArgs: [ "--disable-extensions" ],
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
    try {
      await use(context);
    } finally {
      await context.close();
      rmSync(userDataDir, { recursive: true, force: true });
    }
  },

  serviceWorker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 15_000 });
    await use(worker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

export { expect };
