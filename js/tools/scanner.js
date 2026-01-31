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
  if (typeof turf === 'undefined') return;

  const bbox = [
    Math.min(p1.lng, p2.lng),
    Math.min(p1.lat, p2.lat),
    Math.max(p1.lng, p2.lng),
    Math.max(p1.lat, p2.lat),
  ];

  // 1. РОЗРАХУНОК ДИНАМІЧНОГО КРОКУ (ГРУБИЙ ПОШУК)
  const poly = turf.bboxPolygon(bbox);
  const areaKm2 = turf.area(poly) / 1000000;

  // Для грубого пошуку беремо менше точок (наприклад, 1600), щоб було швидко
  let coarseStep = Math.sqrt(areaKm2 / 1600);
  coarseStep = Math.max(0.02, Math.min(coarseStep, 0.5));

  // Розрахунок рекомендованої відстані
  const diagonal = turf.distance([bbox[0], bbox[1]], [bbox[2], bbox[3]], {
    units: 'kilometers',
  });
  let recMinDist = (diagonal * 0.1).toFixed(2);
  if (recMinDist < 0.1) recMinDist = 0.1;

  // Питання користувачу
  const pointsCountInput = await customPrompt('Кількість точок:', '5');
  if (pointsCountInput === null) return;
  const minDistInput = await customPrompt('Мін. відстань (км):', recMinDist);
  if (minDistInput === null) return;

  const pointsCount = parseInt(pointsCountInput) || 5;
  const minDistance = parseFloat(minDistInput.replace(',', '.')) || 0.1;

  showCopyToast(`Грубе сканування (${areaKm2.toFixed(1)} км²)...`);

  // --- ЕТАП 1: ГРУБИЙ ПРОХІД ---
  const coarseGrid = turf.pointGrid(bbox, coarseStep, { units: 'kilometers' });
  let candidates = [];

  coarseGrid.features.forEach((f) => {
    const coords = f.geometry.coordinates;
    const elev = state.map.queryTerrainElevation(coords) || 0;
    candidates.push({ lng: coords[0], lat: coords[1], elevation: elev });
  });

  // Сортуємо і беремо топ-20 кандидатів для детальної перевірки
  candidates.sort((a, b) => b.elevation - a.elevation);
  let topCandidates = candidates.slice(0, 30);

  showCopyToast(`Уточнення вершин...`);

  // --- ЕТАП 2: ТОЧНИЙ ПРОХІД (LOCAL REFINEMENT) ---
  // Навколо кожного кандидата скануємо квадрат 100x100м з кроком 10м
  let refinedResults = [];

  for (let cand of topCandidates) {
    // Створюємо мікро-bbox навколо кандидата (приблизно +/- 100 метрів)
    // 0.001 градуса ~ 111 метрів
    const buffer = 0.0015;
    const miniBbox = [
      cand.lng - buffer,
      cand.lat - buffer,
      cand.lng + buffer,
      cand.lat + buffer,
    ];

    // Супер-щільна сітка (крок 0.01 км = 10 метрів)
    const fineGrid = turf.pointGrid(miniBbox, 0.01, { units: 'kilometers' });

    let localMax = { lng: cand.lng, lat: cand.lat, elevation: cand.elevation };

    fineGrid.features.forEach((f) => {
      const coords = f.geometry.coordinates;
      const elev = state.map.queryTerrainElevation(coords) || 0;
      if (elev > localMax.elevation) {
        localMax = { lng: coords[0], lat: coords[1], elevation: elev };
      }
    });
    refinedResults.push(localMax);
  }

  // --- ЕТАП 3: ФІЛЬТРАЦІЯ ТА API ---
  // Сортуємо уточнені результати
  refinedResults.sort((a, b) => b.elevation - a.elevation);

  // Фільтруємо за дистанцією (тепер ми фільтруємо вже ТОЧНІ вершини)
  let finalPoints = [];
  for (let p of refinedResults) {
    if (finalPoints.length >= 50) break;
    const isTooClose = finalPoints.some(
      (f) =>
        turf.distance([p.lng, p.lat], [f.lng, f.lat], { units: 'kilometers' }) <
        minDistance,
    );
    if (!isTooClose) finalPoints.push(p);
  }

  // Запит до Open-Meteo для фінальної перевірки висот
  try {
    const requestPoints = finalPoints.slice(0, pointsCount * 2); // Беремо з запасом
    if (requestPoints.length > 0) {
      const lats = requestPoints.map((p) => p.lat).join(',');
      const lngs = requestPoints.map((p) => p.lng).join(',');
      const response = await fetch(
        `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`,
      );

      if (response.ok) {
        const data = await response.json();
        requestPoints.forEach((p, i) => {
          if (data.elevation && data.elevation[i])
            p.elevation = Math.round(data.elevation[i]);
        });
      }
    }
  } catch (e) {
    console.warn('API Error');
  }

  finalPoints.sort((a, b) => b.elevation - a.elevation);
  renderScanResults(finalPoints.slice(0, pointsCount));

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
