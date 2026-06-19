import { writable } from 'svelte/store';
import type { VehicleConfig, AppSettings } from '@/types';

const LS_VEHICLE_KEY = 'vintage_vehicle_config';
const LS_SETTINGS_KEY = 'vintage_app_settings';

const defaultVehicleConfig: VehicleConfig = {
  fuelConsumption: 8,
  fuelPrice: 7.5,
  averageSpeed: 80,
  restStopInterval: 200,
  restStopDuration: 20
};

const defaultAppSettings: AppSettings = {
  tileStyle: 'vintage',
  showCompass: true,
  mapRotation: 0,
  language: 'zh-CN'
};

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return { ...defaultValue, ...JSON.parse(stored) };
    }
  } catch {
    // ignore parse errors
  }
  return defaultValue;
}

function createPersistentWritable<T>(key: string, defaultValue: T) {
  const initial = loadFromStorage(key, defaultValue);
  const store = writable<T>(initial);

  store.subscribe(value => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore storage errors
    }
  });

  return store;
}

export const vehicleConfig = createPersistentWritable<VehicleConfig>(
  LS_VEHICLE_KEY,
  defaultVehicleConfig
);

export const appSettings = createPersistentWritable<AppSettings>(
  LS_SETTINGS_KEY,
  defaultAppSettings
);
