/**
 * friend-presence-storage.ts — Live-Online-Status einzelner Freunde.
 *
 * Quelle: WebSocket-Kanal `autodarts.friends` (Topic `${userId}.status`),
 * ausgewertet in utils/websocket-helpers.ts::processWebSocketMessage().
 * Dieselbe Storage-/Watch-Architektur wie board-data-storage.ts und
 * lobby-data-storage.ts — kein neuer Mechanismus.
 *
 * Ein Eintrag existiert NUR für Freunde, für die bereits ein echtes
 * WebSocket-Presence-Event ankam. Fehlt ein Eintrag, ist der Status
 * "unbekannt" — es wird nie offline/online geraten.
 */

export interface IFriendPresenceEntry {
  status: "Online" | "Offline" | "Incognito";
  /** Zeitstempel des zuletzt empfangenen Events (Date.now()). */
  at: number;
}

export type TFriendPresence = Record<string, IFriendPresenceEntry>;

export const AutodartsToolsFriendPresence: WxtStorageItem<TFriendPresence, any> = storage.defineItem(
  "local:friend-presence",
  {
    defaultValue: {},
  },
);
