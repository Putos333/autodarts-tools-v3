/**
 * discord-webhook.ts — v2.9.87
 *
 * Wrapper um Discord-Webhook-fetch-Calls. Behandelt HTTP 429
 * (Rate Limit) laut Discord-Spec: liest `Retry-After` (Sekunden) oder
 * das JSON-Feld `retry_after` (Sekunden mit Nachkommastellen), wartet
 * und versucht es GENAU EINMAL erneut. Bei erneutem Fehlschlag →
 * `console.warn`, damit man's im DevTools-Log nachvollziehen kann.
 *
 * KEIN endloses Retrylooping — Discord würde bei Missbrauch die
 * Webhook-URL blocken.
 */

interface DiscordFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit | null;
  /** Wenn true → gib die Response zurück, sonst void (fire-and-forget). */
  returnResponse?: boolean;
}

const MAX_RETRY_WAIT_MS = 30_000;  // Nie länger als 30s warten
const DEFAULT_RETRY_MS = 1_500;

/**
 * Sendet einen Fetch an einen Discord-Webhook und retried EINMAL bei 429.
 * Fire-and-forget by default (kein Return).
 */
export async function postDiscordWebhook(
  url: string,
  opts: DiscordFetchOptions = {},
): Promise<Response | null> {
  const init: RequestInit = {
    method: opts.method ?? 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    body: opts.body,
  };

  try {
    let res = await fetch(url, init);

    if (res.status === 429) {
      const waitMs = await computeRetryDelayMs(res);
      console.warn(`[Discord-Webhook] 429 rate-limited, retry nach ${waitMs}ms`);
      await sleep(waitMs);
      res = await fetch(url, init);
      if (res.status === 429) {
        console.warn(`[Discord-Webhook] Auch nach Retry noch 429 — Nachricht verloren.`);
      } else if (!res.ok) {
        console.warn(`[Discord-Webhook] Retry lieferte HTTP ${res.status} — Nachricht evtl. verloren.`);
      }
    } else if (!res.ok) {
      // 4xx/5xx aber nicht 429 → einmal loggen, keine Retry (Body-Fehler etc.)
      console.warn(`[Discord-Webhook] HTTP ${res.status} bei ${new URL(url).host}`);
    }

    return opts.returnResponse ? res : null;
  } catch (e) {
    console.warn('[Discord-Webhook] Fetch fehlgeschlagen:', e);
    return null;
  }
}

async function computeRetryDelayMs(res: Response): Promise<number> {
  // 1) Header hat Vorrang (Sekunden als Integer)
  const header = res.headers.get('Retry-After');
  if (header) {
    const s = parseFloat(header);
    if (!isNaN(s) && s > 0) return clampWait(s * 1000);
  }
  // 2) Manchmal steht der Wert nur im JSON-Body als `retry_after` (float, Sekunden)
  try {
    const clone = res.clone();
    const body = await clone.json();
    if (body && typeof body.retry_after === 'number' && body.retry_after > 0) {
      return clampWait(body.retry_after * 1000);
    }
  } catch {
    /* body war kein JSON */
  }
  return DEFAULT_RETRY_MS;
}

function clampWait(ms: number): number {
  return Math.max(200, Math.min(MAX_RETRY_WAIT_MS, ms));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
