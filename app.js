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

// 3. СИСТЕМА ЗБЕРЕЖЕННЯ
const AppState = {
  // Зберігаємо стан у пам'ять
  save: () => {
    const data = {
      // Зберігаємо тільки координати точок
      points: state.rulerPoints.map((p) => p.coords),
      tool: state.activeTool,
      mapCenter: state.map.getCenter(),
      mapZoom: state.map.getZoom(),
    };
    localStorage.setItem('fox-eye-tools', JSON.stringify(data));
    console.log('State saved');
  },

  // Відновлюємо стан при старті
  load: () => {
    const raw = localStorage.getItem('fox-eye-tools');
    if (!raw) return;

    try {
      const data = JSON.parse(raw);

      // 1. Відновлюємо позицію мапи
      if (data.mapCenter && data.mapZoom) {
        state.map.jumpTo({ center: data.mapCenter, zoom: data.mapZoom });
      }

      // 2. Відновлюємо інструмент (якщо був)
      if (data.tool) {
        setActiveTool(data.tool);
      }

      // 3. Відновлюємо точки
      if (data.points && Array.isArray(data.points) && data.points.length > 0) {
        // Очищаємо масиви перед завантаженням (на всяк випадок)
        state.rulerPoints = [];
        state.rulerMarkers = [];

        // Проходимо по збережених координатах і ставимо точки
        // Важливо: передаємо false, щоб не викликати збереження під час завантаження
        data.points.forEach((coords) => {
          // Перетворюємо назад у об'єкт {lng, lat} для нашої функції
          const lngLat = { lng: coords[0], lat: coords[1] };
          addRulerPoint(lngLat, false);
        });

        showCopyToast('МАРШРУТ ВІДНОВЛЕНО');
      }
    } catch (e) {
      console.error('Save file corrupted', e);
    }
  },
};

// 4. ІКОНКИ
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
  download: `<svg viewBox="0 0 24 24"><path d="M5,20H19V18H5M19,9H15V3H9V9H5L12,16L19,9Z"/></svg>`,
  upload: `<svg viewBox="0 0 24 24"><path d="M9,16V10H5L12,3L19,10H15V16H9M5,20V18H19V20H5Z"/></svg>`,
  help: `<svg viewBox="0 0 24 24"><path d="M11,9H13V7H11M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M11,17H13V11H11V17Z"/></svg>`,
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

