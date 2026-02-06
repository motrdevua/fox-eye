import { state } from '../core/state.js';

let astroContainer = null;
let sunEl = null;
let moonEl = null;
let isVisible = false; // Стан видимості

export function initAstroWidget() {
  // 1. Створюємо UI (але прихованим)
  if (!document.getElementById('astro-widget')) {
    createAstroUI();
  }

  // 2. Логіка кнопки
  const btn = document.getElementById('btn-astro');
  if (btn) {
    btn.addEventListener('click', () => {
      toggleAstroWidget();
    });
  }

  // 3. Оновлення даних (тільки якщо карта готова)
  if (state.map) {
    state.map.on('moveend', () => {
      if (isVisible) updateAstroData(); // Оновлюємо тільки якщо відкрито
    });
  }

  // Таймер хвилинний
  setInterval(() => {
    if (isVisible) updateAstroData();
  }, 60000);
}

function toggleAstroWidget() {
  isVisible = !isVisible;
  const widget = document.getElementById('astro-widget');
  const btn = document.getElementById('btn-astro');

  if (isVisible) {
    widget.style.display = 'flex';
    btn.classList.add('active'); // Підсвічуємо кнопку
    updateAstroData(); // Оновити дані одразу при відкритті
  } else {
    widget.style.display = 'none';
    btn.classList.remove('active');
  }
}

function createAstroUI() {
  const html = `
    <div id="astro-widget" class="astro-panel" style="display: none;"> <div class="astro-row" id="astro-sun">
        <span class="astro-icon">☀️</span> <span class="astro-text">--:--</span>
      </div>
      <div class="astro-row" id="astro-moon">
        <span class="astro-icon">🌑</span> <span class="astro-text">--%</span>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  astroContainer = document.getElementById('astro-widget');
  sunEl = document.querySelector('#astro-sun .astro-text');
  moonEl = document.querySelector('#astro-moon .astro-text');
}

export function updateAstroData() {
  if (!state.map) return;

  const center = state.map.getCenter();
  const date = new Date();
  const sunTimes = SunCalc.getTimes(date, center.lat, center.lng);
  const now = date.getTime();

  let sunText = '';

  // Логіка Сонця
  if (now < sunTimes.sunset.getTime() && now > sunTimes.sunrise.getTime()) {
    const diffMin = Math.round((sunTimes.sunset.getTime() - now) / 60000);
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    sunText = `Захід: ${formatTime(sunTimes.sunset)} (${hours}ч ${mins}м)`;
    setIcon('#astro-sun', '☀️');
  } else {
    let nextSunrise = sunTimes.sunrise;
    if (now > sunTimes.sunrise.getTime()) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      nextSunrise = SunCalc.getTimes(tomorrow, center.lat, center.lng).sunrise;
    }
    const diffMin = Math.round((nextSunrise.getTime() - now) / 60000);
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    sunText = `Схід: ${formatTime(nextSunrise)} (${hours}ч ${mins}м)`;
    setIcon('#astro-sun', '🌙');
  }

  if (sunEl) sunEl.innerText = sunText;

  // Логіка Місяця
  const moonIllumination = SunCalc.getMoonIllumination(date);
  const percent = Math.round(moonIllumination.fraction * 100);
  let lightDesc = percent > 80 ? 'Яскраво' : percent > 40 ? 'Норм' : 'Темно';

  if (moonEl) moonEl.innerText = `${percent}% (${lightDesc})`;
}

function setIcon(selector, icon) {
  const el = document.querySelector(selector + ' .astro-icon');
  if (el) el.innerText = icon;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
