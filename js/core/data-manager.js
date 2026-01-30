// js/core/data-manager.js
import { state } from './state.js';
import { createMarker } from '../map/markers.js';
import { addRulerPoint, clearMeasurements } from '../tools/measurements.js';
import { showCopyToast, customAlert } from '../ui/ui-utils.js';

export const DataManager = {
  // 1. ЕКСПОРТ
  exportToFile: () => {
    const data = {
      version: '1.0',
      timestamp: Date.now(),
      dateString: new Date().toLocaleString(),
      mapView: {
        center: state.map.getCenter(),
        zoom: state.map.getZoom(),
      },
      // Дані лінійки та компаса
      tools: {
        points: state.rulerPoints.map((p) => p.coords),
      },
      // Маркери
      markers: state.markersData,
    };

    // Конвертуємо в JSON
    const jsonString = JSON.stringify(data, null, 2);

    // Створюємо файл
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Генеруємо ім'я файлу: FOX_EYE_2023-10-25_1430.json
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

  // 2. ІМПОРТ
  importFromFile: (file) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // Валідація
        if (!data.mapView) throw new Error('Невірний формат');

        // Очищаємо поточну карту перед завантаженням
        clearMeasurements();
        // Видалення всіх маркерів
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

        showCopyToast('ДАНІ ЗАВАНТАЖЕНО');
      } catch (err) {
        console.error(err);
        customAlert('ПОМИЛКА ЧИТАННЯ ФАЙЛУ');
      }
    };
    reader.readAsText(file);
  },
};
