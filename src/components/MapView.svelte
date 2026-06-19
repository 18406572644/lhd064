<script lang="ts">
  import { onMount, onDestroy, afterUpdate, getContext } from 'svelte';
  import type { MarkerData, MarkerType, RouteSegment } from '@/types';
  import {
    currentRoute,
    selectedMarkerId,
    segments,
    totalDistance,
    addMarker,
    removeMarker,
    updateMarker,
    selectMarker
  } from '@/stores/route.store';
  import { activeTool, mapReady, mapInstance, showToast } from '@/stores/ui.store';
  import { center, zoom, bounds } from '@/stores/map.store';
  import { appSettings } from '@/stores/settings.store';
  import { formatDistance } from '@/utils/distance';

  let L: typeof import('leaflet');
  let map: import('leaflet').Map | null = null;
  let markersLayer: import('leaflet').LayerGroup | null = null;
  let polylineSolid: import('leaflet').Polyline | null = null;
  let polylineDash: import('leaflet').Polyline | null = null;
  let distanceLabelsLayer: import('leaflet').LayerGroup | null = null;
  let deleteMenuEl: HTMLDivElement | null = null;
  let hoverCoords: { lat: number; lng: number } | null = null;
  let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  let currentTileLayer: import('leaflet').TileLayer | null = null;
  let currentTileKey: string = '';
  let mapContainerEl: HTMLDivElement | null = null;

  $: activeTileStyle = $appSettings.tileStyle;

  $: if (map && L) {
    const style = $appSettings.tileStyle;
    if (style && style !== currentTileKey) {
      const cfg = TILE_CONFIGS[style] || TILE_CONFIGS.vintage;
      if (currentTileLayer) { map.removeLayer(currentTileLayer); }
      currentTileLayer = L.tileLayer(cfg.url, {
        attribution: cfg.attribution,
        subdomains: cfg.subdomains,
        maxZoom: 19,
        className: cfg.className
      });
      currentTileLayer.addTo(map);
      currentTileKey = style;
    }
  }

  const markerRefs = new Map<string, import('leaflet').Marker>();
  let deleteMenu = { visible: false, x: 0, y: 0, markerId: '' as string };
  let currentRouteMarkers: MarkerData[] = [];
  let currentSelectedId: string | null = null;
  let currentTool: string = 'select';

  function renderMarkerIconSVG(type: MarkerType, size: number, selected: boolean, orderNumber: number): string {
    const colors: Record<MarkerType, { primary: string; secondary: string; border: string }> = {
      attraction: { primary: '#5A7A4A', secondary: '#3E5A32', border: '#2C4222' },
      restaurant: { primary: '#D4A03C', secondary: '#B8892C', border: '#8F6A20' },
      hotel: { primary: '#3E2C1C', secondary: '#2A1E13', border: '#1A1410' },
      gas: { primary: '#8B3A2E', secondary: '#6E2C23', border: '#4F1E18' }
    };
    const emojis: Record<MarkerType, string> = {
      attraction: '🏛️',
      restaurant: '🍽️',
      hotel: '🏨',
      gas: '⛽'
    };
    const c = colors[type];
    const badgeSize = Math.round(size * 0.72);
    const pinHeight = Math.round(size * 0.35);
    const totalHeight = size + pinHeight;
    const iconFontSize = Math.round(size * 0.42);
    const orderBadgeSize = Math.round(size * 0.32);
    const orderFontSize = Math.round(size * 0.18);
    const halfSize = size / 2;
    const halfBadge = badgeSize / 2;
    const orderBadgeHTML = orderNumber > 0
      ? `<div style="position:absolute;top:-4px;right:-4px;width:${orderBadgeSize}px;height:${orderBadgeSize}px;background:#2C5F8F;color:#F5EFE0;border:2px solid #F5EFE0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:Cinzel,serif;font-weight:700;font-size:${orderFontSize}px;line-height:1;z-index:5;box-shadow:0 2px 4px rgba(0,0,0,0.3);text-shadow:1px 1px 1px rgba(0,0,0,0.3);">${orderNumber}</div>`
      : '';
    const pulseRingHTML = selected
      ? `<div style="position:absolute;top:${halfBadge}px;left:${halfBadge}px;width:${badgeSize}px;height:${badgeSize}px;transform:translate(-50%,-50%);border:3px solid ${c.primary};border-radius:50%;opacity:0.7;z-index:0;animation:marker-pulse-map 1.6s cubic-bezier(0.215,0.61,0.355,1) infinite;"></div>`
      : '';
    const selectedStyle = selected ? 'transform:scale(1.2);' : '';

    let badgeShape = '';
    if (type === 'attraction' || type === 'restaurant') {
      badgeShape = `<circle cx="${halfSize}" cy="${halfBadge}" r="${halfBadge - 1}" fill="url(#badgeGrad)" stroke="${c.border}" stroke-width="2"/>`;
    } else if (type === 'hotel') {
      const r = Math.round(badgeSize * 0.15);
      const rx = (size - badgeSize) / 2 + 1;
      badgeShape = `<rect x="${rx}" y="1" width="${badgeSize - 2}" height="${badgeSize - 2}" rx="${r}" ry="${r}" fill="url(#badgeGrad)" stroke="${c.border}" stroke-width="2"/>`;
    } else if (type === 'gas') {
      const left = (size - badgeSize) / 2;
      badgeShape = `<path d="
        M ${halfSize} 1
        L ${left + badgeSize - 1} ${badgeSize * 0.18}
        L ${left + badgeSize * 0.95} ${badgeSize * 0.85}
        L ${halfSize} ${badgeSize - 1}
        L ${left + badgeSize * 0.05} ${badgeSize * 0.85}
        L ${left + 1} ${badgeSize * 0.18}
        Z
      " fill="url(#badgeGrad)" stroke="${c.border}" stroke-width="2"/>`;
    }

    return `
      <div style="position:relative;width:${size}px;height:${totalHeight}px;transform-origin:50% ${totalHeight - 4}px;${selectedStyle}filter:drop-shadow(0 2px 4px rgba(26,20,16,0.3));">
        <svg viewBox="0 0 ${size} ${totalHeight}" width="${size}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">
          <defs>
            <linearGradient id="pinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="${c.primary}" stop-opacity="1"/>
              <stop offset="100%" stop-color="${c.border}" stop-opacity="1"/>
            </linearGradient>
            <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="${c.primary}" stop-opacity="1"/>
              <stop offset="100%" stop-color="${c.secondary}" stop-opacity="1"/>
            </linearGradient>
          </defs>
          <path d="
            M ${size * 0.35} ${badgeSize * 0.88}
            Q ${halfSize} ${totalHeight + 2} ${size * 0.65} ${badgeSize * 0.88}
            Q ${halfSize} ${badgeSize + 2} ${size * 0.35} ${badgeSize * 0.88}
            Z
          " fill="url(#pinGrad)" filter="drop-shadow(0 3px 2px rgba(0,0,0,0.25))"/>
          <g>${badgeShape}</g>
        </svg>
        <span style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:${badgeSize}px;height:${badgeSize}px;display:flex;align-items:center;justify-content:center;font-size:${iconFontSize}px;line-height:1;pointer-events:none;text-shadow:1px 1px 2px rgba(0,0,0,0.3);z-index:2;">
          ${emojis[type]}
        </span>
        ${orderBadgeHTML}
        ${pulseRingHTML}
      </div>
    `;
  }

  function createLeafletMarker(markerData: MarkerData, index: number, isSelected: boolean): import('leaflet').Marker {
    const size = isSelected ? 44 : 36;
    const iconSize: [number, number] = [size, size + Math.round(size * 0.35)];
    const iconAnchor: [number, number] = [size / 2, size + Math.round(size * 0.35)];

    const customIcon = L!.divIcon({
      html: renderMarkerIconSVG(markerData.type, size, isSelected, index + 1),
      className: 'custom-marker-icon',
      iconSize,
      iconAnchor,
      popupAnchor: [0, -size - 12]
    });

    const leafletMarker = L!.marker([markerData.lat, markerData.lng], {
      icon: customIcon,
      draggable: true,
      riseOnHover: true
    });

    leafletMarker.on('click', () => {
      selectMarker(markerData.id);
    });

    leafletMarker.on('dragend', (e: any) => {
      const pos = e.target.getLatLng();
      updateMarker(markerData.id, { lat: pos.lat, lng: pos.lng });
    });

    leafletMarker.on('contextmenu', (e: any) => {
      L!.DomEvent.stopPropagation(e);
      deleteMenu = {
        visible: true,
        x: e.originalEvent.clientX,
        y: e.originalEvent.clientY,
        markerId: markerData.id
      };
    });

    return leafletMarker;
  }

  function refreshMarkerLayer() {
    if (!map || !L || !markersLayer) return;
    markersLayer.clearLayers();
    markerRefs.clear();

    currentRouteMarkers.forEach((m, idx) => {
      const isSelected = currentSelectedId === m.id;
      const leafletMarker = createLeafletMarker(m, idx, isSelected);
      markersLayer!.addLayer(leafletMarker);
      markerRefs.set(m.id, leafletMarker);
    });
  }

  function refreshPolyline() {
    if (!map || !L || currentRouteMarkers.length < 2) {
      polylineSolid?.remove();
      polylineDash?.remove();
      polylineSolid = null;
      polylineDash = null;
      distanceLabelsLayer?.clearLayers();
      return;
    }

    const latlngs: [number, number][] = currentRouteMarkers.map(m => [m.lat, m.lng]);

    if (!polylineSolid) {
      polylineSolid = L!.polyline(latlngs, {
        color: '#2C5F8F',
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);
    } else {
      polylineSolid.setLatLngs(latlngs);
    }

    if (!polylineDash) {
      polylineDash = L!.polyline(latlngs, {
        color: '#D4A03C',
        weight: 2,
        opacity: 1,
        dashArray: '8, 10',
        lineCap: 'round',
        lineJoin: 'round',
        className: 'route-dash-line'
      }).addTo(map);
    } else {
      polylineDash.setLatLngs(latlngs);
    }

    refreshDistanceLabels();
  }

  function refreshDistanceLabels() {
    if (!map || !L || !distanceLabelsLayer) return;
    distanceLabelsLayer.clearLayers();

    for (let i = 0; i < currentRouteMarkers.length - 1; i++) {
      const from = currentRouteMarkers[i];
      const to = currentRouteMarkers[i + 1];
      const midLat = (from.lat + to.lat) / 2;
      const midLng = (from.lng + to.lng) / 2;

      const dist = getRouteSegmentDistance(i);
      const labelIcon = L!.divIcon({
        className: 'distance-label',
        html: `<div style="
          background:rgba(245,239,224,0.95);
          border:1.5px solid #3E2C1C;
          border-radius:4px;
          padding:3px 8px;
          font-family:'Special Elite',monospace;
          font-size:11px;
          color:#3E2C1C;
          font-weight:600;
          white-space:nowrap;
          box-shadow:1px 1px 0 rgba(62,44,28,0.2),0 2px 6px rgba(0,0,0,0.15);
        ">${formatDistance(dist)}</div>`,
        iconSize: [80, 24],
        iconAnchor: [40, 12]
      });

      L!.marker([midLat, midLng], {
        icon: labelIcon,
        interactive: false,
        zIndexOffset: 100
      }).addTo(distanceLabelsLayer);
    }
  }

  function getRouteSegmentDistance(index: number): number {
    if (index < 0 || index >= currentRouteMarkers.length - 1) return 0;
    const from = currentRouteMarkers[index];
    const to = currentRouteMarkers[index + 1];
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(to.lat - from.lat);
    const dLon = toRad(to.lng - from.lng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) *
      Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function handleMapClick(e: import('leaflet').LeafletMouseEvent) {
    if (!currentTool || currentTool === 'select' || currentTool === 'route') return;
    const validTypes: MarkerType[] = ['attraction', 'restaurant', 'hotel', 'gas'];
    if (!validTypes.includes(currentTool as MarkerType)) return;

    addMarker({
      type: currentTool as MarkerType,
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      name: getDefaultMarkerName(currentTool as MarkerType),
      note: '',
      photoUrls: []
    });
  }

  function getDefaultMarkerName(type: MarkerType): string {
    switch (type) {
      case 'attraction': return '景点';
      case 'restaurant': return '餐厅';
      case 'hotel': return '住宿';
      case 'gas': return '加油站';
    }
  }

  function handleMouseMove(e: import('leaflet').LeafletMouseEvent) {
    hoverCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
    dispatchHoverEvent();
  }

  function dispatchHoverEvent() {
    if (hoverCoords) {
      const evt = new CustomEvent('maphover', { detail: { ...hoverCoords, online: isOnline } });
      window.dispatchEvent(evt);
    }
  }

  function handleDeleteConfirm() {
    if (deleteMenu.markerId) {
      removeMarker(deleteMenu.markerId);
    }
    deleteMenu = { visible: false, x: 0, y: 0, markerId: '' };
  }

  function handleDeleteCancel() {
    deleteMenu = { visible: false, x: 0, y: 0, markerId: '' };
  }

  function handleOnlineChange() {
    isOnline = navigator.onLine;
    dispatchHoverEvent();
  }

  const TILE_CONFIGS: Record<string, { url: string; className: string; attribution: string; subdomains?: string }> = {
    vintage: {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      className: 'vintage-tile-layer',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd'
    },
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      className: 'satellite-tile-layer',
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    },
    standard: {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      className: 'standard-tile-layer',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: 'abc'
    }
  };

  let unsubscribeList: (() => void)[] = [];

  onMount(async () => {
    const mod = await import('leaflet');
    L = mod.default || (mod as any);

    import('leaflet/dist/leaflet.css');

    map = L!.map('vintage-map', {
      center: [35.8617, 104.1954],
      zoom: 5,
      minZoom: 3,
      maxZoom: 18,
      zoomControl: false,
      preferCanvas: false,
      worldCopyJump: true
    });

    L!.control.zoom({ position: 'topright' }).addTo(map);

    markersLayer = L!.layerGroup().addTo(map);
    distanceLabelsLayer = L!.layerGroup().addTo(map);

    map.on('click', handleMapClick);
    map.on('mousemove', handleMouseMove);
    map.on('moveend', () => {
      if (map) {
        const c = map.getCenter();
        center.set([c.lat, c.lng]);
        zoom.set(map.getZoom());
        const b = map.getBounds();
        bounds.set({
          southWest: [b.getSouth(), b.getWest()],
          northEast: [b.getNorth(), b.getEast()]
        });
      }
    });
    map.on('zoomend', () => {
      if (map) {
        zoom.set(map.getZoom());
      }
    });

    window.addEventListener('online', handleOnlineChange);
    window.addEventListener('offline', handleOnlineChange);

    mapInstance.set(map);
    mapReady.set(true);

    unsubscribeList.push(
      currentRoute.subscribe((r) => {
        const markersChanged = JSON.stringify(currentRouteMarkers.map(m => ({ id: m.id, lat: m.lat, lng: m.lng, type: m.type })))
          !== JSON.stringify(r.markers.map(m => ({ id: m.id, lat: m.lat, lng: m.lng, type: m.type })));
        currentRouteMarkers = r.markers;
        if (markersChanged) {
          refreshMarkerLayer();
          refreshPolyline();
        }
      })
    );

    unsubscribeList.push(
      selectedMarkerId.subscribe((id) => {
        if (currentSelectedId !== id) {
          currentSelectedId = id;
          refreshMarkerLayer();
          if (id && map) {
            const markerData = currentRouteMarkers.find(m => m.id === id);
            if (markerData) {
              map.panTo([markerData.lat, markerData.lng], { animate: true, duration: 0.4 });
            }
          }
        }
      })
    );

    unsubscribeList.push(
      activeTool.subscribe((t) => {
        currentTool = t;
      })
    );

    document.addEventListener('click', (e) => {
      if (deleteMenu.visible && deleteMenuEl && !deleteMenuEl.contains(e.target as Node)) {
        handleDeleteCancel();
      }
    });
  });

  onDestroy(() => {
    unsubscribeList.forEach(fn => fn());
    window.removeEventListener('online', handleOnlineChange);
    window.removeEventListener('offline', handleOnlineChange);
    if (map) {
      map.remove();
      map = null;
    }
    mapInstance.set(null);
    mapReady.set(false);
  });
</script>

<div class="map-wrapper">
  <div
    id="vintage-map"
    class="vintage-map-container"
    class:style-vintage={activeTileStyle === 'vintage'}
    class:style-satellite={activeTileStyle === 'satellite'}
    class:style-standard={activeTileStyle === 'standard'}
    bind:this={mapContainerEl}
  ></div>

  {#if deleteMenu.visible}
    <div
      bind:this={deleteMenuEl}
      class="delete-menu"
      style="left: {deleteMenu.x}px; top: {deleteMenu.y}px;"
    >
      <div class="delete-menu-header">🗑️ 删除此标记？</div>
      <div class="delete-menu-buttons">
        <button class="btn-cancel" on:click={handleDeleteCancel}>取消</button>
        <button class="btn-confirm" on:click={handleDeleteConfirm}>确认删除</button>
      </div>
    </div>
  {/if}
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .map-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .vintage-map-container {
    width: 100%;
    height: 100%;
    transition: filter 0.3s ease;
  }

  .vintage-map-container.style-vintage {
    filter: sepia(0.25) saturate(1.1) contrast(1.05);
  }

  .vintage-map-container.style-satellite {
    filter: saturate(1.15) contrast(1.08) brightness(0.98);
  }

  .vintage-map-container.style-standard {
    filter: none;
  }

  .vintage-map-container :global(.vintage-tile-layer) {
    filter: sepia(0.15) saturate(1.05) contrast(1.02) brightness(0.98);
  }

  .vintage-map-container :global(.satellite-tile-layer) {
    filter: saturate(1.1) contrast(1.05);
  }

  .vintage-map-container :global(.standard-tile-layer) {
    filter: none;
  }

  .vintage-map-container :global(.leaflet-container) {
    background: mix($sand, $cream, 60%);
    font-family: $font-body;
  }

  .vintage-map-container :global(.leaflet-control-zoom a) {
    background: $cream;
    color: $deep-brown;
    border: 2px solid $deep-brown;
    font-family: $font-display;
    font-weight: 700;
    transition: all 0.2s ease;
  }

  .vintage-map-container :global(.leaflet-control-zoom a:hover) {
    background: $warm-yellow;
    color: $deep-brown;
  }

  .vintage-map-container :global(.leaflet-control-attribution) {
    background: rgba(245, 239, 224, 0.9) !important;
    font-family: $font-typewriter !important;
    font-size: 10px !important;
    color: $deep-brown !important;
    border-top: 1px solid rgba(62, 44, 28, 0.2);
    border-left: 1px solid rgba(62, 44, 28, 0.2);
    padding: 2px 6px !important;
  }

  .vintage-map-container :global(.leaflet-control-attribution a) {
    color: $highway-blue !important;
  }

  .vintage-map-container :global(.custom-marker-icon) {
    background: transparent !important;
    border: none !important;
  }

  .vintage-map-container :global(.leaflet-marker-icon) {
    background: transparent !important;
    border: none !important;
  }

  .vintage-map-container :global(.route-dash-line) {
    animation: dash-animation 1s linear infinite;
  }

  .vintage-map-container :global(.distance-label) {
    background: transparent !important;
    border: none !important;
  }

  .delete-menu {
    position: fixed;
    z-index: 10000;
    min-width: 180px;
    background: $cream;
    border: 2px solid $deep-brown;
    border-radius: 4px;
    box-shadow:
      2px 2px 0 rgba(62, 44, 28, 0.2),
      4px 4px 12px rgba(26, 20, 16, 0.25);
    overflow: hidden;
    animation: fade-in-menu 0.18s ease-out;
    transform: translate(-50%, 8px);
  }

  .delete-menu-header {
    padding: 12px 14px;
    background: $sand;
    border-bottom: 1px solid rgba(62, 44, 28, 0.2);
    font-family: $font-display;
    font-weight: 600;
    font-size: 13px;
    color: $deep-brown;
  }

  .delete-menu-buttons {
    display: flex;
    padding: 10px;
    gap: 8px;

    button {
      flex: 1;
      padding: 7px 10px;
      border-radius: 3px;
      font-family: $font-typewriter;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.15s ease;
    }
  }

  .btn-cancel {
    background: $cream;
    color: $deep-brown;
    border: 1.5px solid $deep-brown;

    &:hover {
      background: $sand;
    }
  }

  .btn-confirm {
    background: $vintage-red;
    color: $cream;
    border: 1.5px solid $vintage-red;

    &:hover {
      background: darken($vintage-red, 8%);
      border-color: darken($vintage-red, 8%);
    }
  }

  @keyframes fade-in-menu {
    from {
      opacity: 0;
      transform: translate(-50%, 2px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translate(-50%, 8px) scale(1);
    }
  }

  @keyframes dash-animation {
    0% {
      stroke-dashoffset: 0;
    }
    100% {
      stroke-dashoffset: -18;
    }
  }

  @keyframes marker-pulse-map {
    0% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0.7;
    }
    80%, 100% {
      transform: translate(-50%, -50%) scale(1.8);
      opacity: 0;
    }
  }
</style>
