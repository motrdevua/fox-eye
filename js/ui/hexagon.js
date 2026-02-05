// --- ЗМІННІ МОДУЛЯ (Зберігають стан) ---
let animationId = null;
let resizeHandler = null;
let c, ctx, w, h; // Посилання на канвас та розміри

// --- ОСНОВНИЙ ОБ'ЄКТ ---
export const Hexagon = {
  start: function () {
    // 1. Захист від подвійного запуску
    if (animationId) return;

    // Ініціалізація канвасу (припускаємо, що змінна c - це глобальний ID канвасу,
    // або краще отримати його тут: document.getElementById('c'))
    c = document.getElementById('c'); // Або використовувати глобальну c, якщо вона є
    w = c.width = window.innerWidth;
    h = c.height = window.innerHeight;
    ctx = c.getContext('2d');

    // Скидаємо/ініціалізуємо параметри для нового запуску
    let tick = 0;
    let lines = [];

    const opts = {
      len: 20,
      count: 50,
      baseTime: 10,
      addedTime: 10,
      dieChance: 0.05,
      spawnChance: 1,
      sparkChance: 0.1,
      sparkDist: 10,
      sparkSize: 2,
      color: 'hsl(120,100%,light%)',
      baseLight: 50,
      addedLight: 10,
      shadowToTimePropMult: 6,
      baseLightInputMultiplier: 0.01,
      addedLightInputMultiplier: 0.02,
      cx: w / 2,
      cy: h / 2,
      repaintAlpha: 0.04,
      hueChange: 0.1,
    };

    let dieX = w / 2 / opts.len;
    let dieY = h / 2 / opts.len;
    const baseRad = (Math.PI * 2) / 6;

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h);

    // --- ЛОГІКА LINE (Конструктор і прототипи) ---
    function Line() {
      this.reset();
    }

    Line.prototype.reset = function () {
      this.x = 0;
      this.y = 0;
      this.addedX = 0;
      this.addedY = 0;
      this.rad = 0;
      this.lightInputMultiplier =
        opts.baseLightInputMultiplier +
        opts.addedLightInputMultiplier * Math.random();
      this.color = opts.color.replace('hue', tick * opts.hueChange);
      this.cumulativeTime = 0;
      this.beginPhase();
    };

    Line.prototype.beginPhase = function () {
      this.x += this.addedX;
      this.y += this.addedY;
      this.time = 0;
      this.targetTime = (opts.baseTime + opts.addedTime * Math.random()) | 0;
      this.rad += baseRad * (Math.random() < 0.5 ? 1 : -1);
      this.addedX = Math.cos(this.rad);
      this.addedY = Math.sin(this.rad);
      if (
        Math.random() < opts.dieChance ||
        this.x > dieX ||
        this.x < -dieX ||
        this.y > dieY ||
        this.y < -dieY
      )
        this.reset();
    };

    Line.prototype.step = function () {
      ++this.time;
      ++this.cumulativeTime;
      if (this.time >= this.targetTime) this.beginPhase();
      var prop = this.time / this.targetTime,
        wave = Math.sin((prop * Math.PI) / 2),
        x = this.addedX * wave,
        y = this.addedY * wave;
      ctx.shadowBlur = prop * opts.shadowToTimePropMult;
      ctx.fillStyle = ctx.shadowColor = this.color.replace(
        'light',
        opts.baseLight +
          opts.addedLight *
            Math.sin(this.cumulativeTime * this.lightInputMultiplier),
      );
      ctx.fillRect(
        opts.cx + (this.x + x) * opts.len,
        opts.cy + (this.y + y) * opts.len,
        2,
        2,
      );
      if (Math.random() < opts.sparkChance)
        ctx.fillRect(
          opts.cx +
            (this.x + x) * opts.len +
            Math.random() * opts.sparkDist * (Math.random() < 0.5 ? 1 : -1) -
            opts.sparkSize / 2,
          opts.cy +
            (this.y + y) * opts.len +
            Math.random() * opts.sparkDist * (Math.random() < 0.5 ? 1 : -1) -
            opts.sparkSize / 2,
          opts.sparkSize,
          opts.sparkSize,
        );
    };

    // --- LOOP FUNCTION ---
    function loop() {
      animationId = window.requestAnimationFrame(loop); // Зберігаємо ID
      ++tick;
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,alp)'.replace('alp', opts.repaintAlpha);
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      if (lines.length < opts.count && Math.random() < opts.spawnChance)
        lines.push(new Line());

      lines.map(function (line) {
        line.step();
      });
    }

    // --- RESIZE HANDLER ---
    resizeHandler = function () {
      w = c.width = window.innerWidth;
      h = c.height = window.innerHeight;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, w, h);
      opts.cx = w / 2;
      opts.cy = h / 2;
      dieX = w / 2 / opts.len;
      dieY = h / 2 / opts.len;
    };

    // Запуск
    loop();
    window.addEventListener('resize', resizeHandler);
    console.log('Hexagon animation started');
  },

  stop: function () {
    if (animationId) {
      window.cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeHandler);
      animationId = null;
      resizeHandler = null;
      console.log('Hexagon animation stopped');
    }
  },
};
