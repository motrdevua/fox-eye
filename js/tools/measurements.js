import { state } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { AppState } from '../core/app-state.js';
import { showCopyToast } from '../ui/ui-utils.js';

// --- ХЕЛПЕРИ ---
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function getAzimuth(start, end) {
  if (typeof turf === 'undefined') return 0;
  let bearing = turf.bearing(start, end);
  if (bearing < 0) bearing += 360;
  return Math.round(bearing);
}

function formatDistance(km) {
  if (km < 1) return Math.round(km * 1000) + ' м';
  return km.toFixed(2) + ' км';
}

// --- ЛОГІКА ІНСТРУМЕНТІВ ---

export function handleToolClick(lngLat) {
  if (state.activeTool === 'compass') {
    // 1. ПЕРЕВІРКА: Якщо вже є 2 точки (центр і радіус) — це старе коло.
    if (state.rulerPoints.length >= 2) {
      clearMeasurements();
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
    // Лінійка
    addRulerPoint(lngLat);
  }
}

export function addRulerPoint(lngLat, shouldSave = true) {
  const pointId = generateId();
  state.rulerPoints.push({ id: pointId, coords: [lngLat.lng, lngLat.lat] });

  const el = document.createElement('div');
  // Блокуємо клік, щоб карта не отримувала зайвих подій
  el.onclick = (e) => e.stopPropagation();

  // === ТОЧНЕ ВІДНОВЛЕННЯ СТИЛІВ ЦИРКУЛЯ ===
  if (state.activeTool === 'compass') {
    el.className = 'compass-marker-dot';
    Object.assign(el.style, {
      width: '14px',
      height: '14px',
      backgroundColor: CONFIG.colors.yellow,
      border: '1px solid #000',
      borderRadius: '50%',
      margin: '6px 0 0 0',
      padding: '0',
      boxSizing: 'border-box',
      pointerEvents: 'auto', // Дозволяє тягати
      display: 'block',
    });

    // Якщо поставили другу точку (радіус), прибираємо курсор-хрестик
    if (state.rulerPoints.length === 2) {
      document.body.classList.remove('compass-active-cursor');
    }
  } else {
    // Стилі лінійки
    el.className = 'ruler-point-wrapper';

    let labelElement = document.createElement('div');
    labelElement.className = 'ruler-label';

    let distLabel = document.createElement('div');
    distLabel.className = 'ruler-label-dist';

    let icon = document.createElement('div');
    icon.innerHTML = `
      <svg class="ruler-point-svg" viewBox="0 0 24 24" style="width:24px; height:24px; display:block;">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="${CONFIG.colors.main}" stroke="${CONFIG.colors.black}"/>
      </svg>`;

    el.appendChild(distLabel);
    el.appendChild(labelElement);
    el.appendChild(icon);

    // Зберігаємо посилання на labelElement для reindexRulerPoints
    // (Але в DOM елементі простіше шукати через querySelector, як в оригіналі)
  }

  const m = new maplibregl.Marker({
    element: el,
    draggable: true,
    anchor: state.activeTool === 'compass' ? 'center' : 'bottom',
  })
    .setLngLat(lngLat)
    .addTo(state.map);

  // Context Menu (Right Click)
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

  state.rulerMarkers.push({ id: pointId, marker: m });

  reindexRulerPoints();

  // Оновлюємо виміри, тільки якщо це не активне малювання циркулем (бо там mousemove)
  if (state.activeTool !== 'compass' || !state.compass.isDrawing) {
    updateMeasurements();
  }

  if (shouldSave) AppState.save();
}

function removeRulerPoint(id) {
  const m = state.rulerMarkers.find((m) => m.id === id);
  if (m) m.marker.remove();

  state.rulerMarkers = state.rulerMarkers.filter((m) => m.id !== id);
  state.rulerPoints = state.rulerPoints.filter((p) => p.id !== id);

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

export function clearMeasurements() {
  state.rulerMarkers.forEach((item) => {
    const marker = item.marker || item;
    marker.remove();
  });

  state.rulerPoints = [];
  state.rulerMarkers = [];

  const clearGeoJSON = { type: 'FeatureCollection', features: [] };
  const rSrc = state.map.getSource('ruler-source');
  const cSrc = state.map.getSource('compass-arc');

  if (rSrc) rSrc.setData(clearGeoJSON);
  if (cSrc) cSrc.setData(clearGeoJSON);

  state.compass.isDrawing = false;
  state.compass.center = null;

  reindexRulerPoints();

  const infoEl = document.getElementById('infobar');
  if (infoEl) infoEl.style.display = 'none';

  localStorage.removeItem('fox-eye-tools');
}

// === ЦЯ ФУНКЦІЯ БУЛА ВТРАЧЕНА (ВІДПОВІДАЄ ЗА ПЛАВНІСТЬ ЦИРКУЛЯ) ===
export function updateCompassVisual(currentLngLat) {
  if (!state.compass.center || !currentLngLat) return;

  // Оптимізація: оновлюємо не частіше ніж раз на 20мс
  const now = Date.now();
  if (now - state.compass.lastUpdate < 20) return;
  state.compass.lastUpdate = now;

  const start = [state.compass.center.lng, state.compass.center.lat];
  const end = [currentLngLat.lng, currentLngLat.lat];
  const dist = turf.distance(start, end, { units: 'kilometers' });

  if (dist <= 0.001) return;

  const distText = formatDistance(dist);

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

export function updateMeasurements() {
  if (typeof turf === 'undefined') return;

  const rSrc = state.map.getSource('ruler-source');
  const cSrc = state.map.getSource('compass-arc');
  const infoEl = document.getElementById('infobar');

  if (!rSrc || !cSrc) return;

  // --- COMPASS ---
  if (state.activeTool === 'compass' && state.rulerPoints.length >= 2) {
    const start = state.rulerPoints[0].coords;
    const end = state.rulerPoints[1].coords;
    const azimuth = getAzimuth(start, end);
    const radius = turf.distance(start, end, { units: 'kilometers' });
    const distText = formatDistance(radius);

    cSrc.setData({
      type: 'FeatureCollection',
      features: [
        turf.circle(start, radius, { steps: 64, units: 'kilometers' }),
        turf.lineString([start, end], { distanceText: distText }),
      ],
    });
    rSrc.setData({ type: 'FeatureCollection', features: [] });

    if (infoEl) {
      infoEl.style.display = 'block';
      infoEl.innerHTML = `РАДІУС: <span style="color:${CONFIG.colors.yellow}">${distText}</span> | АЗИМУТ: <span style="color:${CONFIG.colors.yellow}">${azimuth}°</span>`;
    }

    // --- RULER ---
  } else if (state.rulerPoints.length > 0) {
    const features = [];
    let totalDist = 0;

    for (let i = 1; i < state.rulerPoints.length; i++) {
      const prev = state.rulerPoints[i - 1].coords;
      const curr = state.rulerPoints[i].coords;

      const line = turf.lineString([prev, curr]);
      const segmentDist = turf.length(line, { units: 'kilometers' });
      totalDist += segmentDist;

      line.properties = { distanceText: formatDistance(segmentDist) };
      features.push(line);
    }

    rSrc.setData({ type: 'FeatureCollection', features: features });
    cSrc.setData({ type: 'FeatureCollection', features: [] });

    if (infoEl) {
      if (state.rulerPoints.length > 1) {
        infoEl.style.display = 'block';
        infoEl.innerHTML = `ЗАГАЛЬНА ДИСТАНЦІЯ: <span style="color:${CONFIG.colors.yellow}">${formatDistance(totalDist)}</span>`;
      } else {
        infoEl.style.display = 'none';
      }
    }
    reindexRulerPoints();
  } else {
    rSrc.setData({ type: 'FeatureCollection', features: [] });
    if (infoEl) infoEl.style.display = 'none';
    reindexRulerPoints();
  }
}

function reindexRulerPoints() {
  if (state.activeTool === 'scan' || state.activeTool === 'compass') return;
  if (typeof turf === 'undefined') return;

  const sidebar = document.getElementById('sidebar');
  const pointsList = document.getElementById('points');

  if (state.rulerPoints.length < 2) {
    if (sidebar) sidebar.classList.add('is-hidden');
    return;
  }

  if (sidebar) sidebar.classList.remove('is-hidden');
  if (sidebar) sidebar.style.display = 'flex';
  if (pointsList) pointsList.innerHTML = '';

  let totalDist = 0;

  state.rulerPoints.forEach((pointData, index) => {
    const markerWrapper = state.rulerMarkers[index];
    const realMarker =
      markerWrapper && markerWrapper.marker
        ? markerWrapper.marker
        : markerWrapper;

    let segmentDist = '';
    let azimuthText = '';

    if (index !== 0) {
      const prev = state.rulerPoints[index - 1].coords;
      const curr = pointData.coords;
      const dist = turf.distance(prev, curr, { units: 'kilometers' });
      totalDist += dist;
      segmentDist = formatDistance(dist);
      const azimuth = getAzimuth(prev, curr);
      azimuthText = `${azimuth}°`;
    }

    if (realMarker && typeof realMarker.getElement === 'function') {
      const el = realMarker.getElement();
      const label = el.querySelector('.ruler-label');
      const distLabel = el.querySelector('.ruler-label-dist');

      if (label) label.innerText = `Точка ${index + 1}`;
      if (distLabel) {
        if (index === 0) distLabel.innerText = 'START';
        else distLabel.innerText = formatDistance(totalDist);
        distLabel.style.display = 'block';
      }
    }

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
      } catch (e) {}
    }

    const item = document.createElement('div');
    item.className = 'point-item';
    item.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items: baseline; margin-bottom: 4px;">
          <b style="color: var(--color-main);">ТОЧКА ${index + 1}</b>
          <div style="text-align:right;">
             ${
               index === 0
                 ? `<span style="background:${CONFIG.colors.main}; color:black; padding:1px 4px; border-radius:2px; font-size:11px; font-weight:bold;">START</span>`
                 : `<span style="color:#000; padding:1px 4px; border-radius:2px; font-size:11px; font-weight:bold;background:${CONFIG.colors.yellow};">DIST: ${segmentDist} <span style="font-size:0.9em">( Σ ${formatDistance(totalDist)} )</span></span>
                  <span style="color:#000; padding:1px 4px; border-radius:2px; font-size:11px; font-weight:bold; background:${CONFIG.colors.yellow}; margin-left:5px;">AZ: ${azimuthText}</span>`
             }
          </div>
      </div>
      <div class="mgrs-copy-zone">
          <span class="coord-text">${formattedMgrs}</span>
          <button class="btn-copy-small">COPY</button>
      </div>
    `;

    // Вішаємо лістенери окремо
    item.querySelector('button').onclick = (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(rawMgrs);
      showCopyToast('MGRS СКОПІЙОВАНО');
    };
    item.onclick = () => {
      state.map.flyTo({ center: coords, zoom: 16 });
    };

    if (pointsList) pointsList.appendChild(item);
  });
}
