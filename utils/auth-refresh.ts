/**
 * auth-refresh.ts – Freshness-Check für Autodarts-Access-Tokens (v2.9.90).
 *
 * Die Extension "piggybackt" auf dem Access-Token, den die play.autodarts.io-
 * Seite selbst einfängt (via auth-cookie.ts). Tokens leben nur ~15 Minuten,
 * die Seite refresht im Hintergrund. Race-Condition:
 *
 *   • Nutzer öffnet play.autodarts.io in einem Tab und lässt ihn stundenlang
 *     offen. Das im GlobalStatus gespeicherte Token ist zwar nicht null,
 *     aber längst abgelaufen.
 *   • Nutzer klickt auf "Turnier-Match starten" in Tools. `createCareerLobby()`
 *     benutzt das alte Token → 401 → Lobby-Erstellung schlägt fehl.
 *
 * Fix: Vor jeder Lobby-Erstellung `ensureFreshAuthToken()` aufrufen. Falls
 * das aktuelle Token älter als STALE_THRESHOLD_MS ist, dispatchen wir ein
 * CustomEvent `adt-request-token-refresh` (siehe auth-cookie.ts), das im
 * Main-World-Kontext einen probe-fetch anstößt und die Autodarts-App zwingt,
 * ihren Bearer-Header zu setzen — den wir dann sofort abfangen. Wir warten
 * bis zu `maxWaitMs` auf ein Update von `GlobalStatus.auth.tokenAt`.
 */

import { AutodartsToolsGlobalStatus } from "@/utils/storage";

// Autodarts-JWTs leben ~15 Minuten. Wir betrachten alles > 10 Minuten als
// zu-alt und triggern einen Refresh-Versuch. Der Puffer verhindert, dass
// die Lobby-Erstellung mitten in einem Ablauf-Fenster stirbt.
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 min

/**
 * Stellt sicher, dass ein möglichst frisches Access-Token verfügbar ist.
 *
 * Return:
 *  • Wenn im GlobalStatus ein frisches Token liegt → dieses.
 *  • Sonst: Refresh-Event dispatchen + auf Token-Update warten (max. `maxWaitMs`).
 *  • Fallback: der zuletzt bekannte Token (auch wenn abgelaufen) — besser als
 *    `null`, weil die Autodarts-API bei manchen Endpoints noch ein paar
 *    Minuten Grace-Period akzeptiert.
 */
export async function ensureFreshAuthToken(maxWaitMs = 2500): Promise<string | null> {
  const status = await AutodartsToolsGlobalStatus.getValue();
  const currentToken = status.auth?.token || "";
  const currentTokenAt = status.auth?.tokenAt || 0;
  const now = Date.now();

  const isFresh = currentToken && (now - currentTokenAt) < STALE_THRESHOLD_MS;
  if (isFresh) return currentToken;

  // Refresh anstoßen. auth-cookie.ts (main world) hört auf dieses Event.
  try {
    window.dispatchEvent(new CustomEvent("adt-request-token-refresh"));
  } catch (_) { /* dispatch nur best-effort */ }

  // Poll auf tokenAt-Update.
  const deadline = now + Math.max(200, maxWaitMs);
  const pollInterval = 100;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollInterval));
    const s = await AutodartsToolsGlobalStatus.getValue();
    const t = s.auth?.token || "";
    const at = s.auth?.tokenAt || 0;
    // Neuer Token gefunden: entweder der Zeitstempel wurde aktualisiert,
    // oder ein bisher leerer Token wurde gesetzt.
    if (t && at > currentTokenAt) {
      console.log("[Auth-Refresh] Frisches Token nach", Date.now() - now, "ms");
      return t;
    }
  }

  // Fallback: alter Token (evtl. abgelaufen). Der Aufrufer kann bei 401 retry.
  console.warn("[Auth-Refresh] Kein Refresh innerhalb", maxWaitMs, "ms — verwende evtl. altes Token");
  return currentToken || null;
}
