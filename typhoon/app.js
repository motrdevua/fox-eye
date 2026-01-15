const apiKey = '39vWsRU1aZVglDrRNJUv';
let map;
let markerCount = 0;
let markersData = [];
let activeTool = null;
let rulerPoints = [];
let rulerMarkers = [];
let shiftSelectedMarkers = [];
let isSelecting = false;
let selectionStart = null; // {x, y} екранні координати
let selectionBoxEl = null; // DOM елемент рамки

// Динамічний циркуль
let compassCenter = null;
let isDrawingCompass = false;

const colorClasses = ['m-green', 'm-red', 'm-blue', 'm-yellow'];

// --- ТЕХНІЧНІ ФУНКЦІЇ ---

function updatePlaceholder() {
  const input = document.getElementById('city-input');
  const type = document.querySelector(
    'input[name="search-type"]:checked'
  ).value;

  input.value = ''; // Очищення при зміні типу
  input.placeholder =
    type === 'city' ? 'ВВЕДІТЬ НАЗВУ НП...' : '36U VV 12345 67890';

  // Видаляємо старі слухачі маски, якщо вони були
  input.oninput = type === 'mgrs' ? handleMgrsMask : null;
}

function handleMgrsMask(e) {
  let v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let parts = [];

  // Маска MGRS: 36U VV 12345 67890
  if (v.length > 0) parts.push(v.substring(0, 3)); // 36U
  if (v.length > 3) parts.push(v.substring(3, 5)); // VV
  if (v.length > 5) parts.push(v.substring(5, 10)); // 12345
  if (v.length > 10) parts.push(v.substring(10, 15)); // 67890

  e.target.value = parts.join(' ');
}

function startMap(lon, lat) {
  document.getElementById('search-overlay').style.display = 'none';
  document.getElementById('map-controls').style.display = 'block';
  initMap(lon, lat);
}

function syncStorage() {
  localStorage.setItem('typhoon_v1.4_data', JSON.stringify(markersData));
}

// --- ПОШУК НА МАПІ ---

