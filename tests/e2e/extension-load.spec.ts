import { expect, test } from "./fixtures/extension";
import { openFakeAutodarts } from "./helpers/ws";

test.describe("extension-load", () => {
  test("Extension lädt: Service Worker, Extension-ID, Manifest MV3", async ({ serviceWorker, extensionId }) => {
    expect(serviceWorker.url()).toMatch(/^chrome-extension:\/\/[a-p]{32}\/background\.js$/);
    expect(extensionId).toMatch(/^[a-p]{32}$/);

    const manifest = await serviceWorker.evaluate(() => (globalThis as any).chrome.runtime.getManifest());
    expect(manifest.manifest_version).toBe(3);

    const matches: string[] = manifest.content_scripts.flatMap((script: { matches: string[] }) => script.matches);
    expect(matches).toContain("*://play.autodarts.io/*");
  });

  test("Content-Script installiert den WebSocket-Hook auf play.autodarts.io", async ({ context, extensionId }) => {
    // openFakeAutodarts wartet bereits auf die Meldung "[WebSocket Capture] Initialized successfully".
    const { page } = await openFakeAutodarts(context);

    // injectScript(..., { keepInDom: true }) lässt das Skript-Element der Extension im DOM.
    const injected = page.locator("script[src*=\"websocket-capture.js\"]");
    await expect(injected).toHaveAttribute("src", new RegExp(`^chrome-extension://${extensionId}/websocket-capture\\.js`));
  });
});
