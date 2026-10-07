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
 * Tablet (Icon-Rail) und Mobil (Bottom-Navigation) siehe die Blöcke „cc-tablet-rail“ und „cc-bottom-nav“ (UI-2C) weiter unten.
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

/**
 * Responsive Navigation (UI-2C): Tablet-Rail (768x1024) und mobile Bottom-Navigation (390x844).
 * Beide zeigen dieselben neun Bereiche in Registry-Reihenfolge; die Desktop-Sidebar bleibt Gegenstand von UI-2B.
 */
const ALL_IDS = GROUPS.flatMap(group => group.ids);
const RAIL_NAMES = [
  "Dashboard", "Board & Autoscoring", "Match", "Match Center", "Training",
  "Freunde / Party", "Statistiken", "Verlauf", "Einstellungen",
];

/** Rot statt Gold: Rot-Kanal dominiert, Grün-Kanal praktisch null (Gold hätte hohen Grün-Kanal). */
function isReddish(color: string): boolean {
  const [ r, g, b ] = (color.match(/[\d.]+/g) ?? []).map(Number);
  return r > 150 && g < 60 && b < 90;
}

const rgbOf = (locator: import("@playwright/test").Locator, property: "backgroundColor" | "color") =>
  locator.evaluate((el, prop) => getComputedStyle(el)[prop as "color"], property);

for (const viewport of VIEWPORTS.filter(candidate => candidate.name === "tablet")) {
  test.describe(`cc-tablet-rail ${viewport.name} ${viewport.width}x${viewport.height}`, () => {
    test("Rail: Breite, Gruppen, alle Einträge erreichbar, Namen, kein Überlauf", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });

      const sidebar = await page.locator(".cc-sidebar").boundingBox();
      expect(Math.round(sidebar!.width)).toBe(76);
      await expect(page.locator(".cc-bottom-nav")).toBeHidden();

      const navigation = page.getByRole("navigation", { name: "Control-Center-Bereiche" });
      for (const group of GROUPS) {
        await expect(navigation.getByRole("group", { name: group.label })).toBeAttached();
      }
      for (const [ index, id ] of ALL_IDS.entries()) {
        const item = page.getByTestId(`cc-nav-${id}`);
        await expect(item).toBeVisible();
        await expect(navigation.getByRole("button", { name: RAIL_NAMES[index], exact: true })).toHaveCount(1);
        const box = await item.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(HIT_TARGET_PX);
        expect(box!.width).toBeGreaterThanOrEqual(HIT_TARGET_PX);
        expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
        expect(box!.x + box!.width).toBeLessThanOrEqual(sidebar!.width);
      }

      // Gruppen sind echte Boxen (kein display:contents).
      for (const groupId of [ "live", "play", "analysis", "system" ]) {
        const display = await page.getByTestId(`cc-nav-group-${groupId}`).evaluate(el => getComputedStyle(el).display);
        expect(display).not.toBe("contents");
      }
      // Beschriftungen sind nur visuell versteckt.
      const label = await page.getByTestId("cc-nav-stats").locator(".cc-nav-label").boundingBox();
      expect(label!.width).toBeLessThanOrEqual(2);

      expect(await navigation.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    });

    test("Aktiver Zustand: ein Eintrag, aria-current, rot statt Gold, Wechsel setzt Hash", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });
      const active = page.getByTestId("cc-nav-dashboard");
      const inactive = page.getByTestId("cc-nav-stats");
      await expect(active).toHaveAttribute("aria-current", "page");
      await expect(page.locator(".cc-nav [aria-current=\"page\"]")).toHaveCount(1);

      expect(await rgbOf(active, "backgroundColor")).not.toBe(await rgbOf(inactive, "backgroundColor"));
      expect(isReddish(await rgbOf(active, "backgroundColor"))).toBe(true);
      expect(isReddish(await rgbOf(active.locator(".cc-nav-icon"), "color"))).toBe(true);
      expect(await active.evaluate(el => getComputedStyle(el, "::before").content)).not.toBe("none");

      await inactive.click();
      await expect(inactive).toHaveAttribute("aria-current", "page");
      expect(new URL(page.url()).hash).toBe("#stats");
    });

    test("Tastatur: Tab-Reihenfolge Skip-Link → Rail, sichtbarer Fokusring, Enter navigiert", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });
      await page.keyboard.press("Tab");
      await expect(page.getByTestId("cc-skip-link")).toBeFocused();

      for (const id of ALL_IDS) {
        await page.keyboard.press("Tab");
        const item = page.getByTestId(`cc-nav-${id}`);
        await expect(item).toBeFocused();
        const outline = await item.evaluate((el) => {
          const style = getComputedStyle(el);
          return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
        });
        expect(outline.style).not.toBe("none");
        expect(outline.width).toBeGreaterThanOrEqual(2);
      }

      await page.getByTestId("cc-nav-history").focus();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("cc-heading")).toHaveText("Verlauf");
      expect(new URL(page.url()).hash).toBe("#history");
    });

    test("Reduced Motion: keine Übergänge an den Rail-Einträgen", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });
      const durationOf = () => page.getByTestId("cc-nav-board").evaluate(el => getComputedStyle(el).transitionDuration);
      expect(await durationOf()).not.toBe("0s");
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(await durationOf()).toBe("0s");
    });
  });
}

