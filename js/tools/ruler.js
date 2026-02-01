import { CONFIG } from '../core/config.js';
import { formatDistance } from './tools-core.js';

// Повертає HTML елемент маркера
export function createRulerMarkerElement() {
  const el = document.createElement('div');
  el.className = 'ruler-point-wrapper';

  const labelElement = document.createElement('div');
  labelElement.className = 'ruler-label';
  const distLabel = document.createElement('div');
  distLabel.className = 'ruler-label-dist';

  const icon = document.createElement('div');
  icon.innerHTML = `<svg class="ruler-point-svg" viewBox="0 0 24 24" style="width:24px; height:24px; display:block;"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${CONFIG.colors.main}" stroke="${CONFIG.colors.black}"/></svg>`;

  el.appendChild(distLabel);
  el.appendChild(labelElement);
  el.appendChild(icon);

  return el;
}

// Повертає GeoJSON для малювання ліній
export function getRulerGeoJSON(points) {
  const features = [];
  if (points.length < 2) return { type: 'FeatureCollection', features: [] };

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].coords;
    const curr = points[i].coords;
    const line = turf.lineString([prev, curr]);
    const segmentDist = turf.length(line, { units: 'kilometers' });
    line.properties = { distanceText: formatDistance(segmentDist) };
    features.push(line);
  }

  return { type: 'FeatureCollection', features: features };
}
