// Всередині setupMapEvents...

// Обробка ВІДПУСКАННЯ кнопки миші (Завершення сканування)
map.on('mouseup', (e) => {
  if (state.activeTool === 'scan' && state.isSelecting) {
    state.isSelecting = false;
    state.map.dragPan.enable(); // Повертаємо можливість рухати карту
    state.map.getCanvas().style.cursor = ''; // Скидаємо курсор

    // Отримуємо координати для запиту висот
    const p1 = state.selectionStart.lngLat;
    const p2 = e.lngLat;

    const minLng = Math.min(p1.lng, p2.lng);
    const maxLng = Math.max(p1.lng, p2.lng);
    const minLat = Math.min(p1.lat, p2.lat);
    const maxLat = Math.max(p1.lat, p2.lat);

    // Видаляємо візуальну рамку
    if (state.selectionBoxEl) {
      state.selectionBoxEl.remove(); // Або .style.display = 'none', якщо хочете перевикористати
      state.selectionBoxEl = null;
    }

    // Запускаємо пошук висот (ваша функція)
    findDominantHeightsInBox(minLng, maxLat, maxLng, minLat);
  }
});
