// خدمة السكنات:
//  - توليد روابط السكنات من سيرفرك (يستخدمها مود CustomSkinLoader داخل اللعبة)
//  - التحقق من ملف PNG ورفعه إلى السيرفر
//  - تثبيت CustomSkinLoader وضبط إعداده تلقائياً
import { api } from '../lib/api.js';
import { instanceId } from '../lib/instance.js';
import * as modrinth from './modrinth.js';

/** ينظّف عنوان السيرفر: يحذف الشرطة الأخيرة ويرفض ما لا يبدأ بـ http(s). */
export function normalizeServer(url) {
  const v = String(url || '').trim().replace(/\/+$/, '');
  return /^https?:\/\/.+/i.test(v) ? v : '';
}

export const skinUrl = (server, name) => `${server}/skins/${encodeURIComponent(name)}.png`;
export const capeUrl = (server, name) => `${server}/capes/${encodeURIComponent(name)}.png`;

/** رابط CustomSkinLoader بصيغته الحرفية، لاستخدامه يدوياً في إعدادات المود. */
export const skinUrlTemplate = (server) => `${server}/skins/{USERNAME}.png`;

// ───────────── سكن افتراضي يُرسم برمجياً (64×64) ─────────────
let cachedDefault = '';
export function defaultSkinDataUrl() {
  if (cachedDefault) return cachedDefault;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const r = (col, x, y, w, h) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  const SKIN = '#c68e6b';
  const HAIR = '#4a3320';
  const SHIRT = '#3f8f9c';
  const PANTS = '#3b4478';
  const SHOE = '#55575c';

  r(SKIN, 0, 0, 32, 16); // الرأس
  r(HAIR, 8, 0, 8, 8); // أعلى الرأس
  r(HAIR, 0, 8, 32, 2); // خط الشعر
  r(HAIR, 24, 8, 8, 8); // خلف الرأس
  r('#ffffff', 9, 12, 1, 1);
  r('#3b3f8f', 10, 12, 1, 1);
  r('#3b3f8f', 13, 12, 1, 1);
  r('#ffffff', 14, 12, 1, 1);
  r('#8c5a45', 11, 14, 2, 1);

  r(SHIRT, 16, 16, 24, 16); // الجذع
  r(SKIN, 40, 16, 16, 16); // الذراع اليمنى
  r(SHIRT, 40, 16, 16, 7);
  r(PANTS, 0, 16, 16, 16); // الساق اليمنى
  r(SHOE, 0, 28, 16, 4);
  r(SKIN, 32, 48, 16, 16); // الذراع اليسرى
  r(SHIRT, 32, 48, 16, 7);
  r(PANTS, 16, 48, 16, 16); // الساق اليسرى
  r(SHOE, 16, 60, 16, 4);

  cachedDefault = c.toDataURL('image/png');
  return cachedDefault;
}

// ───────────── التحقق من ملف السكن ─────────────
export async function readSkinFile(file) {
  if (!file) throw new Error('لم يتم اختيار ملف');
  if (file.type && file.type !== 'image/png') throw new Error('الملف يجب أن يكون بصيغة PNG');
  if (file.size > 256 * 1024) throw new Error('حجم السكن كبير جداً (الحد الأقصى 256 كيلوبايت)');

  const buf = new Uint8Array(await file.arrayBuffer());
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24 || sig.some((b, i) => buf[i] !== b)) {
    throw new Error('الملف ليس صورة PNG صالحة');
  }
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const width = dv.getUint32(16);
  const height = dv.getUint32(20);
  if (!(width === 64 && (height === 64 || height === 32))) {
    throw new Error(`مقاس السكن ${width}×${height} غير مدعوم. المقاسات المقبولة: 64×64 أو 64×32`);
  }
  return { width, height, legacy: height === 32 };
}

// ───────────── الرفع إلى السيرفر ─────────────
// الأسماء في وضع الأوفلاين غير محمية، لذلك يولّد اللانشر رمزاً سرياً لكل اسم
// ويرسله مع الرفع؛ السيرفر يحجز الاسم لأول رمز يراه.
function tokenKey(name) {
  return `prime.skintoken.${name.toLowerCase()}`;
}

export function getSkinToken(name) {
  try {
    let t = localStorage.getItem(tokenKey(name));
    if (!t) {
      const a = new Uint8Array(24);
      crypto.getRandomValues(a);
      t = Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(tokenKey(name), t);
    }
    return t;
  } catch {
    return '';
  }
}

async function errorFrom(res) {
  try {
    const j = await res.json();
    if (j?.error) return j.error;
  } catch {
    /* ليس JSON */
  }
  return `فشل الطلب (${res.status})`;
}

export async function uploadSkin(server, name, file) {
  if (!server) throw new Error('اضبط عنوان سيرفر السكنات من صفحة الإعدادات أولاً.');
  await readSkinFile(file);
  let res;
  try {
    res = await fetch(`${server}/api/skins/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png', 'X-Skin-Token': getSkinToken(name) },
      body: file,
    });
  } catch {
    throw new Error('تعذّر الوصول إلى سيرفر السكنات. تأكد من العنوان ومن أن السيرفر يعمل.');
  }
  if (!res.ok) throw new Error(await errorFrom(res));
  return true;
}

export async function removeSkin(server, name) {
  if (!server) throw new Error('اضبط عنوان سيرفر السكنات من صفحة الإعدادات أولاً.');
  const res = await fetch(`${server}/api/skins/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: { 'X-Skin-Token': getSkinToken(name) },
  });
  if (!res.ok) throw new Error(await errorFrom(res));
  return true;
}

export async function skinExists(server, name) {
  try {
    const res = await fetch(skinUrl(server, name), { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

// ───────────── تجهيز اللعبة لعرض السكنات ─────────────
// يثبّت CustomSkinLoader من Modrinth داخل مجلد mods ثم يكتب إعداده ليشير إلى سيرفرك.
export async function installSkinSupport({ server, mcVersion, loader }) {
  if (!server) throw new Error('اضبط عنوان سيرفر السكنات أولاً.');
  if (loader === 'vanilla') {
    throw new Error('CustomSkinLoader يحتاج محرّك Fabric. بدّل المحرّك من الصفحة الرئيسية.');
  }
  const instance = instanceId(mcVersion, loader);
  const files = await modrinth.resolveInstallFiles({
    projectId: 'customskinloader',
    mcVersion,
    loader,
  });
  for (const f of files) {
    await api.downloadMod(instance, f.url, f.fileName);
  }
  await api.setupSkinLoader(instance, server);
  return files.map((f) => f.fileName);
}
