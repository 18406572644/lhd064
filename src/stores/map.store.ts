import { writable } from 'svelte/store';

export const center = writable<[number, number]>([39.9042, 116.4074]);
export const zoom = writable<number>(5);
export const rotation = writable<number>(0);
export const bounds = writable<any | null>(null);
