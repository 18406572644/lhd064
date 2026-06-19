import type { CommunityRoute } from '@/types';

const DB_NAME = 'vintage_community_db';
const DB_VERSION = 1;
const STORE_NAME = 'community_routes';
const AUTHOR_KEY = 'vintage_community_author_v1';

export const CommunityStorage = {
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
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('publishedAt', 'publishedAt', { unique: false });
          store.createIndex('rating', 'rating', { unique: false });
          store.createIndex('routeName', 'routeName', { unique: false });
        }
      };
    });
  },

  async getAllRoutes(): Promise<CommunityRoute[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        db.close();
        resolve(request.result || []);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  },

  async saveRoute(route: CommunityRoute): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(route);
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

  async deleteRoute(id: string): Promise<boolean> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => {
        db.close();
        resolve(true);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  },

  async getRoute(id: string): Promise<CommunityRoute | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        db.close();
        resolve(request.result || null);
      };
      request.onerror = () => {
        db.close();
        reject(request.error);
      };
    });
  },

  async incrementClonedCount(id: string): Promise<void> {
    const route = await this.getRoute(id);
    if (route) {
      route.clonedCount = (route.clonedCount || 0) + 1;
      await this.saveRoute(route);
    }
  },

  async saveRoutes(routes: CommunityRoute[]): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const route of routes) {
        store.put(route);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  },

  saveAuthorName(name: string): void {
    try {
      localStorage.setItem(AUTHOR_KEY, name);
    } catch (e) {
      console.warn('Failed to save author name', e);
    }
  },

  loadAuthorName(): string {
    try {
      return localStorage.getItem(AUTHOR_KEY) || '';
    } catch (e) {
      return '';
    }
  }
};
