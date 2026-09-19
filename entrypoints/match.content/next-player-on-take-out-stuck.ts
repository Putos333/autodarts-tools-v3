import type { IBoard } from "@/utils/board-data-storage";

import { AutodartsToolsConfig } from "@/utils/storage";
import { waitForElementWithTextContent } from "@/utils";
import { AutodartsToolsBoardData } from "@/utils/board-data-storage";

let boardDataWatcherUnwatch: any;

// Stable module-scope handler references so removeEventListener actually
// removes the exact handler that was registered (Issue #9 P0-1).
// Also acts as an idempotency guard for enable → remove → enable.
let clickHandlerRef: ((e: Event) => void) | null = null;
let fullscreenHandlerRef: (() => void) | null = null;

export async function nextPlayerOnTakeOutStuck() {
  try {
    console.warn("Autodarts Tools: Next player on take out stuck");

    const config = await AutodartsToolsConfig.getValue();

    let takeOutTimout: NodeJS.Timeout;

    function remove() {
      const element = document.getElementById("ad-ext_next-text");
      element?.remove();
      if (takeOutTimout) clearInterval(takeOutTimout);
    }

    // Register click listener once; guard by module-scope ref.
    if (!clickHandlerRef) {
      clickHandlerRef = remove;
      document.addEventListener("click", clickHandlerRef);
    }

    // Handle fullscreen changes
    function handleFullscreenChange() {
      if (document.fullscreenElement) {
        console.log("Autodarts Tools: Fullscreen mode detected, ensuring next player on takeout stuck still works");
        // Re-register click event if needed in fullscreen
        if (!clickHandlerRef) {
          clickHandlerRef = remove;
          document.addEventListener("click", clickHandlerRef);
        }
      }
    }

    // Register fullscreenchange listener once; guard by module-scope ref.
    if (!fullscreenHandlerRef) {
      fullscreenHandlerRef = handleFullscreenChange;
      document.addEventListener("fullscreenchange", fullscreenHandlerRef);
    }

    boardDataWatcherUnwatch?.();

    boardDataWatcherUnwatch = AutodartsToolsBoardData.watch(async (boardData: IBoard) => {
      const nextBtnTextEl = document.getElementById("ad-ext_next-text");
      nextBtnTextEl?.remove();

      if (takeOutTimout) clearInterval(takeOutTimout);

      const gameData = await AutodartsToolsGameData.getValue();
      if (gameData.match?.variant === "Bull-off") return;

      if (boardData.status === "Takeout in progress") {
        console.warn("Autodarts Tools: Takeout in progress");

        // Use a more robust selector that works in both normal and fullscreen modes
        // Increase timeout to allow more time for DOM to settle in fullscreen mode
        let nextBtn = await waitForElementWithTextContent("button", "Next", 2000);
        if (!nextBtn) {
          console.warn("Autodarts Tools: Next button not found, retrying with different approach");
          // Try another approach if the button wasn't found
          const buttons = document.querySelectorAll("button");
          for (const btn of buttons) {
            if (btn.textContent?.trim() === "Next") {
              nextBtn = btn as HTMLElement;
              break;
            }
          }
          if (!nextBtn) return;
        }

        let startSec = config.nextPlayerOnTakeOutStuck.sec;

        const nextBtnTextEl = document.createElement("span");
        nextBtnTextEl.id = "ad-ext_next-text";
        nextBtnTextEl.style.whiteSpace = "pre";
        nextBtnTextEl.textContent = ` (${startSec})`;
        nextBtn.appendChild(nextBtnTextEl);

        takeOutTimout = setInterval(() => {
          startSec--;
          nextBtnTextEl.textContent = ` (${startSec})`;

          if (startSec <= 0) {
            if (takeOutTimout) {
              nextBtnTextEl.textContent = ""; // Reset the button text
              clearInterval(takeOutTimout);
            }
            if (nextBtn instanceof HTMLElement) {
              console.log("Autodarts Tools: Auto-clicking Next button");
              nextBtn.click();
            }
            const element = document.getElementById("ad-ext_next-text");
            element?.remove();
          }
        }, 1000);
      } else {
        if (takeOutTimout) clearInterval(takeOutTimout);
        remove();
      }
    });
  } catch (e) {
    console.error("Autodarts Tools: Next player on takeout stuck - Error: ", e);
  }
}

export function nextPlayerOnTakeOutStuckOnRemove() {
  if (boardDataWatcherUnwatch) {
    boardDataWatcherUnwatch();
    boardDataWatcherUnwatch = null;
  }

  if (fullscreenHandlerRef) {
    document.removeEventListener("fullscreenchange", fullscreenHandlerRef);
    fullscreenHandlerRef = null;
  }

  if (clickHandlerRef) {
    document.removeEventListener("click", clickHandlerRef);
    clickHandlerRef = null;
  }
}
