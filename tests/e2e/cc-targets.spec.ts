import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures/extension";
import { openControlCenter } from "./helpers/control-center";
import { VIEWPORTS } from "./helpers/viewports";

/**
 * Button- und Touch-Target-System (UI-2E K1): Zielgrößen, Zustände und Tastaturfokus in den vier
 * verbindlichen Viewports (docs/UI_GOVERNANCE.md, Abschnitt 19). Ohne zusätzliche Abhängigkeit:
 * berechnete Stile und Bounding-Boxen der geladenen Extension.
 *
 * Bewusst nicht Teil der Prüfung: Textlinks im Fließtext (`display: inline`, WCAG-2.5.8-Ausnahme „inline“).
 * Die Regeln selbst stehen in tests/design-governance.test.ts, Pixelvergleiche in cc-shell-visual.spec.ts.
 */

const HIT_TARGET_PX = 44;
/** Bereiche mit Inhalt im Standardzustand (ohne Live-Daten); Hash ohne "#", "" = Dashboard. */
const SECTION_HASHES = [ "", "board", "match", "matchcenter", "training", "party", "stats", "history", "settings" ];

async function gotoSection(page: Page, hash: string): Promise<void> {
  await page.goto(`${page.url().split("#")[0]}${hash ? `#${hash}` : ""}`);
  await page.reload();
  await expect(page.getByRole("main")).toBeVisible();
}

for (const viewport of VIEWPORTS) {
  test.describe(`cc-targets ${viewport.name} ${viewport.width}x${viewport.height}`, () => {
    test("alle sichtbaren Bedienelemente sind mindestens 44px hoch, kein Seitenüberlauf", async ({ context, extensionId }) => {
      test.setTimeout(120_000);
      const page = await openControlCenter(context, extensionId, { viewport });
      let checked = 0;
      const offenders: string[] = [];
      for (const hash of SECTION_HASHES) {
        await gotoSection(page, hash);
        const result = await page.evaluate((min) => {
          const visible = (element: Element): boolean => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
          };
          const controls = Array.from(document.querySelectorAll(
            "button, [role=\"button\"], input:not([type=\"hidden\"]), select, textarea, summary, a[href]",
          )).filter(visible).filter(element => !(element.tagName === "A" && getComputedStyle(element).display === "inline"));
          const tooSmall = controls
            .map(element => ({ element, rect: element.getBoundingClientRect() }))
            .filter(({ rect }) => rect.height < min - 0.01)
            .map(({ element, rect }) => `${element.tagName.toLowerCase()}.${String(element.className).trim().split(/\s+/).join(".")} ${Math.round(rect.width)}x${rect.height.toFixed(1)}`);
          const root = document.documentElement;
          return { count: controls.length, tooSmall, overflow: root.scrollWidth > root.clientWidth };
        }, HIT_TARGET_PX);
        offenders.push(...result.tooSmall.map(entry => `#${hash || "dashboard"}: ${entry}`));
        expect(result.overflow, `horizontaler Überlauf auf #${hash || "dashboard"}`).toBe(false);
        checked += result.count;
      }
      expect(offenders, `Ziele unter ${HIT_TARGET_PX}px`).toEqual([]);
      expect(checked, "geprüfte Bedienelemente").toBeGreaterThan(50);
    });

    test(".cc-btn hat Hover-Lift, Active nimmt ihn zurück, disabled bewegt sich nicht", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });
      // Eigene Prüfknoten außerhalb der Vue-App (Vue setzt `disabled` an App-Knoten zurück): dieselben globalen
      // .cc-btn-Regeln, aber ein gesperrter Button, den es im Standardzustand sonst nicht gibt.
      await page.evaluate(() => {
        const host = document.createElement("div");
        host.id = "cc-targets-probe";
        host.style.cssText = "position:fixed;left:8px;top:8px;z-index:9999;display:flex;gap:12px;";
        host.innerHTML = "<button class=\"cc-btn\" id=\"probe-on\" type=\"button\">Aktiv</button><button class=\"cc-btn\" id=\"probe-off\" type=\"button\" disabled>Gesperrt</button>";
        document.body.appendChild(host);
      });
      const enabled = page.locator("#probe-on");
      const disabled = page.locator("#probe-off");
      expect((await enabled.boundingBox())!.height).toBeGreaterThanOrEqual(HIT_TARGET_PX - 0.01);
      expect((await disabled.boundingBox())!.height).toBeGreaterThanOrEqual(HIT_TARGET_PX - 0.01);

      await enabled.hover();
      await expect(enabled).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -1)");
      await page.mouse.down();
      await expect(enabled).toHaveCSS("transform", "none");
      await page.mouse.up();

      const resting = await disabled.evaluate(element => getComputedStyle(element).backgroundColor);
      await disabled.hover({ force: true });
      await page.waitForTimeout(300);
      await expect(disabled).toHaveCSS("transform", "none");
      await expect(disabled).toHaveCSS("cursor", "not-allowed");
      await expect(disabled).toHaveCSS("background-color", resting);
    });

    test("Tastatur: fokussierter .cc-btn behält den einheitlichen Fokusring und die Zielgröße", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport, hash: "training" });
      let reached = false;
      for (let step = 0; step < 80 && !reached; step++) {
        await page.keyboard.press("Tab");
        reached = await page.evaluate(() => document.activeElement?.matches("main .cc-btn") ?? false);
      }
      expect(reached, "ein .cc-btn ist per Tab erreichbar").toBe(true);
      const focused = page.locator(":focus");
      await expect(focused).toHaveCSS("outline-style", "solid");
      await expect(focused).toHaveCSS("outline-width", "2px");
      const box = await focused.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(HIT_TARGET_PX - 0.01);
      // Fokus bleibt sichtbar unterhalb des (sticky) Headers bzw. oberhalb der Bottom-Navigation.
      const visibleRegion = await focused.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const header = document.querySelector(".cc-topbar")!.getBoundingClientRect();
        const bottomNav = document.querySelector(".cc-bottom-nav");
        const bottomTop = bottomNav && getComputedStyle(bottomNav).display !== "none" ? bottomNav.getBoundingClientRect().top : window.innerHeight;
        const headerSticky = getComputedStyle(document.querySelector(".cc-topbar")!).position === "sticky";
        return { top: rect.top, bottom: rect.bottom, headerBottom: headerSticky ? header.bottom : 0, bottomTop };
      });
      expect(visibleRegion.top).toBeGreaterThanOrEqual(visibleRegion.headerBottom - 1);
      expect(visibleRegion.bottom).toBeLessThanOrEqual(visibleRegion.bottomTop + 1);
    });
  });
}
