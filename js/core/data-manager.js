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
      // Інструменти (лінійка/компас)
      tools: {
        points: state.rulerPoints.map((p) => p.coords),
      },
      // Маркери
      markers: state.markersData,
    };

    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const date = new Date();
    const filename = `FOX_EYE_${date.toISOString().slice(0, 10)}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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

        // Очищення
        clearMeasurements();
        // Видалення всіх маркерів
        document
          .querySelectorAll('.marker-wrapper')
          .forEach((el) => el.remove());
        state.markersData = [];

        // Відновлення
        state.map.jumpTo({
          center: data.mapView.center,
          zoom: data.mapView.zoom,
        });

        if (data.markers) {
          data.markers.forEach((m) => createMarker(m.lngLat, m));
        }

        if (data.tools && data.tools.points) {
          // Відновлюємо лінійку
          data.tools.points.forEach((coords) => {
            addRulerPoint({ lng: coords[0], lat: coords[1] });
          });
        }

        showCopyToast('ДАНІ ЗАВАНТАЖЕНО');
      } catch (err) {
        console.error(err);
        customAlert('ПОМИЛКА ФАЙЛУ');
      }
    };
    reader.readAsText(file);
  },
};
