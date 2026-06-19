import type { CommunityRoute, CommunityPackage, RouteData } from '@/types';
import { CommunityStorage } from './community-storage.service';
import { StorageService } from './storage.service';
import { MockAPI } from './mock-api';
import { generateId } from '@/utils/id';
import JSZip from 'jszip';

export const CommunityService = {
  async publishToPlaza(
    route: RouteData,
    author: string,
    description: string,
    rating: 1 | 2 | 3 | 4 | 5
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
      thumbnail: route.thumbnail
    };
    await CommunityStorage.saveRoute(communityRoute);
    CommunityStorage.saveAuthorName(author.trim());
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
      await CommunityStorage.saveRoute(route);
      imported++;
    }
    return { imported, skipped };
  }
};
