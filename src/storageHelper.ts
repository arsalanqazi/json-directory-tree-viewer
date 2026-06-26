import { TreeSource } from './types';
import { processRawPresetNode } from './data/presets';

const DB_NAME = 'TreeViewerDB';
const DB_VERSION = 1;
const STORE_NAME = 'treeSources';
const LS_KEY = 'tree-viewer-sources';
const SIZE_THRESHOLD = 2 * 1024 * 1024; // 2MB

// Open (or create) the IndexedDB database
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Save a single large source's heavy data to IndexedDB
async function saveToIDB(id: string, rawJson: string | Blob, rootNodesJson?: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({ id, rawJson, rootNodesJson });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Load a single large source's heavy data from IndexedDB
async function loadFromIDB(id: string): Promise<{ rawJson: string | Blob; rootNodes?: any[]; rootNodesJson?: string } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// Delete a single source from IndexedDB
async function deleteFromIDB(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Metadata-only representation saved to localStorage for large sources.
 * The heavy fields (rawJson, rootNodes) are stored in IndexedDB.
 */
interface LightweightSourceMeta {
  id: string;
  name: string;
  importedAt: string;
  directoriesCount: number;
  filesCount: number;
  totalSize: number;
  _storedInIDB: true;
}

/**
 * Saves all tree sources using a hybrid localStorage + IndexedDB strategy.
 * Small sources go entirely into localStorage.
 * Large sources split: metadata -> localStorage, heavy data -> IndexedDB.
 */
export async function saveTreeSources(sources: TreeSource[]): Promise<void> {
  const lsEntries: (TreeSource | LightweightSourceMeta)[] = [];
  const idbPromises: Promise<void>[] = [];

  for (const source of sources) {
    const rawSize = source.rawJson
      ? (typeof source.rawJson === 'string' ? source.rawJson.length : source.rawJson.size)
      : 0;

    if (rawSize >= SIZE_THRESHOLD) {
      // Large source: save heavy data to IndexedDB
      const rootNodesJson = source.rootNodesJson || JSON.stringify(source.rootNodes);
      idbPromises.push(saveToIDB(source.id, source.rawJson || '', rootNodesJson));
      // Save lightweight metadata to localStorage
      lsEntries.push({
        id: source.id,
        name: source.name,
        importedAt: source.importedAt,
        directoriesCount: source.directoriesCount,
        filesCount: source.filesCount,
        totalSize: source.totalSize,
        _storedInIDB: true,
      });
    } else {
      // Small source: save entirely to localStorage
      lsEntries.push(source);
    }
  }

  // Write to localStorage (may fail silently if somehow still too large)
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(lsEntries));
  } catch (e) {
    console.warn('[storageHelper] localStorage write failed, falling back to IDB-only for all sources:', e);
    // If localStorage fails entirely, save all sources to IDB
    for (const source of sources) {
      const rootNodesJson = source.rootNodesJson || JSON.stringify(source.rootNodes);
      idbPromises.push(saveToIDB(source.id, source.rawJson || '', rootNodesJson));
    }
    // Save only the minimal metadata array
    const minimalMeta = sources.map(s => ({
      id: s.id,
      name: s.name,
      importedAt: s.importedAt,
      directoriesCount: s.directoriesCount,
      filesCount: s.filesCount,
      totalSize: s.totalSize,
      _storedInIDB: true as const,
    }));
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(minimalMeta));
    } catch {
      // Complete localStorage failure -- data lives only in IDB
      console.error('[storageHelper] Complete localStorage failure.');
    }
  }

  await Promise.all(idbPromises);
}

/**
 * Loads all tree sources, hydrating large ones from IndexedDB.
 */
export async function loadTreeSources(): Promise<TreeSource[]> {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return [];

  let entries: any[];
  try {
    entries = JSON.parse(raw);
  } catch {
    return [];
  }

  const results: TreeSource[] = [];

  for (const entry of entries) {
    if (entry._storedInIDB) {
      // Hydrate from IndexedDB
      try {
        const idbData = await loadFromIDB(entry.id);
        if (idbData) {
          let rootNodes: any[] = [];
          if (idbData.rootNodesJson) {
            try {
              rootNodes = JSON.parse(idbData.rootNodesJson);
            } catch (e) {
              console.warn('[storageHelper] Failed to parse rootNodesJson from IndexedDB:', e);
            }
          }

          if (rootNodes.length === 0 && idbData.rawJson) {
            try {
              let parsed: any;
              let text: string;
              if (idbData.rawJson instanceof Blob) {
                text = await idbData.rawJson.text();
              } else {
                text = idbData.rawJson as string;
              }
              // Fix missing commas (e.g. `}{`) before parsing fallback
              const fixedText = text.replace(/([\}\]])(\s*)([\{\[])/g, '$1,$2$3');
              parsed = JSON.parse(fixedText);
              
              const dataArray = Array.isArray(parsed) ? parsed : [parsed];
              const dataNodes = dataArray.filter((node: any) => node.type !== 'report');
              rootNodes = dataNodes.map((node: any) => processRawPresetNode(node, '', 0, entry.id));
            } catch (e) {
              console.error('[storageHelper] Fallback parse of rawJson failed:', e);
              if (idbData.rootNodes) {
                rootNodes = idbData.rootNodes;
              }
            }
          }

          results.push({
            id: entry.id,
            name: entry.name,
            importedAt: entry.importedAt,
            rawJson: idbData.rawJson,
            rootNodesJson: idbData.rootNodesJson,
            rootNodes,
            directoriesCount: entry.directoriesCount,
            filesCount: entry.filesCount,
            totalSize: entry.totalSize,
          });
        }
        // If IDB data is missing, skip this source (it was lost)
      } catch (e) {
        console.warn(`[storageHelper] Failed to hydrate source ${entry.id} from IDB:`, e);
      }
    } else {
      // Small source stored entirely in localStorage
      results.push(entry as TreeSource);
    }
  }

  return results;
}

/**
 * Deletes a single tree source from both localStorage and IndexedDB.
 */
export async function deleteTreeSource(id: string): Promise<void> {
  // Remove from IndexedDB (no-op if it wasn't there)
  try {
    await deleteFromIDB(id);
  } catch {
    // Ignore
  }

  // The localStorage entry will be updated on the next full save
}
