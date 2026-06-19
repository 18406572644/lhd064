export type MarkerType = 'attraction' | 'restaurant' | 'hotel' | 'gas';

export interface MarkerData {
  id: string;
  type: MarkerType;
  lat: number;
  lng: number;
  name: string;
  note: string;
  photoUrls: string[];
  arrivalTime?: string;
  stayDuration?: number;
}

export interface RouteData {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  markers: MarkerData[];
  totalDistance: number;
  totalDuration: number;
  fuelCost: number;
  thumbnail?: string;
  description: string;
}

export interface RouteSegment {
  from?: MarkerData;
  to?: MarkerData;
  fromIndex?: number;
  toIndex?: number;
  fromName?: string;
  toName?: string;
  distance: number;
  duration?: number;
  durationHours?: number;
  bearing?: number;
}

export interface DurationBreakdown {
  totalHours: number;
  restHours: number;
  drivingHours: number;
  stayHours: number;
}

export interface FuelEstimate {
  liters: number;
  cost: number;
}

export interface VehicleConfig {
  fuelConsumption: number;
  fuelPrice: number;
  averageSpeed: number;
  restStopInterval: number;
  restStopDuration: number;
}

export interface AppSettings {
  tileStyle: 'vintage' | 'satellite' | 'standard';
  showCompass: boolean;
  mapRotation: number;
  language: 'zh-CN';
}

export interface CachedTile {
  blob: Blob;
  timestamp: number;
  url: string;
}

export interface CommunityRoute {
  id: string;
  routeId: string;
  routeName: string;
  author: string;
  description: string;
  rating: 1 | 2 | 3 | 4 | 5;
  markers: MarkerData[];
  totalDistance: number;
  totalDuration: number;
  fuelCost: number;
  publishedAt: number;
  clonedCount: number;
  thumbnail?: string;
}

export interface CommunityPackage {
  version: string;
  exportedAt: number;
  routes: CommunityRoute[];
}

export type PlazaSortKey = 'rating' | 'distance' | 'markers';

export interface TileResponse {
  success: boolean;
  tileUrl: string;
  fromCache: boolean;
}
