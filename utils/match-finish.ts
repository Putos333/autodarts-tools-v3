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

/**
 * "Is this match currently finished" — the one-shot counterpart to
 * `didMatchJustFinish` above, for callers (like `utils/liga-api.ts`'s
 * `ligaAutoSubmit()`) that only need the current state, not a transition.
 *
 * Original bug (liga-api.ts): checked `gameData?.gameState === 'finished' ||
 * gameData?.status === 'finished'` — neither field exists on `IGameData`
 * (only `.match.finished`/`.match.winner` do, see game-data-storage.ts) or
 * even on `IMatch`. The watcher callback was typed `gameData: any`, so
 * TypeScript never caught it — `isFinished` was permanently `false` and the
 * Liga auto-submit feature never fired for any match.
 */
export function isMatchFinished(
  match: { finished?: boolean; winner?: number | null } | null | undefined,
): boolean {
  return match?.finished === true || (typeof match?.winner === "number" && match.winner >= 0);
}

/**
 * Match-Ende als ÜBERGANG (prev → cur), `finished` ODER `winner` — die bis
 * dahin wortgleich in match-card.ts und ft-auto-result.ts duplizierte
 * Erkennung, unverändert übernommen: `finished` wird neu true, oder `winner`
 * wechselt von "nicht gesetzt" (undefined/null/<0) auf einen Index >= 0.
 * `prev` undefined (erster Snapshot / Reload) zählt als "nicht beendet".
 * Bewusst NICHT identisch mit `didMatchJustFinish` (nur `winner`, share-card)
 * und `isMatchFinished` (Zustand statt Übergang).
 */
export function didFinishTransition(
  prev: { finished?: boolean; winner?: number | null } | null | undefined,
  cur: { finished?: boolean; winner?: number | null },
): boolean {
  const wasFinished = prev?.finished === true;
  const isFinished = cur.finished === true;
  const winnerBecameSet = (cur.winner !== undefined && cur.winner !== null && cur.winner >= 0)
    && (prev?.winner === undefined || prev?.winner === null || prev?.winner < 0);
  return (!wasFinished && isFinished) || winnerBecameSet;
}