async function performSearch() {
  const input = document.getElementById('city-input');
  const query = input.value.trim();
  if (!query) return;

  const type = document.querySelector(
    'input[name="search-type"]:checked'
  ).value;

  if (type === 'mgrs') {
    // Перевірка формату (мінімум зона, квадрат і по 1 цифрі координат)
    const cleanMgrs = query.replace(/\s/g, '');
    // Знайти рядок з alert('ПОМИЛКА: Недостатньо символів...') і замінити на:
    if (cleanMgrs.length < 7) {
      customAlert('ПОМИЛКА: Недостатньо символів для MGRS (мін. 7)');
      return;
    }
    // ЛОГІКА ДЛЯ MGRS
    try {
      // Очищення пробілів та перетворення в координати
      const cleanMgrs = query.replace(/\s/g, '');
      const coords = mgrs.toPoint(cleanMgrs);
      const lngLat = { lng: coords[0], lat: coords[1] };

      // 1. Запуск карти
      startMap(lngLat.lng, lngLat.lat);

      // 2. Створення маркера (через 500мс, щоб карта встигла ініціалізуватися)
      setTimeout(() => {
        // Перевіряємо, чи немає вже маркера з таким ім'ям
        const name = `SEARCH ${cleanMgrs.slice(-5)}`; // Використовуємо хвіст MGRS для назви
        createMarker(lngLat, {
          id: Date.now(),
          lngLat: lngLat,
          name: name,
          colorIdx: 1, // Червоний колір для пошукового маркера
          posIdx: 0,
        });
      }, 500);
    } catch (e) {
      customAlert('ПОМИЛКА: Невірний формат MGRS');
      console.error(e);
    }
  } else {
    // ... логіка City ...
    const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(
      query
    )}.json?key=${apiKey}&country=ua&language=uk`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.features?.length > 0) {
        const [lon, lat] = data.features[0].center;
        startMap(lon, lat);
        // Для міста маркер зазвичай не ставимо, щоб не засмічувати центр населеного пункту,
        // але якщо потрібно — можемо додати і сюди.
      }
    } catch (e) {
      console.error(e);
    }
  }
}

// --- ПЕРЕВІРКА WEBGL ---

function checkWebGL() {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!(gl && gl instanceof WebGLRenderingContext);
  } catch (e) {
    return false;
  }
}

function showWebGLError() {
  const mapEl = document.getElementById('map');
  mapEl.innerHTML = `
        <div style="padding: 40px; color: #ff4444; background: #111; border: 2px solid #ff0000; margin: 20px; font-family: 'Courier New', monospace;">
            <h3 style="color: #ff0000;">ПОМИЛКА ІНІЦІАЛІЗАЦІЇ ГРАФІКИ (WebGL)</h3>
            <p>Firefox не може запустити графічний двигун карти.</p>
            <p><strong>ЯК ВИПРАВИТИ:</strong></p>
            <ol style="line-height: 1.6;">
                <li>Введіть у адресному рядку: <b style="color: #fff;">about:config</b></li>
                <li>Натисніть "Прийняти ризик та продовжити"</li>
                <li>Знайдіть параметр: <b style="color: #fff;">webgl.force-enabled</b></li>
                <li>Переключіть його у стан <b style="color: #00ff00;">true</b></li>
                <li>Перезапустіть браузер та систему.</li>
            </ol>
            <p style="font-size: 12px; color: #888;">Причина: Браузер заблокував доступ до GPU або драйвери потребують оновлення.</p>
        </div>
    `;
}

// --- ОНОВЛЕНА ІНІЦІАЛІЗАЦІЯ КАРТИ ---

function initMap(lon, lat) {
  // 1. Перевірка WebGL перед запуском
  if (!checkWebGL()) {
    showWebGLError();
    return;
  }

  try {
    // Внутри функции initMap(lon, lat)
    map = new maplibregl.Map({
      container: 'map',
      center: [lon, lat],
      zoom: 13,
      style: {
        version: 8,
        sources: {
          'google-satellite': {
            type: 'raster',
            tiles: ['https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'],
            tileSize: 256,
          },
          'terrain-data': {
            type: 'raster-dem',
            // Используем v2 тайлы, они точнее
            url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${apiKey}`,
            tileSize: 512,
            encoding: 'mapbox',
          },
        },
        layers: [{ id: 'sat', type: 'raster', source: 'google-satellite' }],
        terrain: { source: 'terrain-data', exaggeration: 1.0 },
      },
    });

    map.addControl(new maplibregl.NavigationControl());
    map.doubleClickZoom.disable();

    // Обробка критичної помилки WebGL після ініціалізації
    map.on('error', (e) => {
      if (e.error && e.error.message.includes('WebGL')) {
        showWebGLError();
      }
    });

    // Створення елемента для виділення області
    selectionBoxEl = document.createElement('div');
    selectionBoxEl.className = 'selection-box';
    document.getElementById('map').appendChild(selectionBoxEl);

    map.on('load', () => {
      if (!map.getSource('terrain-data')) return;
      loadSavedMarkers();
      map.addSource('ruler-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      // Добавляем невидимый слой для принудительной подгрузки DEM-тайлов
      map.addLayer({
        id: 'terrain-helper',
        type: 'hillshade',
        source: 'terrain-data',
        paint: { 'hillshade-exaggeration': 0 },
      });
      map.addLayer({
        id: 'ruler-layer-fill',
        type: 'fill',
        source: 'ruler-source',
        paint: { 'fill-color': '#00ff00', 'fill-opacity': 0.1 },
      });
      map.addLayer({
        id: 'ruler-layer-line',
        type: 'line',
        source: 'ruler-source',
        paint: { 'line-color': '#00ff00', 'line-width': 2 },
      });
      // 1. Добавляем источник векторных данных контуров
      map.addSource('contours', {
        type: 'vector',
        url: `https://api.maptiler.com/tiles/contours/tiles.json?key=${apiKey}`,
      });
      // 2. Линии рельефа (Изогипсы)
      map.addLayer({
        id: 'contour-lines',
        type: 'line',
        source: 'contours',
        'source-layer': 'contour',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          // Светло-оранжевый или коричневый цвет, характерный для топокарт
          'line-color': '#ffcc00',
          'line-opacity': 0.6,
          'line-width': [
            'match',
            ['get', 'nth_line'],
            5,
            1.5, // Каждая 5-я линия (жирная)
            0.6, // Остальные (тонкие)
          ],
        },
      });
      // 3. Подписи высот на линиях
      map.addLayer({
        id: 'contour-labels',
        type: 'symbol',
        source: 'contours',
        'source-layer': 'contour',
        filter: ['==', ['get', 'nth_line'], 5], // Подписываем только жирные линии
        layout: {
          'symbol-placement': 'line',
          'text-field': ['concat', ['get', 'ele'], 'м'],
          'text-font': ['Roboto Bold'],
          'text-size': 10,
          'text-allow-overlap': false,
        },
        paint: {
          'text-color': '#ffcc00',
          'text-halo-color': '#000',
          'text-halo-width': 1,
        },
      });
    });

    map.on('mousemove', (e) => {
      try {
        const m = mgrs.forward([e.lngLat.lng, e.lngLat.lat]);
        document.getElementById('mgrs-info').innerText = m.replace(
          /(.{3})(.{2})(.{5})(.{5})/,
          '$1 $2 $3 $4'
        );
      } catch (err) {}
      if (activeTool === 'compass' && isDrawingCompass && compassCenter) {
        updateCompassVisual(e.lngLat);
      }
    });

    map.on('click', (e) => {
      if (activeTool) handleToolClick(e.lngLat);
    });

    map.on('dblclick', (e) => {
      if (activeTool || e.originalEvent.target.closest('.marker-wrapper'))
        return;
      createMarker(e.lngLat);
    });

    // --- ЛОГІКА ВИДІЛЕННЯ ОБЛАСТІ (SCAN) ---
    map.getCanvas().addEventListener('mousedown', (e) => {
      if (activeTool !== 'scan') return;
      if (e.button !== 0) return; // Тільки ліва кнопка

      clearScanResults();

      isSelecting = true;
      map.dragPan.disable(); // Вимикаємо рух карти поки малюємо

      const rect = map.getCanvas().getBoundingClientRect();
      selectionStart = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        lngLat: map.unproject([e.clientX - rect.left, e.clientY - rect.top]), // Запам'ятовуємо координати карти
      };

      selectionBoxEl.style.left = selectionStart.x + 'px';
      selectionBoxEl.style.top = selectionStart.y + 'px';
      selectionBoxEl.style.width = '0px';
      selectionBoxEl.style.height = '0px';
      selectionBoxEl.style.display = 'block';

      uiElements.forEach((el) => {
        if (el) el.classList.add('interface-hidden');
      });
    });

    map.getCanvas().addEventListener('mousemove', (e) => {
      if (!isSelecting || activeTool !== 'scan') return;

      const rect = map.getCanvas().getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const width = Math.abs(currentX - selectionStart.x);
      const height = Math.abs(currentY - selectionStart.y);
      const newX = Math.min(currentX, selectionStart.x);
      const newY = Math.min(currentY, selectionStart.y);

      selectionBoxEl.style.left = newX + 'px';
      selectionBoxEl.style.top = newY + 'px';
      selectionBoxEl.style.width = width + 'px';
      selectionBoxEl.style.height = height + 'px';
    });

    map.getCanvas().addEventListener('mouseup', (e) => {
      if (!isSelecting || activeTool !== 'scan') return;

      isSelecting = false;
      map.dragPan.enable(); // Вмикаємо карту назад
      selectionBoxEl.style.display = 'none';

      const rect = map.getCanvas().getBoundingClientRect();
      const endLngLat = map.unproject([
        e.clientX - rect.left,
        e.clientY - rect.top,
      ]);

      uiElements.forEach((el) => {
        if (el) el.classList.remove('interface-hidden');
      });
      // Запускаємо пошук висот
      findHighestPoints(selectionStart.lngLat, endLngLat);
    });

    // --- АВТОМАТИЧНЕ ПРИХОВУВАННЯ ІНТЕРФЕЙСУ ---
    const uiElements = [
      document.getElementById('map-controls'),
      document.getElementById('results-sidebar'),
      document.getElementById('distance-info'),
    ];

    map.on('movestart', () => {
      uiElements.forEach((el) => {
        if (el) el.classList.add('interface-hidden');
      });
    });

    map.on('moveend', () => {
      uiElements.forEach((el) => {
        if (el) el.classList.remove('interface-hidden');
      });
    });
  } catch (err) {
    console.error('MapLibre critical error:', err);
    showWebGLError();
  }
}

