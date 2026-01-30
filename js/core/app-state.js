import { state } from './state.js';
import { addRulerPoint } from '../tools/measurements.js';
import { showCopyToast } from '../ui/ui-utils.js';

export const AppState = {
  // Зберігаємо стан у пам'ять
  save: () => {
    if (!state.map) return;
    const data = {
      points: state.rulerPoints.map((p) => p.coords),
      tool: state.activeTool,
      mapCenter: state.map.getCenter(),
      mapZoom: state.map.getZoom(),
    };
    localStorage.setItem('fox-eye-tools', JSON.stringify(data));
    // console.log('State saved');
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

      // 2. Відновлюємо інструмент (це робиться в app.js через setActiveTool,
      // але тут ми просто відновлюємо точки, а користувач сам обере інструмент)
      // В оригіналі tool відновлювався, але це може плутати.
      // Основне - відновити точки.

      // 3. Відновлюємо точки лінійки
      if (data.points && Array.isArray(data.points) && data.points.length > 0) {
        state.rulerPoints = [];
        state.rulerMarkers = []; // Очистити перед відновленням

        // Проходимо по збережених координатах і ставимо точки
        // Важливо: передаємо false, щоб не викликати збереження під час завантаження
        data.points.forEach((coords) => {
          const lngLat = { lng: coords[0], lat: coords[1] };
          // false - щоб уникнути циклу
          addRulerPoint(lngLat, false);
        });

        showCopyToast('МАРШРУТ ВІДНОВЛЕНО');
      }
    } catch (e) {
      console.error('Save file corrupted', e);
    }
  },
};
