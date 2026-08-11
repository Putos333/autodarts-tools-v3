import { waitForElement } from "@/utils";
import { AutodartsToolsGameData } from "@/utils/game-data-storage";

export async function hideMenuInMatch() {
  if (document.querySelector("#adt-menu-hide")) return;
  console.log("Autodarts Tools: Hiding menu in match");

  await waitForElement("#ad-ext-player-display");
  const gameData = await AutodartsToolsGameData.getValue();

  let menuActive: boolean = false;

  const menu = await waitForElement("#root > div > div");
  const menuBar = await waitForElement([ "#root > div > div:nth-of-type(2) > div .chakra-wrap", "#root > div > div:nth-of-type(2) > div > div > div > div:last-of-type" ]);
  if (!menuBar || !menu) return console.error("Autodarts Tools: No menu or menu bar found");
  menu.style.display = "none";

  const settingsBtn = menuBar.querySelector("button");
  const settingsIcon = settingsBtn?.querySelector("svg") as Node;

  const menuHideBtn = document.createElement("button");
  menuHideBtn.id = "adt-menu-hide";
  menuHideBtn.className = settingsBtn?.className || "";

  const menuHideBtnSVG = settingsIcon?.cloneNode(true) as SVGElement;
  menuHideBtnSVG.setAttribute("viewBox", "0 0 24 24");
  menuHideBtnSVG.style.height = "1.2em";
  menuHideBtnSVG.style.width = "1.2em";
  menuHideBtnSVG.children[0].setAttribute("d", "M3 18h18v-2H3zm0-5h18v-2H3zm0-7v2h18V6z");

  menuHideBtn.appendChild(menuHideBtnSVG);

  // find first ul in menuBar and add the menuHideBtn to the menuBar
  const menuBarUL = gameData.match?.variant === "Bull-off" ? document.querySelector("#ad-ext-game-variant")?.parentElement?.parentElement?.querySelector("div:last-of-type") || menuBar.querySelector("div:nth-of-type(3) > div") : menuBar.querySelector("ul");
  if (!menuBarUL) return console.error("Autodarts Tools: No menu bar ul found");
  menuBarUL.insertBefore(menuHideBtn, menuBarUL.children[menuBarUL.children.length - 1]);

  // Toggle menu function
  const toggleMenu = (forceState?: boolean) => {
    const shouldShowMenu = forceState !== undefined ? forceState : !menuActive;

    if (shouldShowMenu !== menuActive) {
      menuActive = shouldShowMenu;
      menuHideBtn.toggleAttribute("data-active", menuActive);
      menu.style.display = menuActive ? "" : "none";
    }
  };

  menuHideBtn.addEventListener("click", () => toggleMenu());

  // Initial state - hide menu
  toggleMenu(false);
}

export async function hideMenuInMatchOnRemove() {
  // restore the menu
  console.log("Autodarts Tools: Restoring menu in match");

  const menuToggleBtn = document.querySelector("#adt-menu-hide");
  menuToggleBtn?.remove();

  // Make the original menu visible again
  const menu = document.querySelector("#root > div > div") as HTMLElement;
  if (menu) {
    menu.style.display = "";
  }
}
