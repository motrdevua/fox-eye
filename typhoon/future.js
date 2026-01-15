async function calculateVisibility(obsLng, obsLat, obsElev, radius, obsHeight) {
  if (!map) return;

  showCopyToast(`АНАЛІЗ: ${radius}км | h=${obsHeight}м...`);

  const steps = radius > 5 ? 50 : 25;
  const rays = 120;
  // Сумуємо висоту рельєфу та висоту об'єкта
  const totalObsHeight = obsElev + obsHeight;

  if (map.getLayer('visibility-canvas')) map.removeLayer('visibility-canvas');
  if (map.getSource('visibility-canvas')) map.removeSource('visibility-canvas');

  const canvasData = {
    type: 'FeatureCollection',
    features: [],
  };

  for (let i = 0; i < rays; i++) {
    const bearing = (i * 360) / rays;
    let maxSlope = -Infinity;

    for (let j = 1; j <= steps; j++) {
      const dist = (j / steps) * radius;
      const dest = turf.destination([obsLng, obsLat], dist, bearing, {
        units: 'kilometers',
      });
      const coords = dest.geometry.coordinates;

      // Отримуємо висоту рельєфу в точці цілі
      const targetElev = map.queryTerrainElevation(coords) || 0;

      // Расчет уклона (slope) для определения, видна ли точка
      // Математична модель Line of Sight
      // slope = (висота_цілі - висота_спостерігача) / відстань
      const slope = (targetElev - totalObsHeight) / (dist * 1000);

      if (slope < maxSlope) {
        // Точка нижче лінії погляду — додаємо в маску
        const pointRadius = (radius / steps) * 0.75;
        canvasData.features.push(
          turf.circle(coords, pointRadius, { steps: 6, units: 'kilometers' })
        );
      } else {
        // Точка видима — вона стає новим "горизонтом" для цього променя
        maxSlope = slope;
      }
    }
  }

  map.addSource('visibility-canvas', {
    type: 'geojson',
    data: canvasData,
  });

  map.addLayer({
    id: 'visibility-canvas',
    type: 'fill',
    source: 'visibility-canvas',
    paint: {
      'fill-color': '#ff0000',
      'fill-opacity': 0.35, // Напівпрозорий червоний "туман"
    },
  });
}

// --- СИНТЕЗАТОР ЗВУКУ ---

const SoundEngine = {
  ctx: null,
  ambientNode: null, // Для керування фоновим звуком
  // Ініціалізація контексту (викликається один раз при першій взаємодії)
  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },

  play(type) {
    this.init();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    const now = this.ctx.currentTime;

    if (type === 'success') {
      // "Radar Ping": Два швидких гармонійних сигнали
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, now); // Висока нота
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'error') {
      // "Critical Alert": Низькочастотний дисонанс
      osc.type = 'square'; // Жорсткий звук
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.2);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.2);

      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'click') {
      // "Console Click": Короткий сухий імпульс
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1800, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      osc.start(now);
      osc.stop(now + 0.02);
    } else if (type === 'scan') {
      // "Data Sweep": Звук, що наростає (ідеально для запуску сканування)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.linearRampToValueAtTime(800, now + 0.5);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.5);

      osc.start(now);
      osc.stop(now + 0.5);
    }
  },
};

//  SoundEngine.play('scan');
//  SoundEngine.play('click');
//  SoundEngine.play('success');
//  SoundEngine.play('error');
