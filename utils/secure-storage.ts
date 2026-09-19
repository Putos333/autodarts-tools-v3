/**
 * secure-storage.ts – Verschlüsselter API-Key Speicher
 *
 * Sicherheitskonzept:
 * ─────────────────────────────────────────────────────────────────────────────
 * • API-Keys werden NIEMALS im Klartext gespeichert.
 * • Verschlüsselung: AES-GCM 256-Bit (Web Crypto API – nativ im Browser)
 * • Speicherort: browser.storage.local (nur auf diesem Gerät, nur diese Erweiterung)
 * • Der Verschlüsselungsschlüssel wird pro Gerät automatisch generiert und in
 *   IndexedDB gespeichert – er verlässt den Browser niemals.
 * • Kein Server, kein Cloud-Sync, keine Drittanbieter-Bibliotheken.
 *
 * Was bedeutet das in der Praxis?
 * ─────────────────────────────────────────────────────────────────────────────
 * ✅ Selbst wenn jemand Zugriff auf deine browser.storage.local bekommt,
 *    sieht er nur unlesbaren verschlüsselten Ciphertext.
 * ✅ Der Key kann nicht aus dem Browser exportiert oder kopiert werden.
 * ✅ Beim Deinstallieren der Erweiterung werden alle Keys automatisch gelöscht.
 * ✅ Funktioniert komplett offline – keine Internetverbindung nötig.
 */

const DB_NAME = 'autodarts-secure-keys';
const DB_STORE = 'crypto-keys';
const CRYPTO_KEY_ID = 'master-key-v1';

// ─── IndexedDB Hilfsfunktionen ────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key: string): Promise<CryptoKey | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: CryptoKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Verschlüsselungsschlüssel (pro Gerät, einmalig generiert) ────────────────

async function getMasterKey(): Promise<CryptoKey> {
  // Versuche bestehenden Schlüssel zu laden
  let key = await idbGet(CRYPTO_KEY_ID);
  if (key) return key;

  // Neuen AES-GCM 256-Bit Schlüssel generieren
  key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,       // nicht exportierbar!
    ['encrypt', 'decrypt'],
  );

  await idbSet(CRYPTO_KEY_ID, key);
  return key;
}

// ─── Ver- und Entschlüsselung ─────────────────────────────────────────────────

/**
 * Verschlüsselt einen API-Key und gibt den Ciphertext als Base64-String zurück.
 * Jede Verschlüsselung verwendet einen zufälligen IV (Initialization Vector).
 */
export async function encryptApiKey(plaintext: string): Promise<string> {
  if (!plaintext) return '';
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-Bit IV für AES-GCM
  const encoded = new TextEncoder().encode(plaintext);

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded,
  );

  // IV + Ciphertext zusammenfügen und als Base64 speichern
  const combined = new Uint8Array(iv.byteLength + cipherBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(cipherBuffer), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

/**
 * Entschlüsselt einen verschlüsselten API-Key.
 * Gibt den Klartext zurück, oder '' bei Fehler.
 */
export async function decryptApiKey(ciphertext: string): Promise<string> {
  if (!ciphertext) return '';
  try {
    const key = await getMasterKey();
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const plainBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data,
    );
    return new TextDecoder().decode(plainBuffer);
  } catch {
    return ''; // Fehler = Key nicht lesbar (z.B. falsches Gerät)
  }
}

/**
 * Gibt den genauen Speicherort des API-Keys aus (für das UI).
 */
export function getStorageLocationInfo(): {
  location: string;
  encryption: string;
  syncStatus: string;
  deleteInfo: string;
} {
  return {
    location: 'Nur auf diesem Gerät – browser.storage.local (isoliert für diese Erweiterung)',
    encryption: 'AES-GCM 256-Bit (Web Crypto API, nativ im Browser)',
    syncStatus: 'Kein Cloud-Sync – der Key verlässt dieses Gerät niemals',
    deleteInfo: 'Wird automatisch gelöscht wenn die Erweiterung deinstalliert wird',
  };
}

/**
 * Löscht alle gespeicherten API-Keys (für den "Alles löschen"-Button).
 */
export async function deleteAllApiKeys(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
