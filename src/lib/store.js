import { useEffect, useState } from 'react';

export const DEFAULT_SETTINGS = {
  version: '',
  showSnapshots: false,
  loader: 'vanilla',
  ramMb: 3072,
  javaPath: '',
  jvmArgs: '',
  fullscreen: false,
  skinServer: '',
  curseforgeKey: '',
  accentId: 'moss',
  accent: '#7d9a5b',
  bgId: 'deepslate',
  bg: '#1b1d21',
  pattern: true,
  activeAccount: null,
};

// حالة تُحفظ تلقائياً في localStorage (داخل مجلد بيانات التطبيق)
export function usePersisted(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(initial) || Array.isArray(parsed)) return parsed;
        return { ...initial, ...parsed };
      }
    } catch {
      /* نتجاهل البيانات التالفة ونبدأ من القيم الافتراضية */
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* التخزين ممتلئ أو غير متاح */
    }
  }, [key, value]);

  return [value, setValue];
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