// --- ІНСТРУМЕНТИ ---

function setActiveTool(tool) {
  const prevTool = activeTool;
  clearRuler();

  // Скидання виділення, якщо воно було
  if (selectionBoxEl) {
    selectionBoxEl.style.display = 'none';
  }

  document
    .querySelectorAll('.icon-btn')
    .forEach((b) => b.classList.remove('active'));

  if (tool === prevTool) {
    activeTool = null;
    document.getElementById('distance-info').style.display = 'none';
  } else {
    activeTool = tool;
    isDrawingCompass = false;
    compassCenter = null;

    let btnId = 1;
    if (tool === 'compass') btnId = 2;
    if (tool === 'path') btnId = 3;
    if (tool === 'scan') btnId = 4;

    document.getElementById(`ruler-btn-${btnId}`).classList.add('active');
    document.getElementById('distance-info').style.display = 'block';

    // Текст підказки
    let text = 'ОЧІКУВАННЯ...';
    if (tool === 'scan') text = 'ЗАТИСНІТЬ ТА ТЯГНІТЬ ДЛЯ ВИДІЛЕННЯ ОБЛАСТІ';
    if (tool === 'compass') text = 'ОБЕРІТЬ ЦЕНТР';

    document.getElementById('distance-info').innerHTML = text;
  }
}

