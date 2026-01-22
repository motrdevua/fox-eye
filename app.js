// 1. КОНФІГУРАЦІЯ (Кольори, Ключі, Налаштування)
const CONFIG = {
  apiKey: '39vWsRU1aZVglDrRNJUv', // Зібраний ключ
  colors: {
    main: '#00ff00',
    accent: '#ff0000',
    accentYellow: '#ffff00',
    yellow: '#ffcc00',
    black: '#000000',
  },
  urls: {
    glyphs: 'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf',
    satellite: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    topo: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    terrain: 'https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json',
    contours: 'https://api.maptiler.com/tiles/contours/tiles.json',
  },
};

// 2. СТАН ПРОГРАМИ (Всі змінні, що змінюються)
const state = {
  map: null,
  markerCount: 0,
  markersData: [],
  activeTool: null, // 'ruler', 'compass', 'scan', 'scan_results'

  // Інструменти вимірювання
  rulerPoints: [], // Масив координат {id, coords}
  rulerMarkers: [], // Масив об'єктів маркерів на карті
  scanMarkers: [],

  // Виділення
  isSelecting: false,
  selectionStart: null, // {x, y, lngLat}
  selectionBoxEl: null, // DOM елемент

  // Циркуль
  compass: {
    center: null,
    isDrawing: false,
    lastUpdate: 0,
  },
};

// 3. ІКОНКИ
const ICONS = {
  launch: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style="margin-right:8px"><path d="M12,2L4.5,20.29L5.21,21L12,18L18.79,21L19.5,20.29L12,2Z"/></svg>`,
  reset: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-right:8px"><path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z"/></svg>`,
  clear: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" style="margin-right:8px"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19V4M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/></svg>`,
  ruler: `<svg viewBox="0 0 24 24"><path d="M7,2H17A2,2 0 0,1 19,4V20A2,2 0 0,1 17,22H7A2,2 0 0,1 5,20V4A2,2 0 0,1 7,2M7,4V6H10V8H7V10H12V12H7V14H10V16H7V18H12V20H17V4H7Z"/></svg>`,
  compass: `<svg viewBox="0 0 24 24"><path d="M12,2A1,1 0 0,1 13,3A1,1 0 0,1 12,4A1,1 0 0,1 11,3A1,1 0 0,1 12,2M9.2,5.2L10.5,5.2L11,8.1L11.5,5.2L12.8,5.2L13.3,8.1L13.8,5.2L15.1,5.2L13.6,15H15V17H13.3L12.8,20.2L12.5,22H11.5L11.2,20.2L10.7,17H9V15H10.4L8.9,5.2M12,9L11.5,12H12.5L12,9Z"/></svg>`,
  scan: `<svg viewBox="0 0 24 24"><path d="M14,6L10.25,11L13.1,14.8L11.5,16C9.81,13.75 7,10 7,10L1,18H23L14,6Z"/></svg>`,
  map: `<svg viewBox="0 0 24 24" style="width: 20px; height: 20px"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z"/></svg>`,
  izogips: `<svg viewBox="0 0 24 24" width="24" height="24"><path d="M3.5 18.5L9.5 12.5L13.5 16.5L20.5 9.5" fill="none" stroke="#00ff00" stroke-width="2" stroke-linecap="round"/><path d="M3.5 12.5L9.5 6.5L13.5 10.5L20.5 3.5" fill="none" stroke="#00ff00" stroke-width="2" stroke-linecap="round"/></svg>`,
  print: `<svg viewBox="0 0 24 24" style="width: 20px; height: 20px"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>`,
};

// --- UI ТА HELPER ФУНКЦІЇ ---

function injectIcons() {
  document.querySelectorAll('[data-icon]').forEach((el) => {
    const k = el.getAttribute('data-icon');
    if (ICONS[k]) el.innerHTML += ` ` + ICONS[k];
  });
}

function showCopyToast(text) {
  let toast = document.getElementById('copy-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'copy-toast';
    toast.className = 'copy-toast';
    document.body.appendChild(toast);
  }
  toast.innerText = text;
  toast.className = 'copy-toast modal-success';
  toast.style.display = 'block';

  // Плавне зникнення через 2 секунди
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.style.display = 'none';
      toast.style.opacity = '1';
    }, 300);
  }, 2000);
}

function customPrompt(text, defaultValue) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-prompt');
    const input = document.getElementById('modal-prompt-input');
    const content = modal.querySelector('.modal-content');

    // Стилізація
    content.classList.add('modal-success');
    document.getElementById('modal-prompt-text').innerText = text;
    input.value = defaultValue;

    // Відкриття
    modal.style.display = 'flex';
    setTimeout(() => {
      modal.classList.add('active');
      input.focus();
    }, 10);

    const closePrompt = (result) => {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
        resolve(result);
      }, 100);
    };

    // Очищення старих лістенерів через клонування кнопок
    const okBtn = document.getElementById('modal-prompt-ok');
    const cancelBtn = document.getElementById('modal-prompt-cancel');

    const newOk = okBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);

    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    // Прив'язка нових подій
    newOk.onclick = () => closePrompt(input.value);
    newCancel.onclick = () => closePrompt(null);

    input.onkeydown = (e) => {
      if (e.key === 'Enter') closePrompt(input.value);
      if (e.key === 'Escape') closePrompt(null);
    };
  });
}

