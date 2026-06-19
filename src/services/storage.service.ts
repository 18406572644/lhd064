import type { RouteData, VehicleConfig, CachedTile } from '../types';

const ROUTES_KEY = 'vintage_routes_v1';
const CURRENT_ROUTE_KEY = 'vintage_current_route_v1';
const VEHICLE_CONFIG_KEY = 'vintage_vehicle_config_v1';

const DB_NAME = 'vintage_map_cache';
const DB_VERSION = 1;
const TILE_STORE = 'tiles';

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
  }
};
