/**
 * Browser-Managed Storage & Lifecycle Engine
 * Manages IndexedDB / in-memory temporary storage, best-effort cleanup,
 * and user-visible quota detection.
 */

export interface StorageInfo {
  usageMB: number;
  quotaMB: number;
  percentUsed: number;
}

const DB_NAME = 'clipper_sidhiq_db';
const STORE_NAME = 'jobs';
const CACHE_STORE_NAME = 'downloaded_videos';
const DB_VERSION = 2;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'url' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getBrowserStorageEstimate(): Promise<StorageInfo> {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      const quota = estimate.quota || 1024 * 1024 * 1024; // Default 1 GB estimate
      return {
        usageMB: Number((usage / (1024 * 1024)).toFixed(1)),
        quotaMB: Number((quota / (1024 * 1024)).toFixed(1)),
        percentUsed: Number(((usage / quota) * 100).toFixed(1))
      };
    } catch (_) {}
  }
  return { usageMB: 0, quotaMB: 2048, percentUsed: 0 };
}

export async function saveJobToIndexedDB(job: any): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({
      ...job,
      savedAt: Date.now()
    });
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('IndexedDB save fallback (in-memory mode):', e);
  }
}

export async function loadJobsFromIndexedDB(): Promise<any[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (_) {
    return [];
  }
}

export async function deleteJobFromIndexedDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (_) {}
}

export async function clearAllLocalJobs(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (_) {}
}

/**
 * Best-effort cleanup of jobs older than retention hours (default 6h)
 */
export async function performRetentionCleanup(retentionHours: number = 6.0): Promise<number> {
  const cutoffTime = Date.now() - (retentionHours * 3600 * 1000);
  let cleanedCount = 0;
  try {
    const jobs = await loadJobsFromIndexedDB();
    for (const j of jobs) {
      if (j.savedAt && j.savedAt < cutoffTime) {
        await deleteJobFromIndexedDB(j.id);
        cleanedCount++;
      }
    }
  } catch (_) {}
  return cleanedCount;
}

export interface CachedVideoEntry {
  url: string;
  filename: string;
  blob: Blob;
  size: number;
  mimeType: string;
  cachedAt: number;
}

export async function getCachedVideo(url: string): Promise<CachedVideoEntry | null> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) return null;
    const tx = db.transaction(CACHE_STORE_NAME, 'readonly');
    const store = tx.objectStore(CACHE_STORE_NAME);
    const req = store.get(url);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (_) {
    return null;
  }
}

export async function saveCachedVideo(entry: CachedVideoEntry): Promise<void> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) return;
    const tx = db.transaction(CACHE_STORE_NAME, 'readwrite');
    tx.objectStore(CACHE_STORE_NAME).put(entry);
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {
    console.warn('Failed to cache downloaded video in IndexedDB:', e);
  }
}
