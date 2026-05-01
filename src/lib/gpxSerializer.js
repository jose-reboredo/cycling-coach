// GPX 1.1 serializer — minimal, no XML library.
// Schema: https://www.topografix.com/GPX/1/1/gpx.xsd
//
// Strava + RWGPS + Komoot accept the output of this. Trackpoints
// optionally carry elevation when ORS returns it.

const HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const GPX_OPEN = '<gpx version="1.1" creator="Cadence Club" xmlns="http://www.topografix.com/GPX/1/1">';
const GPX_CLOSE = '</gpx>';

/**
 * Build a GPX 1.1 string for a single track.
 * @param {object} args
 * @param {string} args.name           Track name shown in the file header
 * @param {Array<[number, number]>} args.points       [[lat, lng], ...]
 * @param {Array<number>} [args.elevations]           Optional, must be same length as points
 */
export function buildGpx({ name, points, elevations }) {
  const safeName = escapeXml(name);
  const useEle = Array.isArray(elevations) && elevations.length === points.length;
  let trkpts = '';
  for (let i = 0; i < points.length; i++) {
    const [lat, lng] = points[i];
    const lat6 = Number(lat).toFixed(6);
    const lng6 = Number(lng).toFixed(6);
    if (useEle) {
      const ele = Number(elevations[i]);
      const eleStr = Number.isFinite(ele) ? ele.toFixed(1) : '0.0';
      trkpts += `<trkpt lat="${lat6}" lon="${lng6}"><ele>${eleStr}</ele></trkpt>`;
    } else {
      trkpts += `<trkpt lat="${lat6}" lon="${lng6}"/>`;
    }
  }
  return [
    HEADER,
    GPX_OPEN,
    `<trk><name>${safeName}</name><trkseg>${trkpts}</trkseg></trk>`,
    GPX_CLOSE,
  ].join('');
}

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
