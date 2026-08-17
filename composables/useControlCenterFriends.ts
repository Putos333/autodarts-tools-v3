/**
 * useControlCenterFriends — Freundesliste im Control Center.
 *
 * Es wird ausschließlich die bereits vorhandene `utils/friends-api.ts` benutzt
 * (Endpoints `/as/v0/friends`, `/as/v0/friends/online-status`, Quick-Play über
 * `/gs/v0/lobbies`). Kein neuer Endpoint, keine eigene Datenhaltung.
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

import { computed, ref } from "vue";

import {
  getFriendsDiagnostic,
  quickPlay,
  type IFriendResolved,
  type IQuickPlayResult,
} from "@/utils/friends-api";
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
  const friends = ref<IFriendResolved[]>([]);
  const errorText = ref<string | null>(null);
  const loadedAt = ref<number | null>(null);
  const httpStatus = ref<number | null>(null);
  /** Hat der Online-Status-Endpoint verwertbar geantwortet? */
  const onlineStatusAvailable = ref(false);
  /** Feldnamen des ersten Eintrags — Grundlage der Klartext-Erklärung. */
  const sampleKeys = ref<string[]>([]);

  /** Läuft gerade ein Quick-Play? Enthält dann die Freund-ID. */
  const busyFriendId = ref<string | null>(null);
  const lastActionText = ref<string | null>(null);
  const lastActionOk = ref<boolean | null>(null);

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
    onlineStatusAvailable.value = result.onlineStatusAvailable;
    sampleKeys.value = result.sampleKeys;

    if (!result.ok) {
      friends.value = [];
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

    friends.value = result.friends;
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

  /** Klartext, wenn der Online-Status nicht ermittelbar war. */
  const onlineIssueText = computed<string | null>(() => {
    if (state.value !== "ready" || friends.value.length === 0) return null;
    if (onlineStatusAvailable.value) return null;
    return "Der Online-Status konnte nicht abgerufen werden. Die Einträge werden deshalb als „Status unbekannt“ geführt und nicht als offline.";
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
    load,
    challenge,
  };
}
