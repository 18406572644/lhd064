import type { RouteData, RouteSegment } from '../types';
import { generateGPX } from '../utils/gpx';
import { generateId } from '../utils/id';
import { formatDistance } from '../utils/distance';
import html2canvas from 'html2canvas';

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

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'untitled';
}

function formatDuration(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}分钟`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) {
    return `${h}小时`;
  }
  return `${h}小时${m}分`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildItineraryHTML(
  route: RouteData,
  segments: RouteSegment[],
  estimates: TripEstimates
): string {
  const createdDate = new Date(route.createdAt).toLocaleDateString('zh-CN');
  const updatedDate = new Date(route.updatedAt).toLocaleDateString('zh-CN');

  const typeIcons: Record<string, string> = {
    attraction: '🏛️',
    restaurant: '🍽️',
    hotel: '🏨',
    gas: '⛽'
  };

  const markersHTML = route.markers.map((m, idx) => {
    const seg = segments[idx - 1];
    const dist = seg ? seg.distance : 0;
    const durH = seg && seg.durationHours != null ? seg.durationHours : 0;
    const distanceHTML = seg
      ? `<div class="seg-info">
          <span class="seg-dist">${formatDistance(dist)}</span>
          <span class="seg-time">约${formatDuration(durH)}</span>
        </div>`
      : '';
    const icon = typeIcons[m.type] || '📍';
    const stayStr = m.stayDuration ? `停留 ${m.stayDuration} 分钟` : '';
    return `
      <div class="timeline-item">
        ${distanceHTML}
        <div class="timeline-dot">${icon}</div>
        <div class="timeline-content">
          <div class="marker-header">
            <span class="marker-index">D${idx + 1}</span>
            <span class="marker-name">${m.name || '途经点'}</span>
            ${stayStr ? `<span class="stay-tag">${stayStr}</span>` : ''}
          </div>
          ${m.note ? `<div class="marker-note">${m.note}</div>` : ''}
          <div class="marker-coords">${m.lat.toFixed(4)}, ${m.lng.toFixed(4)}</div>
        </div>
      </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${route.name} - 行程单</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Crimson Pro', 'Lora', 'Georgia', serif;
    background: #F5EDD8;
    color: #3E2C1C;
    min-height: 100vh;
    padding: 40px 20px;
  }
  .itinerary {
    max-width: 800px;
    margin: 0 auto;
    background: #FBF5E6;
    border: 3px double #8B6F47;
    box-shadow: 0 4px 20px rgba(62, 44, 28, 0.15);
    position: relative;
  }
  .itinerary::before {
    content: '';
    position: absolute;
    top: 8px; left: 8px; right: 8px; bottom: 8px;
    border: 1px solid #D4A03C;
    pointer-events: none;
  }
  .header {
    text-align: center;
    padding: 40px 40px 24px;
    border-bottom: 2px solid #D4A03C;
    position: relative;
  }
  .header::after {
    content: '✦';
    position: absolute;
    bottom: -12px;
    left: 50%;
    transform: translateX(-50%);
    background: #FBF5E6;
    padding: 0 12px;
    color: #D4A03C;
    font-size: 18px;
  }
  .header h1 {
    font-family: 'Playfair Display', 'Cinzel', 'Georgia', serif;
    font-size: 32px;
    color: #2C5F8F;
    letter-spacing: 2px;
    margin-bottom: 12px;
    text-shadow: 1px 1px 0 rgba(44, 95, 143, 0.1);
  }
  .header .subtitle {
    font-size: 14px;
    color: #8B6F47;
    letter-spacing: 4px;
    text-transform: uppercase;
  }
  .header .dates {
    margin-top: 16px;
    font-size: 13px;
    color: #6B5639;
  }
  .description {
    padding: 24px 40px;
    font-style: italic;
    color: #6B5639;
    text-align: center;
    line-height: 1.8;
    font-size: 15px;
    border-bottom: 1px dashed #C9B896;
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1px;
    background: #D4A03C;
    border-bottom: 2px solid #D4A03C;
  }
  .stat {
    background: #FBF5E6;
    padding: 20px 12px;
    text-align: center;
  }
  .stat-value {
    font-family: 'Special Elite', 'Roboto Slab', monospace;
    font-size: 20px;
    color: #2C5F8F;
    font-weight: bold;
  }
  .stat-label {
    font-size: 11px;
    color: #8B6F47;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-top: 4px;
  }
  .timeline {
    padding: 32px 40px 40px;
  }
  .timeline-title {
    font-family: 'Playfair Display', serif;
    font-size: 20px;
    color: #2C5F8F;
    margin-bottom: 24px;
    text-align: center;
    letter-spacing: 2px;
  }
  .timeline-title::before,
  .timeline-title::after {
    content: '———';
    color: #D4A03C;
    margin: 0 12px;
  }
  .timeline-item {
    position: relative;
    padding-left: 56px;
    padding-bottom: 28px;
  }
  .timeline-item:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 18px;
    top: 36px;
    bottom: 0;
    width: 2px;
    background: repeating-linear-gradient(
      to bottom,
      #D4A03C,
      #D4A03C 4px,
      transparent 4px,
      transparent 8px
    );
  }
  .timeline-dot {
    position: absolute;
    left: 0;
    top: 0;
    width: 40px;
    height: 40px;
    background: #2C5F8F;
    border: 3px solid #D4A03C;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    box-shadow: 0 2px 6px rgba(44, 95, 143, 0.3);
  }
  .seg-info {
    position: absolute;
    left: 60px;
    top: -16px;
    background: #2C5F8F;
    color: #FBF5E6;
    padding: 3px 10px;
    border-radius: 10px;
    font-size: 11px;
    font-family: 'Special Elite', monospace;
    display: flex;
    gap: 8px;
  }
  .seg-dist { color: #FFD700; }
  .seg-time { color: #E8DCC4; }
  .timeline-content {
    background: #F5EDD8;
    padding: 14px 18px;
    border: 1px solid #C9B896;
    border-radius: 4px;
    position: relative;
  }
  .timeline-content::before {
    content: '';
    position: absolute;
    left: -6px;
    top: 12px;
    width: 10px;
    height: 10px;
    background: #F5EDD8;
    border-left: 1px solid #C9B896;
    border-bottom: 1px solid #C9B896;
    transform: rotate(45deg);
  }
  .marker-header {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }
  .marker-index {
    background: #D4A03C;
    color: #3E2C1C;
    padding: 2px 8px;
    font-weight: bold;
    font-size: 12px;
    font-family: 'Special Elite', monospace;
    border-radius: 2px;
  }
  .marker-name {
    font-weight: bold;
    font-size: 16px;
    color: #3E2C1C;
  }
  .stay-tag {
    font-size: 11px;
    background: #5A7A4A;
    color: #FBF5E6;
    padding: 2px 8px;
    border-radius: 10px;
  }
  .marker-note {
    font-size: 13px;
    color: #6B5639;
    line-height: 1.6;
    margin: 6px 0;
    padding-left: 4px;
    border-left: 2px solid #D4A03C;
  }
  .marker-coords {
    font-size: 11px;
    color: #8B6F47;
    font-family: 'Special Elite', monospace;
    opacity: 0.7;
  }
  .fuel-section {
    margin: 0 40px 32px;
    padding: 20px;
    background: linear-gradient(135deg, #FFF8E7, #F5EDD8);
    border: 2px dashed #D4A03C;
    border-radius: 8px;
    text-align: center;
  }
  .fuel-title {
    font-family: 'Playfair Display', serif;
    font-size: 16px;
    color: #8B3A2E;
    margin-bottom: 12px;
    letter-spacing: 1px;
  }
  .fuel-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }
  .fuel-item-value {
    font-family: 'Special Elite', monospace;
    font-size: 18px;
    color: #2C5F8F;
    font-weight: bold;
  }
  .fuel-item-label {
    font-size: 11px;
    color: #6B5639;
    margin-top: 2px;
  }
  .footer {
    padding: 20px 40px 32px;
    text-align: center;
    border-top: 1px dashed #C9B896;
  }
  .stamp {
    display: inline-block;
    padding: 8px 20px;
    border: 2px solid #8B3A2E;
    color: #8B3A2E;
    font-family: 'Special Elite', monospace;
    font-size: 12px;
    transform: rotate(-5deg);
    opacity: 0.8;
    letter-spacing: 2px;
  }
  .footer-text {
    margin-top: 12px;
    font-size: 11px;
    color: #8B6F47;
    font-style: italic;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .itinerary { box-shadow: none; }
  }
</style>
</head>
<body>
<div class="itinerary">
  <div class="header">
    <h1>${route.name}</h1>
    <div class="subtitle">✧ Vintage Roadtrip Planner ✧</div>
    <div class="dates">创建于 ${createdDate} · 更新于 ${updatedDate}</div>
  </div>

  ${route.description ? `<div class="description">"${route.description}"</div>` : ''}

  <div class="stats">
    <div class="stat">
      <div class="stat-value">${formatDistance(estimates.totalDistance)}</div>
      <div class="stat-label">总里程</div>
    </div>
    <div class="stat">
      <div class="stat-value">${formatDuration(estimates.totalDuration)}</div>
      <div class="stat-label">总时长</div>
    </div>
    <div class="stat">
      <div class="stat-value">${route.markers.length}</div>
      <div class="stat-label">途经点</div>
    </div>
    <div class="stat">
      <div class="stat-value">${estimates.restStopCount}</div>
      <div class="stat-label">休息次数</div>
    </div>
  </div>

  <div class="timeline">
    <div class="timeline-title">行程安排</div>
    ${markersHTML}
  </div>

  <div class="fuel-section">
    <div class="fuel-title">⛽ 油耗估算</div>
    <div class="fuel-grid">
      <div>
        <div class="fuel-item-value">${estimates.fuelLiters.toFixed(1)} L</div>
        <div class="fuel-item-label">预计油耗</div>
      </div>
      <div>
        <div class="fuel-item-value">¥ ${estimates.fuelCost.toFixed(0)}</div>
        <div class="fuel-item-label">预计油费</div>
      </div>
      <div>
        <div class="fuel-item-value">${formatDuration(estimates.drivingDuration)}</div>
        <div class="fuel-item-label">驾驶时长</div>
      </div>
    </div>
  </div>

  <div class="footer">
    <div class="stamp">✦ 行程已规划 ✦</div>
    <div class="footer-text">—— 愿旅途美好，回忆长存 ——</div>
  </div>
</div>
</body>
</html>`;
}

function buildPrintHTML(
  route: RouteData,
  segments: RouteSegment[],
  estimates: TripEstimates
): string {
  return buildItineraryHTML(route, segments, estimates);
}

export const ExportService = {
  async exportGPX(route: RouteData): Promise<void> {
    const timestamp = generateId();
    const cleanName = sanitizeFilename(route.name || 'route');
    const filename = `${cleanName}_${timestamp}.gpx`;
    const gpxContent = generateGPX(route, route.markers || []);
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml;charset=utf-8' });
    triggerDownload(blob, filename);
  },

  async exportItineraryHTML(
    route: RouteData,
    segments: RouteSegment[],
    estimates: TripEstimates
  ): Promise<void> {
    const timestamp = generateId();
    const cleanName = sanitizeFilename(route.name || 'itinerary');
    const filename = `${cleanName}_行程单_${timestamp}.html`;
    const htmlContent = buildItineraryHTML(route, segments, estimates);
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    triggerDownload(blob, filename);
  },

  async generateThumbnail(mapElement: HTMLElement): Promise<string | null> {
    if (!mapElement) return null;
    try {
      const canvas = await html2canvas(mapElement, {
        backgroundColor: '#E8DCC4',
        scale: 0.5,
        useCORS: true,
        allowTaint: true,
        logging: false
      });
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (e) {
      console.error('Failed to generate thumbnail:', e);
      return null;
    }
  },

  printItinerary(
    route: RouteData,
    segments: RouteSegment[],
    estimates: TripEstimates
  ): void {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      alert('请允许弹窗以打印行程单');
      return;
    }
    const htmlContent = buildPrintHTML(route, segments, estimates);
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }
};