function handleToolClick(lngLat) {
  if (activeTool === 'compass') {
    if (!isDrawingCompass) {
      compassCenter = [lngLat.lng, lngLat.lat];
      isDrawingCompass = true;
      addRulerPoint(lngLat);
    } else {
      isDrawingCompass = false;
      addRulerPoint(lngLat);
    }
  } else {
    addRulerPoint(lngLat);
  }
}

function updateCompassVisual(currentLngLat) {
  const center = compassCenter;
  const edge = [currentLngLat.lng, currentLngLat.lat];
  const radiusKm = turf.distance(center, edge, { units: 'kilometers' });
  const circle = turf.circle(center, radiusKm, {
    steps: 64,
    units: 'kilometers',
  });

  map.getSource('ruler-source').setData(circle);

  document.getElementById('distance-info').innerHTML = `
        <span style='color:#00ff00'>ЦИРКУЛЬ (АКТИВНО):</span><br>
        РАДІУС: ${
          radiusKm < 1
            ? Math.round(radiusKm * 1000) + ' м'
            : radiusKm.toFixed(2) + ' км'
        }`;
}

function addRulerPoint(lngLat) {
  const pointId = Date.now();
  rulerPoints.push({ id: pointId, coords: [lngLat.lng, lngLat.lat] });

  const el = document.createElement('div');
  el.className = 'ruler-point-el';
  el.style.cssText =
    'width:8px; height:8px; background:#00ff00; border-radius:50%; border:1px solid #000;';
  el.onclick = (e) => {
    e.stopPropagation();
    removeRulerPoint(pointId);
  };

  const m = new maplibregl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
  rulerMarkers.push({ id: pointId, marker: m });

  if (activeTool !== 'compass' || !isDrawingCompass) {
    updateMeasurements();
  }
}

function removeRulerPoint(id) {
  rulerMarkers = rulerMarkers.filter((m) => {
    if (m.id === id) m.marker.remove();
    return m.id !== id;
  });
  rulerPoints = rulerPoints.filter((p) => p.id !== id);

  if (activeTool === 'compass') {
    isDrawingCompass = false;
    compassCenter = null;
    if (map.getSource('ruler-source'))
      map
        .getSource('ruler-source')
        .setData({ type: 'FeatureCollection', features: [] });
    document.getElementById('distance-info').innerHTML =
      'ЦИРКУЛЬ СКИНУТО. ОБЕРІТЬ ЦЕНТР';
  } else {
    updateMeasurements();
  }
}

function updateMeasurements() {
  if (rulerPoints.length < 2) return;
  const coords = rulerPoints.map((p) => p.coords);

  if (activeTool === 'compass') {
    const radiusKm = turf.distance(coords[0], coords[coords.length - 1], {
      units: 'kilometers',
    });
    const circle = turf.circle(coords[0], radiusKm, {
      steps: 64,
      units: 'kilometers',
    });
    map.getSource('ruler-source').setData(circle);
    document.getElementById('distance-info').innerHTML = `
            <span style='color:#00ff00'>РАДІУС ЗАФІКСОВАНО:</span><br>
            ВІДСТАНЬ: ${radiusKm.toFixed(2)} км`;
  } else {
    const line = turf.lineString(coords);
    const km = turf.length(line, { units: 'kilometers' });
    const p1 = coords[coords.length - 2];
    const p2 = coords[coords.length - 1];
    const az = (turf.bearing(p1, p2) + 360) % 360;
    map.getSource('ruler-source').setData(line);
    document.getElementById(
      'distance-info'
    ).innerHTML = `ВІДСТАНЬ: ${km.toFixed(2)} км<br>АЗИМУТ: ${Math.round(az)}°`;
  }
}

