// js/tools/ruler.js
import { CONFIG } from '../core/config.js';
import { formatDistance, getAzimuth } from './tools-core.js';
import { state } from '../core/state.js';
import { showCopyToast } from '../ui/ui-utils.js';

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

// Повертає GeoJSON
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

// Рендерить сайдбар (це можна лишити тут, бо це UI логіка специфічна для лінійки)
export function renderRulerSidebar() {
  if (state.activeTool !== 'ruler' && state.rulerPoints.length === 0) return;
  if (typeof turf === 'undefined') return;

  const sidebar = document.getElementById('sidebar');
  const pointsList = document.getElementById('points');

  if (state.rulerPoints.length < 2) {
    if (sidebar) sidebar.classList.add('is-hidden');
    return;
  }

  if (sidebar) sidebar.classList.remove('is-hidden');
  if (sidebar) sidebar.style.display = 'flex';
  if (pointsList) pointsList.innerHTML = '';

  let totalDist = 0;

  state.rulerPoints.forEach((pointData, index) => {
    const markerWrapper = state.rulerMarkers[index];
    const realMarker =
      markerWrapper && markerWrapper.marker
        ? markerWrapper.marker
        : markerWrapper;

    let segmentDist = '';
    let azimuthText = '';

    if (index !== 0) {
      const prev = state.rulerPoints[index - 1].coords;
      const curr = pointData.coords;
      const dist = turf.distance(prev, curr, { units: 'kilometers' });
      totalDist += dist;
      segmentDist = formatDistance(dist);
      const azimuth = getAzimuth(prev, curr);
      azimuthText = `${azimuth}°`;
    }

    // Оновлення підписів на карті
    if (realMarker && typeof realMarker.getElement === 'function') {
      const el = realMarker.getElement();
      const label = el.querySelector('.ruler-label');
      const distLabel = el.querySelector('.ruler-label-dist');

      if (label) label.innerText = `Точка ${index + 1}`;
      if (distLabel) {
        if (index === 0) distLabel.innerText = 'START';
        else distLabel.innerText = formatDistance(totalDist);
        distLabel.style.display = 'block';
      }
    }

    // MGRS
    const coords = pointData.coords;
    let rawMgrs = '';
    let formattedMgrs = 'N/A';
    if (typeof mgrs !== 'undefined') {
      try {
        rawMgrs = mgrs.forward(coords);
        formattedMgrs = rawMgrs.replace(
          /(.{3})(.{2})(.{5})(.{5})/,
          '$1 $2 $3 $4',
        );
      } catch (e) {}
    }

    const item = document.createElement('div');
    item.className = 'point-item';
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items: baseline; margin-bottom: 4px;">
          <b style="color: var(--color-main);">ТОЧКА ${index + 1}</b>
          <div style="text-align:right;">
             ${index === 0 ? `<span style="background:${CONFIG.colors.main}; color:black; padding:1px 4px; border-radius:2px; font-size:10px; font-weight:bold;">START</span>` : `<span style="color:#000; padding:1px 4px; border-radius:2px; font-size:10px; font-weight:bold;background:${CONFIG.colors.yellow};">DIST: ${segmentDist} <span style="font-size:0.9em">( Σ ${formatDistance(totalDist)} )</span></span><span style="color:#000; padding:1px 4px; border-radius:2px; font-size:10px; font-weight:bold; background:${CONFIG.colors.yellow}; margin-left:5px;">AZ: ${azimuthText}</span>`}
          </div>
      </div>
      <div class="mgrs-copy-zone">
          <span class="coord-text">${formattedMgrs}</span>
          <button class="btn-copy-small">COPY</button>
      </div>`;

    item.querySelector('button').onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(rawMgrs);
      showCopyToast('MGRS СКОПІЙОВАНО');
    };
    item.onclick = () => state.map.flyTo({ center: coords, zoom: 16 });
    if (pointsList) pointsList.appendChild(item);
  });
}