function customAlert(text) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-alert');
    const content = modal.querySelector('.modal-content');
    document.getElementById('modal-alert-text').innerText = text;
    content.classList.add('modal-error');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);

    const btn = document.getElementById('modal-alert-ok');
    const newBtn = btn.cloneNode(true); // Видаляємо старі лістенери
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.onclick = () => {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
        content.classList.remove('modal-error');
        resolve();
      }, 100);
    };
  });
}

function updatePlaceholder() {
  const input = document.getElementById('search-input');
  const typeEl = document.querySelector('input[name="search-type"]:checked');
  if (!input || !typeEl) return;

  const isCity = typeEl.value === 'city';
  input.value = '';
  input.placeholder = isCity ? 'ВВЕДІТЬ НАЗВУ НП...' : '36U VV 12345 67890';
  input.oninput = isCity ? null : handleMgrsMask;
}

function handleMgrsMask(e) {
  if (e.inputType === 'deleteContentBackward') return;
  const input = e.target;
  let val = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (val.length > 3) val = val.substring(0, 3) + ' ' + val.substring(3);
  if (val.length > 6) val = val.substring(0, 6) + ' ' + val.substring(6);
  input.value = val;
}

function clearSidebar() {
  const listEl = document.getElementById('points-list');
  const sidebar = document.getElementById('results-sidebar');
  if (listEl) listEl.innerHTML = '';
  if (sidebar) sidebar.style.display = 'none';
}

// --- MAP CORE ---

function startMap(lon, lat) {
  document.getElementById('search-overlay').style.display = 'none';
  document.getElementById('map-controls').style.display = 'block';

  if (!state.map) {
    initMap(lon, lat);
    initButtons();
  } else {
    focusPoint(lon, lat);
  }
}

function initMap(lon, lat) {
  if (typeof maplibregl === 'undefined') return customAlert('MapLibre Error');
  injectIcons();

  const baseStyle = {
    version: 8,
    glyphs: CONFIG.urls.glyphs.replace('{key}', CONFIG.apiKey),
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
    });
    setupMapEvents();
  } catch (e) {
    customAlert('Map Error: ' + e.message);
  }
}

// Функція для відображення координат курсора в реальному часі
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
    coordsDisplay.innerText = `MGRS: ${formatted}`;
  } catch (err) {
    coordsDisplay.innerText = '---';
  }
}

function addMapLayers() {
  const map = state.map;
  if (!map.getSource('terrain-data')) return;

  // --- 1. ШАР РЕЛЬЄФУ (ІЗОГІПСИ) ---
  map.addSource('contours', {
    type: 'vector',
    url: `${CONFIG.urls.contours}?key=${CONFIG.apiKey}`,
  });
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
      'line-color': CONFIG.colors.accentYellow,
      'line-opacity': 0.6,
      'line-width': ['match', ['get', 'nth_line'], 5, 1.5, 0.6],
    },
  });

  map.addLayer({
    id: 'contour-labels',
    type: 'symbol',
    source: 'contours',
    'source-layer': 'contour',
    layout: {
      visibility: 'none',
      'symbol-placement': 'line',
      'text-field': ['concat', ['to-string', ['get', 'height']], ' м'],
      // 'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
      'text-size': 10,
      'symbol-spacing': 350,
    },
    paint: {
      'text-color': CONFIG.colors.accentYellow,
      'text-halo-color': '#000',
      'text-halo-width': 1,
    },
  });

  // 2. Tools Sources (Ruler & Compass)
  map.addSource('ruler-source', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
  map.addSource('compass-arc', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  // Ruler Styles
  map.addLayer({
    id: 'ruler-layer-line',
    type: 'line',
    source: 'ruler-source',
    paint: {
      'line-color': `${CONFIG.colors.main}`,
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
      // 'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
      'text-size': 12,
      'symbol-spacing': 250,
    },
    paint: {
      'text-color': CONFIG.colors.main,
      'text-halo-color': CONFIG.colors.black,
      'text-halo-width': 1,
    },
  });

  // Compass Styles
  // Заливка кола
  map.addLayer({
    id: 'compass-circle-fill',
    type: 'fill',
    source: 'compass-arc',
    filter: ['==', '$type', 'Polygon'],
    paint: {
      'fill-color': CONFIG.colors.main,
      'fill-opacity': 0.1,
    },
  });

  // Контур кола
  map.addLayer({
    id: 'compass-circle-layer',
    type: 'line',
    source: 'compass-arc',
    paint: {
      'line-color': CONFIG.colors.main,
      'line-width': 1,
      'line-dasharray': [4, 2],
    },
  });

  // Лінія радіуса
  map.addLayer({
    id: 'compass-radius-line',
    type: 'line',
    source: 'compass-arc',
    filter: ['==', '$type', 'LineString'],
    paint: {
      'line-color': CONFIG.colors.main,
      'line-width': 1,
      'line-dasharray': [4, 2],
    },
  });

  // Підпис радіуса
  map.addLayer({
    id: 'compass-radius-labels',
    type: 'symbol',
    source: 'compass-arc',
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'distanceText'],
      // 'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
      'text-size': 12,
      'symbol-spacing': 250,
    },
    paint: {
      'text-color': CONFIG.colors.accentYellow,
      'text-halo-color': CONFIG.colors.black,
      'text-halo-width': 1,
    },
  });

  // Додатковий шар тіней рельєфу (Hillshade)
  map.addLayer({
    id: 'terrain-helper',
    type: 'hillshade',
    source: 'terrain-data',
    paint: { 'hillshade-exaggeration': 0 }, // Не візуалізуємо тіні, але шар потрібен для роботи 3D
  });
}

