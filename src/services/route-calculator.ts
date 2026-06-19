import type { MarkerData, RouteSegment, VehicleConfig, DurationBreakdown, FuelEstimate } from '../types';
import { haversineDistance } from '../utils/distance';

export const RouteCalculator = {
  calculateSegments(markers: MarkerData[]): RouteSegment[] {
    const segments: RouteSegment[] = [];
    if (markers.length < 2) return segments;

    for (let i = 0; i < markers.length - 1; i++) {
      const from = markers[i];
      const to = markers[i + 1];
      const distance = haversineDistance([from.lat, from.lng], [to.lat, to.lng]);
      segments.push({
        fromIndex: i,
        toIndex: i + 1,
        fromName: from.name || `途经点 ${i + 1}`,
        toName: to.name || `途经点 ${i + 2}`,
        distance,
        durationHours: 0
      });
    }
    return segments;
  },

  calculateTotalDistance(segments: RouteSegment[]): number {
    return segments.reduce((sum, s) => sum + s.distance, 0);
  },

  calculateTotalDuration(
    segments: RouteSegment[],
    vehicleConfig: VehicleConfig,
    markers: MarkerData[]
  ): DurationBreakdown {
    const totalDistance = this.calculateTotalDistance(segments);
    const averageSpeed = Math.max(vehicleConfig.averageSpeed, 1);
    const drivingHours = totalDistance / averageSpeed;

    const restStopInterval = Math.max(vehicleConfig.restStopInterval, 1);
    const rawRestCount = Math.floor(totalDistance / restStopInterval);
    const restStopCount = totalDistance > restStopInterval ? rawRestCount : 0;
    const restHours = (restStopCount * vehicleConfig.restStopDuration) / 60;

    const stayHours = markers.reduce((sum, m) => {
      return sum + ((m.stayDuration || 0) / 60);
    }, 0);

    const totalHours = drivingHours + restHours + stayHours;

    return {
      totalHours,
      restHours,
      drivingHours,
      stayHours
    };
  },

  calculateFuelCost(distance: number, config: VehicleConfig): FuelEstimate {
    const consumption = Math.max(config.fuelConsumption, 0.1);
    const fuelPrice = Math.max(config.fuelPrice, 0);
    const liters = (distance / 100) * consumption;
    const cost = liters * fuelPrice;
    return {
      liters,
      cost
    };
  },

  enrichSegmentsWithDuration(segments: RouteSegment[], vehicleConfig: VehicleConfig): RouteSegment[] {
    const averageSpeed = Math.max(vehicleConfig.averageSpeed, 1);
    return segments.map(s => ({
      ...s,
      durationHours: s.distance / averageSpeed
    }));
  },

  calculateRestStopCount(totalDistance: number, restStopInterval: number): number {
    const interval = Math.max(restStopInterval, 1);
    if (totalDistance <= interval) return 0;
    return Math.floor(totalDistance / interval);
  }
};
