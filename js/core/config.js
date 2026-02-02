// КОНФІГУРАЦІЯ (Кольори, Ключі, Налаштування)
export const CONFIG = {
  VERSION: 'v0.5.1',
  apiKey: '39vWsRU1aZVglDrRNJUv',
  colors: {
    main: '#00ff00', // Це змінюватиметься динамічно
    green: '#00ff00', // Константа для зеленої теми
    orange: '#ff6b00', // Константа для помаранчевої теми
    accent: '#ff0000',
    yellow: '#ffcc00',
    black: '#000000',
  },
  urls: {
    glyphs: 'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf',
    satellite: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    topo: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
    terrain: 'https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json',
    contours: 'https://api.maptiler.com/tiles/contours/tiles.json',
  },
};