function setupMapEvents() {
  const map = state.map;
  if (!map) return;
  map.addControl(new maplibregl.NavigationControl());
  map.doubleClickZoom.disable();

  map.on('load', () => {
    addMapLayers(); // Додаємо шари
    loadSavedMarkers(); // Завантажуємо маркери з пам'яті
  });

  // 2. Клік (Click) - Тільки для інструментів (Лінійка/Циркуль)
  map.on('click', (e) => (state.activeTool ? handleToolClick(e.lngLat) : null));

  // 3. Подвійний клік (Double Click) - Створення маркерів
  map.on('dblclick', (e) => {
    if (!state.activeTool && !e.originalEvent.target.closest('.marker-wrapper'))
      createMarker(e.lngLat);
  });

  // 4. Рух миші (MouseMove) - Циркуль та MGRS
  map.on('mousemove', (e) => {
    if (state.activeTool === 'compass' && state.compass.isDrawing)
      updateCompassVisual(e.lngLat);
    updateLiveCoords(e.lngLat);
  });

  // 5. Авто-приховування інтерфейсу при русі карти
  const ui = [
    document.getElementById('map-controls'),
    document.getElementById('results-sidebar'),
    document.getElementById('distance-info'),
  ];

  map.on('movestart', () =>
    ui.forEach((el) => el && el.classList.add('interface-hidden')),
  );
  map.on('moveend', () =>
    ui.forEach((el) => el && el.classList.remove('interface-hidden')),
  );

  // 6. Логіка SCAN (Виділення області) - Native DOM events
  const canvas = map.getCanvas();
  canvas.addEventListener('mousedown', handleScanStart);
  canvas.addEventListener('mousedown', function () {
    ui.forEach((el) => el && el.classList.add('interface-hidden'));
  });
  canvas.addEventListener('mouseup', handleScanEnd);
  canvas.addEventListener('mouseup', function () {
    ui.forEach((el) => el && el.classList.remove('interface-hidden'));
  });
  canvas.addEventListener('mousemove', handleScanMove);
}

// --- ЛОГІКА ІНСТРУМЕНТІВ ---

function setActiveTool(tool) {
  const prevTool = state.activeTool;

  // Очищення UI
  document.body.classList.remove('compass-active-cursor');
  if (state.selectionBoxEl) state.selectionBoxEl.style.display = 'none';

  // Якщо інструмент змінився - скидаємо старі виміри
  if (tool !== null && tool !== prevTool) {
    clearSidebar();
    clearRuler();
    // Якщо вмикаємо щось інше, ніж Scan - очищаємо результати сканування
    if (tool !== 'scan_results') clearScanResults();
  }

  document
    .querySelectorAll('.icon-btn')
    .forEach((b) => b.classList.remove('active'));

  // Логіка Toggle (вимкнення при повторному кліку)
  if (tool === prevTool) {
    state.activeTool = null;
    document.getElementById('distance-info').style.display = 'none';
  } else {
    state.activeTool = tool;

    // Підсвітка кнопок
    const btnMap = {
      ruler: 'ruler-btn-1',
      compass: 'ruler-btn-2',
      scan: 'ruler-btn-3',
    };

    if (btnMap[tool]) {
      const btn = document.getElementById(btnMap[tool]);
      if (btn) btn.classList.add('active');
    }

    // Інфо-панель
    const infoBox = document.getElementById('distance-info');
    infoBox.style.display = 'block';

    if (tool === 'compass' || tool === 'ruler')
      document.body.classList.add('compass-active-cursor');

    const msgs = {
      scan: 'ЗАТИСНІТЬ ТА ТЯГНІТЬ',
      compass: 'ОБЕРІТЬ ЦЕНТР',
      default: '...',
    };
    infoBox.innerText = msgs[tool] || msgs['default'];
  }
}

