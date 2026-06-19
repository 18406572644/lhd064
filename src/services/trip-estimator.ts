import type { MarkerData, VehicleConfig, RouteSegment } from '../types';
import { RouteCalculator } from './route-calculator';

interface TripEstimates {
  segments: RouteSegment[];
  totalDistance: number;
  totalDuration: number;
  drivingDuration: number;
  restDuration: number;
  stayDuration: number;
  fuelLiters: number;
  fuelCost: number;
  restStopCount: number;
}

export function calculateTripEstimates(
  markers: MarkerData[],
  config: VehicleConfig
): TripEstimates {
  const rawSegments = RouteCalculator.calculateSegments(markers);
  const segments = RouteCalculator.enrichSegmentsWithDuration(rawSegments, config);

  const totalDistance = RouteCalculator.calculateTotalDistance(segments);
  const duration = RouteCalculator.calculateTotalDuration(segments, config, markers);
  const fuel = RouteCalculator.calculateFuelCost(totalDistance, config);
  const restStopCount = RouteCalculator.calculateRestStopCount(
    totalDistance,
    config.restStopInterval
  );

  return {
    segments,
    totalDistance,
    totalDuration: duration.totalHours,
    drivingDuration: duration.drivingHours,
    restDuration: duration.restHours,
    stayDuration: duration.stayHours,
    fuelLiters: fuel.liters,
    fuelCost: fuel.cost,
    restStopCount
  };
}
