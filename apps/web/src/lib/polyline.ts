// Google polyline decoder. Strava returns the route as an encoded string in
// `map.summary_polyline` / `map.polyline`. This decodes it to [lat, lng] pairs
// and projects to a viewBox for inline-SVG rendering. ~25 lines of math.

export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

export interface PolylineSvg {
  d: string;
  viewBox: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export function polylineToSvg(encoded: string, width = 280, height = 140): PolylineSvg | null {
  if (!encoded) return null;
  const pts = decodePolyline(encoded);
  if (pts.length < 2) return null;

  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const padding = 8;
  const w = width - padding * 2;
  const h = height - padding * 2;
  const dLat = maxLat - minLat || 1e-6;
  const dLng = maxLng - minLng || 1e-6;
  // Preserve aspect — fit within viewBox without distorting bearings (rough Mercator)
  const scale = Math.min(w / dLng, h / dLat);
  const offsetX = (width - dLng * scale) / 2;
  const offsetY = (height - dLat * scale) / 2;

  const project = ([la, ln]: [number, number]) => ({
    x: offsetX + (ln - minLng) * scale,
    // Latitude grows north → invert Y axis for SVG
    y: offsetY + (maxLat - la) * scale,
  });

  const projected = pts.map(project);
  const d = projected
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  return {
    d,
    viewBox: `0 0 ${width} ${height}`,
    start: projected[0]!,
    end: projected[projected.length - 1]!,
  };
}
