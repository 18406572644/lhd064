import type { MarkerData } from '@/types';
import { haversineDistance } from '@/utils/distance';

export interface ElevationPoint {
  lat: number;
  lng: number;
  elevation: number;
  distance: number;
  isMarker: boolean;
  markerIndex?: number;
  markerName?: string;
}

export interface ElevationStats {
  totalAscent: number;
  totalDescent: number;
  maxElevation: number;
  minElevation: number;
  maxElevationPoint: ElevationPoint;
  minElevationPoint: ElevationPoint;
}

export interface ElevationProfile {
  points: ElevationPoint[];
  stats: ElevationStats;
  totalDistance: number;
  isSimulated: boolean;
}

function interpolatePoints(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number },
  count: number
): { lat: number; lng: number }[] {
  const result: { lat: number; lng: number }[] = [];
  for (let i = 1; i < count; i++) {
    const t = i / count;
    result.push({
      lat: p1.lat + (p2.lat - p1.lat) * t,
      lng: p1.lng + (p2.lng - p1.lng) * t
    });
  }
  return result;
}

async function fetchElevationsFromAPI(
  coordinates: { latitude: number; longitude: number }[]
): Promise<number[]> {
  if (coordinates.length === 0) return [];

  const batchSize = 100;
  const results: number[] = [];

  for (let i = 0; i < coordinates.length; i += batchSize) {
    const batch = coordinates.slice(i, i + batchSize);
    const locations = batch
      .map(c => `${c.latitude.toFixed(6)},${c.longitude.toFixed(6)}`)
      .join('|');

    const url = `https://api.open-elevation.com/api/v1/lookup?locations=${encodeURIComponent(locations)}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.results || !Array.isArray(data.results)) {
        throw new Error('Invalid API response format');
      }

      const batchElevations: number[] = data.results.map((r: any) => {
        const elev = r.elevation;
        return elev != null && !isNaN(elev) ? elev : 0;
      });
      results.push(...batchElevations);
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('请求超时，请检查网络连接');
      }
      if (e.message.includes('CORS') || e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
        throw new Error('跨域请求被阻止，请尝试使用代理或稍后重试');
      }
      throw e;
    }
  }

  return results;
}

function generateSimulatedElevations(
  coords: { latitude: number; longitude: number }[]
): number[] {
  return coords.map(c => {
    const lat = c.latitude;
    const lng = c.longitude;
    const baseElev = 50 +
      Math.abs(Math.sin(lat * 0.1) * Math.cos(lng * 0.08)) * 800 +
      Math.abs(Math.sin((lat + lng) * 0.05)) * 400 +
      Math.abs(Math.cos(lat * 0.03)) * 200;
    return Math.round(baseElev * 10) / 10;
  });
}

function calculateStats(points: ElevationPoint[]): ElevationStats {
  let totalAscent = 0;
  let totalDescent = 0;
  let maxElev = -Infinity;
  let minElev = Infinity;
  let maxPoint = points[0];
  let minPoint = points[0];

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.elevation > maxElev) {
      maxElev = p.elevation;
      maxPoint = p;
    }
    if (p.elevation < minElev) {
      minElev = p.elevation;
      minPoint = p;
    }
    if (i > 0) {
      const diff = p.elevation - points[i - 1].elevation;
      if (diff > 0) totalAscent += diff;
      else totalDescent += Math.abs(diff);
    }
  }

  return {
    totalAscent,
    totalDescent,
    maxElevation: maxElev,
    minElevation: minElev,
    maxElevationPoint: maxPoint,
    minElevationPoint: minPoint
  };
}

export async function getElevationProfile(
  markers: MarkerData[],
  pointsPerSegment = 20
): Promise<ElevationProfile> {
  if (markers.length < 2) {
    return { points: [], stats: null as any, totalDistance: 0, isSimulated: false };
  }

  const allCoords: {
    latitude: number;
    longitude: number;
    isMarker: boolean;
    markerIndex?: number;
    markerName?: string;
    segIndex: number;
    segT: number;
  }[] = [];

  const segmentDistances: number[] = [];

  for (let i = 0; i < markers.length; i++) {
    if (i === 0) {
      allCoords.push({
        latitude: markers[i].lat,
        longitude: markers[i].lng,
        isMarker: true,
        markerIndex: i,
        markerName: markers[i].name,
        segIndex: 0,
        segT: 0
      });
    } else {
      const segDist = haversineDistance(
        [markers[i - 1].lat, markers[i - 1].lng],
        [markers[i].lat, markers[i].lng]
      );
      segmentDistances.push(segDist);

      const interpolated = interpolatePoints(markers[i - 1], markers[i], pointsPerSegment);
      for (let j = 0; j < interpolated.length; j++) {
        allCoords.push({
          latitude: interpolated[j].lat,
          longitude: interpolated[j].lng,
          isMarker: false,
          segIndex: i - 1,
          segT: (j + 1) / pointsPerSegment
        });
      }

      allCoords.push({
        latitude: markers[i].lat,
        longitude: markers[i].lng,
        isMarker: true,
        markerIndex: i,
        markerName: markers[i].name,
        segIndex: i - 1,
        segT: 1
      });
    }
  }

  const cumulativeSegDistances: number[] = [0];
  for (let i = 0; i < segmentDistances.length; i++) {
    cumulativeSegDistances.push(cumulativeSegDistances[i] + segmentDistances[i]);
  }
  const totalDistance = cumulativeSegDistances[cumulativeSegDistances.length - 1];

  let elevations: number[];
  let isSimulated = false;

  try {
    elevations = await fetchElevationsFromAPI(allCoords);
    if (elevations.length !== allCoords.length) {
      throw new Error(`返回数据数量不匹配: 期望 ${allCoords.length}，实际 ${elevations.length}`);
    }
  } catch (e: any) {
    console.warn('海拔 API 请求失败，使用模拟数据:', e.message);
    elevations = generateSimulatedElevations(allCoords);
    isSimulated = true;
  }

  const points: ElevationPoint[] = allCoords.map((coord, idx) => {
    let distance: number;
    if (coord.isMarker && coord.markerIndex != null) {
      distance = cumulativeSegDistances[coord.markerIndex];
    } else {
      distance = cumulativeSegDistances[coord.segIndex] + segmentDistances[coord.segIndex] * coord.segT;
    }
    return {
      lat: coord.latitude,
      lng: coord.longitude,
      elevation: elevations[idx] ?? 0,
      distance,
      isMarker: coord.isMarker,
      markerIndex: coord.markerIndex,
      markerName: coord.markerName
    };
  });

  const stats = calculateStats(points);

  return { points, stats, totalDistance, isSimulated };
}
