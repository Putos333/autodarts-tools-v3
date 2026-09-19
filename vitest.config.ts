import { fileURLToPath, URL } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vitest/config";

/**
 * Phase 4 — Component Test Foundation.
 *
 * Bewusst eine EIGENE, isolierte Konfiguration statt Erweiterung von
 * wxt.config.ts: Vitest läuft komplett getrennt vom bestehenden
 * `node --test`-Runner (`yarn test`, tests/*.test.ts) — dessen 446 Tests
 * bleiben unverändert auf node:test. `include` ist bewusst auf
 * tests/components/ eingeschränkt (nicht tests/*.test.ts), damit sich
 * beide Runner nie um dieselben Dateien streiten.
 */
export default defineConfig({
  plugins: [ vue() ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    include: [ "tests/components/**/*.test.ts" ],
    globals: false,
  },
});
