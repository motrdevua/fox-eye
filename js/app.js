import { injectIcons } from './ui/icons.js';
import { startMap, toggleMapStyle, toggleContours } from './map/map-core.js';
import { createMarker } from './map/markers.js';
import {
  updatePlaceholder,
  customAlert,
  showCopyToast,
  handleMgrsMask,
} from './ui/ui-utils.js';
import { CONFIG } from './core/config.js';
import { state } from './core/state.js';
import { clearMeasurements } from './tools/measurements.js';
import {
  handleScanStart,
  handleScanMove,
  handleScanEnd,
  clearScanResults,
} from './tools/scanner.js';
import { DataManager } from './core/data-manager.js';

// --- 1. ПЕРЕВІРКА WEBGL (З оригінального коду) ---
function checkWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl') || c.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

function showWebGLError() {
  document.body.innerHTML =
    '<h1 style="color:red; text-align:center; padding:50px">WebGL НЕ ПРАЦЮЄ НА ЦЬОМУ ПРИСТРОЇ</h1>';
}

// --- 2. УПРАВЛІННЯ ІНСТРУМЕНТАМИ ---
function setActiveTool(toolName) {
  const prevTool = state.activeTool;

  // Скидання UI
  document
    .querySelectorAll('.icon-btn')
    .forEach((b) => b.classList.remove('active'));
  document.body.classList.remove('compass-active-cursor');
  if (state.selectionBoxEl) state.selectionBoxEl.style.display = 'none';

  // Чистимо попередній інструмент
  if (prevTool !== toolName) {
    clearMeasurements();
    // Не чистимо результати сканування, якщо ми просто клікнули "Scan" знову або перейшли в інший режим
    if (toolName !== 'scan_results') clearScanResults();
  }

  // Логіка Toggle (вимкнення при повторному кліку)
  if (state.activeTool === toolName) {
    state.activeTool = null;
    document.getElementById('infobar').style.display = 'none';
  } else {
    state.activeTool = toolName;
    const btn = document.getElementById(toolName);
    if (btn) btn.classList.add('active');

    // Специфічні курсори та повідомлення в інфобарі
    const infoBox = document.getElementById('infobar');
    infoBox.style.display = 'block';

    if (toolName === 'ruler') {
      document.body.classList.add('compass-active-cursor');
      infoBox.innerText = '...';
    } else if (toolName === 'compass') {
      document.body.classList.add('compass-active-cursor');
      infoBox.innerText = 'ОБЕРІТЬ ЦЕНТР';
    } else if (toolName === 'scan') {
      infoBox.innerText = 'ЗАТИСНІТЬ ТА ТЯГНІТЬ';
    }
  }
}

