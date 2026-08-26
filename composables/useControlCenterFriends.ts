/**
 * useControlCenterFriends — Freundesliste im Control Center.
 *
 * Liste + Quick-Play kommen ausschließlich aus der bereits vorhandenen
 * `utils/friends-api.ts` (Endpoint `/as/v0/friends/`, Quick-Play über
 * `/gs/v0/lobbies`). Kein neuer REST-Endpoint.
 *
 * Live-Online-Status (Realtest 4) kommt NICHT per REST — Autodarts bietet
 * dafür keinen Snapshot-Endpoint, auch die eigene App nicht. Er wird über den
 * bereits vorhandenen WebSocket-Capture-Layer mitgelesen (Kanal
 * "autodarts.friends", ausgewertet in utils/websocket-helpers.ts, abgelegt in
 * utils/friend-presence-storage.ts) und hier nur per Storage-Watch überlagert
 * — keine zweite Verbindung, kein Polling.
 *
 * ── Wichtige technische Einschränkung ───────────────────────────────────────
 * `fetchWithAuth()` nimmt den Bearer-Token aus `local:globalstatus`. Dieser
 * Token wird ausschließlich von `auth-cookie.js` im Seitenkontext von
 * play.autodarts.io eingefangen und lebt nur ~15 Minuten.
 *
 * `ensureFreshAuthToken()` erneuert ihn über ein `CustomEvent`, auf das nur das
 * Main-World-Skript AUF play.autodarts.io hört. Auf dieser Extension-Seite gibt
 * es diesen Zuhörer nicht — ein Refresh von hier aus ist also nicht möglich.
 *
 * ── RUNTIME-FIX ────────────────────────────────────────────────────────────
 * Statt `getFriends()` wird `getFriendsDiagnostic()` verwendet. `getFriends()`
 * ersetzt fehlende Namen durch den Literaltext 'Unbekannt' und fehlenden
 * Online-Status durch `false` — beides ist dann nicht mehr von echten Werten zu
 * unterscheiden (Symptom: "14 Freunde, 0 online, alle Unbekannt"). Die
 * diagnostische Variante liefert `null` für Unbekanntes und sagt zusätzlich, ob
 * der Online-Status-Endpoint überhaupt geantwortet hat. Diese Unterscheidung
 * gibt die UI unverändert weiter.
 */

import { computed, getCurrentScope, onScopeDispose, ref } from "vue";

import {
  getFriendsDiagnostic,
  quickPlay,
  quickPlayGroup,
  type IFriendResolved,
  type IQuickPlayResult,
} from "@/utils/friends-api";
import { AutodartsToolsFriendPresence, type TFriendPresence } from "@/utils/friend-presence-storage";
import { AutodartsToolsGlobalStatus } from "@/utils/storage";

/** Autodarts-JWTs leben ~15 Min; wir bleiben bewusst konservativ darunter. */
const TOKEN_MAX_AGE_MS = 12 * 60 * 1000;

export type TFriendsState =
  /** Noch nichts versucht. */
  | "idle"
  /** Abruf läuft. */
  | "loading"
  /** Abruf erfolgreich (kann auch eine leere Liste bedeuten). */
  | "ready"
  /** Kein bzw. abgelaufener Token — von hier aus nicht erneuerbar. */
  | "no-auth"
  /** Abruf lief, lieferte aber keine verwertbare Antwort. */
  | "unavailable";

