import { state } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { showCopyToast } from '../ui/ui-utils.js';
import { formatDistance } from './tools-core.js';

// Налаштування висоти
const OBSERVER_HEIGHT = 1.7; // Висота очей (метри)
const TARGET_HEIGHT = 0.5; // Висота цілі (метри)
const SAMPLES = 100; // Кількість точок перевірки (точність)

// === ГОЛОВНИЙ ОБРОБНИК ===
export function handleLosClick(lngLat) {
  // 1. Якщо вже є 2 точки — починаємо заново
  if (state.los.points.length >= 2) {
    clearLos();
  }

  // 2. Додаємо точку
  state.los.points.push(lngLat);

  // Створюємо маркер
  const isObserver = state.los.points.length === 1;
  const color = isObserver ? CONFIG.colors.green : CONFIG.colors.yellow; // Cyan для Спостерігача, Magenta для Цілі
  const label = isObserver ? 'ОКО' : 'ЦІЛЬ';

  const el = document.createElement('div');
  el.className = 'los-marker';
  el.style.backgroundColor = color;
  el.innerHTML = `<div style="position:absolute; bottom:12px; left:-10px; width:40px; text-align:center; font-weight:bold; color:${color}; text-shadow:1px 1px 0 #000; font-size:12px;">${label}</div>`;

  // Стилі для кружечка
  el.style.width = '12px';
  el.style.height = '12px';
  el.style.borderRadius = '50%';
  el.style.border = '1px solid black';
  el.style.boxShadow = '0 0 5px black';

  const marker = new maplibregl.Marker({ element: el })
    .setLngLat(lngLat)
    .addTo(state.map);

  state.los.markers.push(marker);

  // 3. Якщо є обидві точки — РОЗРАХОВУЄМО
  if (state.los.points.length === 2) {
    calculateLos();
  } else {
    showCopyToast('ВСТАНОВІТЬ ЦІЛЬ');
  }
}

// === МАТЕМАТИКА ВИДИМОСТІ ===
function calculateLos() {
  if (typeof turf === 'undefined') return;

  const p1 = state.los.points[0]; // Спостерігач
  const p2 = state.los.points[1]; // Ціль

  // 1. Отримуємо висоти точок (Elevation)
  // MapLibre повертає висоту у метрах на момент запиту
  const elev1 = state.map.queryTerrainElevation(p1) || 0;
  const elev2 = state.map.queryTerrainElevation(p2) || 0;

  const startH = elev1 + OBSERVER_HEIGHT; // Абсолютна висота очей
  const endH = elev2 + TARGET_HEIGHT; // Абсолютна висота цілі

  // 2. Створюємо лінію для семплінгу
  const line = turf.lineString([
    [p1.lng, p1.lat],
    [p2.lng, p2.lat],
  ]);
  const distance = turf.length(line, { units: 'kilometers' });
  const step = distance / SAMPLES; // Крок у кілометрах

  let isVisible = true;
  let obstaclePoint = null;
  let obstacleHeight = 0;

  // 3. Проходимо по лінії і перевіряємо рельєф
  for (let i = 1; i < SAMPLES; i++) {
    const segmentDist = i * step;
    // Отримуємо координати точки на лінії
    const pos = turf.along(line, segmentDist, { units: 'kilometers' });
    const coord = pos.geometry.coordinates;

    // Висота рельєфу в цій точці
    const terrainH =
      state.map.queryTerrainElevation({ lng: coord[0], lat: coord[1] }) || 0;

    // Розрахунок висоти "Променя зору" в цій точці (Лінійна інтерполяція)
    // H_ray = StartH + (EndH - StartH) * (CurrentDist / TotalDist)
    const rayH = startH + (endH - startH) * (segmentDist / distance);

    // ГОЛОВНА ПЕРЕВІРКА: Чи земля вища за промінь?
    if (terrainH > rayH) {
      isVisible = false;
      obstaclePoint = coord; // Запам'ятовуємо, де перешкода
      obstacleHeight = terrainH;
      break; // Достатньо однієї перешкоди
    }
  }

  renderLosLine(p1, p2, isVisible, obstaclePoint);
  showLosInfo(distance, isVisible, elev1, elev2);
}

// === ВІЗУАЛІЗАЦІЯ ===
function renderLosLine(p1, p2, isVisible, obstacle) {
  const color = isVisible ? '#00FF00' : '#FF0000'; // Зелений або Червоний

  // Формуємо GeoJSON
  const features = [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [p1.lng, p1.lat],
          [p2.lng, p2.lat],
        ],
      },
      properties: { color: color },
    },
  ];

  // Якщо заблоковано, додаємо точку перешкоди
  if (!isVisible && obstacle) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: obstacle,
      },
      properties: { isObstacle: true },
    });
  }

  const source = state.map.getSource('los-source');
  if (source) source.setData({ type: 'FeatureCollection', features });
}

function showLosInfo(dist, isVisible, h1, h2) {
  const infoEl = document.getElementById('infobar');
  if (!infoEl) return;

  const status = isVisible
    ? `<span style="color:#00FF00; font-weight:bold">ВИДИМІСТЬ Є</span>`
    : `<span style="color:#FF0000; font-weight:bold">ПЕРЕШКОДА</span>`;

  // Delta H - перепад висот
  const deltaH = (h2 - h1).toFixed(1);
  const sign = deltaH > 0 ? '+' : '';

  infoEl.style.display = 'block';
  infoEl.innerHTML = `
        ${status} | Дист: ${formatDistance(dist)} <br>
        <span style="font-size:0.9em; opacity:0.8">
           Спост: ${Math.round(h1)}м -> Ціль: ${Math.round(h2)}м (Δ ${sign}${deltaH}м)
        </span>
    `;
}

export function clearLos() {
  state.los.markers.forEach((m) => m.remove());
  state.los.markers = [];
  state.los.points = [];

  const source = state.map.getSource('los-source');
  if (source) source.setData({ type: 'FeatureCollection', features: [] });

  const infoEl = document.getElementById('infobar');
  if (infoEl) infoEl.style.display = 'none';
}
