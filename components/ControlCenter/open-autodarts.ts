/**
 * Kleine Helfer, um von der Control-Center-Seite aus Autodarts zu öffnen.
 *
 * `/tools` ist der Einstieg, den das Content-Script bereits auswertet:
 * `entrypoints/content/index.ts` korrigiert die URL per History-API auf
 * `/settings`, und `entrypoints/content/App.vue` erkennt am gespeicherten
 * URL-Status, dass die Tools-Ansicht gemeint war, und öffnet sie.
 *
 * Die Routen sind keine Erfindung:
 *   • `/matches/<uuid>` ist genau das Muster, auf das
 *     `entrypoints/match.content/index.ts` matcht und das
 *     `utils/websocket-helpers.ts` gegen `IMatch.id` prüft.
 *   • `/lobbies/<id>` liefert `utils/friends-api.ts::quickPlay()` als Lobby-URL
 *     und `utils/websocket-helpers.ts` prüft es gegen `ILobbies.id`.
 *
 * RUNTIME-FIX: Der Ursprung ist nicht mehr fest verdrahtet. Autodarts läuft
 * unter play.autodarts.io UND play.autodarts.com (beide stehen in den
 * `matches`-Listen aller Content-Scripts). Wir öffnen auf der Domain, die der
 * Nutzer laut `local:urlstatus` tatsächlich verwendet, statt über einen
 * Domain-Redirect zu gehen.
 */

const DEFAULT_ORIGIN = "https://play.autodarts.io";

function normalizeOrigin(origin?: string | null): string {
  if (typeof origin !== "string") return DEFAULT_ORIGIN;
  const found = origin.match(/^https?:\/\/play\.autodarts\.(io|com)/i);
  return found ? found[0] : DEFAULT_ORIGIN;
}

async function openTab(url: string): Promise<void> {
  try {
    await browser.tabs.create({ url });
  } catch (error) {
    console.warn("[ADT] Tab konnte nicht geöffnet werden", error);
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/** Öffnet die Autodarts-Startseite (damit Live-Daten fließen). */
export function openAutodarts(origin?: string | null): void {
  void openTab(`${normalizeOrigin(origin)}/`);
}

/** Öffnet die bestehende, unveränderte Einstellungsansicht. */
export function openClassicSettings(origin?: string | null): void {
  void openTab(`${normalizeOrigin(origin)}/tools`);
}

/**
 * Öffnet ein konkretes Match. Der Aufrufer MUSS eine ID übergeben, deren
 * Match-Route belegt ist (siehe `openableMatchId` in
 * `composables/useControlCenterStatus.ts`) — sonst landet man auf einer 404.
 */
export function openMatch(matchId: string | null | undefined, origin?: string | null): void {
  if (!matchId) return;
  void openTab(`${normalizeOrigin(origin)}/matches/${matchId}`);
}

/** Öffnet eine konkrete Lobby. */
export function openLobby(lobbyId: string | null | undefined, origin?: string | null): void {
  if (!lobbyId) return;
  void openTab(`${normalizeOrigin(origin)}/lobbies/${lobbyId}`);
}

/** Öffnet eine bereits vollständig erzeugte Autodarts-URL. */
export function openUrl(url: string | null | undefined): void {
  if (!url) return;
  void openTab(url);
}
