import type {
  CommunityRoute,
  CommunityPackage,
  RouteData,
  PlazaFilter,
  RouteTheme,
  UserPreference,
  MarkerType
} from '@/types';
import { CommunityStorage } from './community-storage.service';
import { MockAPI } from './mock-api';
import { generateId } from '@/utils/id';
import { haversineDistance } from '@/utils/distance';
import JSZip from 'jszip';

export const CommunityService = {
  async publishToPlaza(
    route: RouteData,
    author: string,
    description: string,
    rating: 1 | 2 | 3 | 4 | 5,
    themes: RouteTheme[] = []
  ): Promise<CommunityRoute> {
    const communityRoute: CommunityRoute = {
      id: generateId(),
      routeId: route.id,
      routeName: route.name,
      author: author.trim() || '匿名旅行者',
      description: description.trim(),
      rating,
      markers: JSON.parse(JSON.stringify(route.markers)),
      totalDistance: route.totalDistance,
      totalDuration: route.totalDuration,
      fuelCost: route.fuelCost,
      publishedAt: Date.now(),
      clonedCount: 0,
      thumbnail: route.thumbnail,
      themes
    };
    await CommunityStorage.saveRoute(communityRoute);
    CommunityStorage.saveAuthorName(author.trim());
    CommunityStorage.updateUserPreferenceFromRoute(communityRoute);
    return communityRoute;
  },

  async loadPlazaRoutes(): Promise<CommunityRoute[]> {
    return CommunityStorage.getAllRoutes();
  },

  async cloneToMyRoutes(communityRoute: CommunityRoute): Promise<RouteData> {
    const newRoute: RouteData = {
      id: generateId(),
      name: communityRoute.routeName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      markers: JSON.parse(JSON.stringify(communityRoute.markers)),
      totalDistance: communityRoute.totalDistance,
      totalDuration: communityRoute.totalDuration,
      fuelCost: communityRoute.fuelCost,
      description: communityRoute.description
    };
    await MockAPI.saveRoute(newRoute);
    await CommunityStorage.incrementClonedCount(communityRoute.id);
    return newRoute;
  },

  async deleteFromPlaza(id: string): Promise<boolean> {
    return CommunityStorage.deleteRoute(id);
  },

  async exportPackage(routeIds?: string[]): Promise<void> {
    let routes = await CommunityStorage.getAllRoutes();
    if (routeIds && routeIds.length > 0) {
      routes = routes.filter(r => routeIds.includes(r.id));
    }
    const pkg: CommunityPackage = {
      version: '1.0',
      exportedAt: Date.now(),
      routes
    };
    const zip = new JSZip();
    zip.file('package.json', JSON.stringify(pkg, null, 2));
    for (const route of routes) {
      const filename = route.routeName.replace(/[\\/:*?"<>|]/g, '_').trim() || 'untitled';
      zip.file(`routes/${filename}.json`, JSON.stringify(route, null, 2));
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `community_routes_${date}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  async importPackage(file: File): Promise<{ imported: number; skipped: number }> {
    const zip = await JSZip.loadAsync(file);
    const packageFile = zip.file('package.json');
    if (!packageFile) {
      throw new Error('无效的社区路线包：缺少 package.json');
    }
    const content = await packageFile.async('string');
    const pkg: CommunityPackage = JSON.parse(content);
    if (!pkg.routes || !Array.isArray(pkg.routes)) {
      throw new Error('无效的社区路线包：数据格式错误');
    }
    const existingRoutes = await CommunityStorage.getAllRoutes();
    const existingIds = new Set(existingRoutes.map(r => r.id));
    const existingRouteIds = new Set(existingRoutes.map(r => r.routeId));
    let imported = 0;
    let skipped = 0;
    for (const route of pkg.routes) {
      if (existingIds.has(route.id) || existingRouteIds.has(route.routeId)) {
        skipped++;
        continue;
      }
      if (!route.id || !route.routeName || !route.markers) {
        skipped++;
        continue;
      }
      route.publishedAt = route.publishedAt || Date.now();
      route.clonedCount = route.clonedCount || 0;
      route.themes = route.themes || [];
      await CommunityStorage.saveRoute(route);
      imported++;
    }
    return { imported, skipped };
  },

  filterRoutes(routes: CommunityRoute[], filter: PlazaFilter): CommunityRoute[] {
    return routes.filter(route => {
      if (filter.distance !== 'all') {
        if (filter.distance === 'short' && route.totalDistance >= 100) return false;
        if (filter.distance === 'medium' && (route.totalDistance < 100 || route.totalDistance >= 500)) return false;
        if (filter.distance === 'long' && route.totalDistance < 500) return false;
      }
      if (filter.markers !== 'all') {
        const count = route.markers.length;
        if (filter.markers === 'few' && count >= 5) return false;
        if (filter.markers === 'medium' && (count < 5 || count >= 10)) return false;
        if (filter.markers === 'many' && count < 10) return false;
      }
      if (filter.themes.length > 0) {
        const hasTheme = (route.themes || []).some(t => filter.themes.includes(t));
        if (!hasTheme) return false;
      }
      if (filter.difficulty !== 'all') {
        if (route.rating !== filter.difficulty) return false;
      }
      if (filter.minRating !== 'all') {
        if (route.rating < filter.minRating) return false;
      }
      return true;
    });
  },

  async inferUserPreference(): Promise<UserPreference> {
    const pref = CommunityStorage.loadUserPreference();
    const myRoutes = await MockAPI.loadRoutes();
    for (const route of myRoutes) {
      if (route.markers.length >= 2) {
        for (const marker of route.markers) {
          if (!pref.preferredMarkerTypes.includes(marker.type)) {
            pref.preferredMarkerTypes.push(marker.type);
          }
        }
        const distRange = route.totalDistance < 100 ? 'short' : route.totalDistance < 500 ? 'medium' : 'long';
        if (!pref.preferredDistanceRanges.includes(distRange as any)) {
          pref.preferredDistanceRanges.push(distRange as any);
        }
      }
    }
    const favorites = CommunityStorage.loadFavorites();
    const allRoutes = await CommunityStorage.getAllRoutes();
    for (const fav of favorites) {
      const favRoute = allRoutes.find(r => r.id === fav.routeId);
      if (favRoute) {
        for (const theme of favRoute.themes || []) {
          if (!pref.preferredThemes.includes(theme)) {
            pref.preferredThemes.push(theme);
          }
        }
      }
    }
    return pref;
  },

  calculateRouteScore(route: CommunityRoute, pref: UserPreference): number {
    let score = 0;
    const themes = route.themes || [];
    const themeMatches = themes.filter(t => pref.preferredThemes.includes(t)).length;
    score += themeMatches * 25;
    const markerTypes = route.markers.map(m => m.type);
    const typeMatches = markerTypes.filter(t => pref.preferredMarkerTypes.includes(t)).length;
    score += typeMatches * 8;
    const distRange = route.totalDistance < 100 ? 'short' : route.totalDistance < 500 ? 'medium' : 'long';
    if (pref.preferredDistanceRanges.includes(distRange as any)) {
      score += 20;
    }
    score += route.rating * 4;
    score += Math.min(route.clonedCount * 0.5, 10);
    const daysAgo = (Date.now() - route.publishedAt) / (24 * 60 * 60 * 1000);
    score += Math.max(0, 15 - daysAgo * 0.5);
    return score;
  },

  async getRecommendations(limit: number = 6): Promise<CommunityRoute[]> {
    const allRoutes = await CommunityStorage.getAllRoutes();
    const pref = await this.inferUserPreference();
    if (allRoutes.length === 0) return [];
    const favoriteIds = new Set(CommunityStorage.loadFavorites().map(f => f.routeId));
    const scored = allRoutes
      .filter(r => !favoriteIds.has(r.id))
      .map(route => ({ route, score: this.calculateRouteScore(route, pref) }))
      .sort((a, b) => b.score - a.score);
    const hasAnyPref =
      pref.preferredThemes.length > 0 ||
      pref.preferredMarkerTypes.length > 0 ||
      pref.preferredDistanceRanges.length > 0;
    if (!hasAnyPref) {
      return allRoutes
        .slice()
        .sort((a, b) => b.rating - a.rating || b.clonedCount - a.clonedCount)
        .slice(0, limit);
    }
    return scored.slice(0, limit).map(s => s.route);
  },

  calculateGeoSimilarity(routeA: CommunityRoute, routeB: CommunityRoute): number {
    if (routeA.markers.length === 0 || routeB.markers.length === 0) return 0;
    let totalMinDist = 0;
    for (const mA of routeA.markers) {
      let minDist = Infinity;
      for (const mB of routeB.markers) {
        const d = haversineDistance([mA.lat, mA.lng], [mB.lat, mB.lng]);
        if (d < minDist) minDist = d;
      }
      totalMinDist += minDist;
    }
    const avgMinDist = totalMinDist / routeA.markers.length;
    const geoScore = Math.max(0, 1 - avgMinDist / 200);
    return geoScore;
  },

  calculateTagSimilarity(routeA: CommunityRoute, routeB: CommunityRoute): number {
    const themesA = new Set(routeA.themes || []);
    const themesB = new Set(routeB.themes || []);
    if (themesA.size === 0 && themesB.size === 0) return 0.3;
    let intersection = 0;
    for (const t of themesA) {
      if (themesB.has(t)) intersection++;
    }
    const union = themesA.size + themesB.size - intersection;
    const themeScore = union === 0 ? 0 : intersection / union;
    const typesA = new Set(routeA.markers.map(m => m.type));
    const typesB = new Set(routeB.markers.map(m => m.type));
    let typeIntersection = 0;
    for (const t of typesA) {
      if (typesB.has(t)) typeIntersection++;
    }
    const typeUnion = typesA.size + typesB.size - typeIntersection;
    const typeScore = typeUnion === 0 ? 0 : typeIntersection / typeUnion;
    return themeScore * 0.6 + typeScore * 0.4;
  },

  calculateDifficultySimilarity(routeA: CommunityRoute, routeB: CommunityRoute): number {
    const diff = Math.abs(routeA.rating - routeB.rating);
    return Math.max(0, 1 - diff * 0.2);
  },

  async getSimilarRoutes(routeId: string, limit: number = 4): Promise<CommunityRoute[]> {
    const allRoutes = await CommunityStorage.getAllRoutes();
    const target = allRoutes.find(r => r.id === routeId);
    if (!target) return [];
    const scored = allRoutes
      .filter(r => r.id !== routeId)
      .map(route => {
        const geoScore = this.calculateGeoSimilarity(target, route);
        const tagScore = this.calculateTagSimilarity(target, route);
        const diffScore = this.calculateDifficultySimilarity(target, route);
        const totalScore = geoScore * 0.4 + tagScore * 0.4 + diffScore * 0.2;
        return { route, score: totalScore };
      })
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.route);
  },

  async autoDetectThemes(route: RouteData): Promise<RouteTheme[]> {
    const themes: RouteTheme[] = [];
    const types = new Set(route.markers.map(m => m.type));
    if (types.has('attraction')) {
      let hasNature = false;
      let hasCulture = false;
      for (const m of route.markers) {
        const name = m.name.toLowerCase();
        const note = m.note.toLowerCase();
        const text = name + note;
        if (/山|湖|海|草原|森林|自然|公园|景区|风景|峡谷|峰|岭|冰川|雪山/.test(text)) {
          hasNature = true;
        }
        if (/古城|寺|庙|窟|宫|楼|关|历史|文化|遗址|博物馆|故居/.test(text)) {
          hasCulture = true;
        }
      }
      if (hasNature) themes.push('nature');
      if (hasCulture) themes.push('culture');
    }
    if (types.has('restaurant')) {
      themes.push('food');
    }
    if (route.totalDistance >= 300 || route.markers.length >= 6) {
      themes.push('road_trip');
    }
    if (themes.length === 0) {
      themes.push('road_trip');
    }
    return themes;
  }
};
