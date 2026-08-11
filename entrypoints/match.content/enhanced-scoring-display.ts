import type { IGameData } from "@/utils/game-data-storage";
import type { IThrow } from "@/utils/websocket-helpers";

import { addStyles, waitForElement } from "@/utils";
import { AutodartsToolsGameData } from "@/utils/game-data-storage";

let gameDataWatcherUnwatch: any;
const previousValues = new WeakMap();

export async function enhancedScoringDisplay() {
  console.log("Autodarts Tools: Enhanced Scoring Display");

  await waitForElement("#ad-ext-turn");

  addStyles(`
    #ad-ext-turn > .ad-ext-turn-throw, #ad-ext-turn > .score, #ad-ext-turn > .suggestion {
      height: 125px;
    }
    
    p.ad-ext-turn-points {
      font-size: 75px;
      font-weight: bold;
    }
  `, "enhanced-scoring-display");

  const gameData = await AutodartsToolsGameData.getValue();
  updateScoreDisplays(gameData.match?.turns[0].throws as IThrow[]);

  gameDataWatcherUnwatch = AutodartsToolsGameData.watch((_gameData: IGameData, _oldGameData: IGameData) => {
    console.log("Autodarts Tools: Enhanced Scoring Display - Game data changed");

    // Update score displays if throws have changed
    if (_gameData.match?.turns[0].throws.length !== _oldGameData.match?.turns[0].throws.length || _gameData.match?.player !== _oldGameData.match?.player) {
      console.log("Autodarts Tools: Enhanced Scoring Display - Game scores changed", _gameData.match?.turns[0].throws);
      updateScoreDisplays(_gameData.match?.turns[0].throws as IThrow[]);
    }
  });
}

function updateScoreDisplays(throws: IThrow[]) {
  const throwElements = document.querySelectorAll("#ad-ext-turn > .ad-ext-turn-throw > p");
  throwElements.forEach((throwElement, index) => {
    animateScoreElement(throwElement, throws[index].segment.name);
  });

  const throwSuggestionElements = document.querySelectorAll("#ad-ext-turn > .suggestion > p");
  throwSuggestionElements.forEach((throwSuggestionElement, index) => {
    animateScoreElement(throwSuggestionElement, throwSuggestionElements[index].textContent?.trim() || "");
  });
}

function isValidScore(text: string) {
  const specialValues = /^(BULL|25|M(?:[1-9]|1[0-9]|20))$/;
  if (specialValues.test(text)) {
    switch (text) {
      case "BULL":
        return {
          isSpecial: true,
          displayText: "50",
          notation: "DBULL",
        };
      case "25":
        return {
          isSpecial: true,
          displayText: "25",
          notation: "BULL",
        };
      default:
        return {
          isSpecial: true,
          displayText: text,
        };
    }
  }

  const regex = /^(S|D|T)(\d{1,2})$/;
  const match = text.match(regex);
  if (match) {
    const prefix = match[1];
    const baseNumber = Number.parseInt(match[2]);
    const multiplier = prefix === "D" ? 2 : prefix === "T" ? 3 : 1;
    return {
      isSpecial: false,
      displayText: (baseNumber * multiplier).toString(),
      notation: text,
    };
  }
  return null;
}

function formatScoreDisplay(element: Element, scoreText: string) {
  const scoreData = isValidScore(scoreText);
  if (!scoreData) {
    console.warn(`Invalid score text: ${scoreText}`);
    return;
  }

  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  container.style.padding = "0";
  container.style.margin = "0";
  container.style.lineHeight = "1";
  container.style.height = "100%";
  container.style.width = "100%";

  const displayText = document.createElement("div");
  displayText.textContent = scoreData.displayText;
  displayText.style.fontSize = "1.7em";
  displayText.style.fontWeight = "800";
  displayText.style.marginBottom = "-4px";

  container.appendChild(displayText);

  if (!scoreData.isSpecial || scoreData.notation === "DBULL" || scoreData.notation === "BULL") {
    const bottomNotation = document.createElement("div");
    bottomNotation.textContent = scoreData.notation || scoreText;
    bottomNotation.style.fontSize = "0.7em";
    bottomNotation.style.opacity = "0.6";
    bottomNotation.style.fontWeight = "600";
    container.appendChild(bottomNotation);
  }

  element.innerHTML = "";
  element.appendChild(container);
}

function animateScoreElement(element: Element, scoreText: string) {
  const scoreData = isValidScore(scoreText);
  if (!scoreData) return;

  const previousText = previousValues.get(element);
  if (previousText === scoreText) {
    return;
  }

  previousValues.set(element, scoreText);

  (element as HTMLElement).style.transition = "opacity 0.2s ease, transform 0.2s ease";
  (element as HTMLElement).style.opacity = "0";
  (element as HTMLElement).style.transform = "scale(0.1)";

  requestAnimationFrame(() => {
    formatScoreDisplay(element, scoreText);
    requestAnimationFrame(() => {
      (element as HTMLElement).style.opacity = "1";
      (element as HTMLElement).style.transform = "scale(1)";
    });
  });
}

export async function enhancedScoringDisplayOnRemove() {
  console.log("Autodarts Tools: Enhanced Scoring Display removed!");
  gameDataWatcherUnwatch?.();
}
