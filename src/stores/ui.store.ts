import { writable } from 'svelte/store';
import type { MarkerType } from '@/types';

type ActiveTool = MarkerType | 'select' | 'route';

interface ToastData {
  msg: string;
  type: 'info' | 'success' | 'error';
}

export const activeTool = writable<ActiveTool>('select');
export const showRouteLibrary = writable<boolean>(false);
export const showPreview = writable<boolean>(false);
export const showExport = writable<boolean>(false);
export const showSettings = writable<boolean>(false);
export const showPlaza = writable<boolean>(false);
export const showPublishPlaza = writable<boolean>(false);
export const mapReady = writable<boolean>(false);
export const mapInstance = writable<any | null>(null);
export const toast = writable<ToastData | null>(null);

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string, type: 'info' | 'success' | 'error' = 'info') {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  toast.set({ msg, type });
  toastTimer = setTimeout(() => {
    toast.set(null);
    toastTimer = null;
  }, 3000);
}