function clearRuler() {
  rulerPoints = [];
  rulerMarkers.forEach((m) => m.marker.remove());
  rulerMarkers = [];
  if (map && map.getSource('ruler-source'))
    map
      .getSource('ruler-source')
      .setData({ type: 'FeatureCollection', features: [] });
}

function createMarker(lngLat, savedData = null) {
  const id = savedData ? savedData.id : Date.now();
  const name = savedData ? savedData.name : `POINT ${++markerCount}`;
  const colorIdx = savedData ? savedData.colorIdx : 0;
  const posIdx = savedData ? savedData.posIdx : 0;
  const positions = ['label-top', 'label-right', 'label-bottom', 'label-left'];

  const wrapper = document.createElement('div');
  wrapper.className = 'marker-wrapper';
  const el = document.createElement('div');
  el.className = `custom-marker ${colorClasses[colorIdx]}`;
  wrapper.appendChild(el);
  const label = document.createElement('div');
  label.className = `marker-label ${positions[posIdx]}`;
  label.innerText = name;
  wrapper.appendChild(label);

  const marker = new maplibregl.Marker({ element: wrapper, draggable: true })
    .setLngLat(lngLat)
    .addTo(map);

  if (!savedData) {
    markersData.push({ id, lngLat, name, colorIdx, posIdx });
    syncStorage();
  }

  el.onclick = (ev) => {
    ev.stopPropagation();
    if (activeTool === 'compass' && !isDrawingCompass) {
      handleToolClick(lngLat);
      return;
    }
    if (ev.shiftKey) {
      handleShiftMeasure(id, lngLat);
      return;
    }

    const mIdx = markersData.findIndex((m) => m.id === id);
    el.classList.remove(colorClasses[markersData[mIdx].colorIdx]);
    markersData[mIdx].colorIdx =
      (markersData[mIdx].colorIdx + 1) % colorClasses.length;
    el.classList.add(colorClasses[markersData[mIdx].colorIdx]);
    syncStorage();
  };

  el.oncontextmenu = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    marker.remove();
    markersData = markersData.filter((m) => m.id !== id);
    syncStorage();
  };

  marker.on('dragend', () => {
    const mIdx = markersData.findIndex((m) => m.id === id);
    markersData[mIdx].lngLat = marker.getLngLat();
    syncStorage();
  });
}

function loadSavedMarkers() {
  const saved = localStorage.getItem('typhoon_v1.4_data');
  if (saved) {
    markersData = JSON.parse(saved);
    markersData.forEach((data) => {
      createMarker(data.lngLat, data);
      const num = parseInt(data.name.replace('POINT ', ''));
      if (!isNaN(num) && num >= markerCount) markerCount = num;
    });
  }
}

function handleShiftMeasure(id, lngLat) {
  shiftSelectedMarkers.push({ id, lngLat });
  if (shiftSelectedMarkers.length === 2) {
    const p1 = shiftSelectedMarkers[0].lngLat;
    const p2 = shiftSelectedMarkers[1].lngLat;
    const line = turf.lineString([
      [p1.lng, p1.lat],
      [p2.lng, p2.lat],
    ]);
    const km = turf.length(line, { units: 'kilometers' });
    document.getElementById('distance-info').style.display = 'block';
    document.getElementById(
      'distance-info'
    ).innerHTML = `<span style='color:#00ff00'>ЗАМІР:</span> ${km.toFixed(
      2
    )} км`;
    map.getSource('ruler-source').setData(line);
    shiftSelectedMarkers = [];
  }
}

