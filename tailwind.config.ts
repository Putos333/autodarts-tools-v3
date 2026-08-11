import colors from "tailwindcss/colors";
import { addDynamicIconSelectors } from "@iconify/tailwind";

export default {
  darkMode: "class",
  // BUGFIX v2.9.45: Preflight aus, damit Tailwind bei cssInjectionMode:"manifest"
  // die globalen Chakra-UI-Styles auf autodarts.io nicht kaputt macht (h1/h2,
  // Listen, Buttons etc. würden sonst zurückgesetzt).
  corePlugins: {
    preflight: false,
  },
  content: [ "./entrypoints/**/*.{html,ts,vue,tsx}", "./components/**/*.{ts,vue,tsx}" ],
  theme: {
    extend: {
      colors: {
        primary: colors.sky,
        gray: colors.neutral,
      },
      fontFamily: {
        sans: [ "Open Sans", "sans-serif" ],
        system: [ "system-ui" ],
      },
      fontSize: {
        xxs: "0.625rem",
      },
    },
  },
  plugins: [ addDynamicIconSelectors() ],
};
