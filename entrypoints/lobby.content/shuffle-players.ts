import { waitForElement } from "@/utils";

let checkPlayersInterval: NodeJS.Timeout | null = null;
let playerRows: HTMLTableRowElement[] = [];
let shuffledPlayerNames: string[] = [];

export async function shufflePlayers() {
  try {
    const buttonsContainer = await waitForElement("#root > div > div:nth-of-type(2) > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div:last-of-type") as HTMLDivElement;
    const button = buttonsContainer.querySelector("button")?.cloneNode(true) as HTMLButtonElement;

    button.id = "autodarts-tools-shuffle-button";
    button.innerText = "Shuffle";
    button.style.color = "var(--chakra-colors-white)";
    button.style.background = "var(--chakra-colors-whiteAlpha-200)";
    button.style.borderColor = "var(--chakra-colors-whiteAlpha-200)";
    button.style.maxWidth = "7rem";

    button.addEventListener("click", handleShuffle);

    checkPlayersInterval = setInterval(checkPlayers, 500);

    buttonsContainer.appendChild(button);
  } catch (e) {
    // silence is golden
  }
}

async function checkPlayers() {
  const rows = document.querySelectorAll("#root > div > div:nth-of-type(2) > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) table > tbody > tr");
  playerRows = rows as unknown as HTMLTableRowElement[];
}

function getPlayerNameFromRow(row: HTMLTableRowElement) {
  return row.querySelector("td:nth-of-type(2) > span > div p")?.textContent;
}

/**
 * Pure occurrence-lookup: returns the index of the `occurrence`-th (0-based)
 * entry in `names` that equals `target`, or undefined if there is no such
 * occurrence. Extracted (no DOM) so the duplicate-name disambiguation below
 * — the fix for players/bots sharing the exact same displayed name — is
 * unit-testable without mocking the page DOM.
 */
export function findNthOccurrenceIndex(
  names: (string | null | undefined)[],
  target: string,
  occurrence: number,
): number | undefined {
  let seen = 0;
  for (let i = 0; i < names.length; i++) {
    if (names[i] === target) {
      if (seen === occurrence) return i;
      seen++;
    }
  }
  return undefined;
}

function getIndexByPlayerName(playerName: string, occurrence: number) {
  return findNthOccurrenceIndex(playerRows.map(row => getPlayerNameFromRow(row)), playerName, occurrence);
}

async function handleShuffle() {
  const shuffleButton = document.querySelector("#autodarts-tools-shuffle-button") as HTMLButtonElement;
  shuffleButton.setAttribute("disabled", "true");
  shuffleButton.innerText = "Shuffling...";

  if (checkPlayersInterval) clearInterval(checkPlayersInterval);

  // get player names from the rows
  const playerNames = Array.from(playerRows).map(row => row.querySelector("td:nth-of-type(2) > span > div p")?.textContent);

  // shuffle the player names by ordering them in a random order
  shuffledPlayerNames = [ ...playerNames ] as string[];

  let shuffledArrayIsDifferent = playerNames.length < 2;
  while (!shuffledArrayIsDifferent) {
    // Fisher-Yates (Knuth) shuffle algorithm
    for (let i = shuffledPlayerNames.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      // Swap elements at indices i and j
      [ shuffledPlayerNames[i], shuffledPlayerNames[j] ] = [ shuffledPlayerNames[j], shuffledPlayerNames[i] ];
    }
    shuffledArrayIsDifferent = !playerNames.every((value, index) => value === shuffledPlayerNames[index]);
  }

  const playerButtons: Record<string, { up: HTMLButtonElement; down: HTMLButtonElement }> = {};

  // Players/bots can share the exact same displayed name (generic bot names
  // are common). Keying purely by name — like the previous implementation —
  // collapses duplicates onto a single button, while getIndexByPlayerName
  // always resolved to the *first* matching row. The row being clicked and
  // the row being measured could then silently diverge, spinning the reorder
  // loop below forever. Disambiguate both by "Nth occurrence of this name in
  // current row order" instead (see findNthOccurrenceIndex above).
  function updatePlayerButtons() {
    const occurrenceCounts: Record<string, number> = {};
    for (const row of playerRows) {
      const playerName = row.querySelector("td:nth-of-type(2) > span > div p")?.textContent;
      if (!playerName) continue;
      const occurrence = occurrenceCounts[playerName] ?? 0;
      occurrenceCounts[playerName] = occurrence + 1;
      const playerButtonUp = row.querySelector("button:nth-of-type(1)");
      const playerButtonDown = row.querySelector("button:nth-of-type(2)");
      playerButtons[`${playerName}::${occurrence}`] = { up: playerButtonUp as HTMLButtonElement, down: playerButtonDown as HTMLButtonElement };
    }
  }

  updatePlayerButtons();

  // Hard safety cap: even with the disambiguation above, this loop drives
  // real DOM clicks against a page we don't control — bound both the
  // per-player retries and the total passes so a future selector/markup
  // change degrades to "shuffle gave up" instead of "button stuck on
  // Shuffling... forever".
  const MAX_STEP_CLICKS = 30;
  const MAX_TOTAL_PASSES = 50;

  let orderIsCorrect = false;
  let totalPasses = 0;
  while (!orderIsCorrect && totalPasses < MAX_TOTAL_PASSES) {
    orderIsCorrect = true;
    totalPasses++;
    const occurrenceSoFar: Record<string, number> = {};

    for (let i = 0; i < shuffledPlayerNames.length; i++) {
      const playerName = shuffledPlayerNames[i];
      const occurrence = occurrenceSoFar[playerName] ?? 0;
      occurrenceSoFar[playerName] = occurrence + 1;
      const buttonKey = `${playerName}::${occurrence}`;

      let playerIndex = getIndexByPlayerName(playerName, occurrence);
      let stepClicks = 0;

      while (playerIndex !== i && stepClicks < MAX_STEP_CLICKS) {
        orderIsCorrect = false;

        playerButtons[buttonKey]?.up?.click();
        await new Promise(resolve => setTimeout(resolve, 100));
        await checkPlayers();
        updatePlayerButtons();

        playerIndex = getIndexByPlayerName(playerName, occurrence);
        stepClicks++;
      }
    }
  }

  checkPlayersInterval = setInterval(checkPlayers, 500);
  shuffleButton.removeAttribute("disabled");
  shuffleButton.innerText = "Shuffle";
}

export async function onRemove() {
  if (checkPlayersInterval) clearInterval(checkPlayersInterval);

  // reset default values
  checkPlayersInterval = null;
  playerRows = [];
  shuffledPlayerNames = [];
}
