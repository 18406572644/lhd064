import type { RouteData, MarkerData } from '@/types';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateGPX(route: RouteData, markers: MarkerData[]): string {
  const now = new Date().toISOString();
  const routeName = escapeXml(route.name || '未命名路线');
  const routeDesc = escapeXml(route.description || '');
  const createdTime = route.createdAt ? new Date(route.createdAt).toISOString() : now;

  const trkpts = markers.map(m => {
    const name = escapeXml(m.name || '');
    return `      <trkpt lat="${m.lat}" lon="${m.lng}">
        <name>${name}</name>
        <ele>0</ele>
        <time>${createdTime}</time>
      </trkpt>`;
  }).join('\n');

  const wpts = markers.map(m => {
    const name = escapeXml(m.name || '');
    const note = escapeXml(m.note || '');
    return `  <wpt lat="${m.lat}" lon="${m.lng}">
    <name>${name}</name>
    <desc>${note}</desc>
    <sym>${m.type}</sym>
    <type>${m.type}</type>
    <extensions>
      <marker:type>${m.type}</marker:type>
      <marker:id>${m.id}</marker:id>
      ${m.stayDuration ? `<marker:stayDuration>${m.stayDuration}</marker:stayDuration>` : ''}
      ${m.arrivalTime ? `<marker:arrivalTime>${escapeXml(m.arrivalTime)}</marker:arrivalTime>` : ''}
    </extensions>
  </wpt>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"
     creator="Vintage Roadtrip Planner"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xmlns:marker="http://vintage-roadtrip.local/extensions/marker"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${routeName}</name>
    <desc>${routeDesc}</desc>
    <time>${createdTime}</time>
    <bounds>
    </bounds>
  </metadata>
${wpts}
  <trk>
    <name>${routeName}</name>
    <desc>${routeDesc}</desc>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}
