import { state } from '../core/state.js';
import { CONFIG } from '../core/config.js';

const MARKER_COLORS = ['m-green', 'm-red', 'm-blue', 'm-yellow'];

export function createMarker(lngLat, savedData = null) {
  const isMgrs = savedData?.name?.startsWith('MGRS:');
  const id = savedData ? savedData.id : Date.now();
  const name = savedData ? savedData.name : `POINT ${++state.markerCount}`;
  let colorIdx = savedData ? savedData.colorIdx : 0;

  // 1. Створення HTML елемента
  const wrapper = document.createElement('div');
  wrapper.className = 'marker-wrapper' + (isMgrs ? ' static-marker' : '');

  const el = document.createElement('div');
  el.className = `custom-marker ${MARKER_COLORS[colorIdx]}`;
  wrapper.appendChild(el);

  const label = document.createElement('div');
  label.className = 'marker-label';
  label.innerText = name;

  // === НОВЕ: ПЕРЕЙМЕНУВАННЯ ===
  // Подвійний клік по тексту для зміни назви
  label.ondblclick = (e) => {
    e.stopPropagation(); // Щоб не ставити нові точки
    // Використовуємо звичайний prompt або ваш customPrompt
    const newName = prompt('Нова назва точки:', name);
    if (newName && newName.trim() !== '') {
      label.innerText = newName;

      // Оновлюємо в state
      const mData = state.markersData.find((m) => m.id === id);
      if (mData) {
        mData.name = newName;
        saveMarkers();
      }
    }
  };
  // ============================

  wrapper.appendChild(label);

  // 2. Створення маркера на мапі
  const marker = new maplibregl.Marker({
    element: wrapper,
    draggable: !isMgrs, // MGRS маркери не рухаються
  })
    .setLngLat(lngLat)
    .addTo(state.map);

  // 3. Зберігаємо в state
  const markerObj = { id, lngLat, name, colorIdx };
  state.markersData.push(markerObj);
  saveMarkers(); // Зберігаємо в LocalStorage

  // === ПОДІЇ ===

  // Клік - зміна кольору
  el.onclick = (e) => {
    e.stopPropagation(); // Щоб не клікнути по мапі
    el.classList.remove(MARKER_COLORS[colorIdx]);
    colorIdx = (colorIdx + 1) % MARKER_COLORS.length; // Наступний колір
    el.classList.add(MARKER_COLORS[colorIdx]);

    // Оновлюємо дані
    const mData = state.markersData.find((m) => m.id === id);
    if (mData) {
      mData.colorIdx = colorIdx;
      saveMarkers();
    }
  };

  // Правий клік - видалення
  el.oncontextmenu = (e) => {
    e.preventDefault();
    e.stopPropagation();
    marker.remove();
    state.markersData = state.markersData.filter((m) => m.id !== id);
    saveMarkers();
  };

  // Перетягування - оновлення координат
  marker.on('dragend', () => {
    const mData = state.markersData.find((m) => m.id === id);
    if (mData) {
      mData.lngLat = marker.getLngLat();
      saveMarkers();
    }
  });
}

function saveMarkers() {
  // Просте збереження в пам'ять браузера
  localStorage.setItem('fox_eye_markers', JSON.stringify(state.markersData));
}

export function loadSavedMarkers() {
  const saved = localStorage.getItem('fox_eye_markers');
  if (saved) {
    try {
      const data = JSON.parse(saved);
      data.forEach((d) => createMarker(d.lngLat, d));
      // Оновлюємо лічильник, щоб нові точки мали правильні номери
      state.markerCount = data.length;
    } catch (e) {
      console.error('Save file corrupted');
    }
  }
}
