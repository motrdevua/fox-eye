import { state } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { AppState } from '../core/app-state.js';
import { generateId, getAzimuth, formatDistance } from './tools-core.js';
import { showCopyToast } from '../ui/ui-utils.js';

import {
  createCompassMarkerElement,
  getCompassGeoJSON,
  calculateCompassVisual,
} from './compass.js';
import { createRulerMarkerElement, getRulerGeoJSON } from './ruler.js';

// === ДОПОМІЖНІ ФУНКЦІЇ ===
export function clearSidebar() {
  const sidebar = document.getElementById('sidebar');
  const pointsList = document.getElementById('points');

  if (sidebar) sidebar.classList.add('is-hidden');
  if (pointsList) pointsList.innerHTML = '';
}

// === ГОЛОВНИЙ ОБРОБНИК КЛІКІВ ===
export function handleToolClick(lngLat) {
  if (state.activeTool === 'compass') {
    if (state.rulerPoints.length >= 2) clearMeasurements();

    if (!state.compass.isDrawing) {
      state.compass.isDrawing = true;
      state.compass.center = { lng: lngLat.lng, lat: lngLat.lat };
      showCopyToast('ЦЕНТР ВСТАНОВЛЕНО');

      const el = createCompassMarkerElement();
      addPointWrapper(lngLat, el, 'center');
    } else {
      state.compass.isDrawing = false;
      showCopyToast('ЦИРКУЛЬ ЗАФІКСОВАНО');

      const el = createCompassMarkerElement();
      document.body.classList.remove('compass-active-cursor');
      addPointWrapper(lngLat, el, 'center');
    }
  } else if (state.activeTool === 'ruler') {
    const el = createRulerMarkerElement();
    addPointWrapper(lngLat, el, 'bottom');
  }
}

// === УПРАВЛІННЯ ТОЧКАМИ ===

export function addPointWrapper(lngLat, element, anchor) {
  const pointId = generateId();
  state.rulerPoints.push({ id: pointId, coords: [lngLat.lng, lngLat.lat] });

  element.onclick = (e) => e.stopPropagation();
  element.oncontextmenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    removePoint(pointId);
  };

  const m = new maplibregl.Marker({ element, draggable: true, anchor })
    .setLngLat(lngLat)
    .addTo(state.map);

  m.on('drag', () => {
    const newCoords = m.getLngLat();
    const pIdx = state.rulerPoints.findIndex((p) => p.id === pointId);
    if (pIdx !== -1) {
      state.rulerPoints[pIdx].coords = [newCoords.lng, newCoords.lat];
      updateMeasurements();
    }
  });

  state.rulerMarkers.push({ id: pointId, marker: m });

  updateMeasurements();
  AppState.save();
}

export function removePoint(id) {
  const m = state.rulerMarkers.find((m) => m.id === id);
  if (m) m.marker.remove();

  state.rulerMarkers = state.rulerMarkers.filter((m) => m.id !== id);
  state.rulerPoints = state.rulerPoints.filter((p) => p.id !== id);

  if (state.activeTool === 'compass' || state.rulerPoints.length === 0) {
    clearMeasurements();
  } else {
    updateMeasurements();
  }
  AppState.save();
}

export function clearMeasurements() {
  state.rulerMarkers.forEach((item) => {
    const marker = item.marker || item;
    marker.remove();
  });

  state.rulerPoints = [];
  state.rulerMarkers = [];

  clearSidebar();

  const clearGeoJSON = { type: 'FeatureCollection', features: [] };
  const rSrc = state.map.getSource('ruler-source');
  const cSrc = state.map.getSource('compass-arc');

  if (rSrc) rSrc.setData(clearGeoJSON);
  if (cSrc) cSrc.setData(clearGeoJSON);

  state.compass.isDrawing = false;
  state.compass.center = null;

  // ПРИМУСОВЕ ОЧИЩЕННЯ UI
  const sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.add('is-hidden');

  const infoEl = document.getElementById('infobar');
  if (infoEl) {
    infoEl.style.display = 'none'; // Ховаємо
    infoEl.innerText = ''; // Стираємо текст
  }

  localStorage.removeItem('fox-eye-tools');
}

export function addRulerPoint(lngLat) {
  if (state.activeTool === 'compass') {
    const el = createCompassMarkerElement();
    addPointWrapper(lngLat, el, 'center');
  } else {
    const el = createRulerMarkerElement();
    addPointWrapper(lngLat, el, 'bottom');
  }
}

