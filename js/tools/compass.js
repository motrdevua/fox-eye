// js/tools/compass.js
import { CONFIG } from '../core/config.js';
import { formatDistance } from './tools-core.js';

// Повертає HTML елемент маркера
export function createCompassMarkerElement() {
  const el = document.createElement('div');
  el.className = 'compass-marker-dot';
  Object.assign(el.style, {
    width: '14px',
    height: '14px',
    backgroundColor: CONFIG.colors.yellow,
    border: '1px solid #000',
    borderRadius: '50%',
    padding: '0',
    boxSizing: 'border-box',
    pointerEvents: 'auto', // Дозволяє тягати вже поставлену точку
    display: 'block',
  });
  return el;
}

// Повертає GeoJSON для малювання
export function getCompassGeoJSON(points) {
  if (points.length < 2) return { type: 'FeatureCollection', features: [] };

  const start = points[0].coords;
  const end = points[1].coords;

  const dist = turf.distance(start, end, { units: 'kilometers' });
  const distText = formatDistance(dist);

  return {
    type: 'FeatureCollection',
    features: [
      turf.circle(start, dist, { steps: 64, units: 'kilometers' }),
      turf.lineString([start, end], { distanceText: distText }),
    ],
  };
}

// Функція для updateCompassVisual (плавне малювання)
export function calculateCompassVisual(center, currentLngLat) {
  const start = [center.lng, center.lat];
  const end = [currentLngLat.lng, currentLngLat.lat];
  const dist = turf.distance(start, end, { units: 'kilometers' });

  if (dist <= 0.001) return null;
  const distText = formatDistance(dist);

  return {
    type: 'FeatureCollection',
    features: [
      turf.circle(start, dist, { steps: 64, units: 'kilometers' }),
      turf.lineString([start, end], { distanceText: distText }),
    ],
  };
}
