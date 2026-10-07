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

/**
 * Desktop-Navigation (UI-2B): gruppierte Sidebar in den beiden Desktop-Viewports (1920x1080 und 1280x720).
 * Tablet (Icon-Rail) und Mobil sind bewusst nicht Gegenstand (UI-2C), laufen aber in den Tests oben weiter mit.
 */
const GROUPS: ReadonlyArray<{ label: string; ids: string[] }> = [
  { label: "Live", ids: [ "dashboard", "board", "match", "matchcenter" ] },
  { label: "Spielen", ids: [ "training", "party" ] },
  { label: "Auswertung", ids: [ "stats", "history" ] },
  { label: "System", ids: [ "settings" ] },
];

for (const viewport of VIEWPORTS.filter(candidate => candidate.name === "wide" || candidate.name === "desktop")) {
  test.describe(`cc-desktop-nav ${viewport.name} ${viewport.width}x${viewport.height}`, () => {
    test("Gruppen, Zielgrößen, alle Einträge sichtbar, kein horizontales Scrollen", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });

      const navigation = page.getByRole("navigation", { name: "Control-Center-Bereiche" });
      await expect(navigation).toBeVisible();
      for (const group of GROUPS) {
        const region = navigation.getByRole("group", { name: group.label });
        await expect(region).toBeVisible();
        await expect(region.getByRole("list").getByRole("listitem")).toHaveCount(group.ids.length);
        for (const id of group.ids) {
          const item = page.getByTestId(`cc-nav-${id}`);
          await expect(item).toBeVisible();
          const box = await item.boundingBox();
          expect(box!.height).toBeGreaterThanOrEqual(HIT_TARGET_PX);
          // Vollständig im Viewport: die Navigation muss ohne Scrollen erreichbar sein.
          expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
        }
      }

      // Beschriftung ist sichtbar (volle Sidebar, keine Rail) und die Nav selbst scrollt nicht horizontal.
      await expect(page.getByTestId("cc-nav-stats").locator(".cc-nav-label")).toBeVisible();
      expect(await navigation.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      // Ohne Live-Match passt die gesamte Navigation ohne internen Scrollbalken in die Sidebar.
      expect(await navigation.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    });

    test("Aktiver Zustand: genau ein Eintrag, aria-current, sichtbarer Kontrast, Wechsel setzt Hash", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });
      const active = page.getByTestId("cc-nav-dashboard");
      const inactive = page.getByTestId("cc-nav-stats");
      await expect(active).toHaveAttribute("aria-current", "page");
      await expect(page.locator(".cc-nav [aria-current=\"page\"]")).toHaveCount(1);

      const look = (locator: typeof active) => locator.evaluate((el) => {
        const style = getComputedStyle(el);
        return { background: style.backgroundColor, border: style.borderTopColor, weight: Number(style.fontWeight) };
      });
      const [ a, i ] = [ await look(active), await look(inactive) ];
      expect(a.background).not.toBe(i.background);
      expect(a.border).not.toBe(i.border);
      expect(a.weight).toBeGreaterThan(i.weight);
      // Der Akzentbalken liegt im Eintrag (nicht abgeschnitten) und ist tatsächlich sichtbar.
      expect(await active.evaluate(el => getComputedStyle(el, "::before").content)).not.toBe("none");

      await inactive.click();
      await expect(inactive).toHaveAttribute("aria-current", "page");
      await expect(active).not.toHaveAttribute("aria-current", "page");
      expect(new URL(page.url()).hash).toBe("#stats");
    });

    test("Hover: Eintrag ändert Hintergrund und Textfarbe", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });
      const item = page.getByTestId("cc-nav-training");
      const read = () => item.evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color }));
      const before = await read();
      await item.hover();
      await expect.poll(read).not.toEqual(before);

      // Hover auf dem aktiven Eintrag lässt das Akzent-Icon unverändert (kein Flackern des Aktivzustands).
      const activeIcon = page.getByTestId("cc-nav-dashboard").locator(".cc-nav-icon");
      const iconColor = () => activeIcon.evaluate(el => getComputedStyle(el).color);
      const iconBefore = await iconColor();
      await page.getByTestId("cc-nav-dashboard").hover();
      expect(await iconColor()).toBe(iconBefore);
    });

    test("Tastatur: Tab-Reihenfolge Skip-Link → Navigation → Header, sichtbarer Fokusring, Enter navigiert", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });

      await page.keyboard.press("Tab");
      await expect(page.getByTestId("cc-skip-link")).toBeFocused();

      // Alle neun Einträge in Registry-Reihenfolge, jeweils mit sichtbarem Ring.
      const order = GROUPS.flatMap(group => group.ids);
      for (const id of order) {
        await page.keyboard.press("Tab");
        const item = page.getByTestId(`cc-nav-${id}`);
        await expect(item).toBeFocused();
        const outline = await item.evaluate((el) => {
          const style = getComputedStyle(el);
          return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
        });
        expect(outline.style).not.toBe("none");
        expect(outline.width).toBeGreaterThanOrEqual(2);
        // Ring wird nicht vom scrollenden Container abgeschnitten: Fokus-Box liegt im Viewport.
        const box = await item.boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y).toBeGreaterThanOrEqual(0);
      }

      // Enter auf einem fokussierten Eintrag navigiert (Fokus wandert danach auf die Überschrift).
      await page.getByTestId("cc-nav-history").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("cc-heading")).toHaveText("Verlauf");
      expect(new URL(page.url()).hash).toBe("#history");

      // Nach der Navigation folgt der Header mit seinen Aktionen (kein Fokusfang in der Sidebar).
      await page.getByTestId("cc-nav-settings").focus();
      await page.keyboard.press("Tab");
      await expect(page.locator(".cc-topbar").locator(":focus, :focus-within").first()).toBeAttached();
    });

    test("Reduced Motion: keine Übergänge an Navigationseinträgen", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });
      const durationOf = () => page.getByTestId("cc-nav-board").evaluate(el => getComputedStyle(el).transitionDuration);
      expect(await durationOf()).not.toBe("0s");
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(await durationOf()).toBe("0s");
    });
  });
}
