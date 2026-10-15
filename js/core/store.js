// js/core/store.js — IndexedDB persistence: whole sessions + photo blobs.
// Every change is written immediately (no autosave timer, no partial stores).

import { migrateSession, recoverLiveStores } from './migrate.js';

const DB_NAME = 'fraxinus-wildlife';
const DB_VERSION = 1;
const LEGACY_DB = 'SpeciesSurveyDB';
const MIGRATED_FLAG = 'fraxinus.migratedFromV1';

let _db = null;

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

async function db() {
  if (_db) return _db;
  const open = indexedDB.open(DB_NAME, DB_VERSION);
  open.onupgradeneeded = () => {
    const d = open.result;
    if (!d.objectStoreNames.contains('sessions')) d.createObjectStore('sessions', { keyPath: 'id' });
    if (!d.objectStoreNames.contains('photos')) {
      d.createObjectStore('photos', { keyPath: 'id' }).createIndex('sessionId', 'sessionId');
    }
  };
  _db = await req(open);
  _db.onversionchange = () => { _db.close(); _db = null; };
  return _db;
}

async function run(storeName, mode, fn) {
  const tx = (await db()).transaction(storeName, mode);
  const result = fn(tx.objectStore(storeName));
  await txDone(tx);
  return result instanceof IDBRequest ? result.result : result;
}

// ─── Sessions ─────────────────────────────────────────────────────────────
export async function listSessions() {
  const all = await run('sessions', 'readonly', s => s.getAll());
  return all.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export const getSession = id => run('sessions', 'readonly', s => s.get(id));

// Writes are chained so a slow write can never land after a newer one.
let _chain = Promise.resolve();
export function putSession(session) {
  const copy = JSON.parse(JSON.stringify(session));
  _chain = _chain.catch(() => {}).then(() => run('sessions', 'readwrite', s => s.put(copy)));
  return _chain;
}

export async function deleteSession(id) {
  const photoIds = await run('photos', 'readonly', s => s.index('sessionId').getAllKeys(id));
  const tx = (await db()).transaction(['sessions', 'photos'], 'readwrite');
  tx.objectStore('sessions').delete(id);
  photoIds.forEach(pid => tx.objectStore('photos').delete(pid));
  await txDone(tx);
}

// ─── Photos ───────────────────────────────────────────────────────────────
// photo = { id, sessionId, recordId, name, type, blob, time }
export const putPhoto = photo => run('photos', 'readwrite', s => s.put(photo));
export const getPhoto = id => run('photos', 'readonly', s => s.get(id));
export const deletePhoto = id => run('photos', 'readwrite', s => s.delete(id));
export const photosForSession = id => run('photos', 'readonly', s => s.index('sessionId').getAll(id));

// ─── Backup / restore (metadata + records; photos travel in the zip export) ─
export async function importSessions(sessions) {
  const tx = (await db()).transaction('sessions', 'readwrite');
  const store = tx.objectStore('sessions');
  let n = 0;
  for (const s of sessions) {
    if (s && s.id && s.type && s.v === 2) { store.put(s); n++; }
  }
  await txDone(tx);
  return n;
}

// Ask the browser not to evict our data under storage pressure.
export async function requestPersistence() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}

// ─── One-time import from app v1 ──────────────────────────────────────────
function openLegacy() {
  return new Promise(resolve => {
    let created = false;
    const r = indexedDB.open(LEGACY_DB);
    r.onupgradeneeded = () => { created = true; r.transaction.abort(); };  // never create it
    r.onsuccess = () => resolve(created ? null : r.result);
    r.onerror = () => resolve(null);
  });
}

async function readAll(legacy, name) {
  if (!legacy.objectStoreNames.contains(name)) return [];
  const tx = legacy.transaction(name, 'readonly');
  return req(tx.objectStore(name).getAll());
}

// Returns the number of sessions imported (0 if nothing to do).
export async function migrateFromV1() {
  if (localStorage.getItem(MIGRATED_FLAG)) return 0;
  const legacy = await openLegacy();
  if (!legacy) { localStorage.setItem(MIGRATED_FLAG, 'none'); return 0; }
  try {
    const existing = new Set((await listSessions()).map(s => s.id));
    const oldSessions = await readAll(legacy, 'sessions');
    const live = {};
    for (const n of ['speciesMarkers', 'mooseObservations', 'turtleObservations', 'nestObservations', 'habitatObservations']) {
      live[n] = await readAll(legacy, n);
    }
    const migrated = [
      ...oldSessions.map(migrateSession).filter(s => s && !existing.has(s.id)),
      ...recoverLiveStores(live),
    ];
    if (migrated.length) await importSessions(migrated);
    localStorage.setItem(MIGRATED_FLAG, new Date().toISOString());
    return migrated.length;
  } finally {
    legacy.close();
  }
}