for (const viewport of VIEWPORTS.filter(candidate => candidate.name === "mobile")) {
  test.describe(`cc-bottom-nav ${viewport.name} ${viewport.width}x${viewport.height}`, () => {
    test("Leiste: 56px hoch, neun Einträge, Scrollbereich, Zielgrößen, Labels ungekürzt, kein Seiten-Überlauf", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });
      await expect(page.locator(".cc-sidebar")).toBeHidden();
      const bar = page.getByRole("navigation", { name: "Control-Center-Bereiche (mobil)" });
      await expect(bar).toBeVisible();

      // Einträge 56px hoch; die Leiste trägt zusätzlich nur ihren 1px-Rahmen (unverändert gegenüber UI-2A).
      const barBox = await bar.boundingBox();
      expect(Math.round(barBox!.height)).toBeLessThanOrEqual(57);
      expect(Math.round(barBox!.y + barBox!.height)).toBe(viewport.height);
      expect(Math.round((await page.locator(".cc-bottom-nav-scroll").boundingBox())!.height)).toBe(56);

      const scroller = page.locator(".cc-bottom-nav-scroll");
      expect(await scroller.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
      await expect(page.locator(".cc-bottom-nav-item")).toHaveCount(ALL_IDS.length);

      for (const id of ALL_IDS) {
        const item = page.getByTestId(`cc-bottom-nav-${id}`);
        await expect(item).toHaveAccessibleName(/\S/);
        const box = await item.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(HIT_TARGET_PX);
        expect(box!.width).toBeGreaterThanOrEqual(HIT_TARGET_PX);
        const label = await item.locator(".cc-bottom-nav-label").boundingBox();
        expect(label!.x).toBeGreaterThanOrEqual(box!.x);
        expect(label!.x + label!.width).toBeLessThanOrEqual(box!.x + box!.width + 0.5);
        expect(await item.locator(".cc-bottom-nav-label").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
    });

    test("Scrollen und Erreichbarkeit: letzter Eintrag per Scroll und Tastatur, Deep-Link zeigt aktiven Eintrag", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });
      const scroller = page.locator(".cc-bottom-nav-scroll");
      const inView = (testId: string) => page.getByTestId(testId).evaluate((el) => {
        const item = el.getBoundingClientRect();
        const bar = el.parentElement!.getBoundingClientRect();
        return item.left >= bar.left - 0.5 && item.right <= bar.right + 0.5;
      });

      // Letzter Eintrag liegt zunächst außerhalb und wird per Scrollbereich erreichbar.
      expect(await inView("cc-bottom-nav-settings")).toBe(false);
      await scroller.evaluate(el => { el.scrollLeft = el.scrollWidth; });
      expect(await inView("cc-bottom-nav-settings")).toBe(true);
      await page.getByTestId("cc-bottom-nav-settings").click();
      expect(new URL(page.url()).hash).toBe("#settings");

      // Deep-Link: aktiver (letzter) Eintrag ist ohne Zutun sichtbar.
      const deep = await openControlCenter(context, extensionId, { viewport, hash: "settings" });
      await expect(deep.getByTestId("cc-bottom-nav-settings")).toHaveAttribute("aria-current", "page");
      expect(await deep.getByTestId("cc-bottom-nav-settings").evaluate((el) => {
        const item = el.getBoundingClientRect();
        const bar = el.parentElement!.getBoundingClientRect();
        return item.left >= bar.left - 0.5 && item.right <= bar.right + 0.5;
      })).toBe(true);
    });

    test("Tastatur: Tab durch alle Einträge mit sichtbarem Fokusring, Fokus bleibt im Sichtbereich", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });
      await page.getByTestId(`cc-bottom-nav-${ALL_IDS[0]}`).focus();
      for (const [ index, id ] of ALL_IDS.entries()) {
        if (index > 0) await page.keyboard.press("Tab");
        const item = page.getByTestId(`cc-bottom-nav-${id}`);
        await expect(item).toBeFocused();
        const state = await item.evaluate((el) => {
          const style = getComputedStyle(el);
          const box = el.getBoundingClientRect();
          const bar = el.parentElement!.getBoundingClientRect();
          return {
            outlineStyle: style.outlineStyle,
            outlineWidth: parseFloat(style.outlineWidth),
            visible: box.left >= bar.left - 0.5 && box.right <= bar.right + 0.5,
          };
        });
        expect(state.outlineStyle).not.toBe("none");
        expect(state.outlineWidth).toBeGreaterThanOrEqual(2);
        expect(state.visible).toBe(true);
      }
      await page.keyboard.press("Enter");
      expect(new URL(page.url()).hash).toBe("#settings");
    });

    test("Aktiver Zustand: ein Eintrag, aria-current, rot statt Gold, Reduced Motion", async ({ context, extensionId }) => {
      const page = await openControlCenter(context, extensionId, { viewport });
      const active = page.getByTestId("cc-bottom-nav-dashboard");
      const inactive = page.getByTestId("cc-bottom-nav-training");
      await expect(active).toHaveAttribute("aria-current", "page");
      await expect(page.locator(".cc-bottom-nav [aria-current=\"page\"]")).toHaveCount(1);

      expect(await rgbOf(active, "backgroundColor")).not.toBe(await rgbOf(inactive, "backgroundColor"));
      expect(isReddish(await rgbOf(active.locator(".cc-bottom-nav-icon"), "color"))).toBe(true);
      expect(await active.evaluate(el => getComputedStyle(el, "::before").backgroundColor)).not.toBe("rgba(0, 0, 0, 0)");

      const durationOf = () => inactive.evaluate(el => getComputedStyle(el).transitionDuration);
      expect(await durationOf()).not.toBe("0s");
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(await durationOf()).toBe("0s");
    });
  });
}
