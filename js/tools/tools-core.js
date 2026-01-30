export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

export function getAzimuth(start, end) {
  if (typeof turf === 'undefined') return 0;
  let bearing = turf.bearing(start, end);
  if (bearing < 0) bearing += 360;
  return Math.round(bearing);
}

export function formatDistance(km) {
  if (km < 1) return Math.round(km * 1000) + ' м';
  return km.toFixed(2) + ' км';
}