// --- 3. ЛОГІКА ПОШУКУ ---
async function handleSearch() {
  const input = document.getElementById('search-input');
  const typeEl = document.querySelector('input[name="search-type"]:checked');
  if (!input || !typeEl) return;

  const val = input.value.trim();
  if (!val) return;

  // А. ПОШУК ЗА MGRS
  if (typeEl.value === 'mgrs') {
    try {
      if (typeof mgrs === 'undefined') throw new Error('MGRS library missing');
      const cleanMgrs = val.replace(/\s+/g, '');
      const point = mgrs.toPoint(cleanMgrs); // [lng, lat]

      startMap(point[0], point[1]);

      // Створюємо НЕРУХОМИЙ маркер для MGRS
      createMarker(
        { lng: point[0], lat: point[1] },
        {
          id: Date.now(),
          name: `MGRS: ${cleanMgrs}`,
          colorIdx: 1, // Червоний
        },
      );
    } catch (e) {
      console.error(e);
      customAlert('ПОМИЛКА MGRS (Перевірте формат)');
    }
  }
  // Б. ПОШУК НАСЕЛЕНОГО ПУНКТУ (API)
  else {
    try {
      const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(val)}.json?key=${CONFIG.apiKey}&language=uk`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network error');
      const data = await response.json();

      if (data.features?.length) {
        startMap(...data.features[0].center);
        input.value = '';
      } else {
        customAlert('НЕ ЗНАЙДЕНО');
      }
    } catch (e) {
      console.error(e);
      customAlert('ПОМИЛКА МЕРЕЖІ / API');
    }
  }
}

// --- 4. ДРУК ---
function printMap() {
  document.body.classList.add('printing-mode');
  // Даємо час браузеру перемалювати карту на повний екран перед друком
  setTimeout(() => {
    window.print();
    document.body.classList.remove('printing-mode');
  }, 1000);
}

// === ТОЧКА ВХОДУ (DOM READY) ===
document.addEventListener('DOMContentLoaded', () => {
  if (!checkWebGL()) return showWebGLError();

  injectIcons();
  updatePlaceholder();

  // Кнопка "Просто відкрити мапу"
  const openSimpleBtn = document.getElementById('open-map-simple');
  if (openSimpleBtn) {
    openSimpleBtn.onclick = () => {
      // Відкриваємо Київ або центр України за замовчуванням
      startMap(30.5234, 50.4501);
    };
  }

  // --- ПОШУК ---
  const searchInput = document.getElementById('search-input');
  const searchBtn = document.getElementById('search-btn');

  searchBtn.addEventListener('click', handleSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  // Маска MGRS при введенні
  searchInput.addEventListener('input', (e) => {
    const typeEl = document.querySelector('input[name="search-type"]:checked');
    if (typeEl && typeEl.value === 'mgrs') handleMgrsMask(e);
  });

  // Перемикання типу пошуку
  document.querySelectorAll('input[name="search-type"]').forEach((el) => {
    el.addEventListener('change', updatePlaceholder);
  });

  // --- ІНСТРУМЕНТИ ---
  document.getElementById('ruler').onclick = () => setActiveTool('ruler');
  document.getElementById('compass').onclick = () => setActiveTool('compass');
  document.getElementById('scan').onclick = () => setActiveTool('scan');

  // Очищення
  document.getElementById('clear').onclick = () => {
    setActiveTool(null);
    clearMeasurements();
    clearScanResults();
    localStorage.clear();
  };
  // Кнопка "Очистити" в сайдбарі сканера
  const clearPointsBtn = document.getElementById('clear-points');
  if (clearPointsBtn) clearPointsBtn.onclick = clearScanResults;

  // --- ШАРИ МАПИ ---
  const mapModeBtn = document.getElementById('map-mode');
  mapModeBtn.onclick = () => {
    if (toggleMapStyle()) mapModeBtn.classList.add('active');
    else mapModeBtn.classList.remove('active');
  };

  const contourBtn = document.getElementById('contours');
  contourBtn.onclick = () => {
    if (toggleContours()) contourBtn.classList.add('active');
    else contourBtn.classList.remove('active');
  };

  // --- DATA MANAGER (IMPORT/EXPORT) ---
  document.getElementById('export').onclick = DataManager.exportToFile;
  document.getElementById('print').onclick = printMap;
  document.getElementById('reload').onclick = () => location.reload();

  const fileInput = document.getElementById('file');
  document.getElementById('import').onclick = () => {
    // Запитуємо підтвердження, якщо є дані
    if (state.rulerPoints.length > 0 || state.markersData.length > 0) {
      if (!confirm('Завантаження файлу замінить поточні дані. Продовжити?'))
        return;
    }
    fileInput.click();
  };
  fileInput.onchange = (e) => {
    if (e.target.files.length > 0) {
      DataManager.importFromFile(e.target.files[0]);
      fileInput.value = '';
    }
  };

  // --- ДОВІДКА (HELP MODAL) - ВІДНОВЛЕНО ---
  const helpBtn = document.getElementById('help');
  const helpModal = document.getElementById('modal-help');
  const closeHelpBtn = document.getElementById('close-help-btn');

  if (helpBtn && helpModal) {
    helpBtn.addEventListener('click', () => {
      helpModal.style.display = 'flex';
      setTimeout(() => helpModal.classList.add('active'), 10);
    });

    const closeHelp = () => {
      helpModal.classList.remove('active');
      setTimeout(() => (helpModal.style.display = 'none'), 200);
    };

    closeHelpBtn?.addEventListener('click', closeHelp);

    // Закриття по кліку на фон
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) closeHelp();
    });
  }

  // --- ГЛОБАЛЬНІ ПОДІЇ ---

  // ESC - скасування та закриття модалок
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (state.activeTool) {
        setActiveTool(null);
        showCopyToast('ІНСТРУМЕНТ СКАСОВАНО');
      }
      // Закриття будь-якого активного модального вікна
      const activeModal = document.querySelector('.modal-overlay.active');
      if (activeModal) {
        activeModal.classList.remove('active');
        setTimeout(() => (activeModal.style.display = 'none'), 200);
      }
    }
  });

  // --- ЛОГІКА СКАНЕРА (MOUSE EVENTS) ---
  const mapContainer = document.getElementById('map');
  mapContainer.addEventListener('mousedown', handleScanStart);
  mapContainer.addEventListener('mousemove', handleScanMove);
  document.addEventListener('mouseup', handleScanEnd);
});
