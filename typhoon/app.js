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
let currentStyle = 'sat';

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

// Функція для перемикання видимості шарів
function toggleMapLayer(layerId, btnId) {
  if (!map.getLayer(layerId)) return;

  const currentVisibility = map.getLayoutProperty(layerId, 'visibility');

  // Якщо властивість undefined (стандарт стилю) або 'none' — вмикаємо, інакше вимикаємо
  const newVisibility = currentVisibility === 'none' ? 'visible' : 'none';

  map.setLayoutProperty(layerId, 'visibility', newVisibility);

  // Оновлюємо візуал кнопки
  const btn = document.getElementById(btnId);
  if (btn) {
    if (newVisibility === 'visible') {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
}

function startMap(lon, lat) {
  document.getElementById('search-overlay').style.display = 'none';
  document.getElementById('map-controls').style.display = 'block';
  initMap(lon, lat);
  // Реєстрація подій після ініціалізації мапи
  document.getElementById('toggle-contours-btn').onclick = () => {
    // Вкажіть правильний ID шару для ліній контуру
    toggleMapLayer('contour-lines', 'toggle-contours-btn');
    toggleMapLayer('contour-labels', 'toggle-contours-btn');
  };
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
  if (typeof maplibregl === 'undefined') {
    console.error('Бібліотека MapLibre не завантажена!');
    customAlert(
      'КРИТИЧНА ПОМИЛКА: Бібліотека карти не знайдена. Перевірте інтернет або індексний файл.'
    );
    return;
  }

  //  Перевірка WebGL перед запуском
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
        glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${apiKey}`,
        sources: {
          'google-satellite': {
            type: 'raster',
            tiles: ['https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'],
            tileSize: 256,
          },
          'topo-map': {
            type: 'raster',
            tiles: ['https://tile.opentopomap.org/{z}/{x}/{y}.png'], // Світла топокарта
            tileSize: 256,
            attribution: '© OpenTopoMap',
          },
          'terrain-data': {
            type: 'raster-dem',
            url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${apiKey}`,
            tileSize: 512,
            encoding: 'mapbox',
          },
        },
        layers: [
          {
            id: 'topo',
            type: 'raster',
            source: 'topo-map',
            layout: { visibility: 'none' }, // Спочатку прихована
          },
          {
            id: 'sat',
            type: 'raster',
            source: 'google-satellite',
            layout: { visibility: 'visible' },
          },
        ],
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
      // Список ID шарів, які відповідають за рельєф у вашому стилі
      const contourLayers = ['contour', 'contour_label'];

      contourLayers.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, 'visibility', 'none');
        }
      });
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
        paint: {
          'line-color': '#00ff00',
          'line-width': 2,
          'line-dasharray': [4, 2], // Короткі штрихи: 2px лінія, 2px пробіл
        },
      });
      map.addLayer({
        id: 'ruler-labels',
        type: 'symbol',
        source: 'ruler-source',
        layout: {
          'symbol-placement': 'line',
          'text-field': ['get', 'distanceText'],
          // Використовуємо стандартні шрифти MapTiler/MapLibre
          'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 12,
          'text-offset': [0, -1],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-max-width': 10,
          'symbol-spacing': 250,
        },
        paint: {
          'text-color': '#00ff00',
          'text-halo-color': '#000000',
          'text-halo-width': 1,
        },
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
        // filter: ['==', ['get', 'nth_line'], 5], // Подписываем только жирные линии
        layout: {
          'symbol-placement': 'line',
          // Використовуємо to-string, щоб гарантувати відображення числа
          'text-field': ['concat', ['to-string', ['get', 'height']], ' м'],
          'text-font': ['Noto Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 10,
          'text-allow-overlap': false,
          'symbol-spacing': 350, // Відстань між повторами цифр на одній лінії
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
        if (document.getElementById('mgrs-info')) {
          document.getElementById('mgrs-info').innerText = m.replace(
            /(.{3})(.{2})(.{5})(.{5})/,
            '$1 $2 $3 $4'
          );
        }
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
      // Запускаємо пошук висот у виділеній області
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

  // Прибираємо клас курсору при будь-якій зміні інструменту
  document.body.classList.remove('compass-active-cursor');

  if (tool !== null) {
    clearSidebar(); // Чистимо тільки якщо вмикаємо НОВИЙ інструмент
    clearRuler();
  }

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

    // ДОДАЙ ЦЮ ПЕРЕВІРКУ:
    if (tool) {
      // ДОДАЄМО КЛАС ДЛЯ КУРСОРУ, якщо обрано Циркуль або Лінійку (за бажанням)
      if (tool === 'compass' || tool === 'ruler') {
        document.body.classList.add('compass-active-cursor');
      }

      let btnId = 1;
      if (tool === 'compass') btnId = 2;
      if (tool === 'scan') btnId = 3;

      const btn = document.getElementById(`ruler-btn-${btnId}`);
      if (btn) btn.classList.add('active');

      document.getElementById('distance-info').style.display = 'block';

      let text = 'ОЧІКУВАННЯ...';
      if (tool === 'scan') {
        text = 'ЗАТИСНІТЬ ТА ТЯГНІТЬ ДЛЯ ВИДІЛЕННЯ ОБЛАСТІ';
        document.body.classList.remove('compass-active-cursor'); // Для сканування хрестик зазвичай не потрібен
      }
      if (tool === 'compass') text = 'ОБЕРІТЬ ЦЕНТР';

      document.getElementById('distance-info').innerHTML = text;
    }
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
  const distText =
    radiusKm < 1
      ? Math.round(radiusKm * 1000) + ' м'
      : radiusKm.toFixed(2) + ' км';

  const circle = turf.circle(center, radiusKm, {
    steps: 128,
    units: 'kilometers',
  });
  const radiusLine = turf.lineString([center, edge], {
    distanceText: distText,
  });

  map.getSource('ruler-source').setData({
    type: 'FeatureCollection',
    features: [circle, radiusLine],
  });

  document.getElementById('distance-info').innerHTML = `
        <span style='color:#00ff00'>ЦИРКУЛЬ (АКТИВНО):</span><br>
        РАДІУС: ${distText}`;
}

function addRulerPoint(lngLat) {
  // 1. ЛОГІКА ДЛЯ ЦИРКУЛЯ: Очищення перед початком НОВОГО кола
  if (activeTool === 'compass' && rulerPoints.length >= 2) {
    clearRuler();
  }
  const pointId = Date.now();
  rulerPoints.push({ id: pointId, coords: [lngLat.lng, lngLat.lat] });

  let markerElement = document.createElement('div');
  //  для кожного нового маркера
  markerElement.style.zIndex = '1';

  let anchorPoint = 'bottom';
  let labelElement = null;

  if (activeTool === 'compass') {
    if (rulerPoints.length === 2) {
      document.body.classList.remove('compass-active-cursor');
    }
    // ДЛЯ ЦИРКУЛЯ: Створюємо максимально "чистий" об'єкт
    markerElement.className = 'compass-marker-dot';

    // ВАЖЛИВО: задаємо розміри та скидаємо всі відступи
    Object.assign(markerElement.style, {
      width: '14px',
      height: '14px',
      backgroundColor: '#ffff00',
      border: '1px solid #000',
      borderRadius: '50%',
      boxSizing: 'border-box',
      margin: '0',
      padding: '0',
      pointerEvents: 'auto', // Дозволяє тягати вже поставлену точку
      display: 'block',
      margin: '6px 0px 0px 0px',
    });

    const m = new maplibregl.Marker({
      element: markerElement,
      draggable: true,
      anchor: 'center', // Це найважливіше для збігу з курсором
    })
      .setLngLat(lngLat)
      .addTo(map);

    rulerMarkers.push({ id: pointId, marker: m, labelElement: null });
  } else {
    // ДЛЯ ЛІНІЙКИ: залишаємо стандартний маячок
    markerElement.className = 'ruler-point-wrapper';
    markerElement.style.cssText =
      'display:flex; flex-direction:column; align-items:center;';

    const distLabel = document.createElement('div');
    distLabel.className = 'ruler-dist-label';
    distLabel.style.display = 'none';
    markerElement.appendChild(distLabel);

    labelElement = document.createElement('div');
    labelElement.className = 'ruler-label';
    markerElement.appendChild(labelElement);

    const icon = document.createElement('div');
    icon.innerHTML = `
      <svg class="ruler-point-svg" viewBox="0 0 24 24" style="width:24px; height:24px; display:block;">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#00ff00" stroke="#000"/>
      </svg>`;
    markerElement.appendChild(icon);
    anchorPoint = 'bottom';
  }

  const m = new maplibregl.Marker({
    element: markerElement,
    draggable: true,
    anchor: anchorPoint, // Для циркуля тут буде 'center'
  })
    .setLngLat(lngLat)
    .addTo(map);

  markerElement.oncontextmenu = (e) => {
    e.stopPropagation();
    e.preventDefault();
    removeRulerPoint(pointId);
  };

  m.on('drag', () => {
    const newCoords = m.getLngLat();
    const pIdx = rulerPoints.findIndex((p) => p.id === pointId);
    if (pIdx !== -1) {
      rulerPoints[pIdx].coords = [newCoords.lng, newCoords.lat];
      updateMeasurements();
      reindexRulerPoints();
    }
  });

  rulerMarkers.push({ id: pointId, marker: m, labelElement: labelElement });
  reindexRulerPoints();

  if (activeTool !== 'compass' || !isDrawingCompass) {
    updateMeasurements();
  }
}

function reindexRulerPoints() {
  const listEl = document.getElementById('points-list');
  const sidebar = document.getElementById('results-sidebar');

  // Додайте перевірку на ваш новий стан
  if (activeTool === 'scan' || activeTool === 'scan_results') return;
  // 2. Якщо ЦИРКУЛЬ — ХОВАЄМО (тут сайдбар не потрібен)
  if (activeTool === 'compass') {
    if (sidebar) sidebar.style.display = 'none';
    return;
  }

  // 3. Логіка ЛІНІЙКИ (показуємо сайдбар тільки якщо є > 1 точки)
  if (rulerPoints.length < 2) {
    if (listEl) listEl.innerHTML = '';
    if (sidebar) sidebar.style.display = 'none';
    return;
  }

  // Якщо ми дійшли сюди — значить активна Лінійка і точок багато
  if (sidebar) sidebar.style.display = 'flex';
  if (listEl) listEl.innerHTML = '';

  let totalSoFar = 0;

  rulerMarkers.forEach((mObj, index) => {
    const el = mObj.marker.getElement();
    const label = el.querySelector('.ruler-label');
    const distLabel = el.querySelector('.ruler-dist-label');
    const coords = rulerPoints[index].coords;

    if (index > 0) {
      const segmentDist = turf.distance(rulerPoints[index - 1].coords, coords, {
        units: 'kilometers',
      });
      totalSoFar += segmentDist;
    }

    const displayDist =
      totalSoFar < 1
        ? `${Math.round(totalSoFar * 1000)}м`
        : `${totalSoFar.toFixed(2)}км`;

    if (label) label.innerText = `ТОЧКА ${index + 1}`;
    if (distLabel) {
      distLabel.innerText = displayDist;
      distLabel.style.display = index === 0 ? 'none' : 'block';
    }

    const rawMgrs = mgrs.forward(coords);
    const formattedMgrs = rawMgrs.replace(
      /(.{3})(.{2})(.{5})(.{5})/,
      '$1 $2 $3 $4'
    );

    const item = document.createElement('div');
    item.className = 'point-item';
    item.style.borderLeft = `5px solid var(--color-main)`;
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items: baseline;">
          <b style="color: var(--color-main);">ТОЧКА ${index + 1}</b>
          <b style="background:var(--color-main); color:black; padding:2px 6px; border-radius:2px; font-size:11px;">
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

function removeRulerPoint(id) {
  // 1. Видаляємо маркер з карти та масивів
  rulerMarkers = rulerMarkers.filter((m) => {
    if (m.id === id) {
      m.marker.remove();
      return false;
    }
    return true;
  });
  rulerPoints = rulerPoints.filter((p) => p.id !== id);

  // 2. СПЕЦІАЛЬНА ЛОГІКА ДЛЯ ЦИРКУЛЯ
  if (activeTool === 'compass') {
    clearSidebar();
    isDrawingCompass = false;
    compassCenter = null;

    // Очищуємо графіку циркуля на карті
    if (map.getSource('ruler-source')) {
      map
        .getSource('ruler-source')
        .setData({ type: 'FeatureCollection', features: [] });
    }

    // Повне скидання масивів для циркуля
    rulerMarkers.forEach((m) => m.marker.remove());
    rulerMarkers = [];
    rulerPoints = [];

    document.getElementById('distance-info').innerHTML =
      'ЦИРКУЛЬ СКИНУТО. ОБЕРІТЬ ЦЕНТР';

    // Гарантовано ховаємо сайдбар, якщо він був відкритий іншим інструментом
    clearSidebar();
    return; // ПРИПИНЯЄМО виконання функції
  }

  // 3. ЛОГІКА ДЛЯ ЛІНІЙКИ (Multi-point ruler)
  if (rulerPoints.length < 2) {
    // Якщо точок замало для лінії — чистимо все
    if (map.getSource('ruler-source')) {
      map
        .getSource('ruler-source')
        .setData({ type: 'FeatureCollection', features: [] });
    }

    // Видаляємо останню одиноку точку, якщо вона була
    rulerMarkers.forEach((m) => m.marker.remove());
    rulerMarkers = [];
    rulerPoints = [];

    document.getElementById('distance-info').innerHTML = 'ВІДСТАНЬ: 0 м';
    clearSidebar(); // Знищуємо сайдбар
  } else {
    // Якщо точок 2 і більше — оновлюємо лінію та сайдбар
    if (map.getSource('ruler-source')) {
      map.getSource('ruler-source').setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: rulerPoints.map((p) => p.coords),
        },
      });
    }

    // Оновлюємо розрахунки та список у сайдбарі
    updateMeasurements();
    reindexRulerPoints();
  }
}

function clearSidebar() {
  const listEl = document.getElementById('points-list');
  const sidebar = document.getElementById('results-sidebar');
  if (listEl) listEl.innerHTML = '';
  if (sidebar) sidebar.style.display = 'none';
}

function updateMeasurements() {
  if (!map.getSource('ruler-source')) return;

  const features = [];
  let totalDist = 0;

  if (activeTool === 'compass') {
    if (rulerPoints.length >= 2) {
      const center = rulerPoints[0].coords;
      const edge = rulerPoints[1].coords;

      // Розрахунок відстані
      const radius = turf.distance(center, edge, { units: 'kilometers' });

      // Створюємо текст відстані тут (доступний для всього блоку)
      const distText =
        radius < 1
          ? Math.round(radius * 1000) + ' м'
          : radius.toFixed(2) + ' км';

      // Геометрія кола з високою точністю
      const circleGeo = turf.circle(center, radius, {
        steps: 256,
        units: 'kilometers',
      });
      const lineGeo = turf.lineString([center, edge]);

      features.push({
        type: 'Feature',
        geometry: circleGeo.geometry,
        properties: {},
      });

      features.push({
        type: 'Feature',
        geometry: lineGeo.geometry,
        properties: {
          distanceText: distText, // Тепер змінна точно визначена
        },
      });

      // Оновлення текстового інфо-блоку в UI
      const infoEl = document.getElementById('distance-info');
      if (infoEl) {
        infoEl.innerHTML = `РАДІУС ЗАФІКСОВАНО: <span style="color:#00ff00">${distText}</span>`;
      }
    }
  } else {
    // ЛОГІКА ДЛЯ ЗВИЧАЙНОЇ ЛІНІЙКИ
    if (rulerPoints.length >= 2) {
      const coords = rulerPoints.map((p) => p.coords);
      const lineGeo = turf.lineString(coords);
      totalDist = turf.length(lineGeo, { units: 'kilometers' });

      const distText =
        totalDist < 1
          ? Math.round(totalDist * 1000) + ' м'
          : totalDist.toFixed(2) + ' км';

      features.push({
        type: 'Feature',
        geometry: lineGeo.geometry,
        properties: { distanceText: distText },
      });

      const infoEl = document.getElementById('distance-info');
      if (infoEl) {
        infoEl.innerHTML = `ВІДСТАНЬ: <span style="color:#00ff00">${distText}</span>`;
      }
    }
  }

  // Завантажуємо дані в джерело одним масивом features
  map.getSource('ruler-source').setData({
    type: 'FeatureCollection',
    features: features,
  });
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

  // Створюємо дуже щільну сітку (крок 20 метрів для максимальної точності)
  // Використовуємо 0.02 км, щоб точно влучити в центр найменшої ізогіпси
  const grid = turf.pointGrid(bbox, 0.02, { units: 'kilometers' });

  const results = [];

  // Пряме опитування карти (MapLibre Terrain)
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
  activeTool = null;
  document
    .querySelectorAll('.icon-btn')
    .forEach((b) => b.classList.remove('active'));
}

// --- Допоміжна функція для виводу результатів ---

function renderScanResults(filtered) {
  const sidebar = document.getElementById('results-sidebar');
  const listEl = document.getElementById('points-list');

  if (!sidebar || !listEl) return;

  activeTool = 'scan_results'; // ДОДАЙТЕ ЦЕ. Це "фейковий" стан, щоб система знала, що панель зараз потрібна
  sidebar.style.display = 'flex';
  listEl.innerHTML = '';

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

function toggleMapStyle() {
  const isSat = map.getLayoutProperty('sat', 'visibility') === 'visible';

  if (isSat) {
    map.setLayoutProperty('sat', 'visibility', 'none');
    map.setLayoutProperty('topo', 'visibility', 'visible');
    document.getElementById('style-toggle').classList.add('active');
    showCopyToast('ТОПОГРАФІЧНА МАПА АКТИВОВАНА');
  } else {
    map.setLayoutProperty('topo', 'visibility', 'none');
    map.setLayoutProperty('sat', 'visibility', 'visible');
    document.getElementById('style-toggle').classList.remove('active');
    showCopyToast('СУПУТНИК АКТИВОВАНИЙ');
  }
}

async function printMap() {
  const wasSat = map.getLayoutProperty('sat', 'visibility') === 'visible';

  // 1. Якщо був супутник — перемикаємо на світлу для друку
  if (wasSat) {
    map.setLayoutProperty('sat', 'visibility', 'none');
    map.setLayoutProperty('topo', 'visibility', 'visible');
  }

  // Тимчасово приховуємо кнопки (твій існуючий код)
  const ui = [
    document.getElementById('map-controls'),
    document.getElementById('results-sidebar'),
  ];
  ui.forEach((el) => {
    if (el) el.style.visibility = 'hidden';
  });

  // Даємо мапі 500мс, щоб провантажити світлі тайли перед друком
  setTimeout(() => {
    window.print();

    // 2. Повертаємо все як було
    if (wasSat) {
      map.setLayoutProperty('topo', 'visibility', 'none');
      map.setLayoutProperty('sat', 'visibility', 'visible');
    }
    ui.forEach((el) => {
      if (el) el.style.visibility = 'visible';
    });
  }, 500);
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
