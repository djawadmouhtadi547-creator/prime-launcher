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

// ألوان حيّة تعمل جيداً مع التوهّج
export const ACCENTS = [
  { id: 'emerald', name: 'زمرد', color: '#34d399' },
  { id: 'cyan', name: 'سماوي', color: '#22d3ee' },
  { id: 'blue', name: 'أزرق', color: '#60a5fa' },
  { id: 'violet', name: 'بنفسجي', color: '#a78bfa' },
  { id: 'rose', name: 'وردي', color: '#fb7185' },
  { id: 'amber', name: 'عنبر', color: '#fbbf24' },
];

export const BACKGROUNDS = [
  { id: 'midnight', name: 'منتصف الليل', color: '#0b0f14' },
  { id: 'ink', name: 'حبر', color: '#0d0d12' },
  { id: 'forest', name: 'غابة', color: '#0a1210' },
  { id: 'ocean', name: 'محيط', color: '#0b1220' },
  { id: 'wine', name: 'نبيذ', color: '#140c10' },
  { id: 'graphite', name: 'جرافيت', color: '#111214' },
];

export function applyTheme({ accent, bg, pattern }) {
  const root = document.documentElement;
  const A = hexToRgb(accent);
  const B = hexToRgb(bg);
  const W = [255, 255, 255];
  const K = [0, 0, 0];
  const INK = [232, 236, 241];
  const set = (k, v) => root.style.setProperty(k, v);

  set('--c-bg', trip(B));
  set('--c-panel', trip(mix(B, W, 0.055)));
  set('--c-slot', trip(mix(B, K, 0.35)));
  set('--c-hi', trip(mix(B, W, 0.12)));
  set('--c-lo', trip(mix(B, K, 0.5)));
  set('--c-ink', trip(INK));
  set('--c-mute', trip(mix(B, INK, 0.58)));

  set('--c-accent', trip(A));
  set('--c-accent-hi', trip(mix(A, W, 0.35)));
  set('--c-accent-lo', trip(mix(A, K, 0.4)));
  const luma = (0.299 * A[0] + 0.587 * A[1] + 0.114 * A[2]) / 255;
  set('--c-accent-ink', luma > 0.55 ? '22 22 20' : '244 241 232');

  root.dataset.pattern = pattern ? 'on' : 'off';
}
