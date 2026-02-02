import { state } from '../core/state.js';
import { CONFIG } from '../core/config.js';
import { showCopyToast } from './ui-utils.js';

export function toggleTheme() {
  const body = document.body;

  // 1. Перемикання класу CSS
  body.classList.toggle('theme-fox');
  const isFox = body.classList.contains('theme-fox');

  // 2. Вибір нового кольору
  const newColor = isFox ? CONFIG.colors.orange : CONFIG.colors.green; // green треба додати в конфіг, якщо його немає

  // Оновлюємо глобальний конфіг (щоб нові лінії малювались цим кольором)
  CONFIG.colors.main = newColor;

  // 3. Оновлення шарів карти (якщо карта завантажена)
  if (state.map && state.map.getStyle()) {
    updateMapLayersColor(newColor);
  }

  showCopyToast(isFox ? 'РЕЖИМ: TACTICAL FOX' : 'РЕЖИМ: TACTICAL GREEN');
}

function updateMapLayersColor(color) {
  const map = state.map;

  // Список усіх шарів, які треба перефарбувати
  const layersToUpdate = [
    { id: 'ruler-line', prop: 'line-color' },
    { id: 'ruler-labels', prop: 'text-color' },
    { id: 'compass-line', prop: 'line-color' },
    { id: 'compass-circle', prop: 'line-color' },
    { id: 'compass-labels', prop: 'text-color' },
    // Якщо є інші шари, додавай сюди
  ];

  layersToUpdate.forEach((layer) => {
    if (map.getLayer(layer.id)) {
      map.setPaintProperty(layer.id, layer.prop, color);
    }
  });

  // Окремо для заливки компаса (вона має бути прозорою)
  if (map.getLayer('compass-fill')) {
    map.setPaintProperty('compass-fill', 'fill-color', color);
  }
}
