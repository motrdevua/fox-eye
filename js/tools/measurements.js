// js/tools/measurements.js
import { state } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { AppState } from '../core/app-state.js';
import { generateId, getAzimuth, formatDistance } from './tools-core.js';
import { showCopyToast } from '../ui/ui-utils.js';

// Імпортуємо рендерери
import {
  createCompassMarkerElement,
  getCompassGeoJSON,
  calculateCompassVisual,
} from './compass.js';
import {
  createRulerMarkerElement,
  getRulerGeoJSON,
  renderRulerSidebar,
} from './ruler.js';

// === ГОЛОВНИЙ ОБРОБНИК КЛІКІВ ===
export function handleToolClick(lngLat) {
  if (state.activeTool === 'compass') {
    if (state.rulerPoints.length >= 2) clearMeasurements();

    if (!state.compass.isDrawing) {
      // Старт
      state.compass.isDrawing = true;
      state.compass.center = { lng: lngLat.lng, lat: lngLat.lat };
      showCopyToast('ЦЕНТР ВСТАНОВЛЕНО');

      const el = createCompassMarkerElement();
      addPointWrapper(lngLat, el, 'center');
    } else {
      // Фініш
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

// === УПРАВЛІННЯ ТОЧКАМИ (STATE MUTATION) ===

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
      updateMeasurements(); // Оновлюємо графіку при перетягуванні
    }
  });

  state.rulerMarkers.push({ id: pointId, marker: m });

  updateMeasurements(); // Оновлюємо графіку одразу
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

  const clearGeoJSON = { type: 'FeatureCollection', features: [] };
  const rSrc = state.map.getSource('ruler-source');
  const cSrc = state.map.getSource('compass-arc');

  if (rSrc) rSrc.setData(clearGeoJSON);
  if (cSrc) cSrc.setData(clearGeoJSON);

  state.compass.isDrawing = false;
  state.compass.center = null;

  // Очищення UI
  clearSidebar();
  clearInfobar();

  localStorage.removeItem('fox-eye-tools');
}

export function clearSidebar() {
  const sidebar = document.getElementById('sidebar');
  const pointsList = document.getElementById('points');

  if (sidebar) sidebar.style.display = 'none';
  if (pointsList) pointsList.innerHTML = '';
}

export function clearInfobar() {
  const infobar = document.getElementById('infobar');
  if (infobar) infobar.innerHTML = '';
  if (infobar) infobar.style.display = 'none';
}

// === ФУНКЦІЯ ДЛЯ AppState.load (Сумісність) ===
export function addRulerPoint(lngLat) {
  // Автовизначення типу точки на основі активного інструменту
  // або дефолт (Лінійка), якщо завантажуємось
  if (state.activeTool === 'compass') {
    const el = createCompassMarkerElement();
    addPointWrapper(lngLat, el, 'center');
  } else {
    const el = createRulerMarkerElement();
    addPointWrapper(lngLat, el, 'bottom');
  }
}

// === ОНОВЛЕННЯ ГРАФІКИ (ЕКСПОРТУЄТЬСЯ ДЛЯ Map-Core) ===
export function updateMeasurements() {
  if (typeof turf === 'undefined') return;

  const rSrc = state.map.getSource('ruler-source');
  const cSrc = state.map.getSource('compass-arc');
  const infobar = document.getElementById('infobar');

  if (state.activeTool === 'compass') {
    // Логіка Компаса
    if (rSrc) rSrc.setData({ type: 'FeatureCollection', features: [] });
    if (cSrc) cSrc.setData(getCompassGeoJSON(state.rulerPoints));

    // Інфобар Компаса
    if (state.rulerPoints.length >= 2) {
      const start = state.rulerPoints[0].coords;
      const end = state.rulerPoints[1].coords;
      const dist = turf.distance(start, end, { units: 'kilometers' });
      const bearing = turf.bearing(start, end);
      const azimuth = Math.round(bearing < 0 ? bearing + 360 : bearing);
      if (infobar) {
        infobar.style.display = 'block';
        infobar.innerHTML = `РАДІУС: <span style="color:${CONFIG.colors.yellow}">${formatDistance(dist)}</span> | АЗИМУТ: <span style="color:${CONFIG.colors.yellow}">${azimuth}°</span>`;
      }
    }
  } else {
    // Логіка Лінійки
    if (cSrc) cSrc.setData({ type: 'FeatureCollection', features: [] });

    const geoJSON = getRulerGeoJSON(state.rulerPoints);
    if (rSrc) rSrc.setData(geoJSON);

    // Інфобар Лінійки
    if (infobar) {
      // Рахуємо загальну дистанцію для інфобару
      let total = 0;
      geoJSON.features.forEach(
        (f) => (total += turf.length(f, { units: 'kilometers' })),
      );

      if (state.rulerPoints.length > 1) {
        infobar.style.display = 'block';
        infobar.innerHTML = `ЗАГАЛЬНА ДИСТАНЦІЯ: <span style="color:${CONFIG.colors.yellow}">${formatDistance(total)}</span>`;
      } else {
        infobar.style.display = 'none';
      }
    }
    renderRulerSidebar();
  }
}

// === ВІЗУАЛ ПРИ РУСІ МИШІ ===
export function updateCompassVisual(currentLngLat) {
  if (!state.compass.center || !currentLngLat) return;

  // Викликаємо чистий рендерер з compass.js
  const data = calculateCompassVisual(state.compass.center, currentLngLat);
  if (!data) return;

  const source = state.map.getSource('compass-arc');
  if (source) source.setData(data);
}
