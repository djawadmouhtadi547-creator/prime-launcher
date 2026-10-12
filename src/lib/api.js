// جسر الاتصال بين الواجهة (React) ومحرّك التشغيل (Rust)
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export const isTauri = () =>
  typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

async function call(cmd, args) {
  if (!isTauri()) {
    throw new Error('هذه الميزة تعمل داخل تطبيق Prime Launcher فقط، وليس في المتصفح.');
  }
  try {
    return await invoke(cmd, args);
  } catch (err) {
    // أخطاء Rust تصل كنص عربي جاهز للعرض
    throw new Error(typeof err === 'string' ? err : err?.message || 'حدث خطأ غير متوقع');
  }
}

export const api = {
  rootPath: () => call('get_root_path'),
  listVersions: () => call('list_versions'),
  offlineUuid: (name) => call('offline_uuid', { name }),
  detectJava: () => call('detect_java'),
  launchGame: (req) => call('launch_game', { req }),
  apiGet: async (url, headers) => call('api_get', { url, headers: headers || null }),
  downloadMod: (instance, url, fileName) =>
    call('download_mod', { instance, url, fileName }),
  listMods: (instance) => call('list_mods', { instance }),
  deleteMod: (instance, fileName) => call('delete_mod', { instance, fileName }),
  setupSkinLoader: (instance, skinServer) =>
    call('setup_skin_loader', { instance, skinServer }),
  openFolder: (kind, instance = '') => call('open_folder', { kind, instance }),
};

// الاشتراك في أحداث Rust: progress / game_log / game_exit
export async function onEvent(name, handler) {
  if (!isTauri()) return () => {};
  return listen(name, (e) => handler(e.payload));
}
