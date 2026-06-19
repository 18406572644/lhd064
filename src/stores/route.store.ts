import { writable, derived } from 'svelte/store';
import type { RouteData, MarkerData, RouteSegment, VehicleConfig } from '@/types';
import { generateId } from '@/utils/id';
import { haversineDistance, calculateBearing } from '@/utils/distance';

const now = Date.now();
const defaultVehicleConfig: VehicleConfig = {
  fuelConsumption: 8,
  fuelPrice: 7.5,
  averageSpeed: 80,
  restStopInterval: 200,
  restStopDuration: 20
};

const defaultRoute: RouteData = {
  id: generateId(),
  name: '新路线',
  createdAt: now,
  updatedAt: now,
  markers: [],
  totalDistance: 0,
  totalDuration: 0,
  fuelCost: 0,
  description: ''
};

export const currentRoute = writable<RouteData>(defaultRoute);
export const selectedMarkerId = writable<string | null>(null);

export const segments = derived(currentRoute, ($currentRoute) => {
  const markers = $currentRoute.markers;
  if (markers.length < 2) return [];

  const result: RouteSegment[] = [];
  for (let i = 0; i < markers.length - 1; i++) {
    const from = markers[i];
    const to = markers[i + 1];
    const distance = haversineDistance([from.lat, from.lng], [to.lat, to.lng]);
    const duration = distance / defaultVehicleConfig.averageSpeed;
    const bearing = calculateBearing([from.lat, from.lng], [to.lat, to.lng]);
    result.push({ from, to, distance, duration, bearing });
  }
  return result;
});

export const totalDistance = derived(segments, ($segments) => {
  return $segments.reduce((sum, seg) => sum + seg.distance, 0);
});

export function addMarker(marker: Omit<MarkerData, 'id'>) {
  const newMarker: MarkerData = {
    ...marker,
    id: generateId()
  };
  currentRoute.update(route => ({
    ...route,
    markers: [...route.markers, newMarker],
    updatedAt: Date.now()
  }));
  return newMarker;
}

export function removeMarker(id: string) {
  currentRoute.update(route => ({
    ...route,
    markers: route.markers.filter(m => m.id !== id),
    updatedAt: Date.now()
  }));
  selectedMarkerId.update(selected => (selected === id ? null : selected));
}

export function updateMarker(id: string, patch: Partial<MarkerData>) {
  currentRoute.update(route => ({
    ...route,
    markers: route.markers.map(m =>
      m.id === id ? { ...m, ...patch } : m
    ),
    updatedAt: Date.now()
  }));
}

export function reorderMarkers(newOrder: string[]) {
  currentRoute.update(route => {
    const ordered = newOrder
      .map(id => route.markers.find(m => m.id === id))
      .filter((m): m is MarkerData => !!m);
    const remaining = route.markers.filter(m => !newOrder.includes(m.id));
    return {
      ...route,
      markers: [...ordered, ...remaining],
      updatedAt: Date.now()
    };
  });
}

export function selectMarker(id: string | null) {
  selectedMarkerId.set(id);
}

export function clearRoute() {
  currentRoute.set({
    id: generateId(),
    name: '新路线',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    markers: [],
    totalDistance: 0,
    totalDuration: 0,
    fuelCost: 0,
    description: ''
  });
  selectedMarkerId.set(null);
}
