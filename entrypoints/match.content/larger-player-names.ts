import { AutodartsToolsConfig } from "@/utils/storage";
import { waitForElement } from "@/utils";

export async function largerPlayerNames() {
  await waitForElement("#ad-ext-turn");
  try {
    const config = await AutodartsToolsConfig.getValue();

    if (!config.largerPlayerNames.enabled) {
      return;
    }

    const playerNamesSize = config.largerPlayerNames.value || 1.5;
    document.querySelectorAll(".ad-ext-player-name").forEach((nameEl) => {
      if (nameEl instanceof HTMLElement) {
        nameEl.style.fontSize = `${playerNamesSize}rem`;
      }
    });
  } catch (e) {
    console.error("Autodarts Tools: Larger Player Names - Error: ", e);
  }
}