function addRulerPoint(lngLat) {
  // 1. ЛОГІКА ДЛЯ ЦИРКУЛЯ: Очищення перед початком НОВОГО кола
  if (state.activeTool === 'compass' && state.rulerPoints.length >= 2)
    clearRuler();

  const pointId = Date.now();
  state.rulerPoints.push({ id: pointId, coords: [lngLat.lng, lngLat.lat] });

  // Створення маркера
  const el = document.createElement('div');
  el.className = 'ruler-point-wrapper';
  let anchor = 'bottom';

  let labelElement = document.createElement('div');
  let distLabel = document.createElement('div');
  const icon = document.createElement('div');

  if (state.activeTool === 'compass') {
    if (state.rulerPoints.length === 2) {
      document.body.classList.remove('compass-active-cursor');
    }
    el.className = 'compass-marker-dot';
    Object.assign(el.style, {
      width: '14px',
      height: '14px',
      backgroundColor: `${CONFIG.colors.accentYellow}`,
      border: '1px solid #000',
      borderRadius: '50%',
      margin: '6px 0 0 0',
      padding: '0',
      boxSizing: 'border-box',
      pointerEvents: 'auto', // Дозволяє тягати вже поставлену точку
      display: 'block',
    });
  } else {
    labelElement.className = 'ruler-label';
    distLabel.className = 'ruler-dist-label';
    icon.innerHTML = `
      <svg class="ruler-point-svg" viewBox="0 0 24 24" style="width:24px; height:24px; display:block;">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${CONFIG.colors.main}" stroke="${CONFIG.colors.black}"/>
      </svg>`;
    el.appendChild(distLabel);
    el.appendChild(labelElement);
    el.appendChild(icon);
  }

  const m = new maplibregl.Marker({
    element: el,
    draggable: true,
    anchor: anchor, // Для циркуля тут буде 'center'
  })
    .setLngLat(lngLat)
    .addTo(state.map);

  el.oncontextmenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeRulerPoint(pointId);
  };

  m.on('drag', () => {
    const newCoords = m.getLngLat();
    const pIdx = state.rulerPoints.findIndex((p) => p.id === pointId);
    if (pIdx !== -1) {
      state.rulerPoints[pIdx].coords = [newCoords.lng, newCoords.lat];
      updateMeasurements();
      reindexRulerPoints();
    }
  });

  state.rulerMarkers.push({
    id: pointId,
    marker: m,
    labelElement: labelElement,
  });
  reindexRulerPoints();

  if (state.activeTool !== 'compass' || !state.compass.isDrawing) {
    updateMeasurements();
  }
}

function removeRulerPoint(id) {
  // 1. Видаляємо маркер з карти та масивів
  const m = state.rulerMarkers.find((m) => m.id === id);
  if (m) m.marker.remove();

  state.rulerMarkers = state.rulerMarkers.filter((m) => m.id !== id);
  state.rulerPoints = state.rulerPoints.filter((p) => p.id !== id);

  // 2. СПЕЦІАЛЬНА ЛОГІКА ДЛЯ ЦИРКУЛЯ
  if (state.activeTool === 'compass') {
    clearCompass();
  } else if (state.rulerPoints.length < 2) {
    clearRuler();
  } else {
    // Оновлюємо лінію
    const source = state.map.getSource('ruler-source');
    if (source)
      source.setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: state.rulerPoints.map((p) => p.coords),
        },
      });
    updateMeasurements();
    reindexRulerPoints();
  }
}

function handleToolClick(lngLat) {
  if (state.activeTool === 'compass') {
    if (!state.compass.isDrawing) {
      state.compass.isDrawing = true;
      state.compass.center = { lng: lngLat.lng, lat: lngLat.lat };
      showCopyToast('ЦЕНТР ВСТАНОВЛЕНО');
      addRulerPoint(lngLat);
    } else {
      state.compass.isDrawing = false;
      showCopyToast('ЦИРКУЛЬ ЗАФІКСОВАНО');
      addRulerPoint(lngLat);
    }
  } else {
    addRulerPoint(lngLat);
  }
}

function updateMeasurements() {
  // Якщо Turf ще не завантажився - виходимо, щоб не було помилок
  if (typeof turf === 'undefined') return;

  const rSrc = state.map.getSource('ruler-source');
  const cSrc = state.map.getSource('compass-arc');
  const infoEl = document.getElementById('distance-info');

  if (!rSrc || !cSrc) return;

  // --- ЛОГІКА ЦИРКУЛЯ ---
  if (state.activeTool === 'compass' && state.rulerPoints.length >= 2) {
    const start = state.rulerPoints[0].coords;
    const end = state.rulerPoints[1].coords;
    const radius = turf.distance(start, end, { units: 'kilometers' });
    let bearing = turf.bearing(start, end);
    if (bearing < 0) bearing += 360;

    const distText =
      radius < 1 ? Math.round(radius * 1000) + ' м' : radius.toFixed(2) + ' км';

    // Малюємо коло і радіус
    cSrc.setData({
      type: 'FeatureCollection',
      features: [
        turf.circle(start, radius, { steps: 64, units: 'kilometers' }),
        turf.lineString([start, end], { distanceText: distText }),
      ],
    });
    rSrc.setData({ type: 'FeatureCollection', features: [] }); // Чистимо лінійку

    if (infoEl) {
      infoEl.style.display = 'block';
      infoEl.innerHTML = `РАДІУС: <span style="color:${CONFIG.colors.accentYellow}">${distText}</span> | АЗИМУТ: <span style="color:${CONFIG.colors.accentYellow}">${Math.round(bearing)}°</span>`;
    }

    // --- ЛОГІКА ЛІНІЙКИ ---
  } else if (state.rulerPoints.length >= 2) {
    const coords = state.rulerPoints.map((p) => p.coords);
    const line = turf.lineString(coords);
    const dist = turf.length(line, { units: 'kilometers' });

    // Азимут останнього відрізка
    const lastIdx = coords.length - 1;
    let bearing = turf.bearing(coords[lastIdx - 1], coords[lastIdx]);
    if (bearing < 0) bearing += 360;

    const distText =
      dist < 1 ? Math.round(dist * 1000) + ' м' : dist.toFixed(2) + ' км';

    rSrc.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: line.geometry,
          properties: { distanceText: distText },
        },
      ],
    });
    cSrc.setData({ type: 'FeatureCollection', features: [] }); // Чистимо циркуль

    if (infoEl) {
      infoEl.style.display = 'block';
      infoEl.innerHTML = `ВІДСТАНЬ: <span style="color:${CONFIG.colors.accentYellow}">${distText}</span> | АЗИМУТ: <span style="color:${CONFIG.colors.accentYellow}">${Math.round(bearing)}°</span>`;
    }
  }
}

