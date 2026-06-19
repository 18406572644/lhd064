<script lang="ts">
  import { onMount } from 'svelte';
  import type { MarkerData } from '@/types';
  import { getElevationProfile, type ElevationProfile, type ElevationPoint } from '@/services/elevation.service';
  import { formatDistance } from '@/utils/distance';
  import { showToast } from '@/stores/ui.store';

  export let markers: MarkerData[];

  let profile: ElevationProfile | null = null;
  let loading = false;
  let error = '';
  let hoveredPoint: ElevationPoint | null = null;
  let svgWidth = 300;
  let svgContainer: HTMLElement;

  const margin = { top: 28, right: 16, bottom: 36, left: 50 };
  const height = 220;

  $: markerCount = markers.length;
  $: canFetch = markerCount >= 2;

  $: plotWidth = svgWidth - margin.left - margin.right;
  $: plotHeight = height - margin.top - margin.bottom;

  $: minElev = profile ? profile.stats.minElevation : 0;
  $: maxElev = profile ? profile.stats.maxElevation : 100;
  $: elevRange = maxElev - minElev || 1;
  $: yPadding = elevRange * 0.12;
  $: yMin = minElev - yPadding;
  $: yMax = maxElev + yPadding;
  $: yRange = yMax - yMin || 1;

  $: totalDist = profile ? profile.totalDistance : 0;

  $: markerPoints = profile
    ? profile.points.filter(p => p.isMarker)
    : [];

  function scaleX(dist: number): number {
    return margin.left + (totalDist > 0 ? (dist / totalDist) * plotWidth : 0);
  }

  function scaleY(elev: number): number {
    return margin.top + plotHeight - ((elev - yMin) / yRange) * plotHeight;
  }

  function buildPath(): string {
    if (!profile || profile.points.length === 0) return '';
    return profile.points
      .map((p, i) => {
        const x = scaleX(p.distance);
        const y = scaleY(p.elevation);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }

  function buildAreaPath(): string {
    if (!profile || profile.points.length === 0) return '';
    const baseline = (margin.top + plotHeight).toFixed(2);
    const linePath = profile.points
      .map((p, i) => {
        const x = scaleX(p.distance);
        const y = scaleY(p.elevation);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
    const lastX = scaleX(profile.points[profile.points.length - 1].distance).toFixed(2);
    const firstX = scaleX(profile.points[0].distance).toFixed(2);
    return `${linePath} L${lastX},${baseline} L${firstX},${baseline} Z`;
  }

  function yTicks(): number[] {
    const tickCount = 5;
    const step = yRange / (tickCount - 1);
    return Array.from({ length: tickCount }, (_, i) => Math.round((yMin + step * i) * 10) / 10);
  }

  function xTicks(): number[] {
    if (totalDist <= 0) return [];
    const tickCount = 5;
    const step = totalDist / (tickCount - 1);
    return Array.from({ length: tickCount }, (_, i) => Math.round(step * i * 10) / 10);
  }

  function formatElev(m: number): string {
    if (m >= 1000) return `${(m / 1000).toFixed(1)}k`;
    return `${Math.round(m)}`;
  }

  function formatXDist(km: number): string {
    if (km >= 100) return `${Math.round(km)}`;
    if (km >= 1) return `${km.toFixed(1)}`;
    return `${Math.round(km * 1000)}m`;
  }

  async function fetchProfile() {
    if (!canFetch) return;
    loading = true;
    error = '';
    try {
      profile = await getElevationProfile(markers, 20);
    } catch (e: any) {
      error = e.message || '获取海拔数据失败';
      showToast('海拔数据获取失败', 'error');
    } finally {
      loading = false;
    }
  }

  function onMouseMove(e: MouseEvent) {
    if (!profile || profile.points.length === 0) return;
    const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const distRatio = (x - margin.left) / plotWidth;
    const dist = distRatio * totalDist;
    let closest = profile.points[0];
    let minDelta = Infinity;
    for (const p of profile.points) {
      const delta = Math.abs(p.distance - dist);
      if (delta < minDelta) {
        minDelta = delta;
        closest = p;
      }
    }
    hoveredPoint = closest;
  }

  function onMouseLeave() {
    hoveredPoint = null;
  }

  onMount(() => {
    if (canFetch) {
      fetchProfile();
    }

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        svgWidth = entry.contentRect.width;
      }
    });
    if (svgContainer) {
      ro.observe(svgContainer);
    }
    return () => ro.disconnect();
  });

  $: if (canFetch && !loading && !profile && !error) {
    fetchProfile();
  }
</script>

<style lang="scss">
  @use '../styles/mixins' as *;

  .elevation-profile {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .load-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 32px 16px;
    font-family: $font-body;
    font-size: 14px;
    color: rgba(62, 44, 28, 0.6);
    font-style: italic;
  }

  .spinner {
    width: 20px;
    height: 20px;
    border: 2.5px solid rgba(44, 95, 143, 0.2);
    border-top-color: $highway-blue;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .error-msg {
    text-align: center;
    padding: 24px 16px;
    font-family: $font-body;
    font-size: 13px;
    color: $vintage-red;
    line-height: 1.6;

    .retry-btn {
      display: inline-block;
      margin-top: 10px;
      padding: 6px 16px;
      border: 1.5px solid rgba(139, 58, 46, 0.4);
      border-radius: 4px;
      background: rgba(255, 250, 235, 0.9);
      font-family: $font-display;
      font-size: 12px;
      font-weight: 600;
      color: $vintage-red;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: $vintage-red;
        color: #FFF;
        border-color: $vintage-red;
      }
    }
  }

  .chart-container {
    background: rgba(255, 250, 235, 0.7);
    border: 1.5px solid rgba(139, 111, 71, 0.25);
    border-radius: 6px;
    overflow: hidden;
    position: relative;
  }

  .chart-svg {
    display: block;
    width: 100%;
    height: auto;
    cursor: crosshair;
  }

  .axis-label {
    font-family: $font-typewriter;
    font-size: 9px;
    fill: rgba(62, 44, 28, 0.5);
  }

  .grid-line {
    stroke: rgba(139, 111, 71, 0.12);
    stroke-dasharray: 3 3;
  }

  .elev-area {
    fill: rgba(44, 95, 143, 0.08);
  }

  .elev-line {
    fill: none;
    stroke: $highway-blue;
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .marker-dot {
    fill: $warm-yellow;
    stroke: $deep-brown;
    stroke-width: 1.5;
    cursor: pointer;
    transition: r 0.15s;

    &:hover {
      r: 5;
    }
  }

  .marker-elev-label {
    font-family: $font-typewriter;
    font-size: 7.5px;
    fill: $highway-blue;
    pointer-events: none;
  }

  .hover-line {
    stroke: rgba(62, 44, 28, 0.3);
    stroke-width: 1;
    stroke-dasharray: 4 2;
    pointer-events: none;
  }

  .hover-dot {
    fill: $vintage-red;
    stroke: #FFF;
    stroke-width: 1.5;
    pointer-events: none;
  }

  .tooltip {
    position: absolute;
    top: 4px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(62, 44, 28, 0.9);
    color: #FFF;
    padding: 4px 10px;
    border-radius: 4px;
    font-family: $font-typewriter;
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 5;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .stat-card {
    background: rgba(255, 250, 235, 0.85);
    border: 1.5px solid rgba(139, 111, 71, 0.25);
    border-radius: 6px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .stat-label {
      font-family: $font-display;
      font-size: 10px;
      font-weight: 600;
      color: rgba(62, 44, 28, 0.55);
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .stat-value {
      font-family: $font-typewriter;
      font-size: 16px;
      font-weight: 700;
      color: $highway-blue;
      line-height: 1;

      .stat-unit {
        font-size: 10px;
        font-weight: 400;
        color: rgba(62, 44, 28, 0.5);
        margin-left: 2px;
      }
    }

    &.ascent .stat-value { color: $moss-green; }
    &.descent .stat-value { color: $vintage-red; }
    &.max-elev .stat-value { color: $highway-blue; }
    &.min-elev .stat-value { color: $warm-yellow; }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 24px;
    text-align: center;

    .empty-icon {
      font-size: 56px;
      opacity: 0.3;
      margin-bottom: 16px;
    }
    .empty-text {
      font-family: $font-body;
      font-size: 14px;
      color: rgba(62, 44, 28, 0.55);
      font-style: italic;
      line-height: 1.6;
    }
  }
</style>

<div class="elevation-profile">
  {#if !canFetch}
    <div class="empty-state">
      <div class="empty-icon">⛰️</div>
      <div class="empty-text">
        至少添加 2 个标记点<br />
        以生成海拔剖面图
      </div>
    </div>
  {:else if loading}
    <div class="load-bar">
      <div class="spinner"></div>
      正在获取海拔数据...
    </div>
  {:else if error}
    <div class="error-msg">
      <div>⚠️ {error}</div>
      <button class="retry-btn" on:click={fetchProfile}>重新获取</button>
    </div>
  {:else if profile && profile.points.length > 0}
    <div class="chart-container" bind:this={svgContainer}>
      {#if hoveredPoint}
        <div class="tooltip">
          {hoveredPoint.isMarker && hoveredPoint.markerName ? `${hoveredPoint.markerName} · ` : ''}
          {formatDistance(hoveredPoint.distance)} · {Math.round(hoveredPoint.elevation)}m
        </div>
      {/if}
      <svg
        class="chart-svg"
        viewBox="0 0 {svgWidth} {height}"
        on:mousemove={onMouseMove}
        on:mouseleave={onMouseLeave}
      >
        {#each yTicks() as tick}
          <line
            class="grid-line"
            x1={margin.left}
            y1={scaleY(tick)}
            x2={svgWidth - margin.right}
            y2={scaleY(tick)}
          />
          <text
            class="axis-label"
            x={margin.left - 6}
            y={scaleY(tick) + 3}
            text-anchor="end"
          >
            {formatElev(tick)}m
          </text>
        {/each}

        {#each xTicks() as tick}
          <line
            class="grid-line"
            x1={scaleX(tick)}
            y1={margin.top}
            x2={scaleX(tick)}
            y2={margin.top + plotHeight}
          />
          <text
            class="axis-label"
            x={scaleX(tick)}
            y={margin.top + plotHeight + 16}
            text-anchor="middle"
          >
            {formatXDist(tick)}
          </text>
        {/each}

        <path class="elev-area" d={buildAreaPath()} />
        <path class="elev-line" d={buildPath()} />

        {#each markerPoints as mp}
          <circle
            class="marker-dot"
            cx={scaleX(mp.distance)}
            cy={scaleY(mp.elevation)}
            r="4"
          />
          {@const labelAbove = mp.elevation > (minElev + maxElev) / 2}
          <text
            class="marker-elev-label"
            x={scaleX(mp.distance)}
            y={labelAbove ? scaleY(mp.elevation) - 10 : scaleY(mp.elevation) + 14}
            text-anchor="middle"
          >
            {Math.round(mp.elevation)}m
          </text>
        {/each}

        {#if hoveredPoint}
          <line
            class="hover-line"
            x1={scaleX(hoveredPoint.distance)}
            y1={margin.top}
            x2={scaleX(hoveredPoint.distance)}
            y2={margin.top + plotHeight}
          />
          <circle
            class="hover-dot"
            cx={scaleX(hoveredPoint.distance)}
            cy={scaleY(hoveredPoint.elevation)}
            r="4"
          />
        {/if}
      </svg>
    </div>

    <div class="stats-grid">
      <div class="stat-card ascent">
        <span class="stat-label">⬆ 总爬升</span>
        <span class="stat-value">{Math.round(profile.stats.totalAscent)}<span class="stat-unit">m</span></span>
      </div>
      <div class="stat-card descent">
        <span class="stat-label">⬇ 总下降</span>
        <span class="stat-value">{Math.round(profile.stats.totalDescent)}<span class="stat-unit">m</span></span>
      </div>
      <div class="stat-card max-elev">
        <span class="stat-label">🔺 最高点</span>
        <span class="stat-value">{Math.round(profile.stats.maxElevation)}<span class="stat-unit">m</span></span>
      </div>
      <div class="stat-card min-elev">
        <span class="stat-label">🔻 最低点</span>
        <span class="stat-value">{Math.round(profile.stats.minElevation)}<span class="stat-unit">m</span></span>
      </div>
    </div>
  {/if}
</div>
