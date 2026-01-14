# fox-eye

3. Важливе зауваження щодо Аналізу Видимості

Функція calculateVisibility все ще використовує map.queryTerrainElevation. Якщо ви хочете, щоб і зони видимості були "професійними", потрібно переписати і її на API-запити. Проте, оскільки там сотні точок на один промінь, це може бути повільно.

3. Как управлять этим слоем?

Если вы хотите иметь возможность включать/выключать изогипсы, чтобы они не перекрывали обзор, можно добавить простую кнопку в index.html:

// Функция для переключения видимости (можно вызвать из консоли или привязать к кнопке)

function toggleContours() {

    const visibility = map.getLayoutProperty('contour-lines', 'visibility');

    const nextValue = visibility === 'none' ? 'visible' : 'none';

    map.setLayoutProperty('contour-lines', 'visibility', nextValue);

    map.setLayoutProperty('contour-labels', 'visibility', nextValue);

}

// ... (ваш код, де вже створено масив filtered) ...

// 1. Сортуємо за картою та беремо топ-50 для перевірки

filtered.sort((a, b) => b.elevation - a.elevation);

const candidates = filtered.slice(0, 50);

showCopyToast(`ОТРИМАННЯ ДАНИХ (Open-Meteo)...`);

try {

    // Формуємо швидкий запит (GET)

    const lats = candidates.map(p => p.lat).join(',');

    const lngs = candidates.map(p => p.lng).join(',');

    const url =`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`;

    const response = await fetch(url);

    if (response.ok) {

    const data = await response.json();

    // Якщо прийшов масив висот, оновлюємо дані

    if (data.elevation && data.elevation.length === candidates.length) {

    candidates.forEach((p, index) => {

    p.elevation = Math.round(data.elevation[index]);

    });

    showCopyToast(`ТОЧНІСТЬ 30м ПІДТВЕРДЖЕНО`);

    }

    }

} catch (e) {

    console.warn("API Error, using map elevations:", e);

}

// 2. Фінальне сортування за уточненими даними

candidates.sort((a, b) => b.elevation - a.elevation);

// 3. Відбираємо топ точок згідно запиту користувача

const finalPoints = candidates.slice(0, pointsCount);

// --- БЛОК ГАРАНТОВАНОГО МАЛЮВАННЯ ---

// Очищаємо старі маркери, якщо вони є

if (window.scanMarkers) {

    window.scanMarkers.forEach(m => m.remove());

}

window.scanMarkers = [];

console.log("Малюємо точки:", finalPoints); // Для перевірки в консолі

// Створюємо нові маркери вручну

finalPoints.forEach((p, index) => {

    // Створення HTML елемента маркера

    const el = document.createElement('div');

    el.className = 'scan-marker'; // Використовуємо ваш CSS клас, якщо є

    el.style.backgroundColor = index === 0 ? '#ff0000' : '#ffa500'; // Лідер - червоний

    el.style.width = '24px';

    el.style.height = '24px';

    el.style.borderRadius = '50%';

    el.style.border = '2px solid #fff';

    el.style.textAlign = 'center';

    el.style.color = 'black';

    el.style.fontWeight = 'bold';

    el.style.lineHeight = '24px';

    el.innerText = index + 1;

    el.style.cursor = 'pointer';

    // Створення маркера MapLibre

    const marker = new maplibregl.Marker({ element: el })

    .setLngLat([p.lng, p.lat])

    .setPopup(new maplibregl.Popup({ offset: 25 })

    .setHTML(`

    `<div style="color:black; padding:5px;">`

    `<b>`Точка #${index + 1}`</b><br>`

    Висота:`<b>`${p.elevation} м`</b><br>`

    Коорд:${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}

    `</div>`

    `))

    .addTo(map);

    window.scanMarkers.push(marker);

});

// Також оновлюємо бокову панель (якщо функція доступна)

if (typeof renderScanResults === 'function') {

    renderScanResults(finalPoints);

}

setActiveTool(null);