// Допоміжна функція для очистки результатів
function clearScanResults() {
  // 1. Проверка: если карта еще не создана или не загружена, просто выходим
  if (!map || !map.getStyle()) return;

  // 2. Очистка линеек и циркуля
  clearRuler();

  // 3. Скрытие панелей
  const resultsSidebar = document.getElementById('results-sidebar');
  if (resultsSidebar) resultsSidebar.style.display = 'none';

  const pointsList = document.getElementById('points-list');
  if (pointsList) pointsList.innerHTML = '';

  // 4. Безопасное удаление слоев видимости
  if (map.getLayer('visibility-canvas')) map.removeLayer('visibility-canvas');
  if (map.getSource('visibility-canvas')) map.removeSource('visibility-canvas');

  // 5. Удаление маркеров сканирования
  if (window.scanMarkersList && window.scanMarkersList.length > 0) {
    window.scanMarkersList.forEach((m) => m.remove());
    window.scanMarkersList = [];
  }

  showCopyToast('КАРТУ ОЧИЩЕНО');
}

// Допоміжна функція для видалення шарів (викликати ії замість прямого map.removeLayer)
function safeRemoveLayer(id) {
  if (map && map.getStyle()) {
    if (map.getLayer(id)) map.removeLayer(id);
    if (map.getSource(id)) map.removeSource(id);
  }
}

// Функція центруваня мапи на точці зі списку
function focusPoint(lng, lat) {
  map.flyTo({
    center: [lng, lat],
    zoom: 16, // Рівень наближення
    essential: true,
    speed: 1.2,
  });
}

async function findHighestPoints(p1, p2) {
  const pointsCountInput = await customPrompt(
    'Скільки найвищих точок знайти?',
    '5'
  );

  if (pointsCountInput === null) {
    setActiveTool(null);
    return;
  }
  const pointsCount = parseInt(pointsCountInput) || 5;

  // Визначаємо межі
  const bbox = [
    Math.min(p1.lng, p2.lng),
    Math.min(p1.lat, p2.lat),
    Math.max(p1.lng, p2.lng),
    Math.max(p1.lat, p2.lat),
  ];

  // Створюємо дуже щільну сітку (крок 10 метрів для максимальної точності)
  // Використовуємо 0.01 км, щоб точно влучити в центр найменшої ізогіпси
  const grid = turf.pointGrid(bbox, 0.01, { units: 'kilometers' });

  const results = [];

  // Пряме опитування карти (MapLibre Terrain)
  // ... всередині findHighestPoints ...
  grid.features.forEach((f) => {
    const coords = f.geometry.coordinates;
    const elev = map.queryTerrainElevation(coords) || 0;
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
    if (filtered.length >= pointsCount) break;
    const isTooClose = filtered.some(
      (f) =>
        turf.distance([p.lng, p.lat], [f.lng, f.lat], { units: 'kilometers' }) <
        0.3
    );
    if (!isTooClose) filtered.push(p);
  }

  // 1. Беремо ТОП-50 точок за попередніми даними мапи.
  // (GET-запрос має ліміт довжини URL, тому 50 точок — безпечний максимум за раз, і цього більш ніж достатньо)
  filtered.sort((a, b) => b.elevation - a.elevation);
  const fastCandidates = filtered.slice(0, 50);

  showCopyToast(`ЗАПИТ ДО NASA SRTM та OPEN-METEO (High Speed)...`);

  try {
    // Формуємо URL для пакетного запросу (координати через кому)
    const lats = fastCandidates.map((p) => p.lat).join(',');
    const lngs = fastCandidates.map((p) => p.lng).join(',');

    // Open-Meteo Elevation API: миттєва відповідь, дані Copernicus DEM 30m
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;

    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();

      // Open-Meteo повертає масив { elevation: [261, 245, ...] }
      if (data.elevation && data.elevation.length === fastCandidates.length) {
        fastCandidates.forEach((p, index) => {
          // Оновлюємо висоту
          p.elevation = Math.round(data.elevation[index]);
        });
      }
    } else {
      throw new Error('API Response Error');
    }
  } catch (e) {
    console.error('Ошибка API, використовуємо дані мапи:', e);
    showCopyToast(`ПОМИЛКА МЕРЕЖІ`);
  }

  // 2. Фінальне сортування вже за точними даними
  fastCandidates.sort((a, b) => b.elevation - a.elevation);

  // 3. Рендер результата
  // Беремо fastCandidates, оскільки ми оновили висоту сам в них

  const finalResult = fastCandidates.slice(0, pointsCount);

  renderScanResults(finalResult);
  setActiveTool(null);
}

// --- Допоміжна функція для виводу результатів ---

