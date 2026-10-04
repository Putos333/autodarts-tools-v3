import { expect, test } from "./fixtures/extension";
import { openFakeAutodarts, readWsStatus, simulateNewerContentScript, startWsStatusLog, TOAST, WS_URL } from "./helpers/ws";

/**
 * WebSocket-Lifecycle der Extension (entrypoints/websocket-capture.ts + websocket-monitor.content.ts).
 *
 * Es werden nur Verhaltensweisen geprüft, die sich eindeutig aus dem vorhandenen Code ableiten lassen:
 *  - open  -> openSockets = max(1, openSockets + 1), Status "connected", info = Host
 *  - close -> openSockets = max(0, openSockets - 1); bei 0 "disconnected" (+ Toast), sonst "connected"
 *  - connected -> bestehender Toast wird entfernt; höchstens ein Toast gleichzeitig
 *  - lesen von `event.data` löst genau ein `websocket-incoming`-Event pro Zugriff aus
 *
 *  - error + close bei fehlgeschlagenem Verbindungsaufbau -> nie "open", openSockets bleibt 0, Status "disconnected"
 *
 *  - error -> storage.local erhält zuerst "error", danach (close) "disconnected"
 *  - ein neueres Content-Script (WXT-Invalidierung) -> das alte reagiert nicht mehr (kein Toast, kein Status-Update)
 *
 * Bewusst NICHT getestet (dokumentiertes Produktrisiko): doppelte Injektion des Capture-Skripts. Es gibt keinen
 * Idempotenz-Mechanismus (WXT injectScript hängt jedes Mal ein neues <script> an, websocket-capture.ts hat keinen Guard);
 * bei zweimaliger Injektion entstehen pro Nachricht zwei `websocket-incoming`-Events. Im normalen Ablauf wird nur einmal injiziert.
 */
const FAKE_HOST = new URL(WS_URL).host;

test.describe("ws-lifecycle", () => {
  test("connect/open: Status connected, ein offener Socket, Host als info", async ({ context, serviceWorker }) => {
    const board = await openFakeAutodarts(context);
    await board.open();

    await expect.poll(() => readWsStatus(serviceWorker)).toMatchObject({
      status: "connected",
      openSockets: 1,
      info: FAKE_HOST,
    });
    await expect(board.page.locator(TOAST)).toHaveCount(0);
  });

  test("message: genau ein websocket-incoming-Event pro gelesener Nachricht", async ({ context }) => {
    const board = await openFakeAutodarts(context);
    await board.open();

    const payload = JSON.stringify({ channel: "e2e.noop", data: "hello" });
    board.sendFromServer(payload);

    await expect.poll(() => board.receivedMessages()).toEqual([ payload ]);
    const incoming = await board.incomingEvents();
    expect(incoming).toHaveLength(1);
    expect(incoming[0]).toMatchObject({ url: WS_URL, data: payload });
  });

  test("reconnect: neuer Socket nach Disconnect entfernt den Toast", async ({ context, serviceWorker }) => {
    const board = await openFakeAutodarts(context);
    const toast = board.page.locator(TOAST);

    const first = await board.open();
    board.closeFromServer(first);
    await expect(toast).toBeVisible();

    await board.open();
    await expect(toast).toHaveCount(0);
    await expect.poll(() => readWsStatus(serviceWorker)).toMatchObject({ status: "connected", openSockets: 1 });
  });

  test("mehrere Reconnects: immer höchstens ein Toast, Zustand folgt jedem Zyklus", async ({ context, serviceWorker }) => {
    const board = await openFakeAutodarts(context);
    const toast = board.page.locator(TOAST);

    for (let cycle = 0; cycle < 3; cycle++) {
      const index = await board.open();
      await expect(toast).toHaveCount(0);

      board.closeFromServer(index);
      await expect(toast).toHaveCount(1);
      await expect.poll(() => readWsStatus(serviceWorker)).toMatchObject({ status: "disconnected", openSockets: 0 });
    }

    await board.open();
    await expect(toast).toHaveCount(0);
    await expect.poll(() => readWsStatus(serviceWorker)).toMatchObject({ status: "connected", openSockets: 1 });
  });

  test("zwei Sockets: Toast erst nach dem Schließen des letzten", async ({ context, serviceWorker }) => {
    const board = await openFakeAutodarts(context);
    const toast = board.page.locator(TOAST);

    const a = await board.open();
    const b = await board.open();
    await expect.poll(() => readWsStatus(serviceWorker)).toMatchObject({ status: "connected", openSockets: 2 });

    board.closeFromServer(a);
    await expect.poll(() => readWsStatus(serviceWorker)).toMatchObject({ status: "connected", openSockets: 1 });
    await expect(toast).toHaveCount(0);

    board.closeFromServer(b);
    await expect(toast).toBeVisible();
    await expect.poll(() => readWsStatus(serviceWorker)).toMatchObject({ status: "disconnected", openSockets: 0 });
  });

  test("error: gescheiterter Verbindungsaufbau endet in close, disconnected und Toast", async ({ context, serviceWorker }) => {
    const board = await openFakeAutodarts(context);

    const events = await board.connectUnreachable();
    expect(events).toEqual([ "error", "close" ]);

    await expect(board.page.locator(TOAST)).toBeVisible();
    await expect.poll(() => readWsStatus(serviceWorker)).toMatchObject({ status: "disconnected", openSockets: 0 });
  });

  test("error: storage.local erhält erst \"error\", dann \"disconnected\"", async ({ context, serviceWorker }) => {
    const board = await openFakeAutodarts(context);
    const readLog = await startWsStatusLog(serviceWorker);

    await board.connectUnreachable();

    await expect.poll(readLog).toEqual([ "error", "disconnected" ]);
  });

  test("Listener-Cleanup: nach Invalidierung durch ein neueres Content-Script reagiert das alte nicht mehr", async ({ context, serviceWorker, extensionId }) => {
    const board = await openFakeAutodarts(context);
    await board.open();
    await expect.poll(() => readWsStatus(serviceWorker)).toMatchObject({ status: "connected", openSockets: 1 });

    await simulateNewerContentScript(board.page, extensionId);
    board.closeFromServer(0, 1001);

    // Beweis, dass der Hook im Seitenkontext den Abbruch gemeldet hat (sonst wäre der Test leer) ...
    await expect.poll(() => board.statusEvents()).toContain("disconnected");
    // ... das alte Content-Script aber weder den Toast zeigt noch den Status schreibt.
    await expect(board.page.locator(TOAST)).toHaveCount(0);
    expect(await readWsStatus(serviceWorker)).toMatchObject({ status: "connected", openSockets: 1 });
  });

  test("Toast lässt sich per \"Ausblenden\" schließen", async ({ context }) => {
    const board = await openFakeAutodarts(context);
    const toast = board.page.locator(TOAST);

    board.closeFromServer(await board.open());
    await expect(toast).toBeVisible();

    await board.page.locator("[data-testid=\"adt-ws-dismiss\"]").click();
    await expect(toast).toHaveCount(0);
  });
});
