import { URL, fileURLToPath } from "node:url";

import { defineConfig, type ConfigEnv } from "wxt";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Component from "unplugin-vue-components/vite";
import RadixVueResolver from "radix-vue/resolver";
import { ViteMcp } from "vite-plugin-mcp";

// See https://wxt.dev/api/config.html
export default defineConfig({
  // runner: { // Deprecated in v0.20
  //   startUrls: [ "https://play.autodarts.io/" ],
  // },
  webExt: {
    startUrls: [ "https://play.autodarts.io/" ],
  },
  modules: [ "@wxt-dev/webextension-polyfill" ],
  imports: {
    presets: [ "vue" ],
    addons: {
      vueTemplate: true,
    },
  },
  // `manifest` als Funktion: Chrome erwartet laut Schema `author: {email}`,
  // Firefox validiert `author` dagegen strikt als String (sonst Manifest-
  // Warnung "Expected string instead of {...}"). Der Rest des Manifests ist
  // für beide Ziele identisch, daher nur `author` pro Browser unterschieden.
  manifest: ({ browser }: ConfigEnv) => ({
    host_permissions: [
      "*://play.autodarts.io/*",
      "*://play.autodarts.com/*",
      "*://api.autodarts.io/*",
      "*://darts-downloads.peschi.org/*",
      "*://autodarts.x10.mx/*",
      "*://adt-socket.tobias-thiele.de/*",
      "*://discord.com/api/webhooks/*",
      "*://*.preview.emergentagent.com/*",
      "*://*.emergent.host/*",
    ],
    permissions: [
      "storage",
      "activeTab",
      "alarms",
      // "background",
    ],
    background: {
      service_worker: "background.js",
      type: "module",
      persistent: false,
    },
    name: "Tools for Autodarts",
    short_name: "Autodarts Tools",
    description: "__MSG_extension_description__",
    default_locale: "de",
    // v2.9.86 — Toolbar-Action (Chrome MV3 verwendet `action`, WXT mappt es
    // für Firefox MV2 automatisch auf `browser_action`).
    action: {
      default_title: "Tools for Autodarts",
      default_popup: "popup.html",
      default_icon: {
        16: "icon/16.png",
        24: "icon/24.png",
        48: "icon/48.png",
        96: "icon/96.png",
        128: "icon/128.png",
      },
    },
    homepage_url: "https://darts-caller-ext.emergent.host",
    author: browser === "firefox" ? "community@autodarts.tools" : { email: "community@autodarts.tools" },
    // content_scripts: [
    //   {
    //     matches: [ "*://play.autodarts.io/*" ],
    //     js: [ "dart-zoom.js" ],
    //   },
    // ],
    // web_accessible_resources: [ {
    //   resources: [ "dart-zoom.js" ],
    //   matches: [ "<all_urls>" ],
    // } ],
    web_accessible_resources: [
      {
        resources: [ "images/*" ],
        matches: [ "*://play.autodarts.io/*", "*://play.autodarts.com/*" ],
      },
      {
        resources: [ "websocket-capture.js", "auth-cookie.js" ],
        matches: [ "*://play.autodarts.io/*", "*://play.autodarts.com/*" ],
      },
      {
        resources: [ "sounds/*" ],
        matches: [ "*://play.autodarts.io/*", "*://play.autodarts.com/*" ],
      },
    ],
  }),
  dev: {
    reloadCommand: "Alt+T",
  },
  vite: () => ({
    server: {
      watch: {
        usePolling: true,
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./", import.meta.url)),
        "~": fileURLToPath(new URL("./", import.meta.url)),
        "src": fileURLToPath(new URL("./", import.meta.url)),
      },
    },
    plugins: [
      vue(),
      ViteMcp(),

      AutoImport({
        imports: [
          "vue",
          "vue-router",
          "vue/macros",
          "@vueuse/core",
          {
            "#imports": [
              "browser",
              "defineBackground",
              "defineContentScript",
              "createShadowRootUi",
              "defineUnlistedScript",
              "storage",
              "injectScript",
              "defineUnlistedScript",
            ],
          },
        ],
        dts: "auto-imports.d.ts",
        dirs: [ "composables/" ],
      }),

      Component({
        dts: true,
        resolvers: [
          RadixVueResolver(),
        ],
      }),
    ],
    build: {
      minify: "esbuild",
      target: "esnext",
    },
    // TD-02: `drop` gehört zu Vite's Top-Level `esbuild`-Option (UserConfig.esbuild),
    // nicht unter `build.esbuild` (BuildOptions kennt dieses Feld nicht – wurde bisher
    // von Vite stillschweigend ignoriert, siehe node_modules/vite/dist/node/index.d.ts).
    //
    // RUNTIME-FIX (Realtest 2, Friends & Party): "console" stand hier ebenfalls in
    // `drop` und hat dadurch AUSNAHMSLOS jeden console.*-Aufruf aus JEDEM Build
    // entfernt — auch aus `yarn build`/`yarn build:firefox`, also genau den Builds,
    // die real via about:debugging geladen werden. Das betraf nicht nur die neuen
    // [ADT-DIAG]-Logs dieser Untersuchung, sondern ausnahmslos alle console.log/
    // warn/error-Aufrufe im gesamten Projekt — ein zuverlässiger Realtest mit
    // Diagnose-Logs war dadurch grundsätzlich unmöglich. `debugger` bleibt entfernt
    // (unkritisch). TEMPORÄR bis der reale Datenweg vom Nutzer bestätigt ist —
    // danach kann "console" hier wieder ergänzt werden, wenn stille Production-
    // Logs gewünscht sind.
    esbuild: {
      drop: [ "debugger" ],
    },
  }),
});
