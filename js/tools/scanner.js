import { state } from '../core/state.js';
import { customPrompt, showCopyToast } from '../ui/ui-utils.js';
import { CONFIG } from '../core/config.js';
// === ВАЖЛИВО: ДОДАНО ІМПОРТ ===
import { clearMeasurements } from './measurements.js';

// --- МИША (ВИДІЛЕННЯ) ---

export function handleScanStart(e) {
  if (state.activeTool !== 'scan' || e.button !== 0) return;
  e.preventDefault();

  // Тут викликається наша функція, тепер вона буде працювати
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
    const label = document.createElement('span');
    label.className = 'selection-area-label';
    label.innerText = '0 m²';
    state.selectionBoxEl.appendChild(label);
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

export function handleScanMove(e) {
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

  // Розрахунок площі (ГЕКТАРИ)
  const label = state.selectionBoxEl.querySelector('.selection-area-label');
  if (label) {
    const leftMid = state.map.unproject([newX, (newY + newY + height) / 2]);
    const rightMid = state.map.unproject([
      newX + width,
      (newY + newY + height) / 2,
    ]);
    const topMid = state.map.unproject([(newX + newX + width) / 2, newY]);
    const bottomMid = state.map.unproject([
      (newX + newX + width) / 2,
      newY + height,
    ]);

    const widthM = leftMid.distanceTo(rightMid);
    const heightM = topMid.distanceTo(bottomMid);
    const area = widthM * heightM;

    let text = '';
    if (area >= 1000000) text = (area / 1000000).toFixed(2) + ' km²';
    else if (area >= 10000) text = (area / 10000).toFixed(2) + ' ha';
    else
      text =
        Math.round(area)
          .toString()
          .replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' m²';

    label.innerText = text;
  }
}

export function handleScanEnd(e) {
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

// --- ГОЛОВНА ЛОГІКА (МАПА + API) ---

async function findHighestPoints(p1, p2) {
  const pointsCountInput = await customPrompt(
    'Скільки найвищих точок знайти?',
    '5',
  );
  if (pointsCountInput === null) {
    return;
  }

  const pointsCount = parseInt(pointsCountInput) || 5;
  const bbox = [
    Math.min(p1.lng, p2.lng),
    Math.min(p1.lat, p2.lat),
    Math.max(p1.lng, p2.lng),
    Math.max(p1.lat, p2.lat),
  ];

  // 1. ГЕНЕРАЦІЯ ЩІЛЬНОЇ СІТКИ (0.02 КМ)
  const grid = turf.pointGrid(bbox, 0.02, { units: 'kilometers' });
  const results = [];

  // 2. ПРЯМЕ ОПИТУВАННЯ КАРТИ (ШВИДКЕ)
  grid.features.forEach((f) => {
    const coords = f.geometry.coordinates;
    const elev = state.map.queryTerrainElevation(coords) || 0;
    results.push({
      lng: coords[0],
      lat: coords[1],
      elevation: Math.round(elev),
    });
  });

  results.sort((a, b) => b.elevation - a.elevation);

  // 3. ФІЛЬТРАЦІЯ (ЩОБ НЕ ЗЛИПАЛИСЯ)
  let filtered = [];
  for (let p of results) {
    if (filtered.length >= 50) break; // Ліміт
    const isTooClose = filtered.some(
      (f) =>
        turf.distance([p.lng, p.lat], [f.lng, f.lat], { units: 'kilometers' }) <
        0.3,
    );
    if (!isTooClose) filtered.push(p);
  }

  showCopyToast(`ЗАПИТ ДО Open-Meteo Elevation API...`);

  // 4. УТОЧНЕННЯ ЧЕРЕЗ API
  try {
    const lats = filtered.map((p) => p.lat).join(',');
    const lngs = filtered.map((p) => p.lng).join(',');

    const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      if (data.elevation) {
        filtered.forEach(
          (p, i) => (p.elevation = Math.round(data.elevation[i])),
        );
      }
    } else {
      throw new Error('API Response Error');
    }
  } catch (e) {
    console.error('Ошибка API, використовуємо дані мапи:', e);
    showCopyToast(`ПОМИЛКА МЕРЕЖІ (Дані з кешу)`);
  }

  // Фінальне сортування та рендер
  filtered.sort((a, b) => b.elevation - a.elevation);
  renderScanResults(filtered.slice(0, pointsCount));

  state.activeTool = null;
  document
    .querySelectorAll('.icon-btn')
    .forEach((b) => b.classList.remove('active'));
}

function renderScanResults(data) {
  const sidebar = document.getElementById('sidebar');
  const pointsList = document.getElementById('points');
  if (!sidebar || !pointsList) return;

  state.activeTool = 'scan_results';
  sidebar.classList.remove('is-hidden');
  sidebar.style.display = 'flex';
  pointsList.innerHTML = '';

  if (!state.scanMarkers) state.scanMarkers = [];

  data.forEach((p, i) => {
    const color = `hsl(${(i / data.length) * 240}, 100%, 50%)`;
    const name = `PT-${i + 1}`;

    const el = document.createElement('div');
    el.className = 'scan-result-marker';
    el.style.backgroundColor = color;
    el.innerHTML = `<div class="scan-marker-label">${name}</div>`;

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([p.lng, p.lat])
      .addTo(state.map);
    state.scanMarkers.push(marker);

    let rawMgrs = '';
    let formattedMgrs = 'N/A';
    if (typeof mgrs !== 'undefined') {
      rawMgrs = mgrs.forward([p.lng, p.lat]);
      formattedMgrs = rawMgrs.replace(
        /(.{3})(.{2})(.{5})(.{5})/,
        '$1 $2 $3 $4',
      );
    }

    const item = document.createElement('div');
    item.className = 'point-item';
    item.style.borderLeft = `5px solid ${color}`;
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items: baseline; pointer-events: none;">
          <b style="background: ${color}; font-size: 14px; color:black; padding:0px 6px 2px 6px; border-radius:2px;">${name}</b>
          <b style="background: ${color}; color:black; padding:2px 6px; border-radius:2px; font-size: 12px;">${Math.round(
            p.elevation,
          )} м</b>
      </div>
      <div class="mgrs-copy-zone">
          <span class="coord-text">${formattedMgrs}</span>
          <button class="btn-copy-small btn-copy-mgrs">COPY</button>
      </div>
    `;

    item.onclick = () => {
      state.map.flyTo({
        center: [p.lng, p.lat],
        zoom: 16,
        speed: 1.5,
        essential: true,
      });
    };

    item.querySelector('button').onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard
        .writeText(rawMgrs)
        .then(() => showCopyToast(`${name} СКОПІЙОВАНО`));
    };

    pointsList.appendChild(item);
  });
}

export function clearScanResults() {
  if (state.scanMarkers) {
    state.scanMarkers.forEach((m) => m.remove());
    state.scanMarkers = [];
  }

  // Тепер ця функція доступна завдяки імпорту
  clearMeasurements();

  document.getElementById('sidebar').classList.add('is-hidden');

  if (
    state.map &&
    state.map.getStyle() &&
    state.map.getLayer('visibility-canvas')
  ) {
    state.map.removeLayer('visibility-canvas');
  }

  showCopyToast('КАРТУ ОЧИЩЕНО');
}
