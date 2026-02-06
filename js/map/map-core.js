import { CONFIG } from '../core/config.js';
import { state } from '../core/state.js';
import { customAlert, showCopyToast } from '../ui/ui-utils.js';
import {
  handleToolClick,
  updateMeasurements,
  clearMeasurements,
  updateCompassVisual,
} from '../tools/measurements.js';
// === НОВЕ: Імпорт обробника Line of Sight ===
import { handleLosClick } from '../tools/los.js';
// ===========================================
import { createMarker, loadSavedMarkers } from './markers.js';
import { AppState } from '../core/app-state.js';
import { Hexagon } from '../ui/hexagon.js';

import { initAstroWidget } from '../tools/astro.js';

function focusPoint(lng, lat) {
  state.map.flyTo({
    center: [lng, lat],
    zoom: 16,
    speed: 1.5,
    essential: true,
  });
}

function selectZone(e) {
  const currentPoint = e.point;
  const startPoint = state.map.project(state.selectionStart.lngLat);

  const minX = Math.min(startPoint.x, currentPoint.x);
  const maxX = Math.max(startPoint.x, currentPoint.x);
  const minY = Math.min(startPoint.y, currentPoint.y);
  const maxY = Math.max(startPoint.y, currentPoint.y);

  state.selectionBoxEl.style.left = minX + 'px';
  state.selectionBoxEl.style.top = minY + 'px';
  state.selectionBoxEl.style.width = maxX - minX + 'px';
  state.selectionBoxEl.style.height = maxY - minY + 'px';

  const label = state.selectionBoxEl.querySelector('.selection-area-label');
  if (label) {
    const leftMid = state.map.unproject([minX, (minY + maxY) / 2]);
    const rightMid = state.map.unproject([maxX, (minY + maxY) / 2]);
    const topMid = state.map.unproject([(minX + maxX) / 2, minY]);
    const bottomMid = state.map.unproject([(minX + maxX) / 2, maxY]);

    const widthM = leftMid.distanceTo(rightMid);
    const heightM = topMid.distanceTo(bottomMid);

    const area = widthM * heightM;

    let text = '';
    if (area >= 1000000) {
      text = (area / 1000000).toFixed(2) + ' km²';
    } else if (area >= 10000) {
      text = (area / 10000).toFixed(2) + ' ha';
    } else {
      text =
        Math.round(area)
          .toString()
          .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' m²';
    }

    label.innerText = text;
  }
}

export function startMap(lon, lat) {
  document.getElementById('search-overlay').style.display = 'none';
  document.getElementById('tools').style.display = 'block';

  Hexagon.stop();

  initAstroWidget();

  if (!state.map) {
    initMap(lon, lat);
  } else {
    focusPoint(lon, lat);
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

    const scale = new maplibregl.ScaleControl({
      maxWidth: 150,
      unit: 'metric',
    });
    state.map.addControl(scale, 'bottom-right');

    const nav = new maplibregl.NavigationControl();
    state.map.addControl(nav, 'top-right');

    setupMapEvents();
  } catch (e) {
    customAlert('Map Error: ' + e.message);
  }
}

