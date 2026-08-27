/**
 * canonical-match-result-storage.ts – Persistenz für das Canonical Match Result (P2)
 *
 * Folgt exakt dem bestehenden Muster der übrigen `*-storage.ts`-Module
 * (game-data-storage, board-data-storage, …): ein `storage.defineItem` auf
 * `local:`. Content Scripts schreiben nachweislich direkt in storage.local
 * (u.a. match-card.ts, career-controller.ts), deshalb wird KEINE
 * Background-Bridge gebaut.
 *
 * Bewusst nicht in `local:config-2-0-0` abgelegt: dort liegen Base64-Sounds,
 * und CMR-Daten sollen den Config-Blob nicht mitwachsen lassen.
 */

import {
  CMR_RETENTION_LIMIT,
  CMR_SCHEMA_VERSION,
  type ICanonicalMatchResult,
  type TCmrOutcome,
  sanitizeCanonicalMatchResults,
  upsertCanonicalMatchResult,
  migrateCanonicalMatchResult,
} from "./canonical-match-result";

export interface ICanonicalMatchResultStore {
  version: number;
  /** Neueste zuerst. */
  records: ICanonicalMatchResult[];
}

export const defaultCanonicalMatchResultStore: ICanonicalMatchResultStore = {
  version: CMR_SCHEMA_VERSION,
  records: [],
};

export const AutodartsToolsCanonicalMatchResults: WxtStorageItem<ICanonicalMatchResultStore, any> = storage.defineItem(
  "local:canonical-match-results-v1",
  {
    defaultValue: defaultCanonicalMatchResultStore,
  },
);

/**
 * Migrations-Laufwerk: lädt den Store, führt bei Bedarf eine Migration durch
 * und speichert das Ergebnis mit der aktuellen Schema-Version.
 *
 * Wird einmalig beim Extension-Start oder bei Storage-Änderungen aufgerufen.
 */
export async function migrateCanonicalMatchResults(): Promise<ICanonicalMatchResultStore> {
  const store = await AutodartsToolsCanonicalMatchResults.getValue();
  if (!store) {
    return defaultCanonicalMatchResultStore;
  }

  // Bereits aktuelle Version → nichts zu tun
  if (store.version === CMR_SCHEMA_VERSION) {
    return store;
  }

  // Migration von älterer Version auf aktuelle
  const migratedRecords = store.records.map((record) => migrateCanonicalMatchResult(record, store.version));

  const migratedStore: ICanonicalMatchResultStore = {
    version: CMR_SCHEMA_VERSION,
    records: sanitizeCanonicalMatchResults(migratedRecords),
  };

  await AutodartsToolsCanonicalMatchResults.setValue(migratedStore);
  return migratedStore;
}

/**
 * Initialisiert den CMR-Store: führt Migration durch und gibt gültige Records zurück.
 * Diese Funktion ersetzt getCanonicalMatchResults() für den ersten Lesezugriff.
 */
export async function initCanonicalMatchResults(): Promise<ICanonicalMatchResult[]> {
  const store = await migrateCanonicalMatchResults();
  return store.records;
}

/**
 * Schreibt einen Stand fort. Es wird nur dann geschrieben, wenn sich
 * tatsächlich etwas verbessert oder geändert hat – ein wirkungsloser oder
 * schwächerer Stand erzeugt keinen Storage-Write.
 */
export async function persistCanonicalMatchResult(next: ICanonicalMatchResult): Promise<TCmrOutcome> {
  const store = await AutodartsToolsCanonicalMatchResults.getValue();
  const records = sanitizeCanonicalMatchResults(store?.records);
  const result = upsertCanonicalMatchResult(records, next, CMR_RETENTION_LIMIT);

  if (result.outcome === "unchanged" || result.outcome === "rejected-weaker") {
    return result.outcome;
  }

  await AutodartsToolsCanonicalMatchResults.setValue({
    version: CMR_SCHEMA_VERSION,
    records: result.records,
  });

  return result.outcome;
}

/** Liest die gespeicherten Ergebnisse, beschädigte Einträge werden ignoriert. */
export async function getCanonicalMatchResults(): Promise<ICanonicalMatchResult[]> {
  const store = await AutodartsToolsCanonicalMatchResults.getValue();
  return sanitizeCanonicalMatchResults(store?.records);
}
