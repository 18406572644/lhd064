import type { RouteData, VehicleConfig, CachedTile, DraftRouteSnapshot } from '../types';
import { generateId } from '../utils/id';

const ROUTES_KEY = 'vintage_routes_v1';
const CURRENT_ROUTE_KEY = 'vintage_current_route_v1';
const VEHICLE_CONFIG_KEY = 'vintage_vehicle_config_v1';

const DB_NAME = 'vintage_map_cache';
const DB_VERSION = 2;
const TILE_STORE = 'tiles';
const DRAFT_ROUTES_STORE = 'draft_routes';
const MAX_SNAPSHOTS_PER_ROUTE = 10;

export const StorageService = {
  saveRoutes(routes: RouteData[]): void {
    try {
      localStorage.setItem(ROUTES_KEY, JSON.stringify(routes));
    } catch (e) {
      console.error('Failed to save routes:', e);
    }
  },

  loadRoutes(): RouteData[] {
    try {
      const data = localStorage.getItem(ROUTES_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Failed to load routes:', e);
      return [];
    }
  },

  saveCurrentRouteId(id: string): void {
    try {
      localStorage.setItem(CURRENT_ROUTE_KEY, id);
    } catch (e) {
      console.error('Failed to save current route id:', e);
    }
  },

  loadCurrentRouteId(): string | null {
    try {
      return localStorage.getItem(CURRENT_ROUTE_KEY);
    } catch (e) {
      console.error('Failed to load current route id:', e);
      return null;
    }
  },

  saveVehicleConfig(config: VehicleConfig): void {
    try {
      localStorage.setItem(VEHICLE_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save vehicle config:', e);
    }
  },

  loadVehicleConfig(): VehicleConfig | null {
    try {
      const data = localStorage.getItem(VEHICLE_CONFIG_KEY);
      if (!data) return null;
      return JSON.parse(data) as VehicleConfig;
    } catch (e) {
      console.error('Failed to load vehicle config:', e);
      return null;
    }
  },

  openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(TILE_STORE)) {
          const store = db.createObjectStore(TILE_STORE, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(DRAFT_ROUTES_STORE)) {
          const store = db.createObjectStore(DRAFT_ROUTES_STORE, { keyPath: 'id' });
          store.createIndex('routeId', 'routeId', { unique: false });
          store.createIndex('savedAt', 'savedAt', { unique: false });
          store.createIndex('routeId_savedAt', ['routeId', 'savedAt'], { unique: false });
        }
      };
    });
  },

  async saveTile(z: number, x: number, y: number, data: CachedTile): Promise<void> {
    const key = `${z}/${x}/${y}`;
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TILE_STORE, 'readwrite');
      const store = transaction.objectStore(TILE_STORE);
      const record = { key, ...data };
      const request = store.put(record);
      request.onsuccess = () => {
        db.close();
        resolve();
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  },

  async getTile(z: number, x: number, y: number): Promise<CachedTile | null> {
    const key = `${z}/${x}/${y}`;
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(TILE_STORE, 'readonly');
      const store = transaction.objectStore(TILE_STORE);
      const request = store.get(key);
      request.onsuccess = () => {
        db.close();
        const result = request.result;
        if (result) {
          const { key: _key, ...rest } = result;
          resolve(rest as CachedTile);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  },

  async saveDraftSnapshot(snapshot: Omit<DraftRouteSnapshot, 'id' | 'savedAt'>): Promise<DraftRouteSnapshot> {
    const db = await this.openDB();
    const fullSnapshot: DraftRouteSnapshot = {
      ...snapshot,
      id: generateId(),
      savedAt: Date.now()
    };

    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(DRAFT_ROUTES_STORE, 'readwrite');
      const store = transaction.objectStore(DRAFT_ROUTES_STORE);
      const request = store.add(fullSnapshot);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    await this.cleanupOldSnapshots(snapshot.routeId);
    db.close();
    return fullSnapshot;
  },

  async getDraftSnapshots(routeId: string, limit: number = MAX_SNAPSHOTS_PER_ROUTE): Promise<DraftRouteSnapshot[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DRAFT_ROUTES_STORE, 'readonly');
      const store = transaction.objectStore(DRAFT_ROUTES_STORE);
      const index = store.index('routeId_savedAt');
      const range = IDBKeyRange.bound([routeId, 0], [routeId, Infinity]);
      const request = index.openCursor(range, 'prev');
      const results: DraftRouteSnapshot[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value as DraftRouteSnapshot);
          cursor.continue();
        } else {
          db.close();
          resolve(results);
        }
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  },

  async getDraftSnapshotById(id: string): Promise<DraftRouteSnapshot | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DRAFT_ROUTES_STORE, 'readonly');
      const store = transaction.objectStore(DRAFT_ROUTES_STORE);
      const request = store.get(id);
      request.onsuccess = () => {
        db.close();
        resolve((request.result as DraftRouteSnapshot) || null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  },

  async cleanupOldSnapshots(routeId: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DRAFT_ROUTES_STORE, 'readwrite');
      const store = transaction.objectStore(DRAFT_ROUTES_STORE);
      const index = store.index('routeId_savedAt');
      const range = IDBKeyRange.bound([routeId, 0], [routeId, Infinity]);
      const request = index.openCursor(range, 'prev');
      let count = 0;
      const toDelete: IDBValidKey[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          count++;
          if (count > MAX_SNAPSHOTS_PER_ROUTE) {
            toDelete.push(cursor.primaryKey);
          }
          cursor.continue();
        } else {
          const deletePromises = toDelete.map(key =>
            new Promise<void>((res, rej) => {
              const delReq = store.delete(key);
              delReq.onsuccess = () => res();
              delReq.onerror = () => rej(delReq.error);
            })
          );
          Promise.all(deletePromises)
            .then(() => {
              db.close();
              resolve();
            })
            .catch(err => {
              db.close();
              reject(err);
            });
        }
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  },

  async deleteAllDraftSnapshots(routeId: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(DRAFT_ROUTES_STORE, 'readwrite');
      const store = transaction.objectStore(DRAFT_ROUTES_STORE);
      const index = store.index('routeId');
      const range = IDBKeyRange.only(routeId);
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          db.close();
          resolve();
        }
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  }
};
