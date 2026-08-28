/**
 * `winner` ist projektweit sentinel-kodiert: -1 (oder undefined/null) = noch
 * nicht entschieden, >= 0 = Gewinner-Index (siehe z.B. match-card.ts:523-524,
 * ft-auto-result.ts:108). Pure/DOM-frei, damit share-card.ts's Match-Ende-
 * Erkennung unit-testbar bleibt (share-card.ts selbst importiert
 * utils/storage.ts, das WXTs `storage`-Build-Makro voraussetzt und daher
 * außerhalb des Extension-Kontexts nicht importierbar ist).
 *
 * Ursprünglicher Bug (share-card.ts): `wasFinished` wurde mit
 * `!!old.match.winner || old.match.winner === 0` geprüft. In JavaScript ist
 * `!!(-1) === true` (jede Zahl außer 0 ist truthy) — `wasFinished` war
 * dadurch während des GESAMTEN laufenden Matches (winner === -1) fälschlich
 * `true`, auch exakt im Moment des echten Übergangs zu "finished". Die
 * Share-Card wurde dadurch in der Praxis nie ausgelöst.
 */
export function didMatchJustFinish(
  oldWinner: number | null | undefined,
  newWinner: number | null | undefined,
): boolean {
  const wasFinished = oldWinner !== undefined && oldWinner !== null && oldWinner >= 0;
  const nowFinished = typeof newWinner === "number" && newWinner >= 0;
  return nowFinished && !wasFinished;
}
