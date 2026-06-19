import { get } from 'svelte/store';
import { currentRoute } from '@/stores/route.store';
import { StorageService } from './storage.service';
import { showToast } from '@/stores/ui.store';
import { haversineDistance } from '@/utils/distance';
import type { RouteData } from '@/types';

const AUTOSAVE_INTERVAL_MS = 30 * 1000;
let autosaveTimer: ReturnType<typeof setInterval> | null = null;
let lastSavedHash = '';

function computeRouteHash(route: RouteData): string {
  return route.markers
    .map(m => `${m.lat.toFixed(6)},${m.lng.toFixed(6)}`)
    .join('|') + `|${route.name}`;
}

function calculateTotalDistance(route: RouteData): number {
  if (route.markers.length < 2) return 0;
  let dist = 0;
  for (let i = 0; i < route.markers.length - 1; i++) {
    const from = route.markers[i];
    const to = route.markers[i + 1];
    dist += haversineDistance([from.lat, from.lng], [to.lat, to.lng]);
  }
  return dist;
}

async function saveSnapshot(): Promise<void> {
  const route = get(currentRoute);
  if (!route || route.markers.length === 0) return;

  const currentHash = computeRouteHash(route);
  if (currentHash === lastSavedHash) return;

  try {
    const dist = calculateTotalDistance(route);
    await StorageService.saveDraftSnapshot({
      routeId: route.id,
      routeName: route.name,
      markers: JSON.parse(JSON.stringify(route.markers)),
      totalDistance: dist
    });
    lastSavedHash = currentHash;
  } catch (e) {
    console.error('Autosave failed:', e);
  }
}

export function startAutosave(): void {
  if (autosaveTimer) return;
  autosaveTimer = setInterval(() => {
    saveSnapshot().catch(err => console.error('Autosave error:', err));
  }, AUTOSAVE_INTERVAL_MS);
}

export function stopAutosave(): void {
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
    autosaveTimer = null;
  }
}

export async function forceSaveSnapshot(): Promise<void> {
  await saveSnapshot();
  showToast('已保存当前快照', 'success');
}

export function resetLastSavedHash(): void {
  lastSavedHash = '';
}
