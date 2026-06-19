export type MarkerType = 'attraction' | 'restaurant' | 'hotel' | 'gas';

export type RouteTheme = 'nature' | 'culture' | 'food' | 'road_trip';

export type DistanceRange = 'all' | 'short' | 'medium' | 'long';

export type MarkerCountRange = 'all' | 'few' | 'medium' | 'many';

export type RatingFilter = 'all' | 3 | 4 | 5;

export type DifficultyFilter = 'all' | 1 | 2 | 3 | 4 | 5;

export interface PlazaFilter {
  distance: DistanceRange;
  markers: MarkerCountRange;
  themes: RouteTheme[];
  difficulty: DifficultyFilter;
  minRating: RatingFilter;
}

export interface FavoriteRoute {
  routeId: string;
  customTags: string[];
  favoritedAt: number;
}

export interface WatchLaterRoute {
  routeId: string;
  addedAt: number;
}

export interface UserPreference {
  preferredThemes: RouteTheme[];
  preferredMarkerTypes: MarkerType[];
  preferredDistanceRanges: DistanceRange[];
}

export const ROUTE_THEME_LABELS: Record<RouteTheme, string> = {
  nature: '自然',
  culture: '人文',
  food: '美食',
  road_trip: '自驾穿越'
};

export const ROUTE_THEME_ICONS: Record<RouteTheme, string> = {
  nature: '🌿',
  culture: '🏛️',
  food: '🍜',
  road_trip: '🚗'
};

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
  mapMode: '2d' | '3d';
}

export interface FlightConfig {
  altitude: number;
  speed: number;
  pitch: number;
  slowdownFactor: number;
  markerStayTime: number;
}

export interface FlightState {
  isPlaying: boolean;
  isPaused: boolean;
  currentProgress: number;
  totalDistance: number;
  currentMarkerIndex: number;
  currentPosition: { lat: number; lng: number; elevation: number } | null;
  showInfoCard: boolean;
  currentInfoCard: MarkerData | null;
  isRecording: boolean;
  exportFormat: 'video' | 'gif' | null;
}

export interface CachedTile {
  blob: Blob;
  timestamp: number;
  url: string;
}

export interface DraftRouteSnapshot {
  id: string;
  routeId: string;
  routeName: string;
  markers: MarkerData[];
  totalDistance: number;
  savedAt: number;
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
  themes: RouteTheme[];
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
