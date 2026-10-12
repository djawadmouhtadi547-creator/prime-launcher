// نظام الألوان: كل الأسطح تُشتق من لون الخلفية، فتبقى الواجهة متناسقة مهما كان اللون
const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));

export function hexToRgb(hex) {
  let h = String(hex || '').replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return [27, 29, 33];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const mix = (a, b, t) => a.map((v, i) => clamp(v + (b[i] - v) * t));
const trip = (c) => c.join(' ');

// ألوان هادئة مستوحاة من خامات اللعبة، بدون ألوان نيون
export const ACCENTS = [
  { id: 'moss', name: 'طحلب', color: '#7d9a5b' },
  { id: 'copper', name: 'نحاس', color: '#b87a4b' },
  { id: 'lapis', name: 'لازورد', color: '#5b78a8' },
  { id: 'amethyst', name: 'جمشت', color: '#8b6ba8' },
  { id: 'redstone', name: 'ريدستون', color: '#a9524b' },
  { id: 'gold', name: 'ذهب', color: '#b79b4c' },
];

export const BACKGROUNDS = [
  { id: 'deepslate', name: 'ديب سليت', color: '#1b1d21' },
  { id: 'basalt', name: 'بازلت', color: '#1e1e1f' },
  { id: 'forest', name: 'غابة', color: '#171e19' },
  { id: 'deep', name: 'أعماق', color: '#161d26' },
  { id: 'nether', name: 'نذر', color: '#241a1a' },
  { id: 'obsidian', name: 'أوبسيديان', color: '#17151d' },
];

export function applyTheme({ accent, bg, pattern }) {
  const root = document.documentElement;
  const A = hexToRgb(accent);
  const B = hexToRgb(bg);
  const W = [255, 255, 255];
  const K = [0, 0, 0];
  const INK = [231, 226, 214];
  const set = (k, v) => root.style.setProperty(k, v);

  set('--c-bg', trip(B));
  set('--c-panel', trip(mix(B, W, 0.055)));
  set('--c-slot', trip(mix(B, K, 0.4)));
  set('--c-hi', trip(mix(B, W, 0.16)));
  set('--c-lo', trip(mix(B, K, 0.58)));
  set('--c-ink', trip(INK));
  set('--c-mute', trip(mix(B, INK, 0.52)));

  set('--c-accent', trip(A));
  set('--c-accent-hi', trip(mix(A, W, 0.28)));
  set('--c-accent-lo', trip(mix(A, K, 0.45)));
  const luma = (0.299 * A[0] + 0.587 * A[1] + 0.114 * A[2]) / 255;
  set('--c-accent-ink', luma > 0.55 ? '22 22 20' : '244 241 232');

  root.dataset.pattern = pattern ? 'on' : 'off';
}