function clearInfobar() {
  const infobar = document.getElementById('infobar');
  if (infobar) infobar.innerHTML = '';
  if (infobar) infobar.style.display = 'none';
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
    });
    setupMapEvents();
    // === ДОДАЄМО МАСШТАБНУ ШКАЛУ (SCALE CONTROL) ===
    const scale = new maplibregl.ScaleControl({
      maxWidth: 150,
      unit: 'metric', // Тільки метри/кілометри
    });
    state.map.addControl(scale, 'bottom-right'); // Розміщення: знизу праворуч
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
    coordsDisplay.innerText = `${formatted}`;
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
      'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
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
      'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
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
    AppState.load();
  });

  // 2. Клік (Click) - Тільки для інструментів (Лінійка/Циркуль)
  map.on('click', (e) => (state.activeTool ? handleToolClick(e.lngLat) : null));

  map.on('contextmenu', (e) => {
    // Якщо ми зараз малюємо компасом (поставили центр, але ще не поставили радіус)
    if (state.activeTool === 'compass' && state.compass.isDrawing) {
      // 1. Зупиняємо малювання
      state.compass.isDrawing = false;
      state.compass.center = null;

      // 2. Очищаємо все (видаляємо точку центру і червоне коло)
      clearMeasurements();

      // 3. Даємо знати користувачу
      showCopyToast('МАЛЮВАННЯ СКАСОВАНО');

      // 4. Запобігаємо появі стандартного контекстного меню браузера
      e.preventDefault();
    }
  });

  // 3. Подвійний клік (Double Click) - Створення маркерів
  map.on('dblclick', (e) => {
    if (!state.activeTool && !e.originalEvent.target.closest('.marker-wrapper'))
      createMarker(e.lngLat);
  });

  // 4. Рух миші (MouseMove) - Циркуль та MGRS
  map.on('mousemove', (e) => {
    if (state.activeTool === 'compass' && state.compass.isDrawing) {
      updateCompassVisual(e.lngLat);
    }
    // Знайди в setupMapEvents -> map.on('mousemove', ...)
    // Заміни весь блок "if (state.isSelecting && state.selectionBoxEl)" на цей:

    if (state.isSelecting && state.selectionBoxEl) {
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
    updateLiveCoords(e.lngLat);
  });

  // 5. Авто-приховування інтерфейсу при русі карти
  const ui = [
    document.getElementById('map-controls'),
    document.getElementById('results-sidebar'),
    document.getElementById('infobar'),
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
    clearMeasurements();
    // Якщо вмикаємо щось інше, ніж Scan - очищаємо результати сканування
    if (tool !== 'scan_results') clearScanResults();
  }

  document
    .querySelectorAll('.icon-btn')
    .forEach((b) => b.classList.remove('active'));

  // Логіка Toggle (вимкнення при повторному кліку)
  if (tool === prevTool) {
    state.activeTool = null;
    document.getElementById('infobar').style.display = 'none';
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
    const infoBox = document.getElementById('infobar');
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

function generateId() {
  // Використовуємо substring замість substr
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function addRulerPoint(lngLat, shouldSave = true) {
  const pointId = generateId();

  state.rulerPoints.push({ id: pointId, coords: [lngLat.lng, lngLat.lat] });

  const el = document.createElement('div');
  el.onclick = (e) => {
    e.stopPropagation(); // Це не дозволить мапі отримати клік
  };
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

  if (shouldSave) AppState.save();
}

function removeRulerPoint(id) {
  // 1. Видаляємо маркер з карти та масивів
  const m = state.rulerMarkers.find((m) => m.id === id);
  if (m) m.marker.remove();

  state.rulerMarkers = state.rulerMarkers.filter((m) => m.id !== id);
  state.rulerPoints = state.rulerPoints.filter((p) => p.id !== id);

  // 2. СПЕЦІАЛЬНА ЛОГІКА ДЛЯ ЦИРКУЛЯ
  if (state.activeTool === 'compass' || state.rulerPoints.length < 2) {
    clearMeasurements();
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

  AppState.save();
}

function handleToolClick(lngLat) {
  if (state.activeTool === 'compass') {
    // 1. ПЕРЕВІРКА: Якщо вже є 2 точки (центр і радіус) — це старе коло.
    // Очищаємо все ПЕРЕД тим, як почати нове.
    if (state.rulerPoints.length >= 2) {
      clearMeasurements();
      // Тепер rulerPoints = [], isDrawing = false
    }

    if (!state.compass.isDrawing) {
      // ПОЧАТОК НОВОГО КОЛА (Клік 1)
      state.compass.isDrawing = true;
      state.compass.center = { lng: lngLat.lng, lat: lngLat.lat };
      showCopyToast('ЦЕНТР ВСТАНОВЛЕНО');
      addRulerPoint(lngLat); // Додаємо центр
    } else {
      // ЗАВЕРШЕННЯ КОЛА (Клік 2)
      state.compass.isDrawing = false;
      showCopyToast('ЦИРКУЛЬ ЗАФІКСОВАНО');
      addRulerPoint(lngLat); // Додаємо радіус
    }
  } else {
    // Для лінійки логіка проста
    addRulerPoint(lngLat);
  }
}

// Отримати азимут (0-360) між двома координатами
function getAzimuth(start, end) {
  let bearing = turf.bearing(start, end);
  if (bearing < 0) bearing += 360;
  return Math.round(bearing);
}

// Форматування відстані (м/км)
function formatDistance(km) {
  if (km < 1) return Math.round(km * 1000) + ' м';
  return km.toFixed(2) + ' км';
}

function updateMeasurements() {
  // Якщо Turf ще не завантажився - виходимо, щоб не було помилок
  if (typeof turf === 'undefined') return;

  const rSrc = state.map.getSource('ruler-source');
  const cSrc = state.map.getSource('compass-arc');
  const infoEl = document.getElementById('infobar'); // Верхня плашка (загальна інфо)

  if (!rSrc || !cSrc) return;

  // --- ЛОГІКА ЦИРКУЛЯ ---
  if (state.activeTool === 'compass' && state.rulerPoints.length >= 2) {
    const start = state.rulerPoints[0].coords;
    const end = state.rulerPoints[1].coords;
    const azimuth = getAzimuth(start, end);
    const radius = turf.distance(start, end, { units: 'kilometers' });
    const distText = formatDistance(radius);
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
      infoEl.innerHTML = `РАДІУС: <span style="color:${CONFIG.colors.accentYellow}">${distText}</span> | АЗИМУТ: <span style="color:${CONFIG.colors.accentYellow}">${azimuth}°</span>`;
    }

    // --- НОВА ЛОГІКА ЛІНІЙКИ ---
  } else if (state.rulerPoints.length > 0) {
    const features = [];
    let totalDist = 0;

    // 1. Проходимо по точках і будуємо сегменти
    for (let i = 1; i < state.rulerPoints.length; i++) {
      const prev = state.rulerPoints[i - 1].coords;
      const curr = state.rulerPoints[i].coords;

      const line = turf.lineString([prev, curr]);
      const segmentDist = turf.length(line, { units: 'kilometers' });
      totalDist += segmentDist;

      // Додаємо властивість distanceText саме для цього сегмента
      line.properties = { distanceText: formatDistance(segmentDist) };
      features.push(line);
    }

    // Оновлюємо дані на мапі
    rSrc.setData({
      type: 'FeatureCollection',
      features: features,
    });
    cSrc.setData({ type: 'FeatureCollection', features: [] });

    // Оновлюємо верхню плашку (загальна сума)
    if (infoEl) {
      if (state.rulerPoints.length > 1) {
        infoEl.style.display = 'block';
        infoEl.innerHTML = `ЗАГАЛЬНА ДИСТАНЦІЯ: <span style="color:${CONFIG.colors.accentYellow}">${formatDistance(totalDist)}</span>`;
      } else {
        infoEl.style.display = 'none';
      }
    }

    // Оновлюємо сайдбар (список точок)
    reindexRulerPoints();
  } else {
    // Якщо точок немає - чистимо все
    rSrc.setData({ type: 'FeatureCollection', features: [] });
    if (infoEl) infoEl.style.display = 'none';
    reindexRulerPoints();
  }
}

function reindexRulerPoints() {
  if (state.activeTool === 'scan' || state.activeTool === 'compass') return;
  if (typeof turf === 'undefined') return;

  const listEl = document.getElementById('points-list');
  const sidebar = document.getElementById('results-sidebar');

  if (state.rulerPoints.length < 2) {
    if (sidebar) sidebar.classList.add('interface-hidden');
    return;
  }

  if (sidebar) sidebar.classList.remove('interface-hidden');
  if (sidebar) sidebar.style.display = 'flex';
  if (listEl) listEl.innerHTML = '';

  // 1. Виносимо змінну за межі циклу, щоб рахувати загальну дистанцію
  let totalDist = 0;

  state.rulerPoints.forEach((pointData, index) => {
    const markerWrapper = state.rulerMarkers[index];
    const realMarker =
      markerWrapper && markerWrapper.marker
        ? markerWrapper.marker
        : markerWrapper;

    // --- РОЗРАХУНКИ ---
    let segmentDist = '';
    let azimuthText = '';

    if (index !== 0) {
      const prev = state.rulerPoints[index - 1].coords;
      const curr = pointData.coords;
      const dist = turf.distance(prev, curr, { units: 'kilometers' });

      // 2. Плюсуємо до загальної дистанції
      totalDist += dist;

      segmentDist = formatDistance(dist);

      const azimuth = getAzimuth(prev, curr);
      azimuthText = `${azimuth}°`;
    }

    // --- ОНОВЛЕННЯ МАРКЕРА ---
    // Тепер працюємо з realMarker, який точно має метод getElement
    if (realMarker && typeof realMarker.getElement === 'function') {
      const el = realMarker.getElement();
      const label = el.querySelector('.ruler-label');
      const distLabel = el.querySelector('.ruler-dist-label');

      if (label) label.innerText = `Точка ${index + 1}`;

      // 4. У distLabel пишемо загальну накопичену дистанцію
      if (distLabel) {
        if (index === 0) distLabel.innerText = 'START';
        else distLabel.innerText = formatDistance(totalDist);

        distLabel.style.display = 'block';
      }
    }

    // --- MGRS ---
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
      } catch (e) {
        console.warn(e);
      }
    }

    // --- САЙДБАР ---
    const item = document.createElement('div');
    item.className = 'point-item';

    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items: baseline; margin-bottom: 4px;">
          <b style="color: var(--color-main);">ТОЧКА ${index + 1}</b>
          <div style="text-align:right;">
             ${
               index === 0
                 ? `<span style="background:${CONFIG.colors.main}; color:black; padding:1px 4px; border-radius:2px; font-size:11px; font-weight:bold;">START</span>`
                 : `<span style="color:#000; padding:1px 4px; border-radius:2px; font-size:11px;  font-weight:bold;background:${CONFIG.colors.yellow};">DIST: ${segmentDist} <span style="font-size:0.9em">( Σ ${formatDistance(totalDist)} )</span></span>
                 <span style="color:#000; padding:1px 4px; border-radius:2px; font-size:11px; font-weight:bold; background:${CONFIG.colors.yellow}; margin-left:5px;">AZ: ${azimuthText}</span>`
             }
          </div>
      </div>
      
      <div class="mgrs-copy-zone" style="display:flex; justify-content:space-between; align-items:center;">
          <span class="coord-text" style="font-family:var(--font-mono); font-size:12px; color:#ccc;">${formattedMgrs}</span>
          <button class="btn-copy-small" onclick="event.stopPropagation(); navigator.clipboard.writeText('${rawMgrs}'); showCopyToast('MGRS СКОПІЙОВАНО')">COPY</button>
      </div>
    `;

    item.onclick = () => {
      if (typeof focusPoint === 'function') focusPoint(coords[0], coords[1]);
      else state.map.flyTo({ center: coords, zoom: 14 });
    };

    if (listEl) listEl.appendChild(item);
  });
}

function clearMeasurements() {
  // 1. Видаляємо всі маркери з карти
  state.rulerMarkers.forEach((item) => {
    const marker = item.marker || item; // Підстраховка (обгортка чи сам маркер)
    marker.remove();
  });

  // 2. Очищаємо масиви в стані
  state.rulerPoints = [];
  state.rulerMarkers = [];

  // 3. Очищаємо графіку на карті (лінії та кола)
  const clearGeoJSON = { type: 'FeatureCollection', features: [] };
  const rSrc = state.map.getSource('ruler-source');
  const cSrc = state.map.getSource('compass-arc');

  if (rSrc) rSrc.setData(clearGeoJSON);
  if (cSrc) cSrc.setData(clearGeoJSON);

  // 4. Скидаємо стан малювання
  state.compass.isDrawing = false;
  state.compass.center = null;

  // 5. Оновлюємо інтерфейс (ховаємо панелі)
  reindexRulerPoints();
  clearInfobar();

  localStorage.removeItem('fox-eye-tools'); // Видаляємо запис про інструменти
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
  // === ВАЖЛИВО! БЛОКУЄМО СТАНДАРТНУ ПОВЕДІНКУ ===
  e.preventDefault();
  // ==============================================
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

    // === НОВЕ: Створюємо лейбл для тексту один раз ===
    const label = document.createElement('span');
    label.className = 'selection-area-label';
    label.innerText = '0 m²';
    state.selectionBoxEl.appendChild(label);
    // ================================================

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
  clearMeasurements();
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
    document.getElementById('infobar'),
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

// === СИСТЕМА ОБМІНУ ДАНИМИ (EXPORT/IMPORT) ===

const DataManager = {
  // 1. ЕКСПОРТ (Скачування файлу)
  exportToFile: () => {
    // Збираємо повну картину
    const data = {
      version: '0.1',
      timestamp: Date.now(),
      dateString: new Date().toLocaleString(),
      mapView: {
        center: state.map.getCenter(),
        zoom: state.map.getZoom(),
      },
      // Дані лінійки та компаса
      tools: {
        active: state.activeTool,
        points: state.rulerPoints.map((p) => p.coords),
      },
      // Дані звичайних маркерів
      markers: state.markersData,
    };

    // Конвертуємо в JSON
    const jsonString = JSON.stringify(data, null, 2);

    // Створюємо файл
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Генеруємо ім'я файлу: SITREP_2023-10-25_1430.json
    const date = new Date();
    const filename = `SITREP_${date.toISOString().slice(0, 10)}_${date.getHours()}${date.getMinutes()}.json`;

    // Тригеримо скачування
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    // Прибираємо сміття
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showCopyToast('ФАЙЛ ЗБЕРЕЖЕНО');
  },

  // 2. ІМПОРТ (Читання файлу)
  importFromFile: (file) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // Валідація (чи це наш файл?)
        if (!data.mapView || !data.tools) {
          customAlert('НЕВІДОМИЙ ФОРМАТ ФАЙЛУ');
          return;
        }

        // Очищаємо поточну карту перед завантаженням
        clearMeasurements();
        state.markersData.forEach((m) => {
          // Знаходимо реальний маркер через ID і видаляємо (це складно, простіше перезавантажити сторінку, але ми зробимо "м'яке" очищення)
          // Тут краще використати логіку "стерти все"
        });
        // Просте очищення маркерів:
        document
          .querySelectorAll('.marker-wrapper')
          .forEach((el) => el.remove());
        state.markersData = [];

        // === ВІДНОВЛЕННЯ ===

        // 1. Камера
        state.map.jumpTo({
          center: data.mapView.center,
          zoom: data.mapView.zoom,
        });

        // 2. Маркери (звичайні)
        if (data.markers) {
          data.markers.forEach((m) => createMarker(m.lngLat, m));
        }

        // 3. Лінійка/Компас
        if (data.tools && data.tools.points) {
          state.rulerPoints = [];
          data.tools.points.forEach((coords) => {
            const lngLat = { lng: coords[0], lat: coords[1] };
            addRulerPoint(lngLat, false);
          });
        }

        // Зберігаємо новий стан
        AppState.save();
        showCopyToast('СИТУАЦІЮ ЗАВАНТАЖЕНО');
      } catch (err) {
        console.error(err);
        customAlert('ПОМИЛКА ЧИТАННЯ ФАЙЛУ');
      }
    };

    reader.readAsText(file);
  },
};

function initButtons() {
  const contourBtn = document.getElementById('toggle-contours-btn');
  if (contourBtn)
    contourBtn.onclick = () => {
      const vis = state.map.getLayoutProperty('contour-lines', 'visibility');
      const next = vis === 'visible' ? 'none' : 'visible';
      state.map.setLayoutProperty('contour-lines', 'visibility', next);
      state.map.setLayoutProperty('contour-labels', 'visibility', next);
      contourBtn.classList.toggle('active', next === 'visible');
    };

  // 1. Кнопка ЕКСПОРТ
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.onclick = () => {
      DataManager.exportToFile();
    };
  }

  // 2. Кнопка ІМПОРТ (клікає по прихованому інпуту)
  const importBtn = document.getElementById('import-btn');
  const fileInput = document.getElementById('file-input');

  if (importBtn && fileInput) {
    importBtn.onclick = () => {
      // Запитуємо підтвердження перед заміною даних
      if (state.rulerPoints.length > 0 || state.markersData.length > 0) {
        if (!confirm('Завантаження файлу замінить поточні дані. Продовжити?'))
          return;
      }
      fileInput.click();
    };

    // Коли файл обрано
    fileInput.onchange = (e) => {
      if (e.target.files.length > 0) {
        DataManager.importFromFile(e.target.files[0]);
        fileInput.value = ''; // Скидаємо, щоб можна було завантажити той самий файл ще раз
      }
    };
  }
}

function initHelp() {
  // Додати це в window.onload або initButtons()
  const helpBtn = document.getElementById('help-btn');
  const helpModal = document.getElementById('modal-help');
  const closeHelpBtn = document.getElementById('close-help-btn');

  if (helpBtn && helpModal) {
    // Відкриття
    helpBtn.onclick = () => {
      helpModal.style.display = 'flex';
      setTimeout(() => helpModal.classList.add('active'), 10);
    };

    // Закриття кнопкою
    closeHelpBtn.onclick = () => {
      helpModal.classList.remove('active');
      setTimeout(() => (helpModal.style.display = 'none'), 200);
    };

    // Закриття по кліку на фон
    helpModal.onclick = (e) => {
      if (e.target === helpModal) {
        helpModal.classList.remove('active');
        setTimeout(() => (helpModal.style.display = 'none'), 200);
      }
    };
  }
}

// START
window.onload = () => {
  if (!checkWebGL()) return showWebGLError();
  updatePlaceholder();
  state.scanMarkers = [];
  initHelp();
};
