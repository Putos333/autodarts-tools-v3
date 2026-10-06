import { expect, type BrowserContext, type Page } from "@playwright/test";

import type { IQaViewport } from "./viewports";

export interface IOpenControlCenterOptions {
  viewport?: IQaViewport;
  /** Bereichs-Hash ohne "#", z. B. "stats". Standard: Standardbereich (Dashboard). */
  hash?: string;
  /** Hängt vor dem Laden einen Layout-Shift-Beobachter an (`readLayoutShift`). */
  trackLayoutShift?: boolean;
}

/**
 * Öffnet die Control-Center-Seite der geladenen Extension deterministisch.
 *
 * Determinismus (im UI-1-Spike belegt, identische Screenshot-Hashes über Frames und Sessions):
 *  - Die Seite ruft extern `…/api/marathon/health` (KI-Backend) auf. Der Request wird auf 404 gestubbt
 *    (entspricht dem beobachteten Zustand „KI-Backend nicht erreichbar“) und der Helper wartet auf genau
 *    diesen Endzustand, statt zu raten.
 *  - `networkidle` wird nie erreicht (dauerhafte Hintergrundaktivität der Seite) und wird deshalb nicht benutzt.
 */
export async function openControlCenter(
  context: BrowserContext,
  extensionId: string,
  options: IOpenControlCenterOptions = {},
): Promise<Page> {
  await context.route("**/api/marathon/health", route => route.fulfill({ status: 404, body: "" }));

  const page = await context.newPage();
  if (options.viewport) await page.setViewportSize({ width: options.viewport.width, height: options.viewport.height });

  if (options.trackLayoutShift) {
    await page.addInitScript(() => {
      const holder = window as unknown as { __ccLayoutShift: number };
      holder.__ccLayoutShift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
          if (!entry.hadRecentInput) holder.__ccLayoutShift += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
  }

  await page.goto(`chrome-extension://${extensionId}/controlcenter.html${options.hash ? `#${options.hash}` : ""}`);
  await expect(page.getByText("KI-Backend nicht erreichbar")).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  return page;
}

/** Kumulierter Layout-Shift (CLS-Näherung, ohne Nutzereingaben) seit dem Laden. */
export async function readLayoutShift(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __ccLayoutShift: number }).__ccLayoutShift);
}
