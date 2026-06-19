import type { MarkerData } from '../types';
import { haversineDistance } from '../utils/distance';

const MAX_2OPT_ITERATIONS = 50;

function totalRouteDistance(markers: MarkerData[]): number {
  let total = 0;
  for (let i = 0; i < markers.length - 1; i++) {
    total += haversineDistance(
      [markers[i].lat, markers[i].lng],
      [markers[i + 1].lat, markers[i + 1].lng]
    );
  }
  return total;
}

export const RouteOptimizer = {
  nearestNeighbor(markers: MarkerData[], startIndex: number = 0): MarkerData[] {
    if (markers.length <= 2) return [...markers];

    const remaining = markers.map(m => ({ ...m }));
    const result: MarkerData[] = [];

    const startIdx = Math.min(Math.max(startIndex, 0), remaining.length - 1);
    result.push(remaining.splice(startIdx, 1)[0]);

    while (remaining.length > 0) {
      const current = result[result.length - 1];
      let nearestIdx = 0;
      let nearestDist = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const dist = haversineDistance(
          [current.lat, current.lng],
          [remaining[i].lat, remaining[i].lng]
        );
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestIdx = i;
        }
      }

      result.push(remaining.splice(nearestIdx, 1)[0]);
    }

    return result;
  },

  twoOpt(markers: MarkerData[]): MarkerData[] {
    if (markers.length <= 3) return [...markers];

    let best = [...markers];
    let bestDistance = totalRouteDistance(best);
    let improved = true;
    let iteration = 0;

    while (improved && iteration < MAX_2OPT_ITERATIONS) {
      improved = false;
      iteration++;

      for (let i = 0; i < best.length - 2; i++) {
        for (let k = i + 2; k < best.length; k++) {
          const before =
            (i > 0 ? haversineDistance(
              [best[i - 1].lat, best[i - 1].lng],
              [best[i].lat, best[i].lng]
            ) : 0) +
            haversineDistance(
              [best[k].lat, best[k].lng],
              [best[k + 1] ? best[k + 1].lat : best[k].lat, best[k + 1] ? best[k + 1].lng : best[k].lng]
            );

          const after =
            (i > 0 ? haversineDistance(
              [best[i - 1].lat, best[i - 1].lng],
              [best[k].lat, best[k].lng]
            ) : 0) +
            haversineDistance(
              [best[i].lat, best[i].lng],
              [best[k + 1] ? best[k + 1].lat : best[i].lat, best[k + 1] ? best[k + 1].lng : best[i].lng]
            );

          if (after < before) {
            const newRoute = [
              ...best.slice(0, i),
              ...best.slice(i, k + 1).reverse(),
              ...best.slice(k + 1)
            ];

            const newDistance = totalRouteDistance(newRoute);
            if (newDistance < bestDistance) {
              best = newRoute;
              bestDistance = newDistance;
              improved = true;
            }
          }
        }
        if (improved) break;
      }
    }

    return best;
  },

  optimizeRoute(markers: MarkerData[], startFixed: boolean = true): MarkerData[] {
    if (markers.length <= 2) return [...markers];

    if (startFixed) {
      const first = markers[0];
      const rest = markers.slice(1);

      if (rest.length <= 1) return [first, ...rest];

      const nnResult = this.nearestNeighbor(rest, 0);
      const optimizedRest = this.twoOpt(nnResult);

      return [first, ...optimizedRest];
    } else {
      let bestOverall: MarkerData[] = [];
      let bestOverallDistance = Infinity;

      const maxStarts = Math.min(markers.length, 5);
      for (let startIdx = 0; startIdx < maxStarts; startIdx++) {
        const nnResult = this.nearestNeighbor(markers, startIdx);
        const optimized = this.twoOpt(nnResult);
        const dist = totalRouteDistance(optimized);
        if (dist < bestOverallDistance) {
          bestOverallDistance = dist;
          bestOverall = optimized;
        }
      }

      return bestOverall.length > 0 ? bestOverall : this.twoOpt(this.nearestNeighbor(markers, 0));
    }
  }
};
