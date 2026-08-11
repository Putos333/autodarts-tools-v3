import { addStyles } from "@/utils";

export async function smallerScores() {
  try {
    console.log("Autodarts Tools: Set score smaller");

    addStyles(`
        .ad-ext-player:not(.ad-ext-player-active):not(.ad-ext-player-winner) > div > p { font-size: 3em!important; }
        `, "score-smaller");
  } catch (e) {
    console.error("Autodarts Tools: Set score smaller - Error: ", e);
  }
}
