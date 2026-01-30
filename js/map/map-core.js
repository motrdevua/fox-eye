import { CONFIG } from '../core/config.js';
import { state } from '../core/state.js';
import { customAlert, showCopyToast } from '../ui/ui-utils.js';
import {
  handleToolClick,
  updateMeasurements,
  clearMeasurements,
} from '../tools/measurements.js';
import { createMarker, loadSavedMarkers } from './markers.js';
import { AppState } from '../core/app-state.js';
import { updateCompassVisual } from '../tools/measurements.js';

// Експортуємо функції для зовнішнього використання
export function startMap(lon, lat) {
  document.getElementById('search-overlay').style.display = 'none';
  document.getElementById('tools').style.display = 'block';

  if (!state.map) {
    initMap(lon, lat);
  } else {
    state.map.flyTo({ center: [lon, lat], zoom: 14 });
  }
}

function initMap(lon, lat) {
  if (typeof maplibregl === 'undefined') return customAlert('MapLibre Error');

  const baseStyle = {
    version: 8,
    glyphs: `${CONFIG.urls.glyphs}?key=${CONFIG.apiKey}`,
    sources: {
      'google-satellite': {
        type: 'raster',
        tiles: [CONFIG.urls.satellite],
        tileSize: 256,
      },
      'topo-map': {
        type: 'raster',
        tiles: [CONFIG.urls.topo],
        tileSize: 256,
        attribution: '© OpenTopoMap',
      },
      'terrain-data': {
        type: 'raster-dem',
        url: `${CONFIG.urls.terrain}?key=${CONFIG.apiKey}`,
        tileSize: 512,
        encoding: 'mapbox',
      },
    },
    layers: [
      {
        id: 'topo',
        type: 'raster',
        source: 'topo-map',
        layout: { visibility: 'none' },
      },
      {
        id: 'sat',
        type: 'raster',
        source: 'google-satellite',
        layout: { visibility: 'visible' },
      },
    ],
    terrain: { source: 'terrain-data', exaggeration: 1.0 },
  };

  try {
    state.map = new maplibregl.Map({
      container: 'map',
      center: [lon, lat],
      zoom: 13,
      style: baseStyle,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });

    // Scale & Nav Controls
    state.map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 150, unit: 'metric' }),
      'bottom-right',
    );
    state.map.addControl(new maplibregl.NavigationControl(), 'top-right');

    setupMapEvents();
  } catch (e) {
    customAlert('Map Error: ' + e.message);
  }
}

function setupMapEvents() {
  const map = state.map;

  map.on('load', () => {
    addMapLayers();
    loadSavedMarkers();
    AppState.load(); // ВІДНОВЛЕННЯ СТАНУ
  });

  // 1. Кліки (Інструменти)
  map.on('click', (e) => {
    if (state.activeTool) handleToolClick(e.lngLat);
  });

  // 2. Правий клік (Context Menu) - Скасування малювання циркуля
  map.on('contextmenu', (e) => {
    if (state.activeTool === 'compass' && state.compass.isDrawing) {
      state.compass.isDrawing = false;
      state.compass.center = null;
      clearMeasurements();
      showCopyToast('МАЛЮВАННЯ СКАСОВАНО');
      e.preventDefault();
    }
  });

  // 3. Double Click (Створення маркерів)
  map.doubleClickZoom.disable();
  map.on('dblclick', (e) => {
    if (
      !state.activeTool &&
      !e.originalEvent.target.closest('.marker-wrapper')
    ) {
      createMarker(e.lngLat);
    }
  });

  // 4. Mouse Move (Координати + Візуал циркуля + UI)
  map.on('mousemove', (e) => {
    updateLiveCoords(e.lngLat);

    if (state.activeTool === 'compass' && state.compass.isDrawing) {
      updateCompassVisual(e.lngLat); // <--- ОСЬ ВОНО
    }

    if (state.isSelecting && state.selectionBoxEl) {
      // Виклик імпортується зі сканера?
      // В модульному коді ми це винесли в document/map listener в app.js,
      // але для вірності можна і тут, хоча app.js вже обробляє це.
      // В app.js ми додали mapContainer.addEventListener('mousemove', handleScanMove);
      // Тому тут дублювати не треба.
    }
  });

  // 5. Авто-приховування інтерфейсу (ВІДНОВЛЕНО)
  const panels = [
    document.getElementById('tools'),
    document.getElementById('sidebar'),
    document.getElementById('infobar'),
  ];
  map.on('movestart', () => {
    panels.forEach((el) => el && el.classList.add('is-hidden'));
  });
  map.on('moveend', () => {
    panels.forEach((el) => el && el.classList.remove('is-hidden'));
    AppState.save(); // Зберігаємо позицію після руху
  });
}

