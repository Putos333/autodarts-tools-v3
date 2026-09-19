import { AutodartsToolsConfig } from "@/utils/storage";
import { waitForElement } from "@/utils";

export async function largerLegsSets() {
  await waitForElement("#ad-ext-turn");
  try {
    const config = await AutodartsToolsConfig.getValue();

    if (!config.largerLegsSets.enabled) {
      return;
    }

    const legsSetsLargerSize = config.largerLegsSets.value || 3;
    document.querySelectorAll(".ad-ext-player").forEach((playerCardEl) => {
      playerCardEl?.querySelectorAll(".chakra-stack span").forEach((spanEl) => {
        if (spanEl.classList.contains("ad-ext-player-name")
            || spanEl.querySelector(".ad-ext-player-name")
            || spanEl.closest(".ad-ext-player-name")
            || spanEl.parentElement?.classList.contains("ad-ext-player-name")) {
          return;
        }

        const paragraph = spanEl.querySelector("p");
        if (paragraph) {
          paragraph.style.fontSize = `${legsSetsLargerSize}rem`;
        }
      });
    });
  } catch (e) {
    console.error("Autodarts Tools: Larger Legs / Sets - Error: ", e);
  }
}
