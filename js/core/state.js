// СТАН ПРОГРАМИ (Всі змінні, що змінюються)
export const state = {
  map: null,
  markerCount: 0,
  markersData: [],
  activeTool: null, // 'ruler', 'compass', 'scan', 'scan_results'

  los: {
    points: [], // Масив з 2 точок [{lng, lat}, {lng, lat}]
    markers: [], // Масив маркерів на мапі
  },

  // Інструменти вимірювання
  rulerPoints: [], // Масив координат {id, coords}
  rulerMarkers: [], // Масив об'єктів маркерів на карті
  scanMarkers: [],

  // Виділення
  isSelecting: false,
  selectionStart: null, // {x, y, lngLat}
  selectionBoxEl: null, // DOM елемент

  // Циркуль
  compass: {
    center: null,
    isDrawing: false,
    lastUpdate: 0,
  },
};
