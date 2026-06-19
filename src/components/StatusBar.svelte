<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { MarkerData } from '@/types';
  import {
    currentRoute,
    totalDistance
  } from '@/stores/route.store';
  import { vehicleConfig } from '@/stores/settings.store';
  import { formatDistance } from '@/utils/distance';
  import { formatDuration, formatCurrency } from '@/utils/format';
  import { calculateTripEstimates } from '@/services/trip-estimator';

  let markers: MarkerData[] = [];
  let markersLen = 0;
  let dist = 0;
  let estimatedHours = 0;
  let estimatedMinutes = 0;
  let fuelLiters = 0;
  let fuelCost = 0;
  let hoverLat: number | null = null;
  let hoverLng: number | null = null;
  let isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

  let unsubscribeList: (() => void)[] = [];

  $: {
    if (markers && $vehicleConfig) {
      const estimates = calculateTripEstimates(markers, $vehicleConfig);
      const totalH = estimates.totalDuration;
      estimatedHours = Math.floor(totalH);
      estimatedMinutes = Math.round((totalH - estimatedHours) * 60);
      fuelLiters = estimates.fuelLiters;
      fuelCost = estimates.fuelCost;
    }
  }

  function handleMapHover(e: any) {
    const detail = e.detail || {};
    hoverLat = detail.lat ?? null;
    hoverLng = detail.lng ?? null;
    if (typeof detail.online === 'boolean') {
      isOnline = detail.online;
    }
  }

  function handleOnline() {
    isOnline = true;
  }

  function handleOffline() {
    isOnline = false;
  }

  function formatCoord(val: number | null): string {
    if (val === null || val === undefined) return '--';
    return val.toFixed(4);
  }

  onMount(() => {
    unsubscribeList.push(
      currentRoute.subscribe((r) => {
        markers = r.markers;
        markersLen = r.markers.length;
      })
    );
    unsubscribeList.push(
      totalDistance.subscribe((d) => {
        dist = d;
      })
    );

    window.addEventListener('maphover', handleMapHover);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  });

  onDestroy(() => {
    unsubscribeList.forEach(fn => fn());
    window.removeEventListener('maphover', handleMapHover);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  });
</script>