function reindexRulerPoints() {
  // Не показуємо список точок для сканера або циркуля, тільки для лінійки
  if (state.activeTool === 'scan' || state.activeTool === 'compass') return;
  if (typeof turf === 'undefined') return;

  const listEl = document.getElementById('points-list');
  const sidebar = document.getElementById('results-sidebar');
  const infoEl = document.getElementById('distance-info');

  if (state.rulerPoints.length < 2) {
    if (sidebar) sidebar.classList.add('interface-hidden');
    if (infoEl) infoEl.innerHTML = '...';
    return;
  }

  if (sidebar) sidebar.style.display = 'flex';
  if (listEl) listEl.innerHTML = '';

  let totalSoFar = 0;

  state.rulerMarkers.forEach((mObj, index) => {
    // Оновлюємо лейбли НА КАРТІ
    const el = mObj.marker.getElement();
    const label = el.querySelector('.ruler-label');
    const distLabel = el.querySelector('.ruler-dist-label');

    // Рахуємо відстань
    if (index > 0) {
      const segmentDist = turf.distance(
        state.rulerPoints[index - 1].coords,
        state.rulerPoints[index].coords,
        { units: 'kilometers' },
      );
      totalSoFar += segmentDist;
    }

    const displayDist =
      totalSoFar < 1
        ? `${Math.round(totalSoFar * 1000)}м`
        : `${totalSoFar.toFixed(2)}км`;

    // Ставимо текст у маркери
    if (label) label.innerText = `ТОЧКА ${index + 1}`;
    if (distLabel) {
      distLabel.innerText = displayDist;
      distLabel.style.display = index === 0 ? 'none' : 'block'; // Першу точку не підписуємо відстанню
    }

    const coords = state.rulerPoints[index].coords;
    const rawMgrs = mgrs.forward(coords);
    const formattedMgrs = rawMgrs.replace(
      /(.{3})(.{2})(.{5})(.{5})/,
      '$1 $2 $3 $4',
    );

    const item = document.createElement('div');
    item.className = 'point-item';
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items: baseline;">
          <b style="color: var(--color-main);">ТОЧКА ${index + 1}</b>
          
          <b style="background:${CONFIG.colors.yellow}; color:black; padding:2px 6px; border-radius:2px; font-size:12px;">
            ${index === 0 ? 'START' : displayDist}
          </b>
      </div>
      <div class="mgrs-copy-zone">
          <span class="coord-text" style="font-size:12px;">${formattedMgrs}</span>
          <button class="btn-copy-small" onclick="event.stopPropagation(); navigator.clipboard.writeText('${rawMgrs}'); showCopyToast('MGRS СКОПІЙОВАНО')">COPY</button>
      </div>
    `;
    item.onclick = () => focusPoint(coords[0], coords[1]);
    if (listEl) listEl.appendChild(item);
  });
}

function clearRuler() {
  state.rulerMarkers.forEach((mObj) => mObj.marker.remove());
  state.rulerMarkers = [];
  state.rulerPoints = [];
  state.compass.isDrawing = false;
  state.compass.center = null;

  const clearGeoJSON = { type: 'FeatureCollection', features: [] };
  const rSrc = state.map.getSource('ruler-source');
  const cSrc = state.map.getSource('compass-arc');

  if (rSrc) rSrc.setData(clearGeoJSON);
  if (cSrc) cSrc.setData(clearGeoJSON);

  reindexRulerPoints();
}

function updateCompassVisual(currentLngLat) {
  // 1. Перевірка: чи є центр і чи є поточні координати миші
  if (!state.compass.center || !currentLngLat) return;

  // Оптимізація: оновлюємо не частіше ніж раз на 20мс
  const now = Date.now();
  if (now - state.compass.lastUpdate < 20) return;
  state.compass.lastUpdate = now;

  // 2. Формуємо масиви координат [longitude, latitude]
  // Turf.js ПРИЙМАЄ ТІЛЬКИ МАСИВИ [lng, lat]
  const start = [state.compass.center.lng, state.compass.center.lat];
  const end = [currentLngLat.lng, currentLngLat.lat];
  const dist = turf.distance(start, end, { units: 'kilometers' });
  if (dist <= 0.001) return;

  const distText =
    dist < 1 ? Math.round(dist * 1000) + ' м' : dist.toFixed(2) + ' км';
  const data = {
    type: 'FeatureCollection',
    features: [
      turf.circle(start, dist, { steps: 64, units: 'kilometers' }), // Коло
      turf.lineString([start, end], { distanceText: distText }), // Радіус
    ],
  };
  const source = state.map.getSource('compass-arc');
  if (source) source.setData(data);
}

function clearCompass() {
  // Скидаємо стан малювання
  state.compass.isDrawing = false;
  state.compass.center = null;
  clearRuler();
}

function initButtons() {
  const btn = document.getElementById('toggle-contours-btn');
  if (btn)
    btn.onclick = () => {
      const vis = state.map.getLayoutProperty('contour-lines', 'visibility');
      const next = vis === 'visible' ? 'none' : 'visible';
      state.map.setLayoutProperty('contour-lines', 'visibility', next);
      state.map.setLayoutProperty('contour-labels', 'visibility', next);
      btn.classList.toggle('active', next === 'visible');
    };
}

// --- РОБОТА З МАРКЕРАМИ ---

function createMarker(lngLat, savedData = null) {
  // Перевіряємо, чи це MGRS маркер (він нерухомий)
  const isMgrs = savedData?.name?.startsWith('MGRS:');
  const id = savedData ? savedData.id : Date.now();
  const name = savedData ? savedData.name : `POINT ${++state.markerCount}`;
  const colorIdx = savedData ? savedData.colorIdx : 0;

  // Класи для стилізації
  const colors = ['m-green', 'm-red', 'm-blue', 'm-yellow'];

  // 1. Створення DOM елементів
  const wrapper = document.createElement('div');
  wrapper.className = 'marker-wrapper' + (isMgrs ? ' static-marker' : '');

  const el = document.createElement('div');
  el.className = `custom-marker ${colors[colorIdx]}`;
  wrapper.appendChild(el);

  const label = document.createElement('div');
  label.className = 'marker-label';
  label.innerText = name;
  wrapper.appendChild(label);

  // 2. Створення маркера MapLibre
  const marker = new maplibregl.Marker({
    element: wrapper,
    draggable: !isMgrs, // Забороняємо тягати MGRS
  })
    .setLngLat(lngLat)
    .addTo(state.map);

  // 3. Реєстрація в state (щоб уникнути помилок undefined)
  const markerData = { id, lngLat, name, colorIdx };
  if (!state.markersData.find((m) => m.id === id)) {
    state.markersData.push(markerData);
    if (!isMgrs) syncStorage();
  }

  // 4. Подія Кліку (Зміна кольору)
  el.onclick = (ev) => {
    ev.stopPropagation();

    // Зміна кольору по колу
    const mData = state.markersData.find((m) => m.id === id);
    if (mData) {
      el.classList.remove(colors[mData.colorIdx]);
      mData.colorIdx = (mData.colorIdx + 1) % colors.length;
      el.classList.add(colors[mData.colorIdx]);
      if (!isMgrs) syncStorage();
    }
  };

  // 5. Подія Правий Клік (Видалення)
  el.oncontextmenu = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    marker.remove();
    state.markersData = state.markersData.filter((m) => m.id !== id);
    if (!isMgrs) syncStorage();
  };

  // 6. Подія Перетягування (Оновлення координат)
  marker.on('dragend', () => {
    const mData = state.markersData.find((m) => m.id === id);
    if (mData) {
      mData.lngLat = marker.getLngLat();
      syncStorage();
    }
  });
}

function syncStorage() {
  localStorage.setItem('fox_eye_data', JSON.stringify(state.markersData));
}

function loadSavedMarkers() {
  const saved = localStorage.getItem('fox_eye_data');
  if (saved) {
    try {
      JSON.parse(saved).forEach((d) => createMarker(d.lngLat, d));
    } catch (e) {
      console.error('Load error', e);
    }
  }
}

function focusPoint(lng, lat) {
  state.map.flyTo({
    center: [lng, lat],
    zoom: 16,
    speed: 1.5,
    essential: true,
  });
}

// --- SCAN LOGIC & SYSTEM ---

function handleScanStart(e) {
  if (state.activeTool !== 'scan' || e.button !== 0) return;

  clearScanResults();
  state.isSelecting = true;
  state.map.dragPan.disable();

  const rect = state.map.getCanvas().getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  state.selectionStart = { x, y, lngLat: state.map.unproject([x, y]) };

  if (!state.selectionBoxEl) {
    state.selectionBoxEl = document.createElement('div');
    state.selectionBoxEl.className = 'selection-box';
    document.getElementById('map').appendChild(state.selectionBoxEl);
  }

  const box = state.selectionBoxEl;
  Object.assign(box.style, {
    left: x + 'px',
    top: y + 'px',
    width: '0px',
    height: '0px',
    display: 'block',
  });
}

function handleScanMove(e) {
  if (!state.isSelecting || state.activeTool !== 'scan') return;

  const rect = state.map.getCanvas().getBoundingClientRect();
  const curX = e.clientX - rect.left;
  const curY = e.clientY - rect.top;

  const width = Math.abs(curX - state.selectionStart.x);
  const height = Math.abs(curY - state.selectionStart.y);
  const newX = Math.min(curX, state.selectionStart.x);
  const newY = Math.min(curY, state.selectionStart.y);

  Object.assign(state.selectionBoxEl.style, {
    left: newX + 'px',
    top: newY + 'px',
    width: width + 'px',
    height: height + 'px',
  });
}

function handleScanEnd(e) {
  if (!state.isSelecting || state.activeTool !== 'scan') return;

  state.isSelecting = false;
  state.map.dragPan.enable();
  if (state.selectionBoxEl) state.selectionBoxEl.style.display = 'none';

  const rect = state.map.getCanvas().getBoundingClientRect();
  const endLngLat = state.map.unproject([
    e.clientX - rect.left,
    e.clientY - rect.top,
  ]);

  findHighestPoints(state.selectionStart.lngLat, endLngLat);
}

async function findHighestPoints(p1, p2) {
  const pointsCountInput = await customPrompt(
    'Скільки найвищих точок знайти?',
    '5',
  );
  if (pointsCountInput === null) {
    setActiveTool(null);
    return;
  }

  const pointsCount = parseInt(pointsCountInput) || 5;
  const bbox = [
    Math.min(p1.lng, p2.lng),
    Math.min(p1.lat, p2.lat),
    Math.max(p1.lng, p2.lng),
    Math.max(p1.lat, p2.lat),
  ];
  // Генерація сітки
  // Створюємо дуже щільну сітку (крок 20 метрів для максимальної точності)
  // Використовуємо 0.02 км, щоб точно влучити в центр найменшої ізогіпси
  const grid = turf.pointGrid(bbox, 0.02, { units: 'kilometers' });
  const results = [];

  // Пряме опитування карти (MapLibre Terrain)
  grid.features.forEach((f) => {
    const coords = f.geometry.coordinates;
    const elev = state.map.queryTerrainElevation(coords) || 0;
    results.push({
      lng: coords[0],
      lat: coords[1],
      elevation: Math.round(elev), // Округлюємо до цілих метрів
    });
  });

  // Сортуємо: від найвищої
  results.sort((a, b) => b.elevation - a.elevation);

  // Фільтруємо, щоб точки не злипалися (мінімум 300м між PT-1, PT-2...)
  let filtered = [];
  for (let p of results) {
    if (filtered.length >= 50) break; // Ліміт для API
    const isTooClose = filtered.some(
      (f) =>
        turf.distance([p.lng, p.lat], [f.lng, f.lat], { units: 'kilometers' }) <
        0.3,
    );
    if (!isTooClose) filtered.push(p);
  }

  showCopyToast(`ЗАПИТ ДО Open-Meteo Elevation API...`);

  // Уточнення через API
  try {
    const lats = filtered.map((p) => p.lat).join(',');
    const lngs = filtered.map((p) => p.lng).join(',');

    // Open-Meteo Elevation API: миттєва відповідь, дані Copernicus DEM 30m
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;

    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.elevation)
        filtered.forEach(
          (p, i) => (p.elevation = Math.round(data.elevation[i])),
        );
    } else {
      throw new Error('API Response Error');
    }
  } catch (e) {
    console.error('Ошибка API, використовуємо дані мапи:', e);
    showCopyToast(`ПОМИЛКА МЕРЕЖІ`);
  }

  // 2. Фінальне сортування вже за точними даними
  filtered.sort((a, b) => b.elevation - a.elevation);
  renderScanResults(filtered.slice(0, pointsCount));
  state.activeTool = null;
  document
    .querySelectorAll('.icon-btn')
    .forEach((b) => b.classList.remove('active'));
}

function renderScanResults(data) {
  const sidebar = document.getElementById('results-sidebar');
  const listEl = document.getElementById('points-list');
  if (!sidebar || !listEl) return;

  state.activeTool = 'scan_results'; // "фейковий" стан, щоб система знала, що панель зараз потрібна
  sidebar.style.display = 'flex';
  listEl.innerHTML = '';

  // Очистка старих маркерів
  if (!state.scanMarkers) state.scanMarkers = [];

  data.forEach((p, i) => {
    const color = `hsl(${(i / data.length) * 240}, 100%, 50%)`;
    const name = `PT-${i + 1}`;

    // 1. Створення маркера на карті
    const el = document.createElement('div');
    el.className = 'scan-result-marker';
    el.style.backgroundColor = color;
    el.innerHTML = `<div class="scan-marker-label">${name}</div>`;

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([p.lng, p.lat])
      .addTo(state.map);
    state.scanMarkers.push(marker);

    // 2. Створення елемента списку
    const rawMgrs = mgrs.forward([p.lng, p.lat]);
    const formattedMgrs = rawMgrs.replace(
      /(.{3})(.{2})(.{5})(.{5})/,
      '$1 $2 $3 $4',
    );
    const item = document.createElement('div');

    item.className = 'point-item';
    item.style.borderLeft = `5px solid ${color}`;
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items: baseline; pointer-events: none;">
          <b style="color: ${color}; font-size: 14px;">${name}</b>
          <b style="background:${color}; color:black; padding:2px 6px; border-radius:2px; font-size: 14px;">${Math.round(
            p.elevation,
          )} м</b>
      </div>
      <div class="mgrs-copy-zone">
          <span class="coord-text" style="color: ${CONFIG.colors.main}; opacity: 0.8;">${formattedMgrs}</span>
          <button class="btn-copy-small btn-copy-mgrs">COPY</button>
      </div>
    `;

    item.onclick = () => focusPoint(p.lng, p.lat);
    item.querySelector('button').onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard
        .writeText(rawMgrs)
        .then(() => showCopyToast(`${name} СКОПІЙОВАНО`));
    };

    listEl.appendChild(item);
  });
}