// === ГОЛОВНА ФУНКЦІЯ ОНОВЛЕННЯ ===
export function updateMeasurements() {
  if (typeof turf === 'undefined') return;

  const infoEl = document.getElementById('infobar');
  const sidebar = document.getElementById('sidebar');

  // 1. ЗАВЖДИ СПОЧАТКУ ХОВАЄМО ІНФОБАР (щоб не було "привидів")
  if (infoEl) {
    infoEl.style.display = 'none';
    infoEl.innerText = '';
  }

  // 2. Якщо точок немає - повна зачистка і вихід
  if (state.rulerPoints.length === 0) {
    if (sidebar) sidebar.classList.add('is-hidden');
    const rSrc = state.map.getSource('ruler-source');
    const cSrc = state.map.getSource('compass-arc');
    if (rSrc) rSrc.setData({ type: 'FeatureCollection', features: [] });
    if (cSrc) cSrc.setData({ type: 'FeatureCollection', features: [] });
    return;
  }

  const rSrc = state.map.getSource('ruler-source');
  const cSrc = state.map.getSource('compass-arc');

  // --- ЛОГІКА КОМПАСА ---
  if (state.activeTool === 'compass') {
    if (rSrc) rSrc.setData({ type: 'FeatureCollection', features: [] });
    if (sidebar) sidebar.classList.add('is-hidden');

    if (state.rulerPoints.length >= 2) {
      const geoData = getCompassGeoJSON(state.rulerPoints);
      if (cSrc) cSrc.setData(geoData);

      const start = state.rulerPoints[0].coords;
      const end = state.rulerPoints[1].coords;
      const dist = turf.distance(start, end, { units: 'kilometers' });
      const bearing = turf.bearing(start, end);
      const azimuth = Math.round(bearing < 0 ? bearing + 360 : bearing);

      // Показуємо інфобар ТІЛЬКИ якщо є розрахунок
      if (infoEl) {
        infoEl.innerHTML = `РАДІУС: <span style="color:${CONFIG.colors.yellow}">${formatDistance(dist)}</span> | АЗИМУТ: <span style="color:${CONFIG.colors.yellow}">${azimuth}°</span>`;
        infoEl.style.display = 'block';
      }
    }
    return;
  }

  // --- ЛОГІКА ЛІНІЙКИ ---
  if (cSrc) cSrc.setData({ type: 'FeatureCollection', features: [] });

  const geoJSON = getRulerGeoJSON(state.rulerPoints);
  if (rSrc) rSrc.setData(geoJSON);

  let totalDist = 0;
  geoJSON.features.forEach(
    (f) => (totalDist += turf.length(f, { units: 'kilometers' })),
  );

  // Інфобар для лінійки: показуємо, тільки якщо > 1 точки (є дистанція)
  if (infoEl && state.rulerPoints.length > 1) {
    infoEl.innerHTML = `ЗАГАЛЬНА ДИСТАНЦІЯ: <span style="color:${CONFIG.colors.yellow}">${formatDistance(totalDist)}</span>`;
    infoEl.style.display = 'block';
  }

  // Сайдбар
  if (sidebar) {
    if (state.rulerPoints.length > 1) {
      sidebar.classList.remove('is-hidden');
      sidebar.style.display = 'flex';
    } else {
      sidebar.classList.add('is-hidden');
    }
  }

  // Оновлення маркерів (назв та дистанцій)
  // ВАЖЛИВО: Запускаємо навіть для однієї точки, щоб скинути її назву в "START"
  if (state.rulerPoints.length > 0) {
    const pointsList = document.getElementById('points');
    if (pointsList) pointsList.innerHTML = '';

    state.rulerPoints.forEach((pointData, index) => {
      const markerObj = state.rulerMarkers[index];
      const realMarker = markerObj ? markerObj.marker : null;
      let segmentDist = 0;
      let azimuth = 0;

      if (index !== 0) {
        const prev = state.rulerPoints[index - 1].coords;
        const curr = pointData.coords;
        segmentDist = turf.distance(prev, curr, { units: 'kilometers' });
        azimuth = getAzimuth(prev, curr);
      }

      // Розрахунок поточної суми для списку
      let currentTotal = 0;
      for (let i = 1; i <= index; i++) {
        const p1 = state.rulerPoints[i - 1].coords;
        const p2 = state.rulerPoints[i].coords;
        currentTotal += turf.distance(p1, p2, { units: 'kilometers' });
      }

      // ОНОВЛЕННЯ ВІЗУАЛУ МАРКЕРА
      if (realMarker) {
        const el = realMarker.getElement();
        const label = el.querySelector('.ruler-label');
        const distLabel = el.querySelector('.ruler-label-dist');

        // 1. Оновлюємо ім'я (Точка 1, Точка 2...)
        if (label) label.innerText = `Точка ${index + 1}`;

        // 2. Оновлюємо лейбл дистанції
        if (distLabel) {
          if (index === 0) {
            distLabel.innerText = 'START';
          } else {
            distLabel.innerText = formatDistance(currentTotal);
          }
          distLabel.style.display = 'block';
        }
      }

      // Сайдбар заповнюємо тільки якщо точок > 1
      if (pointsList && state.rulerPoints.length > 1) {
        const coords = pointData.coords;
        let rawMgrs = typeof mgrs !== 'undefined' ? mgrs.forward(coords) : '';
        let formattedMgrs = rawMgrs
          ? rawMgrs.replace(/(.{3})(.{2})(.{5})(.{5})/, '$1 $2 $3 $4')
          : 'N/A';

        const item = document.createElement('div');
        item.className = 'point-item';
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items: baseline; margin-bottom: 4px;">
                <b style="color: var(--color-main);">ТОЧКА ${index + 1}</b>
                <div style="text-align:right;">
                    ${
                      index === 0
                        ? `<span style="background:${CONFIG.colors.main}; color:black; padding:1px 4px; border-radius:2px; font-size:11px; font-weight:bold;">START</span>`
                        : `<span style="color:#000; padding:1px 4px; border-radius:2px; font-size:11px; font-weight:bold; background:${CONFIG.colors.yellow};">
                            ${formatDistance(segmentDist)} <span style="font-size:0.9em">(Σ ${formatDistance(currentTotal)})</span>
                           </span>
                           <span style="color:#000; padding:1px 4px; border-radius:2px; font-size:11px; font-weight:bold; background:${CONFIG.colors.yellow}; margin-left:5px;">${azimuth}°</span>`
                    }
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
        pointsList.appendChild(item);
      }
    });
  }
}

export function updateCompassVisual(currentLngLat) {
  if (!state.compass.center || !currentLngLat) return;
  const data = calculateCompassVisual(state.compass.center, currentLngLat);
  if (!data) return;

  const source = state.map.getSource('compass-arc');
  if (source) source.setData(data);
}