function setupMapEvents() {
  const map = state.map;

  map.doubleClickZoom.disable();

  map.on('load', () => {
    addMapLayers();
    loadSavedMarkers();
    AppState.load();
  });

  // === 1. ВИПРАВЛЕНО: Кліки (Розподіл інструментів) ===
  map.on('click', (e) => {
    if (!state.activeTool) return;

    if (state.activeTool === 'los') {
      // Якщо обрано інструмент "Line of Sight", викликаємо його логіку
      handleLosClick(e.lngLat);
    } else {
      // Для "ruler" та "compass" викликаємо стару функцію
      handleToolClick(e.lngLat);
    }
  });
  // ====================================================

  // 2. Правий клік (Context Menu)
  map.on('contextmenu', (e) => {
    if (state.activeTool === 'compass' && state.compass.isDrawing) {
      state.compass.isDrawing = false;
      state.compass.center = null;
      clearMeasurements();
      showCopyToast('МАЛЮВАННЯ СКАСОВАНО');
      e.preventDefault();
    }
  });

  // 3. Подвійний клік
  map.on('dblclick', (e) => {
    if (
      !state.activeTool &&
      !e.originalEvent.target.closest('.marker-wrapper')
    ) {
      createMarker(e.lngLat);
    }
  });

  // 4. Mouse Move
  map.on('mousemove', (e) => {
    updateLiveCoords(e.lngLat);

    if (state.activeTool === 'compass' && state.compass.isDrawing) {
      updateCompassVisual(e.lngLat);
    }

    if (state.isSelecting && state.selectionBoxEl) {
      selectZone(e);
    }
  });

  // 5. Авто-приховування інтерфейсу
  map.on('movestart', () => {
    const tools = document.getElementById('tools');
    const sidebar = document.getElementById('sidebar');
    const infobar = document.getElementById('infobar');

    if (tools) tools.style.display = 'none';
    if (sidebar) sidebar.style.display = 'none';
    if (infobar) infobar.style.display = 'none';
  });

  map.on('moveend', () => {
    const tools = document.getElementById('tools');
    if (tools) tools.style.display = 'block';

    if (state.activeTool === 'ruler' || state.activeTool === 'compass') {
      updateMeasurements();
    } else {
      const sidebar = document.getElementById('sidebar');
      if (sidebar && !sidebar.classList.contains('is-hidden')) {
        sidebar.style.display = 'flex';
      }
    }

    AppState.save();
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
    const formatted = mgrsString.replace(
      /(.{3})(.{2})(.{5})(.{5})/,
      '$1 $2 $3 $4',
    );
    coordsDisplay.innerText = `${formatted}`;
  } catch (err) {
    coordsDisplay.innerText = '---';
  }
}

function addMapLayers() {
  const map = state.map;

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
      layout: {
        visibility: 'none',
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': CONFIG.colors.yellow,
        'line-opacity': 0.6,
        'line-width': ['match', ['get', 'nth_line'], 5, 1.5, 0.6],
      },
    });

  if (!map.getLayer('contour-labels'))
    map.addLayer({
      id: 'contour-labels',
      type: 'symbol',
      source: 'contours',
      'source-layer': 'contour',
      layout: {
        visibility: 'none',
        'symbol-placement': 'line',
        'text-field': ['concat', ['to-string', ['get', 'height']], ' м'],
        'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
        'text-size': 10,
        'symbol-spacing': 350,
      },
      paint: {
        'text-color': CONFIG.colors.yellow,
        'text-halo-color': '#000',
        'text-halo-width': 1,
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

  // Ruler Styles
  if (!map.getLayer('ruler-line')) {
    map.addLayer({
      id: 'ruler-line',
      type: 'line',
      source: 'ruler-source',
      paint: {
        'line-color': CONFIG.colors.main,
        'line-width': 1,
        'line-dasharray': [4, 2],
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
        'symbol-spacing': 250,
        'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
      },
      paint: {
        'text-color': CONFIG.colors.main,
        'text-halo-color': '#000',
        'text-halo-width': 1,
      },
    });
  }
  // Compass Styles
  if (!map.getLayer('compass-line')) {
    map.addLayer({
      id: 'compass-circle',
      type: 'line',
      source: 'compass-arc',
      paint: {
        'line-color': CONFIG.colors.main,
        'line-width': 1,
        'line-dasharray': [4, 2],
      },
    });
    map.addLayer({
      id: 'compass-fill',
      type: 'fill',
      source: 'compass-arc',
      filter: ['==', '$type', 'Polygon'],
      paint: {
        'fill-color': CONFIG.colors.main,
        'fill-opacity': 0.1,
      },
    });
    map.addLayer({
      id: 'compass-line',
      type: 'line',
      source: 'compass-arc',
      paint: {
        'line-color': CONFIG.colors.main,
        'line-width': 1,
        'line-dasharray': [4, 2],
      },
    });
    map.addLayer({
      id: 'compass-labels',
      type: 'symbol',
      source: 'compass-arc',
      layout: {
        'symbol-placement': 'line',
        'text-field': ['get', 'distanceText'],
        'text-size': 12,
        'symbol-spacing': 250,
      },
      paint: {
        'text-color': CONFIG.colors.yellow,
        'text-halo-color': '#000',
        'text-halo-width': 1,
      },
    });
  }

  // === LINE OF SIGHT LAYERS (Це ви вже додали, залишаємо) ===
  if (!map.getSource('los-source')) {
    map.addSource('los-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getLayer('los-line')) {
    map.addLayer({
      id: 'los-line',
      type: 'line',
      source: 'los-source',
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 2,
        'line-opacity': 0.8,
      },
    });
  }

  if (!map.getLayer('los-obstacle')) {
    map.addLayer({
      id: 'los-obstacle',
      type: 'circle',
      source: 'los-source',
      filter: ['==', 'isObstacle', true],
      paint: {
        'circle-radius': 6,
        'circle-color': CONFIG.colors.red,
        'circle-stroke-width': 1,
        'circle-stroke-color': CONFIG.colors.black,
      },
    });
  }

  if (!map.getLayer('terrain-helper')) {
    map.addLayer({
      id: 'terrain-helper',
      type: 'hillshade',
      source: 'terrain-data',
      paint: { 'hillshade-exaggeration': 0 },
    });
  }
}

export function toggleMapStyle() {
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
  const map = state.map;
  const vis = map.getLayoutProperty('contour-lines', 'visibility');
  const next = vis === 'visible' ? 'none' : 'visible';
  map.setLayoutProperty('contour-lines', 'visibility', next);
  map.setLayoutProperty('contour-labels', 'visibility', next);
  if (next === 'visible') showCopyToast('ІЗОГІПСИ УВІМКНЕНО');
  return next === 'visible';
}
