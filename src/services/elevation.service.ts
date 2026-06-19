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
}

function interpolatePoints(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }, count: number): { lat: number; lng: number }[] {
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

async function fetchElevations(coordinates: { latitude: number; longitude: number }[]): Promise<number[]> {
  if (coordinates.length === 0) return [];

  const batchSize = 150;
  const results: number[] = [];

  for (let i = 0; i < coordinates.length; i += batchSize) {
    const batch = coordinates.slice(i, i + batchSize);
    const url = 'https://api.open-elevation.com/getElevation';
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations: batch.map(c => ({ latitude: c.latitude, longitude: c.longitude })) })
    });

    if (!response.ok) {
      throw new Error(`Elevation API error: ${response.status}`);
    }

    const data = await response.json();
    const elevations: number[] = data.results?.map((r: any) => r.elevation ?? 0) ?? [];
    results.push(...elevations);
  }

  return results;
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

export async function getElevationProfile(markers: MarkerData[], pointsPerSegment = 20): Promise<ElevationProfile> {
  if (markers.length < 2) {
    return { points: [], stats: null as any, totalDistance: 0 };
  }

  const allCoords: { latitude: number; longitude: number; isMarker: boolean; markerIndex?: number; markerName?: string }[] = [];
  const markerPositionMap = new Map<number, number>();

  let cumDist = 0;
  const markerDistances: number[] = [0];

  for (let i = 0; i < markers.length; i++) {
    if (i === 0) {
      allCoords.push({
        latitude: markers[i].lat,
        longitude: markers[i].lng,
        isMarker: true,
        markerIndex: i,
        markerName: markers[i].name
      });
      markerPositionMap.set(i, allCoords.length - 1);
    } else {
      const segDist = haversineDistance(
        [markers[i - 1].lat, markers[i - 1].lng],
        [markers[i].lat, markers[i].lng]
      );
      cumDist += segDist;
      markerDistances.push(cumDist);

      const interpolated = interpolatePoints(markers[i - 1], markers[i], pointsPerSegment);
      for (const ip of interpolated) {
        allCoords.push({ latitude: ip.lat, longitude: ip.lng, isMarker: false });
      }

      allCoords.push({
        latitude: markers[i].lat,
        longitude: markers[i].lng,
        isMarker: true,
        markerIndex: i,
        markerName: markers[i].name
      });
      markerPositionMap.set(i, allCoords.length - 1);
    }
  }

  const elevations = await fetchElevations(allCoords);

  const points: ElevationPoint[] = allCoords.map((coord, idx) => {
    let distance = 0;
    if (coord.isMarker && coord.markerIndex != null) {
      distance = markerDistances[coord.markerIndex];
    } else {
      distance = 0;
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

  let runningDist = 0;
  for (let i = 1; i < points.length; i++) {
    if (!points[i].isMarker) {
      runningDist += haversineDistance(
        [points[i - 1].lat, points[i - 1].lng],
        [points[i].lat, points[i].lng]
      );
      points[i].distance = markerDistances[markerDistances.length - 1] > 0
        ? (() => {
            let dist = 0;
            for (let j = 1; j <= i; j++) {
              dist += haversineDistance(
                [points[j - 1].lat, points[j - 1].lng],
                [points[j].lat, points[j].lng]
              );
            }
            return dist;
          })()
        : 0;
    }
  }

  const totalDistance = markerDistances[markerDistances.length - 1];
  const stats = calculateStats(points);

  return { points, stats, totalDistance };
}
