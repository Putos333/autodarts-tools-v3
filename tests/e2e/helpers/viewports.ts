/**
 * Verbindliche Visual-QA-Viewports (AUTODARTS ELITE UI MASTER 1.0, docs/UI_GOVERNANCE.md).
 *
 * Bewusst KEINE globale Playwright-Projektmatrix: Specs, die responsives Verhalten prüfen,
 * iterieren selbst über VIEWPORTS und setzen per `page.setViewportSize`. So laufen die
 * bestehenden Tests (Viewport 1280x800 aus tests/e2e/fixtures/extension.ts) nicht ×4.
 */
export interface IQaViewport {
  /** Kurzname, auch Bestandteil der Baseline-Dateinamen. */
  name: "wide" | "desktop" | "tablet" | "mobile";
  width: number;
  height: number;
}

export const VIEWPORTS: readonly IQaViewport[] = [
  { name: "wide", width: 1920, height: 1080 },
  { name: "desktop", width: 1280, height: 720 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];