function safeRemoveLayer(id) {
  if (state.map && state.map.getStyle()) {
    if (state.map.getLayer(id)) state.map.removeLayer(id);
    if (state.map.getSource(id)) state.map.removeSource(id);
  }
}

function clearScanResults() {
  if (state.scanMarkers) {
    state.scanMarkers.forEach((m) => m.remove());
    state.scanMarkers = [];
  }
  clearRuler();
  clearSidebar();
  safeRemoveLayer('visibility-canvas'); // Про всяк випадок

  showCopyToast('КАРТУ ОЧИЩЕНО');
}

// --- ПОШУК ТА ГЕОКОДИНГ ---

async function performSearch() {
  const input = document.getElementById('search-input');
  const typeEl = document.querySelector('input[name="search-type"]:checked');
  if (!input || !typeEl) return;

  const val = input.value.trim();
  if (!val) return;

  // А. ПОШУК ЗА MGRS
  if (typeEl.value === 'mgrs') {
    try {
      const cleanMgrs = val.replace(/\s+/g, '');
      const point = mgrs.toPoint(cleanMgrs); // [lng, lat]
      const lng = point[0];
      const lat = point[1];

      startMap(lng, lat);

      // Створюємо НЕРУХОМИЙ маркер для MGRS
      createMarker(
        { lng, lat },
        {
          id: Date.now(),
          name: `MGRS: ${cleanMgrs}`,
          colorIdx: 1, // Червоний (Index 1 в масиві кольорів)
          posIdx: 0,
        },
      );
    } catch (e) {
      console.error(e);
      customAlert('ПОМИЛКА MGRS');
    }
  }
  // Б. ПОШУК НАСЕЛЕНОГО ПУНКТУ
  else {
    try {
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(val)}.json?key=${CONFIG.apiKey}&language=uk`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.features?.length) {
        startMap(...data.features[0].center);
        input.value = ''; // Очистити поле після успіху
      } else {
        customAlert('НЕ ЗНАЙДЕНО');
      }
    } catch (e) {
      customAlert('ПОМИЛКА МЕРЕЖІ');
    }
  }
}

function toggleMapStyle() {
  const isSat = state.map.getLayoutProperty('sat', 'visibility') === 'visible';

  if (isSat) {
    state.map.setLayoutProperty('sat', 'visibility', 'none');
    state.map.setLayoutProperty('topo', 'visibility', 'visible');
    document.getElementById('style-toggle').classList.add('active');
    showCopyToast('ТОПОГРАФІЧНА МАПА АКТИВОВАНА');
  } else {
    state.map.setLayoutProperty('topo', 'visibility', 'none');
    state.map.setLayoutProperty('sat', 'visibility', 'visible');
    document.getElementById('style-toggle').classList.remove('active');
    showCopyToast('СУПУТНИК АКТИВОВАНИЙ');
  }
}

async function printMap() {
  toggleMapStyle();
  // Тимчасово приховуємо панелі
  const ui = [
    document.getElementById('map-controls'),
    document.getElementById('results-sidebar'),
    document.getElementById('distance-info'),
  ];
  ui.forEach((el) => el && el.classList.add('interface-hidden'));

  // Даємо мапі час, щоб провантажити світлі тайли перед друком
  setTimeout(() => {
    window.print();
    toggleMapStyle();
    ui.forEach((el) => el && el.classList.remove('interface-hidden'));
  }, 1000);
}

function checkWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl') || c.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

function showWebGLError() {
  document.body.innerHTML =
    '<h1 style="color:red; text-align:center; padding:50px">WebGL НЕ ПРАЦЮЄ</h1>';
}

// START
window.onload = () => {
  if (!checkWebGL()) return showWebGLError();
  updatePlaceholder();
  state.scanMarkers = [];
};