export function useControlCenterFriends() {
  const state = ref<TFriendsState>("idle");
  /** Roh-Ergebnis von getFriendsDiagnostic() — ohne Live-Presence-Overlay. */
  const rawFriends = ref<IFriendResolved[]>([]);
  const errorText = ref<string | null>(null);
  const loadedAt = ref<number | null>(null);
  const httpStatus = ref<number | null>(null);
  /** Feldnamen des ersten Eintrags — Grundlage der Klartext-Erklärung. */
  const sampleKeys = ref<string[]>([]);

  // ── Live-Presence (Realtest 4) ───────────────────────────────────────────
  // Quelle: WebSocket-Kanal "autodarts.friends" → utils/websocket-helpers.ts
  // → local:friend-presence (utils/friend-presence-storage.ts). Kein neuer
  // Endpoint, kein Polling — reine Storage-Watch wie überall sonst im
  // Control Center. Ein Eintrag existiert nur, wenn bereits ein echtes
  // Presence-Event für diese userId ankam; sonst bleibt der Freund
  // "Status unbekannt".
  const presence = ref<TFriendPresence>({});
  AutodartsToolsFriendPresence.getValue().then((value) => {
    presence.value = value ?? {};
  }).catch(() => { /* bleibt {} */ });
  const unwatchPresence = AutodartsToolsFriendPresence.watch((value) => {
    presence.value = value ?? {};
  });
  if (getCurrentScope()) onScopeDispose(() => unwatchPresence?.());

  /** REST-Liste + Live-Presence zusammengeführt — nur bestätigte Werte. */
  const friends = computed<IFriendResolved[]>(() => rawFriends.value.map((friend) => {
    const entry = friend.id ? presence.value[friend.id] : undefined;
    if (!entry) return friend;
    const online = entry.status === "Online" ? true : (entry.status === "Offline" || entry.status === "Incognito" ? false : friend.online);
    return { ...friend, online };
  }));

  /** True, sobald für mind. einen geladenen Freund ein echtes Presence-Event ankam. */
  const onlineStatusAvailable = computed(() =>
    rawFriends.value.some(friend => Boolean(friend.id && presence.value[friend.id])),
  );

  /** Läuft gerade ein Quick-Play? Enthält dann die Freund-ID. */
  const busyFriendId = ref<string | null>(null);
  const lastActionText = ref<string | null>(null);
  const lastActionOk = ref<boolean | null>(null);

  /** Läuft gerade eine Stammgruppen-Einladung (quickPlayGroup)? */
  const busyGroup = ref(false);
  const lastGroupResult = ref<{ ok: boolean; text: string; invited: string[]; failed: string[] } | null>(null);

  async function readTokenAge(): Promise<number | null> {
    try {
      const status = await AutodartsToolsGlobalStatus.getValue();
      const token = status?.auth?.token;
      const tokenAt = status?.auth?.tokenAt;
      if (!token || typeof tokenAt !== "number" || tokenAt <= 0) return null;
      return Date.now() - tokenAt;
    } catch {
      return null;
    }
  }

  /** true, wenn ein Abruf überhaupt Sinn hat. */
  async function hasUsableToken(): Promise<boolean> {
    const age = await readTokenAge();
    // TEMP-DIAG (Realtest 2): macht sichtbar, ob der lokale Freshness-Check
    // vor dem eigentlichen API-Call greift — nie den Token-Inhalt loggen.
    console.log(`[ADT-DIAG] TOKEN_STORAGE: ${age === null ? "NO" : "YES"}  TOKEN_AGE: ${age === null ? "n/a" : `${Math.round(age / 1000)}s`}  MAX_AGE: ${Math.round(TOKEN_MAX_AGE_MS / 1000)}s`);
    return age !== null && age < TOKEN_MAX_AGE_MS;
  }

  async function load(): Promise<void> {
    if (state.value === "loading") return;
    errorText.value = null;
    state.value = "loading";

    if (!(await hasUsableToken())) {
      state.value = "no-auth";
      return;
    }

    const result = await getFriendsDiagnostic();
    httpStatus.value = result.httpStatus;
    sampleKeys.value = result.sampleKeys;

    if (!result.ok) {
      rawFriends.value = [];
      // 401/403 heißt: der Token wurde abgelehnt — dasselbe Problem wie bei
      // fehlendem Token, also derselbe ehrliche Hinweis.
      if (result.httpStatus === 401 || result.httpStatus === 403) {
        state.value = "no-auth";
        return;
      }
      errorText.value = result.error ?? "Die Freundesliste konnte nicht geladen werden.";
      state.value = "unavailable";
      return;
    }

    rawFriends.value = result.friends;
    loadedAt.value = Date.now();
    state.value = "ready";
  }

  /**
   * Quick-Play: erstellt über die bestehende Funktion eine private Lobby und
   * lädt den Freund ein. Das ist ein echter, nach außen wirkender Vorgang —
   * die aufrufende Komponente bestätigt ihn deshalb vorher.
   */
  async function challenge(friend: IFriendResolved): Promise<IQuickPlayResult> {
    const label = friend.name ?? "diesen Freund";
    busyFriendId.value = friend.id;
    lastActionText.value = null;
    lastActionOk.value = null;
    try {
      const result = await quickPlay(friend.id);
      lastActionOk.value = result.success;
      lastActionText.value = result.success
        ? `Lobby erstellt und Einladung an ${label} gesendet.`
        : `Einladung an ${label} fehlgeschlagen: ${result.error ?? "unbekannter Fehler"}`;
      return result;
    } catch (error) {
      lastActionOk.value = false;
      lastActionText.value = `Einladung an ${label} fehlgeschlagen: ${
        error instanceof Error ? error.message : String(error)
      }`;
      return { success: false, error: lastActionText.value };
    } finally {
      busyFriendId.value = null;
    }
  }

  /**
   * Stammgruppe: erstellt über die bestehende `quickPlayGroup()` eine neue
   * private Lobby und lädt alle übergebenen Freunde ein. Dieselbe Ehrlichkeit
   * wie `challenge()`: Erfolg/Fehler nur aus der tatsächlichen Antwort, keine
   * Ready-/Angenommen-Zustände. Erstellt IMMER eine neue Lobby — daher von der
   * aufrufenden UI nur anbieten, wenn (noch) keine Lobby aktiv ist.
   */
  async function challengeGroup(friendIds: string[]): Promise<import("@/utils/friends-api").IGroupInviteResult> {
    busyGroup.value = true;
    lastGroupResult.value = null;
    try {
      const result = await quickPlayGroup(friendIds);
      lastGroupResult.value = {
        ok: result.success,
        text: result.success
          ? `Lobby erstellt — ${result.invited.length} von ${friendIds.length} Freunden eingeladen.`
          : `Party-Erstellung fehlgeschlagen: ${result.error ?? "unbekannter Fehler"}`,
        invited: result.invited,
        failed: result.failed,
      };
      return result;
    } catch (error) {
      const text = `Party-Erstellung fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`;
      lastGroupResult.value = { ok: false, text, invited: [], failed: friendIds };
      return { success: false, error: text, invited: [], failed: friendIds };
    } finally {
      busyGroup.value = false;
    }
  }

  // ── Auswertung ────────────────────────────────────────────────────────────
  // Gruppiert wird nur, wenn der Online-Status wirklich bekannt ist. Sonst gibt
  // es eine flache Liste — eine "Offline"-Gruppe wäre eine Behauptung.

  const online = computed(() => friends.value.filter(friend => friend.online === true));
  const offline = computed(() => friends.value.filter(friend => friend.online === false));
  const unknownOnline = computed(() => friends.value.filter(friend => friend.online === null));

  /** Wie viele Einträge haben keinen auflösbaren Namen? */
  const unresolvedNames = computed(() => friends.value.filter(friend => friend.name === null).length);
  const allNamesUnresolved = computed(
    () => friends.value.length > 0 && unresolvedNames.value === friends.value.length,
  );

  const isLoading = computed(() => state.value === "loading");
  const canAct = computed(() => state.value === "ready");

  /** Klartext, warum Namen fehlen — inklusive der real gelieferten Feldnamen. */
  const nameIssueText = computed<string | null>(() => {
    if (state.value !== "ready" || unresolvedNames.value === 0) return null;
    const scope = allNamesUnresolved.value
      ? `Zu keinem der ${friends.value.length} Einträge`
      : `Zu ${unresolvedNames.value} von ${friends.value.length} Einträgen`;
    const keys = sampleKeys.value.length > 0
      ? ` Autodarts liefert pro Eintrag nur diese Felder: ${sampleKeys.value.join(", ")}.`
      : "";
    return `${scope} hat Autodarts einen Anzeigenamen mitgeliefert.${keys} Die Namen lassen sich ohne einen zusätzlichen Nutzer-Abruf nicht auflösen — einen solchen Endpunkt setzt die Erweiterung bislang nicht ein, deshalb wird hier nichts erfunden.`;
  });

  /** Klartext, wenn (noch) kein Freund einen bestätigten Live-Status hat. */
  const onlineIssueText = computed<string | null>(() => {
    if (state.value !== "ready" || friends.value.length === 0) return null;
    if (onlineStatusAvailable.value) return null;
    // RUNTIME-FIX (Realtest 4): Autodarts bietet keinen abrufbaren Snapshot-
    // Endpunkt für den Status der Freundesliste — auch die eigene App nicht
    // (siehe utils/friends-api.ts::getOnlineFriendIds()). Seit Realtest 4
    // liest diese Erweiterung den echten Live-Kanal "autodarts.friends" mit
    // (utils/websocket-helpers.ts) — ein Freund zeigt "Online"/"Offline" also
    // erst, sobald für ihn tatsächlich ein Presence-Event eintraf. Bis dahin
    // bewusst "Status unbekannt" statt geraten.
    return "Für die Freunde unten ist bisher noch kein Live-Status eingetroffen (Autodarts sendet ihn pro Freund einzeln über die Live-Verbindung, nicht als Liste). Einträge werden deshalb als „Status unbekannt“ geführt — nicht als offline.";
  });

  return {
    state,
    friends,
    online,
    offline,
    unknownOnline,
    onlineStatusAvailable,
    unresolvedNames,
    allNamesUnresolved,
    nameIssueText,
    onlineIssueText,
    sampleKeys,
    httpStatus,
    isLoading,
    canAct,
    errorText,
    loadedAt,
    busyFriendId,
    lastActionText,
    lastActionOk,
    busyGroup,
    lastGroupResult,
    load,
    challenge,
    challengeGroup,
  };
}
