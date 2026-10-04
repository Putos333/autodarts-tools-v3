import { expect, test } from "./fixtures/extension";
import { openFakeAutodarts, readWsStatus, TOAST } from "./helpers/ws";

test.describe("websocket-disconnect-toast", () => {
  test("zeigt nach simuliertem Verbindungsabbruch den Disconnect-Toast", async ({ context, serviceWorker }) => {
    const board = await openFakeAutodarts(context);
    const toast = board.page.locator(TOAST);

    // Negativkontrolle: ohne Disconnect gibt es keinen Toast.
    await expect(toast).toHaveCount(0);

    await board.open();
    await expect(toast).toHaveCount(0);

    board.closeFromServer(0, 1001);

    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Board getrennt");
    await expect(toast).toContainText("code=1001");

    // Der Content-Script schreibt den Status zusätzlich in storage.local.
    await expect.poll(() => readWsStatus(serviceWorker)).toMatchObject({
      status: "disconnected",
      openSockets: 0,
    });
  });
});
