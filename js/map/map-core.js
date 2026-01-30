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

function focusPoint(lng, lat) {
  state.map.flyTo({
    center: [lng, lat],
    zoom: 16,
    speed: 1.5,
    essential: true,
  });
}

function selectZone(e) {
  // 1. Використовуємо e.point (точність MapLibre), а не clientX
  const currentPoint = e.point;

  // Перераховуємо стартову точку в пікселі (гарантує точність навіть при зміщенні)
  const startPoint = state.map.project(state.selectionStart.lngLat);

  const minX = Math.min(startPoint.x, currentPoint.x);
  const maxX = Math.max(startPoint.x, currentPoint.x);
  const minY = Math.min(startPoint.y, currentPoint.y);
  const maxY = Math.max(startPoint.y, currentPoint.y);

  // Оновлюємо візуал рамки
  state.selectionBoxEl.style.left = minX + 'px';
  state.selectionBoxEl.style.top = minY + 'px';
  state.selectionBoxEl.style.width = maxX - minX + 'px';
  state.selectionBoxEl.style.height = maxY - minY + 'px';

  // === 2. ТОЧНИЙ РОЗРАХУНОК (ГЕКТАРИ) ===
  const label = state.selectionBoxEl.querySelector('.selection-area-label');
  if (label) {
    // Беремо координати середини сторін (це компенсує кривизну Землі)
    const leftMid = state.map.unproject([minX, (minY + maxY) / 2]);
    const rightMid = state.map.unproject([maxX, (minY + maxY) / 2]);
    const topMid = state.map.unproject([(minX + maxX) / 2, minY]);
    const bottomMid = state.map.unproject([(minX + maxX) / 2, maxY]);

    // Рахуємо дистанцію в метрах
    const widthM = leftMid.distanceTo(rightMid);
    const heightM = topMid.distanceTo(bottomMid);

    const area = widthM * heightM;

    // === 3. ФОРМАТУВАННЯ (M² -> HA -> KM²) ===
    let text = '';
    if (area >= 1000000) {
      // Більше 1 км² (1 000 000 м²) -> показуємо км²
      text = (area / 1000000).toFixed(2) + ' km²';
    } else if (area >= 10000) {
      // Більше 1 Гектара (10 000 м²) -> показуємо Гектари (ha)
      // Це прибере "дві тризначні цифри". 500 000 м² стане 50.00 ha
      text = (area / 10000).toFixed(2) + ' ha';
    } else {
      // Менше 1 га -> показуємо метри
      text =
        Math.round(area)
          .toString()
          .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' m²';
    }

    label.innerText = text;
  }
}

// Експортуємо функції для зовнішнього використання
export function startMap(lon, lat) {
  document.getElementById('search-overlay').style.display = 'none';
  document.getElementById('tools').style.display = 'block';

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

    // Scale & Nav Controls
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

  // Події завантаження
  map.on('load', () => {
    addMapLayers(); // Додаємо шари
    loadSavedMarkers(); // Завантажуємо маркери з пам'яті
    AppState.load(); // ВІДНОВЛЕННЯ СТАНУ
  });

  // 1. Кліки (Інструменти)
  map.on('click', (e) => {
    if (state.activeTool) handleToolClick(e.lngLat);
  });

  // 2. Правий клік (Context Menu)
  map.on('contextmenu', (e) => {
    // Якщо ми зараз малюємо компасом (поставили центр, але ще не поставили радіус)
    if (state.activeTool === 'compass' && state.compass.isDrawing) {
      // 1. Зупиняємо малювання
      state.compass.isDrawing = false;
      state.compass.center = null;
      // 2. Очищаємо все (видаляємо точку центру і  коло)
      clearMeasurements();
      // 3. Даємо знати користувачу
      showCopyToast('МАЛЮВАННЯ СКАСОВАНО');
      // 4. Запобігаємо появі стандартного контекстного меню браузера
      e.preventDefault();
    }
  });

  // 3. Подвійний клік (Double Click) - Створення маркерів
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
    updateLiveCoords(e.lngLat); // Оновлення координат в інфобарі

    if (state.activeTool === 'compass' && state.compass.isDrawing) {
      updateCompassVisual(e.lngLat);
    }

    if (state.isSelecting && state.selectionBoxEl) {
      selectZone(e);
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
    panels.forEach((el) => el && (el.style.display = 'none'));
  });
  map.on('moveend', () => {
    panels.forEach((el) => el && (el.style.display = 'block'));

    AppState.save(); // Зберігаємо позицію після руху
  });
}

function updateLiveCoords(lngLat) {
  const coordsDisplay = document.getElementById('live-coords');
  if (!coordsDisplay) return;
  try {
    // Перевірка наявності бібліотеки mgrs
    if (typeof mgrs === 'undefined') {
      coordsDisplay.innerText = `${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`;
      return;
    }
    const mgrsString = mgrs.forward([lngLat.lng, lngLat.lat]);
    // Форматування: 36U VV 12345 67890
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

  // 2. Tools Sources (Ruler & Compass)
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
    // Заливка
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
    // Радіус
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
    // Підпис
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

  // Додатковий шар тіней рельєфу (Hillshade)
  if (!map.getLayer('terrain-helper')) {
    map.addLayer({
      id: 'terrain-helper',
      type: 'hillshade',
      source: 'terrain-data',
      paint: { 'hillshade-exaggeration': 0 }, // Не візуалізуємо тіні, але шар потрібен для роботи 3D
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
