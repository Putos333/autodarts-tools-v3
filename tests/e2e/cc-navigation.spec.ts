import { expect, test } from "./fixtures/extension";
import { openControlCenter, readLayoutShift } from "./helpers/control-center";
import { VIEWPORTS } from "./helpers/viewports";

/**
 * App-Shell und Header (UI-2A): Verhalten, Tastatur und Zugänglichkeit in den vier verbindlichen
 * Viewports (docs/UI_GOVERNANCE.md). Ohne zusätzliche Abhängigkeit (kein axe): Rollen-/Namens-Locator,
 * Tastatur-Eingaben, berechnete Stile und Bounding-Boxen.
 *
 * Pixelvergleiche stehen in cc-shell-visual.spec.ts.
 */

const HIT_TARGET_PX = 44;
const MAX_HEADER_SHARE = 1 / 3;
const MAX_LAYOUT_SHIFT = 0.1;
const MOBILE_MAX_WIDTH = 640;

for (const viewport of VIEWPORTS) {
  test.describe(`cc-navigation ${viewport.name} ${viewport.width}x${viewport.height}`, () => {
    test("Struktur: Header-Höhe, Zielgrößen, Landmarks, Layout-Shift", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport, trackLayoutShift: true });

      // Header belegt höchstens ein Drittel der Viewport-Höhe.
      const header = await page.locator(".cc-topbar").boundingBox();
      expect(header).not.toBeNull();
      expect(header!.height / viewport.height).toBeLessThanOrEqual(MAX_HEADER_SHARE);

      // Alle Header-Aktionen: Zielgröße und zugänglicher Name (auch als Icon-Button).
      const buttons = page.locator(".cc-topbar .cc-btn");
      await expect(buttons).toHaveCount(3);
      for (const button of await buttons.all()) {
        const box = await button.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(HIT_TARGET_PX);
        expect(box!.width).toBeGreaterThanOrEqual(HIT_TARGET_PX);
      }
      // Auf den Header begrenzt: „Autodarts öffnen“ kommt auch in den Quick-Play-Kacheln vor.
      for (const name of [ "Aktualisieren", "Autodarts öffnen", "Klassische Ansicht" ]) {
        await expect(page.getByRole("banner").getByRole("button", { name })).toBeVisible();
      }

      // Landmarks: genau eine sichtbare Navigation (die jeweils andere ist ausgeblendet), ein Header, ein Main, eine h1.
      await expect(page.getByRole("navigation")).toHaveCount(1);
      await expect(page.getByRole("banner")).toHaveCount(1);
      await expect(page.getByRole("main")).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dashboard");
      await expect(page.locator("[aria-current=\"page\"]:visible")).toHaveCount(1);

      // Kein horizontales Scrollen, kein nennenswerter Layout-Shift.
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
      expect(await readLayoutShift(page)).toBeLessThanOrEqual(MAX_LAYOUT_SHIFT);
    });

    test("Tastatur: Skip-Link, sichtbarer Fokus an Header-Aktionen", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });

      // Erster Tab-Stopp ist der Skip-Link, sichtbar im Viewport und mit Fokusring.
      await page.keyboard.press("Tab");
      const skipLink = page.getByTestId("cc-skip-link");
      await expect(skipLink).toBeFocused();
      const skipBox = await skipLink.boundingBox();
      expect(skipBox!.y).toBeGreaterThanOrEqual(0);
      expect(skipBox!.y + skipBox!.height).toBeLessThanOrEqual(viewport.height);
      expect(await skipLink.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe("none");

      // Enter springt zum Inhalt, ohne den Hash-Router anzutasten.
      await page.keyboard.press("Enter");
      await expect(page.getByRole("main")).toBeFocused();
      expect(new URL(page.url()).hash).toBe("#dashboard");

      // Jede Header-Aktion zeigt per Tastatur einen sichtbaren Fokusring.
      for (const testId of [ "cc-refresh", "cc-open-autodarts", "cc-open-classic" ]) {
        const target = page.getByTestId(testId);
        for (let presses = 0; presses < 80 && !(await target.evaluate(el => el === document.activeElement)); presses += 1) {
          await page.keyboard.press("Tab");
        }
        await expect(target).toBeFocused();
        const outline = await target.evaluate((el) => {
          const style = getComputedStyle(el);
          return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
        });
        expect(outline.style).not.toBe("none");
        expect(outline.width).toBeGreaterThanOrEqual(2);
      }
    });

    test("Bereichswechsel: Fokus auf Überschrift, Titel; nicht beim Erstladen", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });
      const heading = page.getByTestId("cc-heading");
      await expect(heading).not.toBeFocused();

      const isMobile = viewport.width <= MOBILE_MAX_WIDTH;
      await page.getByTestId(isMobile ? "cc-bottom-nav-stats" : "cc-nav-stats").click();
      await expect(heading).toHaveText("Statistiken");
      await expect(heading).toBeFocused();
      await expect(page).toHaveTitle(/Statistiken/);
      expect(new URL(page.url()).hash).toBe("#stats");
    });

    test("Deep-Link: Bereich aus dem Hash, Fokus bleibt unangetastet", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport, hash: "stats" });
      const heading = page.getByTestId("cc-heading");
      await expect(heading).toHaveText("Statistiken");
      await expect(heading).not.toBeFocused();
      await expect(page).toHaveTitle(/Statistiken/);
    });
  });
}

test("Reduced Motion: keine Übergänge an den Header-Aktionen", async ({ context, extensionId }) => {
  const page = await openControlCenter(context, extensionId, { viewport: VIEWPORTS[1] });
  const durationOf = () => page.getByTestId("cc-open-autodarts").evaluate(el => getComputedStyle(el).transitionDuration);

  expect(await durationOf()).not.toBe("0s");
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(await durationOf()).toBe("0s");
});
