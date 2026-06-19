import { writable, derived } from 'svelte/store';
import type { FlightConfig, FlightState } from '@/types';

const defaultFlightConfig: FlightConfig = {
  altitude: 800,
  speed: 120,
  pitch: 55,
  slowdownFactor: 0.3,
  markerStayTime: 3
};

const defaultFlightState: FlightState = {
  isPlaying: false,
  isPaused: false,
  currentProgress: 0,
  totalDistance: 0,
  currentMarkerIndex: -1,
  currentPosition: null,
  showInfoCard: false,
  currentInfoCard: null,
  isRecording: false,
  exportFormat: null
};

export const flightConfig = writable<FlightConfig>(defaultFlightConfig);
export const flightState = writable<FlightState>(defaultFlightState);

export const isPlaying = derived(flightState, $s => $s.isPlaying);
export const isPaused = derived(flightState, $s => $s.isPaused);
export const isRecording = derived(flightState, $s => $s.isRecording);

export function resetFlight() {
  flightState.set({ ...defaultFlightState });
}

export function startFlight(totalDist?: number) {
  flightState.update(s => ({
    ...s,
    isPlaying: true,
    isPaused: false,
    currentProgress: 0,
    totalDistance: totalDist ?? s.totalDistance,
    showInfoCard: false,
    currentInfoCard: null
  }));
}

export function pauseFlight() {
  flightState.update(s => ({ ...s, isPaused: true }));
}

export function resumeFlight() {
  flightState.update(s => ({ ...s, isPaused: false }));
}

export function stopFlight() {
  flightState.update(s => ({
    ...s,
    isPlaying: false,
    isPaused: false,
    currentProgress: 0,
    showInfoCard: false,
    currentInfoCard: null,
    isRecording: false,
    exportFormat: null
  }));
}

export function startRecording(format: 'video' | 'gif') {
  flightState.update(s => ({ ...s, isRecording: true, exportFormat: format }));
}

export function stopRecording() {
  flightState.update(s => ({ ...s, isRecording: false, exportFormat: null }));
}

export function updateFlightProgress(progress: number, position: { lat: number; lng: number; elevation: number }, markerIndex: number) {
  flightState.update(s => ({
    ...s,
    currentProgress: progress,
    currentPosition: position,
    currentMarkerIndex: markerIndex
  }));
}

export function showMarkerInfoCard(marker: any) {
  flightState.update(s => ({
    ...s,
    showInfoCard: true,
    currentInfoCard: marker
  }));
}

export function hideMarkerInfoCard() {
  flightState.update(s => ({
    ...s,
    showInfoCard: false,
    currentInfoCard: null
  }));
}
