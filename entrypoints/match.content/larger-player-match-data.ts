import { AutodartsToolsConfig } from "@/utils/storage";
import { waitForElement } from "@/utils";

export async function largerPlayerMatchData() {
  await waitForElement("#ad-ext-turn");
  try {
    const config = await AutodartsToolsConfig.getValue();

    if (!config.largerPlayerMatchData.enabled) {
      return;
    }

    const playerMatchDataSize = config.largerPlayerMatchData.value || 1.5;
    document.querySelectorAll(".ad-ext-player").forEach((playerCardEl) => {
      const matchDataElement = playerCardEl?.querySelector("div:last-of-type > p") as HTMLElement | null;
      if (matchDataElement) {
        matchDataElement.style.fontSize = `${playerMatchDataSize}rem`;
      }
    });
  } catch (e) {
    console.error("Autodarts Tools: Larger Player Match Data - Error: ", e);
  }
}
