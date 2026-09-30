/**
 * elo-client.ts – Anonymer ELO-Ladder Client (v2.9.75)
 *
 * Bei erstem Aufruf wird eine Player-ID (UUID) angelegt und dauerhaft in
 * browser.storage.local gespeichert. Der Display-Name wird aus dem
 * autodarts.io-Nutzernamen extrahiert oder auf "Anonymous_XXXX" gesetzt.
 * Sämtliche Kommunikation erfolgt anonym.
 */

const STORAGE_KEY = "adt-elo-identity";

export interface EloIdentity {
  playerId: string;
  displayName: string;
  createdAt: number;
  lastRating?: number;
  lastRank?: number;
  submitEnabled?: boolean;
}

export interface MatchResult {
  displayName?: string;
  result: 0 | 0.5 | 1;
  opponentRating?: number;
  opponentName?: string;
  matchAvg?: number;
  total180?: number;
  highFinish?: number;
}

export interface EloSubmitResponse {
  ok: boolean;
  old_rating: number;
  new_rating: number;
  delta: number;
  rank: number;
  total_players: number;
}

export interface EloLeaderboardEntry {
  rank: number;
  display_name: string;
  rating: number;
  matches: number;
  wins: number;
  total_180: number;
  best_finish: number;
}

function uuid(): string {
  return "pl-" + crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

function makeAnonymousName(): string {
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 4).toUpperCase();
  return `Anonymous_${suffix}`;
}

export async function getIdentity(): Promise<EloIdentity> {
  const raw = await browser.storage.local.get(STORAGE_KEY);
  const existing = raw?.[STORAGE_KEY] as EloIdentity | undefined;
  if (existing?.playerId) return existing;
  const created: EloIdentity = {
    playerId: uuid(),
    displayName: makeAnonymousName(),
    createdAt: Date.now(),
    submitEnabled: true,
  };
  await browser.storage.local.set({ [STORAGE_KEY]: created });
  return created;
}

export async function updateIdentity(patch: Partial<EloIdentity>): Promise<EloIdentity> {
  const cur = await getIdentity();
  const next = { ...cur, ...patch };
  await browser.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

export async function resetIdentity(): Promise<EloIdentity> {
  await browser.storage.local.remove(STORAGE_KEY);
  return getIdentity();
}

function normalizeBackend(url: string): string {
  const u = (url || "").trim().replace(/\/+$/, "");
  if (!u) return "";
  if (!/^https?:\/\//.test(u)) return `https://${u}`;
  return u;
}

// ─── Explizite Zustimmung (Consent) ─────────────────────────────────────
//
// Jede Netzwerkkommunikation dieses Clients (Upload, Ranglisten-Abruf,
// eigener Rang) läuft über bgFetch() und ist nur im Zustand "accepted"
// erlaubt. Fehlender, ungültiger oder nicht lesbarer Zustand zählt als
// "unknown" und sperrt (fail closed). Die Zustimmung liegt bewusst NICHT in
// der Config (IConfig): Einstellungs-Import und -Reset ändern sie nicht, und
// eine importierte Datei kann keine fremde Zustimmung mitbringen. Die
// bisherigen Gates (elo.enabled, elo.submitEnabled, identity.submitEnabled)
// bleiben unverändert und gelten zusätzlich.

const CONSENT_KEY = "adt-elo-consent";
export const ELO_CONSENT_VERSION = 1;
export type EloConsentState = "unknown" | "accepted" | "declined";

export async function getEloConsent(): Promise<EloConsentState> {
  try {
    const raw = await browser.storage.local.get(CONSENT_KEY);
    const rec = raw?.[CONSENT_KEY] as { state?: unknown; v?: unknown } | undefined;
    if (!rec || typeof rec !== "object" || rec.v !== ELO_CONSENT_VERSION) return "unknown";
    return rec.state === "accepted" || rec.state === "declined" ? rec.state : "unknown";
  } catch {
    return "unknown";
  }
}

/** Speichert die Entscheidung und prüft sie durch Zurücklesen. Gibt nur bei bestätigtem Schreiben `true` zurück. */
export async function setEloConsent(state: "accepted" | "declined"): Promise<boolean> {
  if (state !== "accepted" && state !== "declined") return false;
  try {
    await browser.storage.local.set({ [CONSENT_KEY]: { state, at: Date.now(), v: ELO_CONSENT_VERSION } });
    return (await getEloConsent()) === state;
  } catch {
    return false;
  }
}

async function bgFetch(url: string, options: RequestInit): Promise<any> {
  if ((await getEloConsent()) !== "accepted") {
    return { ok: false, error: "consent-required" };
  }
  try {
    const resp = await browser.runtime.sendMessage({
      type: "FETCH_JSON",
      payload: {
        url,
        method: options.method || "GET",
        headers: options.headers,
        body: options.body,
      },
    });
    return resp;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function submitMatch(backendUrl: string, m: MatchResult): Promise<EloSubmitResponse | null> {
  const identity = await getIdentity();
  if (identity.submitEnabled === false) return null;
  const url = normalizeBackend(backendUrl);
  if (!url) return null;
  const body = {
    player_id: identity.playerId,
    display_name: m.displayName || identity.displayName,
    result: m.result,
    opponent_rating: m.opponentRating,
    opponent_name: m.opponentName,
    match_avg: m.matchAvg,
    total_180: m.total180,
    high_finish: m.highFinish,
  };
  const resp = await bgFetch(`${url}/api/elo/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp?.ok) return null;
  const data = resp.data as EloSubmitResponse;
  await updateIdentity({
    lastRating: data.new_rating,
    lastRank: data.rank,
    displayName: body.display_name,
  });
  return data;
}

export async function fetchLeaderboard(backendUrl: string, limit = 50): Promise<EloLeaderboardEntry[]> {
  const url = normalizeBackend(backendUrl);
  if (!url) return [];
  const resp = await bgFetch(`${url}/api/elo/leaderboard?limit=${limit}`, { method: "GET" });
  if (!resp?.ok) return [];
  return (resp.data as EloLeaderboardEntry[]) ?? [];
}

export async function fetchSelf(backendUrl: string): Promise<any> {
  const identity = await getIdentity();
  const url = normalizeBackend(backendUrl);
  if (!url) return null;
  const resp = await bgFetch(`${url}/api/elo/me/${encodeURIComponent(identity.playerId)}`, {
    method: "GET",
  });
  if (!resp?.ok) return null;
  return resp.data;
}
