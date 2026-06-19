import type { CommunityRoute, FavoriteRoute, WatchLaterRoute, UserPreference } from '@/types';

const DB_NAME = 'vintage_community_db';
const DB_VERSION = 1;
const STORE_NAME = 'community_routes';
const AUTHOR_KEY = 'vintage_community_author_v1';
const FAVORITES_KEY = 'vintage_community_favorites_v1';
const WATCH_LATER_KEY = 'vintage_community_watchlater_v1';
const USER_PREF_KEY = 'vintage_community_userpref_v1';

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
  },

  loadFavorites(): FavoriteRoute[] {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  },

  saveFavorites(favorites: FavoriteRoute[]): void {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch (e) {
      console.warn('保存收藏失败', e);
    }
  },

  isFavorite(routeId: string): boolean {
    return this.loadFavorites().some(f => f.routeId === routeId);
  },

  toggleFavorite(routeId: string, customTags: string[] = []): boolean {
    const favorites = this.loadFavorites();
    const idx = favorites.findIndex(f => f.routeId === routeId);
    if (idx >= 0) {
      favorites.splice(idx, 1);
      this.saveFavorites(favorites);
      return false;
    } else {
      favorites.push({ routeId, customTags, favoritedAt: Date.now() });
      this.saveFavorites(favorites);
      return true;
    }
  },

  updateFavoriteTags(routeId: string, customTags: string[]): void {
    const favorites = this.loadFavorites();
    const fav = favorites.find(f => f.routeId === routeId);
    if (fav) {
      fav.customTags = customTags;
      this.saveFavorites(favorites);
    }
  },

  getFavorite(routeId: string): FavoriteRoute | undefined {
    return this.loadFavorites().find(f => f.routeId === routeId);
  },

  loadWatchLater(): WatchLaterRoute[] {
    try {
      const raw = localStorage.getItem(WATCH_LATER_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  },

  saveWatchLater(list: WatchLaterRoute[]): void {
    try {
      localStorage.setItem(WATCH_LATER_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('保存稍后再看失败', e);
    }
  },

  isWatchLater(routeId: string): boolean {
    return this.loadWatchLater().some(w => w.routeId === routeId);
  },

  toggleWatchLater(routeId: string): boolean {
    const list = this.loadWatchLater();
    const idx = list.findIndex(w => w.routeId === routeId);
    if (idx >= 0) {
      list.splice(idx, 1);
      this.saveWatchLater(list);
      return false;
    } else {
      list.push({ routeId, addedAt: Date.now() });
      this.saveWatchLater(list);
      return true;
    }
  },

  loadUserPreference(): UserPreference {
    try {
      const raw = localStorage.getItem(USER_PREF_KEY);
      if (!raw) {
        return { preferredThemes: [], preferredMarkerTypes: [], preferredDistanceRanges: [] };
      }
      return JSON.parse(raw) as UserPreference;
    } catch (e) {
      return { preferredThemes: [], preferredMarkerTypes: [], preferredDistanceRanges: [] };
    }
  },

  saveUserPreference(pref: UserPreference): void {
    try {
      localStorage.setItem(USER_PREF_KEY, JSON.stringify(pref));
    } catch (e) {
      console.warn('保存用户偏好失败', e);
    }
  },

  updateUserPreferenceFromRoute(route: CommunityRoute): void {
    const pref = this.loadUserPreference();
    for (const theme of route.themes || []) {
      if (!pref.preferredThemes.includes(theme)) {
        pref.preferredThemes.push(theme);
      }
    }
    for (const marker of route.markers) {
      if (!pref.preferredMarkerTypes.includes(marker.type)) {
        pref.preferredMarkerTypes.push(marker.type);
      }
    }
    const distRange = route.totalDistance < 100 ? 'short' : route.totalDistance < 500 ? 'medium' : 'long';
    if (!pref.preferredDistanceRanges.includes(distRange as any)) {
      pref.preferredDistanceRanges.push(distRange as any);
    }
    this.saveUserPreference(pref);
  }
};