function renderScanResults(filtered) {
  const listEl = document.getElementById('points-list');
  listEl.innerHTML = '';
  document.getElementById('results-sidebar').style.display = 'flex';

  filtered.forEach((p, i) => {
    const color = `hsl(${(i / filtered.length) * 240}, 100%, 50%)`;
    const pointName = `PT-${i + 1}`;

    // 1. Створення маркера на карті
    const el = document.createElement('div');
    el.className = 'scan-result-marker';
    el.style.backgroundColor = color;
    const label = document.createElement('div');
    label.className = 'scan-marker-label';
    label.innerText = pointName;
    el.appendChild(label);

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([p.lng, p.lat])
      .addTo(map);

    window.scanMarkersList.push(marker);

    // 2. Створення елемента списку
    const rawMgrs = mgrs.forward([p.lng, p.lat]);
    const formattedMgrs = rawMgrs.replace(
      /(.{3})(.{2})(.{5})(.{5})/,
      '$1 $2 $3 $4'
    );
    const item = document.createElement('div');

    item.className = 'point-item';
    item.style.borderLeft = `5px solid ${color}`;
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items: baseline; pointer-events: none;">
          <b style="color: ${color}; font-size: 14px;">${pointName}</b>
          <b style="background:${color}; color:black; padding:2px 6px; border-radius:2px; font-size: 14px;">${Math.round(
      p.elevation
    )} м</b>
      </div>
      <div class="mgrs-copy-zone">
          <span class="coord-text" style="color: #00ff00; opacity: 0.8;">${formattedMgrs}</span>
          <button class="btn-copy-small btn-copy-mgrs">COPY</button>
      </div>
    `;

    // 3. Додаємо обробник кліку для зуму
    item.onclick = (e) => {
      // Перевіряємо, щоб клік не був по кнопці копіювання
      if (e.target.tagName !== 'BUTTON') {
        focusPoint(p.lng, p.lat);
      }
    };

    // 4. Кнопка копіювання (stopPropagation щоб не спрацював зум при копіюванні)
    const copyBtn = item.querySelector('.btn-copy-mgrs');
    copyBtn.onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(rawMgrs).then(() => {
        showCopyToast(`${pointName} СКОПІЙОВАНО`);
      });
    };

    listEl.appendChild(item);
  });
}

// --- СПЛИВАЮЧІ ПОВІДОМЛЕННЯ

function showCopyToast(text) {
  let toast = document.getElementById('copy-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'copy-toast';
    toast.className = 'copy-toast';
    document.body.appendChild(toast);
  }

  toast.innerText = text;
  toast.style.display = 'block';

  // Додаємо клас для анімації
  toast.classList.add('modal-success');

  // Плавне зникнення через 2 секунди
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.style.display = 'none';
      toast.style.opacity = '1';
    }, 300);
  }, 2000);
}

// --- КАСТОМНІ МОДАЛКИ ЗАМІСТЬ alert ТА prompt ---

function customAlert(text) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-alert');
    const content = modal.querySelector('.modal-content'); // Знаходимо внутрішній блок

    document.getElementById('modal-alert-text').innerText = text;

    // Додаємо клас помилки
    content.classList.add('modal-error');

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);

    document.getElementById('modal-alert-ok').onclick = () => {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.style.display = 'none';
        content.classList.remove('modal-error'); // Прибираємо після закриття
        resolve();
      }, 100);
    };
  });
}

function customPrompt(text, defaultValue) {
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-prompt');
    const input = document.getElementById('modal-prompt-input');
    const content = modal.querySelector('.modal-content');
    content.classList.add('modal-success');
    document.getElementById('modal-prompt-text').innerText = text;
    input.value = defaultValue;

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

    document.getElementById('modal-prompt-ok').onclick = () =>
      closePrompt(input.value);
    document.getElementById('modal-prompt-cancel').onclick = () =>
      closePrompt(null);

    // Додаємо підтримку клавіші Enter для зручності
    input.onkeydown = (e) => {
      if (e.key === 'Enter') closePrompt(input.value);
      if (e.key === 'Escape') closePrompt(null);
    };
  });
}

// Замість відкритих викликів map.getLayer використовуємо тільки обробник завантаження вікна

window.onload = () => {
  const input = document.getElementById('city-input');
  if (input) {
    input.value = '';
    updatePlaceholder();
  }

  // Очищення та малювання
  if (window.scanMarkersList) window.scanMarkersList.forEach((m) => m.remove());
  window.scanMarkersList = [];
};
