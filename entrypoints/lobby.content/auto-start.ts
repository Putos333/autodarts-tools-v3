import { waitForElement } from "@/utils";
import { reportSelectorMiss } from "@/utils/selector-health";

let autostartEnabled: boolean = false;
let checkAutoStartInterval: NodeJS.Timeout | null = null;
// v2.9.90: Wiedereintritts-Sperre. Der Interval feuert alle 1s, aber jede
// Prüfung wartet 3s vor dem eigentlichen Klick — ohne Guard klickt der zweite
// (und dritte) Aufruf mehrfach auf "Start game", was in Lobbies zu doppelten
// Start-Requests und Autodarts-seitigen Fehlern führt.
let checkAutoStartBusy: boolean = false;

export async function autoStart() {
  try {
    const hasAutoStartButton = document.getElementById("adt-autostart-button");
    if (hasAutoStartButton) return;

    const buttonsContainer = await waitForElement("#root > div > div:nth-of-type(2) > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) > div:last-of-type") as HTMLDivElement;
    if (!buttonsContainer) {
      reportSelectorMiss('Auto-Start (Button-Container)', '#root > … Buttons-Container CSS-Kette');
      return;
    }
    const button = buttonsContainer.querySelector("button")?.cloneNode(true) as HTMLButtonElement;
    if (!button) {
      reportSelectorMiss('Auto-Start (Klon-Vorlage)', 'buttonsContainer button');
      return;
    }

    button.id = "adt-autostart-button";
    button.innerText = "Autostart OFF";
    updateButtonStyle(button, false);
    button.style.maxWidth = "10rem";

    button.addEventListener("click", () => {
      const isOn = button.textContent === "Autostart OFF";
      button.textContent = isOn ? "Autostart ON" : "Autostart OFF";
      updateButtonStyle(button, isOn);
      autostartEnabled = isOn;

      if (autostartEnabled) {
        // Sicherheitshalber ein evtl. laufendes Interval vorher stoppen.
        if (checkAutoStartInterval) clearInterval(checkAutoStartInterval);
        checkAutoStartBusy = false;
        checkAutoStartInterval = setInterval(checkAutoStart, 1000);
      } else {
        if (checkAutoStartInterval) clearInterval(checkAutoStartInterval);
        checkAutoStartBusy = false;
      }
    });

    buttonsContainer.appendChild(button);
  } catch (e) {
    console.error("Autodarts Tools: Auto Start - Error adding auto start button: ", e);
  }
}

function updateButtonStyle(button: HTMLButtonElement, isSuccess: boolean) {
  if (isSuccess) {
    // Success style
    button.style.border = "1px solid var(--chakra-colors-borderGreen)";
    button.style.background = "var(--chakra-colors-glassGreen)";
    button.style.color = "var(--chakra-colors-white)";
  } else {
    // Danger style
    button.style.border = "1px solid var(--chakra-colors-borderRed)";
    button.style.background = "var(--chakra-colors-glassRed)";
    button.style.color = "var(--chakra-colors-white)";
  }
}

export async function onRemove() {
  if (checkAutoStartInterval) clearInterval(checkAutoStartInterval);
  autostartEnabled = false;
  checkAutoStartBusy = false;
}

async function checkAutoStart() {
  // v2.9.90 Wiedereintritts-Sperre: läuft bereits eine Prüfung inkl. der 3s-
  // Wartezeit, überspringen wir diesen Tick. Ohne Guard würde der Interval
  // während der `await sleep(3000)`-Pause weitere Aufrufe starten und
  // mehrfach auf den Start-Button klicken.
  if (checkAutoStartBusy) return;
  checkAutoStartBusy = true;
  try {
    // v2.9.97: Autodarts hat das Player-Panel teils auf ein Div-Layout
    // umgestellt. Alte Table-Selektoren liefern dann 0 Zeilen → Autostart
    // klickt nie „Start game". Wir prüfen deshalb parallel mehrere Layouts:
    //   1) Klassische Tabelle mit <tr>
    //   2) Neues Div-Layout (.ad-ext-player)
    //   3) Data-testid Player-Container (aktuellste UI)
    //   4) Fallback: Chakra-Stack Kinder in der Lobby-Card
    const tableRows = document.querySelectorAll(
      "#root > div > div:nth-of-type(2) > div > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(2) table > tbody > tr",
    );
    const divPlayers = document.querySelectorAll(
      ".ad-ext-player, [data-testid*='player' i]:not([data-testid*='name']):not([data-testid*='button']), [class*='player' i][class*='row' i]",
    );
    // Duplikate herausfiltern (Data-testid greift oft mehrere Ebenen)
    const uniqueDivPlayers = new Set<Element>();
    divPlayers.forEach((el) => {
      // Nur echte Zeilen, keine verschachtelten Buttons/Icons
      if (el.querySelector('[data-testid*="player-name"]') || el.matches('.ad-ext-player')) {
        uniqueDivPlayers.add(el);
      }
    });

    const totalPlayers = Math.max(tableRows.length, uniqueDivPlayers.size);
    if (totalPlayers > 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Nach der Wartezeit kann autostart bereits per Toggle deaktiviert
      // worden sein — dann nicht mehr klicken.
      if (!autostartEnabled) return;

      // v2.9.97: Start-Button auch mit erweitertem Text-Match finden
      // (i18n / neue Autodarts-Labels).
      const buttons = document.querySelectorAll("button") as NodeListOf<HTMLButtonElement>;
      const startButton = Array.from(buttons).find((button) => {
        const t = (button.textContent ?? '').trim();
        return /^(start\s*game|spiel\s*starten|starten|start\s*match|begin\s*match)$/i.test(t);
      });
      if (!startButton) {
        reportSelectorMiss('Auto-Start (Start-Button)', 'button:text(Start game|Spiel starten|Start match)');
        return;
      }
      startButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));

      if (checkAutoStartInterval) {
        clearInterval(checkAutoStartInterval);
        checkAutoStartInterval = null;
      }
    }
  } finally {
    checkAutoStartBusy = false;
  }
}
