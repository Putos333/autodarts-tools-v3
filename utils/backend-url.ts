/**
 * backend-url.ts — v2.9.86
 *
 * Einheitliche Quelle für die Backend-Basis-URL. Löst das Problem, dass
 * `darts-caller-ext.preview.emergentagent.com` an 7+ Stellen im Code
 * hardcodiert war. Zukünftige URL-Umstellungen erfordern jetzt exakt eine
 * Änderung: die `PRIMARY_BACKEND_URL`-Konstante hier.
 *
 * Fallback-Kette (in Reihenfolge):
 *  1. User-Setting (falls in Settings/AI-Commentator/ELO/… gesetzt)
 *  2. PRIMARY_BACKEND_URL — perspektivisch die Produktions-Domain
 *  3. FALLBACK_BACKEND_URL — die aktuell live erreichbare Preview-URL
 *
 * MIGRATIONS-HINWEIS: Sobald `autodarts-tools.emergent.host` deployed ist
 * (Emergent → Deploy → Production), einfach PRIMARY auf jenen Host setzen
 * und FALLBACK ggf. entfernen.
 */

/** Perspektivische Produktions-Domain — seit v2.9.88 live und Primary. */
export const PRIMARY_BACKEND_URL = 'https://darts-caller-ext.emergent.host';

/** Legacy Preview-URL (nur noch als Notfall-Fallback, wenn Prod down ist). */
export const FALLBACK_BACKEND_URL = 'https://darts-caller-ext.preview.emergentagent.com';

/**
 * Liefert die zu verwendende Backend-URL. Bevorzugt die Nutzer-Config,
 * fällt sonst auf PRIMARY (Prod-Domain) zurück.
 */
export function getBackendUrl(userConfigUrl?: string | null): string {
  const trimmed = (userConfigUrl ?? '').trim().replace(/\/+$/, '');
  if (trimmed) return trimmed;
  return PRIMARY_BACKEND_URL;
}