function updateLiveCoords(lngLat) {
  const coordsDisplay = document.getElementById('live-coords');
  if (!coordsDisplay) return;
  try {
    if (typeof mgrs === 'undefined') {
      coordsDisplay.innerText = `${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`;
      return;
    }
    const mgrsString = mgrs.forward([lngLat.lng, lngLat.lat]);
    coordsDisplay.innerText = mgrsString.replace(
      /(.{3})(.{2})(.{5})(.{5})/,
      '$1 $2 $3 $4',
    );
  } catch (err) {
    coordsDisplay.innerText = '---';
  }
}

function addMapLayers() {
  const map = state.map;
  // ... (код додавання шарів ruler, compass, contours ідентичний попередньому кроку) ...
  // Вставте сюди код функції addMapLayers з моєї попередньої відповіді (про ізогіпси)
  // Я не дублюю його тут, щоб зекономити місце, але він має бути повним.

  // ПОВТОРЮ КОД ШАРІВ ДЛЯ ПОВНОТИ КАРТИНИ:
  if (!map.getSource('contours'))
    map.addSource('contours', {
      type: 'vector',
      url: `${CONFIG.urls.contours}?key=${CONFIG.apiKey}`,
    });
  if (!map.getLayer('contour-lines'))
    map.addLayer({
      id: 'contour-lines',
      type: 'line',
      source: 'contours',
      'source-layer': 'contour',
      layout: { visibility: 'none', 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': CONFIG.colors.yellow,
        'line-width': 1,
        'line-opacity': 0.5,
      },
    });

  if (!map.getSource('ruler-source'))
    map.addSource('ruler-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  if (!map.getSource('compass-arc'))
    map.addSource('compass-arc', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

  if (!map.getLayer('ruler-line')) {
    map.addLayer({
      id: 'ruler-line',
      type: 'line',
      source: 'ruler-source',
      paint: {
        'line-color': CONFIG.colors.main,
        'line-width': 2,
        'line-dasharray': [2, 1],
      },
    });
    map.addLayer({
      id: 'ruler-labels',
      type: 'symbol',
      source: 'ruler-source',
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'distanceText'],
        'text-size': 12,
        'text-offset': [0, -1],
      },
      paint: {
        'text-color': CONFIG.colors.yellow,
        'text-halo-color': '#000',
        'text-halo-width': 2,
      },
    });
  }
  if (!map.getLayer('compass-line')) {
    map.addLayer({
      id: 'compass-line',
      type: 'line',
      source: 'compass-arc',
      paint: {
        'line-color': CONFIG.colors.yellow,
        'line-width': 2,
        'line-dasharray': [2, 1],
      },
    });
    map.addLayer({
      id: 'compass-fill',
      type: 'fill',
      source: 'compass-arc',
      paint: { 'fill-color': CONFIG.colors.yellow, 'fill-opacity': 0.1 },
    });
    map.addLayer({
      id: 'compass-labels',
      type: 'symbol',
      source: 'compass-arc',
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'distanceText'],
        'text-size': 12,
      },
      paint: {
        'text-color': CONFIG.colors.yellow,
        'text-halo-color': '#000',
        'text-halo-width': 2,
      },
    });
  }
}

export function toggleMapStyle() {
  /* ... код з попередніх відповідей ... */
  const map = state.map;
  const isSat = map.getLayoutProperty('sat', 'visibility') === 'visible';
  if (isSat) {
    map.setLayoutProperty('sat', 'visibility', 'none');
    map.setLayoutProperty('topo', 'visibility', 'visible');
    showCopyToast('ТОПОГРАФІЧНА МАПА');
    return true;
  } else {
    map.setLayoutProperty('topo', 'visibility', 'none');
    map.setLayoutProperty('sat', 'visibility', 'visible');
    showCopyToast('СУПУТНИК');
    return false;
  }
}

export function toggleContours() {
  /* ... код з попередніх відповідей ... */
  const map = state.map;
  const vis = map.getLayoutProperty('contour-lines', 'visibility');
  const next = vis === 'visible' ? 'none' : 'visible';
  map.setLayoutProperty('contour-lines', 'visibility', next);
  if (next === 'visible') showCopyToast('ІЗОГІПСИ УВІМКНЕНО');
  return next === 'visible';
}