<footer class="status-bar">
  <div class="gauge-panel">
    <div class="gauge gauge-stops">
      <span class="gauge-label">
        <span class="label-icon">🗺️</span>
        <span class="label-text">途经点</span>
      </span>
      <div class="gauge-value">
        <span class="value-digits">{markersLen}</span>
        <span class="value-unit">站</span>
      </div>
    </div>

    <div class="gauge-divider"></div>

    <div class="gauge gauge-distance">
      <span class="gauge-label">
        <span class="label-icon">🛣️</span>
        <span class="label-text">总里程</span>
      </span>
      <div class="gauge-value odometer">
        <span class="value-digits">{formatDistance(dist)}</span>
      </div>
    </div>

    <div class="gauge-divider"></div>

    <div class="gauge gauge-time">
      <span class="gauge-label">
        <span class="label-icon">⏱️</span>
        <span class="label-text">预计时间</span>
      </span>
      <div class="gauge-value">
        {#if markersLen >= 2}
          <span class="value-digits">{estimatedHours}</span>
          <span class="value-unit">时</span>
          <span class="value-digits">{String(estimatedMinutes).padStart(2, '0')}</span>
          <span class="value-unit">分</span>
        {:else}
          <span class="value-empty">-- 时 -- 分</span>
        {/if}
      </div>
    </div>

    <div class="gauge-divider"></div>

    <div class="gauge gauge-fuel">
      <span class="gauge-label">
        <span class="label-icon">⛽</span>
        <span class="label-text">油耗估算</span>
      </span>
      <div class="gauge-value">
        {#if markersLen >= 2}
          <span class="value-digits">{fuelLiters.toFixed(1)}</span>
          <span class="value-unit">升</span>
          <span class="value-sep">/</span>
          <span class="value-digits value-cost">{formatCurrency(fuelCost)}</span>
        {:else}
          <span class="value-empty">-- 升 / ¥--</span>
        {/if}
      </div>
    </div>

    <div class="gauge-divider"></div>

    <div class="gauge gauge-coords">
      <span class="gauge-label">
        <span class="label-icon">📍</span>
        <span class="label-text">坐标</span>
        <span class="status-dot {isOnline ? 'online' : 'offline'}" title={isOnline ? '在线' : '离线'}>
          <span class="dot-inner"></span>
        </span>
      </span>
      <div class="gauge-value coords-value">
        <span class="coord-block">
          <span class="coord-prefix">N</span>
          <span class="coord-num">{formatCoord(hoverLat)}</span>
        </span>
        <span class="coord-sep">·</span>
        <span class="coord-block">
          <span class="coord-prefix">E</span>
          <span class="coord-num">{formatCoord(hoverLng)}</span>
        </span>
      </div>
    </div>
  </div>
</footer>

<style lang="scss">
  .status-bar {
    background: linear-gradient(180deg, #2A1E13 0%, #1A1410 50%, #0F0B08 100%);
    border-top: 3px solid #0A0806;
    box-shadow:
      inset 0 2px 0 rgba(212, 160, 60, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.04),
      0 -2px 8px rgba(0, 0, 0, 0.4);
    padding: 8px 16px;
    position: relative;
    z-index: 50;
    font-family: $font-typewriter;
    flex-shrink: 0;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: repeating-linear-gradient(
        90deg,
        rgba(212, 160, 60, 0.3) 0px,
        rgba(212, 160, 60, 0.3) 20px,
        rgba(62, 44, 28, 0.5) 20px,
        rgba(62, 44, 28, 0.5) 40px
      );
    }

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        transparent 0px,
        transparent 1px,
        rgba(0, 0, 0, 0.06) 1px,
        rgba(0, 0, 0, 0.06) 2px
      );
      pointer-events: none;
      z-index: 1;
    }
  }

  .gauge-panel {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: 0;
  }

  .gauge {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4px 18px;
    gap: 4px;
    flex: 1;
    min-width: 0;

    &.gauge-stops { flex: 0 0 auto; min-width: 100px; }
    &.gauge-distance { flex: 1 1 140px; }
    &.gauge-time { flex: 1 1 180px; }
    &.gauge-fuel { flex: 1 1 200px; }
    &.gauge-coords { flex: 1 1 220px; }
  }

  .gauge-label {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: rgba(212, 160, 60, 0.7);
    font-weight: 600;
    white-space: nowrap;

    .label-icon {
      font-size: 12px;
      opacity: 0.9;
      filter: drop-shadow(0 0 2px rgba(212, 160, 60, 0.3));
    }
  }

  .gauge-value {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
    white-space: nowrap;
    text-shadow:
      0 0 6px rgba(212, 160, 60, 0.25),
      1px 1px 0 rgba(0, 0, 0, 0.5);
  }

  .value-digits {
    font-family: $font-typewriter;
    font-weight: 700;
    font-size: 20px;
    color: $warm-yellow;
    letter-spacing: 1px;
    line-height: 1.1;
  }

  .value-unit {
    font-family: $font-typewriter;
    font-size: 12px;
    font-weight: 600;
    color: rgba(212, 160, 60, 0.8);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1.1;
  }

  .value-sep {
    font-family: $font-typewriter;
    font-size: 16px;
    color: rgba(212, 160, 60, 0.5);
    margin: 0 2px;
    font-weight: 700;
  }

  .value-cost {
    color: mix($warm-yellow, #F5EFE0, 60%);
    font-size: 18px;
  }

  .value-empty {
    font-family: $font-typewriter;
    font-size: 16px;
    color: rgba(212, 160, 60, 0.35);
    font-weight: 600;
    letter-spacing: 1px;
  }

  .odometer {
    position: relative;
    padding: 3px 10px;
    background: rgba(0, 0, 0, 0.4);
    border: 1.5px solid rgba(212, 160, 60, 0.2);
    border-radius: 3px;
    box-shadow:
      inset 0 2px 4px rgba(0, 0, 0, 0.5),
      inset 0 -1px 0 rgba(255, 255, 255, 0.03);

    .value-digits {
      font-family: 'Courier New', monospace;
      font-weight: 700;
      font-size: 22px;
      letter-spacing: 3px;
      color: #E6BE55;
      text-shadow:
        0 0 8px rgba(212, 160, 60, 0.4),
        0 0 2px rgba(230, 190, 85, 0.6);
    }
  }

  .status-dot {
    position: relative;
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-left: 2px;

    .dot-inner {
      position: absolute;
      inset: 1px;
      border-radius: 50%;
      transition: all 0.3s ease;
    }

    &.online .dot-inner {
      background: #5A7A4A;
      box-shadow:
        0 0 4px rgba(90, 122, 74, 0.6),
        inset 0 0 2px rgba(255, 255, 255, 0.3);
      animation: pulse-online 2s ease-in-out infinite;
    }

    &.offline .dot-inner {
      background: #8B3A2E;
      box-shadow:
        0 0 4px rgba(139, 58, 46, 0.5),
        inset 0 0 2px rgba(0, 0, 0, 0.3);
    }
  }

  .coords-value {
    padding: 3px 10px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px dashed rgba(212, 160, 60, 0.25);
    border-radius: 3px;
  }

  .coord-block {
    display: inline-flex;
    align-items: baseline;
    gap: 3px;
  }

  .coord-prefix {
    font-size: 11px;
    font-weight: 700;
    color: rgba(212, 160, 60, 0.6);
    letter-spacing: 0.5px;
  }

  .coord-num {
    font-family: 'Courier New', monospace;
    font-size: 14px;
    font-weight: 600;
    color: rgba(212, 160, 60, 0.9);
    letter-spacing: 0.5px;
  }

  .coord-sep {
    color: rgba(212, 160, 60, 0.4);
    font-weight: 700;
    margin: 0 4px;
    font-size: 14px;
  }

  .gauge-divider {
    position: relative;
    width: 1px;
    margin: 6px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(
        180deg,
        transparent 0%,
        rgba(212, 160, 60, 0.3) 20%,
        rgba(212, 160, 60, 0.5) 50%,
        rgba(212, 160, 60, 0.3) 80%,
        transparent 100%
      );
    }

    &::after {
      content: '';
      width: 5px;
      height: 5px;
      background: $warm-yellow;
      border-radius: 50%;
      position: relative;
      z-index: 1;
      box-shadow:
        0 0 4px rgba(212, 160, 60, 0.5),
        inset 0 0 1px rgba(255, 255, 255, 0.3);
    }
  }

  @keyframes pulse-online {
    0%, 100% {
      box-shadow:
        0 0 4px rgba(90, 122, 74, 0.6),
        inset 0 0 2px rgba(255, 255, 255, 0.3);
      opacity: 1;
    }
    50% {
      box-shadow:
        0 0 8px rgba(90, 122, 74, 0.9),
        0 0 12px rgba(90, 122, 74, 0.4),
        inset 0 0 2px rgba(255, 255, 255, 0.4);
      opacity: 0.95;
    }
  }
</style>
