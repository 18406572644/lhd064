<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from 'svelte';
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
  import { activeTool, mapReady, showToast } from '@/stores/ui.store';
  import { center, zoom, bounds } from '@/stores/map.store';
  import { appSettings } from '@/stores/settings.store';
  import { flightConfig, flightState, updateFlightProgress, showMarkerInfoCard, hideMarkerInfoCard, startFlight, stopFlight, pauseFlight, resumeFlight, startRecording, stopRecording } from '@/stores/flight.store';
  import { formatDistance } from '@/utils/distance';
  import { getElevationProfile, type ElevationProfile, type ElevationPoint } from '@/services/elevation.service';

  let maplibre: typeof import('maplibre-gl');
  let map: import('maplibre-gl').Map | null = null;
  let mapContainerEl: HTMLDivElement | null = null;
  let markersLayer: import('maplibre-gl').Marker[] = [];
  let currentRouteMarkers: MarkerData[] = [];
  let currentSelectedId: string | null = null;
  let currentTool: string = 'select';
  let deleteMenuEl: HTMLDivElement | null = null;
  let deleteMenu = { visible: false, x: 0, y: 0, markerId: '' as string };

  let elevationProfile: ElevationProfile | null = null;
  let flightAnimationFrame: number | null = null;
  let flightStartTime: number = 0;
  let flightPausedTime: number = 0;
  let flightPauseDuration: number = 0;
  let lastMarkerVisitIndex: number = -1;
  let markerStayTimers: Map<number, number> = new Map();
  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];

  const TILE_CONFIGS: Record<string, { style: any; terrain?: any }> = {
    vintage: {
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
              'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
              'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          }
        },
        layers: [
          {
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      }
    },
    satellite: {
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          }
        },
        layers: [
          {
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      }
    },
    standard: {
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
        },
        layers: [
          {
            id: 'simple-tiles',
            type: 'raster',
            source: 'raster-tiles',
            minzoom: 0,
            maxzoom: 22
          }
        ]
      }
    }
  };

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

  function createMapLibreMarker(markerData: MarkerData, index: number, isSelected: boolean): import('maplibre-gl').Marker {
    const size = isSelected ? 44 : 36;
    const iconSize: [number, number] = [size, size + Math.round(size * 0.35)];
    const iconAnchor: [number, number] = [size / 2, size + Math.round(size * 0.35)];

    const el = document.createElement('div');
    el.className = 'custom-marker-icon-maplibre';
    el.innerHTML = renderMarkerIconSVG(markerData.type, size, isSelected, index + 1);
    el.style.width = `${iconSize[0]}px`;
    el.style.height = `${iconSize[1]}px`;
    el.style.transform = `translate(${-iconAnchor[0]}px, ${-iconAnchor[1]}px)`;
    el.style.cursor = 'grab';

    const marker = new maplibre.Marker({
      element: el,
      anchor: 'bottom',
      draggable: true
    }).setLngLat([markerData.lng, markerData.lat]);

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      selectMarker(markerData.id);
    });

    el.addEventListener('contextmenu', (e) => {
      e.stopPropagation();
      e.preventDefault();
      deleteMenu = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        markerId: markerData.id
      };
    });

    marker.on('dragend', () => {
      const pos = marker.getLngLat();
      updateMarker(markerData.id, { lat: pos.lat, lng: pos.lng });
    });

    return marker;
  }

  function refreshMarkerLayer() {
    if (!map) return;

    markersLayer.forEach(m => m.remove());
    markersLayer = [];

    currentRouteMarkers.forEach((m, idx) => {
      const isSelected = currentSelectedId === m.id;
      const marker = createMapLibreMarker(m, idx, isSelected);
      marker.addTo(map!);
      markersLayer.push(marker);
    });
  }

  function refreshRouteLine() {
    if (!map || !maplibre) return;

    const routeSourceId = 'route-line-source';
    const routeLayerId = 'route-line-layer';
    const routeDashLayerId = 'route-dash-layer';

    if (currentRouteMarkers.length < 2) {
      if (map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
      if (map.getLayer(routeDashLayerId)) map.removeLayer(routeDashLayerId);
      if (map.getSource(routeSourceId)) map.removeSource(routeSourceId);
      return;
    }

    const lnglats: [number, number][] = currentRouteMarkers.map(m => [m.lng, m.lat]);

    if (!map.getSource(routeSourceId)) {
      map.addSource(routeSourceId, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: lnglats
          },
          properties: {}
        }
      });

      map.addLayer({
        id: routeLayerId,
        type: 'line',
        source: routeSourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#2C5F8F',
          'line-width': 5,
          'line-opacity': 0.85
        }
      });

      map.addLayer({
        id: routeDashLayerId,
        type: 'line',
        source: routeSourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#D4A03C',
          'line-width': 2,
          'line-dasharray': [2, 2.5],
          'line-opacity': 1
        }
      });
    } else {
      const source = map.getSource(routeSourceId) as import('maplibre-gl').GeoJSONSource;
      source.setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: lnglats
        },
        properties: {}
      });
    }
  }

  function addTerrainLayer() {
    if (!map || !maplibre) return;

    try {
      if (!map.getSource('maplibre-dem')) {
        map.addSource('maplibre-dem', {
          type: 'raster-dem',
          url: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
          tileSize: 256
        });
        map.setTerrain({
          source: 'maplibre-dem',
          exaggeration: 1.5
        });
      }
    } catch (e) {
      console.warn('[terrain] Terrain loading failed:', e);
    }
  }

  function removeTerrainLayer() {
    if (!map) return;

    try {
      if (map.getTerrain()) {
        map.setTerrain();
      }
      if (map.getSource('maplibre-dem')) {
        map.removeSource('maplibre-dem');
      }
    } catch (e) {
      console.warn('[terrain] Terrain removal failed:', e);
    }
  }

  function handleMapClick(e: any) {
    if (!currentTool || currentTool === 'select' || currentTool === 'route') return;
    const validTypes: MarkerType[] = ['attraction', 'restaurant', 'hotel', 'gas'];
    if (!validTypes.includes(currentTool as MarkerType)) return;

    const lngLat = e.lngLat;
    addMarker({
      type: currentTool as MarkerType,
      lat: lngLat.lat,
      lng: lngLat.lng,
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

  function handleDeleteConfirm() {
    if (deleteMenu.markerId) {
      removeMarker(deleteMenu.markerId);
    }
    deleteMenu = { visible: false, x: 0, y: 0, markerId: '' };
  }

  function handleDeleteCancel() {
    deleteMenu = { visible: false, x: 0, y: 0, markerId: '' };
  }

  function interpolateAlongPath(points: ElevationPoint[], progress: number): { lat: number; lng: number; elevation: number; markerIndex: number } {
    if (!points || points.length === 0) {
      return { lat: 0, lng: 0, elevation: 0, markerIndex: -1 };
    }

    const totalDist = points[points.length - 1].distance;
    const targetDist = progress * totalDist;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      if (targetDist >= p1.distance && targetDist <= p2.distance) {
        const segLen = p2.distance - p1.distance;
        const t = segLen > 0 ? (targetDist - p1.distance) / segLen : 0;

        return {
          lat: p1.lat + (p2.lat - p1.lat) * t,
          lng: p1.lng + (p2.lng - p1.lng) * t,
          elevation: p1.elevation + (p2.elevation - p1.elevation) * t,
          markerIndex: p2.isMarker ? (p2.markerIndex ?? -1) : -1
        };
      }
    }

    const last = points[points.length - 1];
    return {
      lat: last.lat,
      lng: last.lng,
      elevation: last.elevation,
      markerIndex: last.isMarker ? (last.markerIndex ?? -1) : -1
    };
  }

  function calculateBearing3D(p1: { lat: number; lng: number }, p2: { lat: number; lng: number }): number {
    const toRad = (d: number) => d * Math.PI / 180;
    const toDeg = (r: number) => r * 180 / Math.PI;

    const lat1 = toRad(p1.lat);
    const lat2 = toRad(p2.lat);
    const dLon = toRad(p2.lng - p1.lng);

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let bearing = toDeg(Math.atan2(y, x));
    bearing = (bearing + 360) % 360;
    return bearing;
  }

  async function startFlightAnimation() {
    if (!map || currentRouteMarkers.length < 2) {
      showToast('需要至少2个标记点才能开始飞行模拟', 'error');
      return;
    }

    if (!elevationProfile || elevationProfile.points.length < currentRouteMarkers.length) {
      try {
        elevationProfile = await getElevationProfile(currentRouteMarkers, 50);
      } catch (e) {
        showToast('海拔数据获取失败，使用默认值', 'error');
      }
    }

    if (!elevationProfile || elevationProfile.points.length === 0) {
      showToast('无法生成飞行路径', 'error');
      return;
    }

    const totalDist = elevationProfile.totalDistance;
    startFlight(totalDist);
    flightStartTime = performance.now();
    flightPauseDuration = 0;
    flightPausedTime = 0;
    lastMarkerVisitIndex = -1;
    markerStayTimers.forEach(t => clearTimeout(t));
    markerStayTimers.clear();

    animateFlight();
  }

  function animateFlight() {
    if (!map || !elevationProfile) return;

    let $flightConfig: any;
    let $flightState: any;
    flightConfig.subscribe(fc => { $flightConfig = fc; })();
    flightState.subscribe(fs => { $flightState = fs; })();

    if ($flightState.isPaused) {
      if (!flightPausedTime) {
        flightPausedTime = performance.now();
      }
      flightAnimationFrame = requestAnimationFrame(animateFlight);
      return;
    } else {
      if (flightPausedTime) {
        flightPauseDuration += performance.now() - flightPausedTime;
        flightPausedTime = 0;
      }
    }

    if (!$flightState.isPlaying) {
      stopAnimation();
      return;
    }

    const now = performance.now();
    const elapsedSec = (now - flightStartTime - flightPauseDuration) / 1000;
    const speedKmh = $flightConfig.speed;
    const progress = Math.min(1, (speedKmh * elapsedSec / 3600) / Math.max(elevationProfile!.totalDistance, 0.001));

    if (progress >= 1) {
      stopFlight();
      stopRecording();
      stopAnimation();
      showToast('飞行模拟完成！', 'success');
      return;
    }

    const pos = interpolateAlongPath(elevationProfile!.points, progress);
    const altitude = $flightConfig.altitude;

    const bearingStep = 0.001;
    const lookAhead = interpolateAlongPath(
      elevationProfile!.points,
      Math.min(1, progress + bearingStep)
    );

    const bearing = calculateBearing3D(
      { lat: pos.lat, lng: pos.lng },
      { lat: lookAhead.lat, lng: lookAhead.lng }
    );

    updateFlightProgress(progress, pos, pos.markerIndex);

    if (pos.markerIndex >= 0 && pos.markerIndex !== lastMarkerVisitIndex) {
      lastMarkerVisitIndex = pos.markerIndex;
      const marker = currentRouteMarkers[pos.markerIndex];
      if (marker) {
        showMarkerInfoCard(marker);

        const stayDuration = $flightConfig.markerStayTime * 1000;
        pauseFlight();

        const timerId = setTimeout(() => {
          hideMarkerInfoCard();
          resumeFlight();
          markerStayTimers.delete(pos.markerIndex);
        }, stayDuration) as unknown as number;

        markerStayTimers.set(pos.markerIndex, timerId);
      }
    }

    try {
      map!.flyTo({
        center: [pos.lng, pos.lat],
        zoom: 15,
        pitch: $flightConfig.pitch,
        bearing: bearing,
        speed: 0.5,
        curve: 1
      });
    } catch (e) {
    }

    flightAnimationFrame = requestAnimationFrame(animateFlight);
  }

  function stopAnimation() {
    if (flightAnimationFrame) {
      cancelAnimationFrame(flightAnimationFrame);
      flightAnimationFrame = null;
    }
    markerStayTimers.forEach(t => clearTimeout(t));
    markerStayTimers.clear();
  }

  async function startVideoRecording() {
    if (!map || !mapContainerEl) return;

    try {
      const canvas = mapContainerEl.querySelector('canvas');
      if (!canvas) {
        showToast('找不到地图 canvas', 'error');
        return;
      }

      const stream = (canvas as any).captureStream(30);
      recordedChunks = [];

      mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `flight-simulation-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        recordedChunks = [];
        mediaRecorder = null;
        showToast('视频导出成功！', 'success');
      };

      mediaRecorder.start();
      startRecording('video');
      startFlightAnimation();
      showToast('开始录制飞行动画...', 'info');

    } catch (e: any) {
      showToast('录制失败: ' + (e.message || e), 'error');
    }
  }

  function stopVideoRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    stopRecording();
  }

  let unsubscribeList: (() => void)[] = [];
  let currentStyleKey: string = '';
  let currentMapMode: string = '2d';

  onMount(async () => {
    const mod = await import('maplibre-gl');
    maplibre = mod.default || mod;
    await import('maplibre-gl/dist/maplibre-gl.css');

    if (!mapContainerEl) return;

    const styleConfig = TILE_CONFIGS[$appSettings.tileStyle] || TILE_CONFIGS.vintage;

    map = new maplibre.Map({
      container: mapContainerEl,
      style: styleConfig.style,
      center: [104.1954, 35.8617],
      zoom: 5,
      minZoom: 2,
      maxZoom: 20,
      pitch: 0,
      bearing: 0,
      antialias: true,
      attributionControl: true
    });

    currentStyleKey = $appSettings.tileStyle;

    map.addControl(new maplibre.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
    map.addControl(new maplibre.ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      if (!map) return;
      if ($appSettings.mapMode === '3d') {
        addTerrainLayer();
        currentMapMode = '3d';
      }
      refreshMarkerLayer();
      refreshRouteLine();
      mapReady.set(true);
    });

    map.on('click', handleMapClick);

    map.on('moveend', () => {
      if (map) {
        const c = map.getCenter();
        center.set([c.lat, c.lng]);
        zoom.set(map.getZoom());
        const b = map.getBounds();
        if (b) {
          bounds.set({
            southWest: [b.getSouth(), b.getWest()],
            northEast: [b.getNorth(), b.getEast()]
          });
        }
      }
    });

    unsubscribeList.push(
      currentRoute.subscribe(async (r) => {
        const markersChanged = JSON.stringify(currentRouteMarkers.map(m => ({ id: m.id, lat: m.lat, lng: m.lng, type: m.type })))
          !== JSON.stringify(r.markers.map(m => ({ id: m.id, lat: m.lat, lng: m.lng, type: m.type })));
        currentRouteMarkers = r.markers;
        if (markersChanged) {
          refreshMarkerLayer();
          refreshRouteLine();
          if (r.markers.length >= 2) {
            try {
              elevationProfile = await getElevationProfile(r.markers, 30);
            } catch (e) {
              console.warn('[elevation] profile fetch failed', e);
            }
          } else {
            elevationProfile = null;
          }
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
              map.flyTo({
                center: [markerData.lng, markerData.lat],
                speed: 0.6,
                curve: 1.42
              });
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

    unsubscribeList.push(
      appSettings.subscribe(async (settings) => {
        if (!map) return;

        if (settings.tileStyle !== currentStyleKey) {
          const styleConfig = TILE_CONFIGS[settings.tileStyle] || TILE_CONFIGS.vintage;
          try {
            map.setStyle(styleConfig.style);
            currentStyleKey = settings.tileStyle;
            map.once('styledata', () => {
              refreshMarkerLayer();
              refreshRouteLine();
              if (settings.mapMode === '3d') {
                addTerrainLayer();
                currentMapMode = '3d';
              }
            });
          } catch (e) {
            console.error('[style] Style switch error:', e);
          }
        }

        if (settings.mapMode !== currentMapMode) {
          currentMapMode = settings.mapMode;
          if (settings.mapMode === '3d') {
            addTerrainLayer();
          } else {
            removeTerrainLayer();
            if (map.getPitch() > 0) {
              map.setPitch(0);
            }
          }
        }
      })
    );

    document.addEventListener('click', (e) => {
      if (deleteMenu.visible && deleteMenuEl && !deleteMenuEl.contains(e.target as Node)) {
        handleDeleteCancel();
      }
    });
  });

  afterUpdate(() => {
    if (map && map.getStyle()) {
    }
  });

  onDestroy(() => {
    stopAnimation();
    unsubscribeList.forEach(fn => fn());
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (map) {
      map.remove();
      map = null;
    }
    mapReady.set(false);
  });

  $: {
    if ($appSettings.mapMode === '3d' && map && !$flightState.isPlaying) {
      if (currentRouteMarkers.length >= 2) {
        getElevationProfile(currentRouteMarkers, 30).then(profile => {
          elevationProfile = profile;
        }).catch(() => {});
      }
    }
  }
</script>

<div class="maplibre-wrapper">
  <div
    bind:this={mapContainerEl}
    class="maplibre-container"
    class:style-vintage={$appSettings.tileStyle === 'vintage'}
    class:style-satellite={$appSettings.tileStyle === 'satellite'}
    class:style-standard={$appSettings.tileStyle === 'standard'}
    class:mode-3d={$appSettings.mapMode === '3d'}
  ></div>

  <div class="flight-controls-overlay" class:visible={$appSettings.mapMode === '3d' && currentRouteMarkers.length >= 2}>
    <div class="flight-controls">
      <div class="flight-progress-bar">
        <div class="flight-progress-fill" style="width: {Math.round($flightState.currentProgress * 100)}%"></div>
      </div>
      <div class="flight-buttons">
        {#if !$flightState.isPlaying}
          <button class="flight-btn play" on:click={startFlightAnimation} title="开始飞行">
            <span>🚀</span>
            <span>开始飞行</span>
          </button>
        {:else if $flightState.isPaused}
          <button class="flight-btn resume" on:click={() => resumeFlight()} title="继续">
            <span>▶️</span>
            <span>继续</span>
          </button>
        {:else}
          <button class="flight-btn pause" on:click={() => pauseFlight()} title="暂停">
            <span>⏸️</span>
            <span>暂停</span>
          </button>
        {/if}
        <button class="flight-btn stop" on:click={() => { stopFlight(); stopVideoRecording(); stopAnimation(); }} title="停止" disabled={!$flightState.isPlaying && !$flightState.isRecording}>
          <span>⏹️</span>
          <span>停止</span>
        </button>
        <div class="divider"></div>
        {#if !$flightState.isRecording}
          <button class="flight-btn record" on:click={startVideoRecording} title="录制视频">
            <span>🎬</span>
            <span>录制</span>
          </button>
        {:else}
          <button class="flight-btn stop-record" on:click={() => { stopVideoRecording(); stopFlight(); }} title="停止录制">
            <span>🔴</span>
            <span>停止录制</span>
          </button>
        {/if}
      </div>
      <div class="flight-config">
        <div class="config-item">
          <label>飞行高度</label>
          <input type="range" min="200" max="3000" step="50" bind:value={$flightConfig.altitude} />
          <span>{$flightConfig.altitude}m</span>
        </div>
        <div class="config-item">
          <label>飞行速度</label>
          <input type="range" min="30" max="500" step="10" bind:value={$flightConfig.speed} />
          <span>{$flightConfig.speed}km/h</span>
        </div>
        <div class="config-item">
          <label>俯仰角度</label>
          <input type="range" min="0" max="85" step="1" bind:value={$flightConfig.pitch} />
          <span>{$flightConfig.pitch}°</span>
        </div>
        <div class="config-item">
          <label>标记停留</label>
          <input type="range" min="0" max="10" step="0.5" bind:value={$flightConfig.markerStayTime} />
          <span>{$flightConfig.markerStayTime}s</span>
        </div>
      </div>
    </div>
  </div>

  {#if $flightState.showInfoCard && $flightState.currentInfoCard}
    <div class="flight-info-card">
      <div class="info-card-header">
        <span class="info-card-index">📍 #{$flightState.currentMarkerIndex + 1}</span>
        <span class="info-card-name">{$flightState.currentInfoCard.name}</span>
      </div>
      {#if $flightState.currentInfoCard.note}
        <div class="info-card-note">{$flightState.currentInfoCard.note}</div>
      {/if}
      <div class="info-card-footer">
        {#if $flightState.currentPosition}
          <span>海拔: {Math.round($flightState.currentPosition.elevation)}m</span>
        {/if}
      </div>
    </div>
  {/if}

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

  .maplibre-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .maplibre-container {
    width: 100%;
    height: 100%;
    transition: filter 0.3s ease;
  }

  .maplibre-container :global(.maplibregl-map) {
    background: mix($sand, $cream, 60%);
    font-family: $font-body;
  }

  .maplibre-container :global(.maplibregl-canvas) {
    width: 100% !important;
    height: 100% !important;
  }

  .maplibre-container :global(.maplibregl-ctrl-group) {
    background: $cream !important;
    border: 2px solid $deep-brown !important;
    border-radius: 4px !important;
    overflow: hidden !important;
  }

  .maplibre-container :global(.maplibregl-ctrl-group button) {
    background: $cream !important;
    color: $deep-brown !important;
    border-bottom: 1px solid rgba(62, 44, 28, 0.2) !important;
  }

  .maplibre-container :global(.maplibregl-ctrl-group button:hover) {
    background: $warm-yellow !important;
    color: $deep-brown !important;
  }

  .maplibre-container :global(.maplibregl-ctrl-group button:last-child) {
    border-bottom: none !important;
  }

  .maplibre-container :global(.maplibregl-ctrl-attrib) {
    background: rgba(245, 239, 224, 0.9) !important;
    font-family: $font-typewriter !important;
    font-size: 10px !important;
    color: $deep-brown !important;
    border-top: 1px solid rgba(62, 44, 28, 0.2);
    border-left: 1px solid rgba(62, 44, 28, 0.2);
    padding: 2px 6px !important;
  }

  .maplibre-container :global(.maplibregl-ctrl-attrib a) {
    color: $highway-blue !important;
  }

  .maplibre-container :global(.maplibregl-scale-control) {
    background: rgba(245, 239, 224, 0.9) !important;
    border: 1.5px solid $deep-brown !important;
    border-radius: 3px !important;
    color: $deep-brown !important;
    font-family: $font-typewriter !important;
    font-size: 10px !important;
    padding: 2px 6px !important;
  }

  .maplibre-container.style-vintage {
    filter: sepia(0.25) saturate(1.1) contrast(1.05);
  }

  .maplibre-container.style-satellite {
    filter: saturate(1.15) contrast(1.08) brightness(0.98);
  }

  .maplibre-container.style-standard {
    filter: none;
  }

  .maplibre-container.mode-3d :global(.maplibregl-canvas-container) {
    perspective: 1000px;
  }

  .flight-controls-overlay {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 500;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;

    &.visible {
      opacity: 1;
      pointer-events: auto;
    }
  }

  .flight-controls {
    background: rgba(245, 239, 224, 0.95);
    border: 2.5px solid $deep-brown;
    border-radius: 10px;
    padding: 12px 16px;
    box-shadow: 0 8px 24px rgba(62, 44, 28, 0.25);
    backdrop-filter: blur(8px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 420px;
  }

  .flight-progress-bar {
    width: 100%;
    height: 8px;
    background: rgba(62, 44, 28, 0.15);
    border-radius: 4px;
    overflow: hidden;

    .flight-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, $highway-blue, $moss-green);
      border-radius: 4px;
      transition: width 0.1s linear;
    }
  }

  .flight-buttons {
    display: flex;
    align-items: center;
    gap: 8px;

    .divider {
      width: 1px;
      height: 24px;
      background: rgba(62, 44, 28, 0.2);
      margin: 0 4px;
    }
  }

  .flight-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1.5px solid rgba(62, 44, 28, 0.3);
    border-radius: 6px;
    background: #FFF;
    font-family: $font-display;
    font-size: 12px;
    font-weight: 600;
    color: $deep-brown;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(62, 44, 28, 0.2);
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    span:first-child {
      font-size: 14px;
    }

    &.play {
      background: linear-gradient(180deg, #3A7CB8 0%, $highway-blue 100%);
      color: #FFF;
      border-color: #1E4A78;
    }

    &.resume {
      background: linear-gradient(180deg, $moss-green 0%, #3D5A32 100%);
      color: #FFF;
      border-color: #2A4022;
    }

    &.pause {
      background: linear-gradient(180deg, $warm-yellow 0%, #B88820 100%);
      color: #FFF;
      border-color: #8F6A20;
    }

    &.stop {
      background: linear-gradient(180deg, #A06860 0%, $vintage-red 100%);
      color: #FFF;
      border-color: #6E2C23;
    }

    &.record {
      background: linear-gradient(180deg, #D4606A 0%, #B84A50 100%);
      color: #FFF;
      border-color: #8F3A40;
    }

    &.stop-record {
      background: linear-gradient(180deg, #FF6068 0%, #E04A50 100%);
      color: #FFF;
      border-color: #AF3A40;
      animation: record-pulse 1s ease-in-out infinite;
    }
  }

  @keyframes record-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(224, 74, 80, 0.5); }
    50% { box-shadow: 0 0 0 6px rgba(224, 74, 80, 0); }
  }

  .flight-config {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px 16px;
    padding-top: 8px;
    border-top: 1px dashed rgba(62, 44, 28, 0.2);
  }

  .config-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: $font-body;
    font-size: 11px;
    color: $deep-brown;

    label {
      flex-shrink: 0;
      min-width: 56px;
      font-weight: 600;
    }

    input[type="range"] {
      flex: 1;
      height: 4px;
      -webkit-appearance: none;
      appearance: none;
      background: rgba(62, 44, 28, 0.2);
      border-radius: 2px;
      outline: none;
      cursor: pointer;

      &::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        background: $highway-blue;
        border: 2px solid $cream;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.15s;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);

        &:hover {
          transform: scale(1.15);
          background: #3A7CB8;
        }
      }

      &::-moz-range-thumb {
        width: 14px;
        height: 14px;
        background: $highway-blue;
        border: 2px solid $cream;
        border-radius: 50%;
        cursor: pointer;
      }
    }

    span {
      flex-shrink: 0;
      min-width: 46px;
      text-align: right;
      font-family: $font-typewriter;
      font-size: 10px;
      color: $highway-blue;
      font-weight: 600;
    }
  }

  .flight-info-card {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 600;
    background: rgba(245, 239, 224, 0.98);
    border: 2.5px solid $deep-brown;
    border-radius: 10px;
    padding: 14px 18px;
    box-shadow: 0 12px 32px rgba(62, 44, 28, 0.3);
    backdrop-filter: blur(10px);
    min-width: 260px;
    animation: info-card-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);

    .info-card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }

    .info-card-index {
      background: $highway-blue;
      color: $cream;
      padding: 3px 10px;
      border-radius: 4px;
      font-family: $font-typewriter;
      font-size: 11px;
      font-weight: 700;
    }

    .info-card-name {
      font-family: $font-display;
      font-size: 16px;
      font-weight: 700;
      color: $deep-brown;
    }

    .info-card-note {
      font-family: $font-body;
      font-size: 12px;
      color: rgba(62, 44, 28, 0.75);
      line-height: 1.5;
      padding: 6px 10px;
      background: rgba(255, 250, 235, 0.8);
      border-radius: 4px;
      border-left: 3px solid $warm-yellow;
      margin-bottom: 8px;
    }

    .info-card-footer {
      padding-top: 8px;
      border-top: 1px dashed rgba(62, 44, 28, 0.2);
      font-family: $font-typewriter;
      font-size: 11px;
      color: $highway-blue;
      font-weight: 600;
    }
  }

  @keyframes info-card-in {
    from {
      opacity: 0;
      transform: translateX(20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateX(0) scale(1);
    }
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
