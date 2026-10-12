// خدمة CurseForge: تحتاج مفتاح API (مجاني من console.curseforge.com) يُحفظ في الإعدادات.
import { api } from '../lib/api.js';

const BASE = 'https://api.curseforge.com/v1';
const GAME_ID = 432; // Minecraft
const CLASS_MODS = 6;
const LOADER_TYPE = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };

async function get(apiKey, path) {
  if (!apiKey) {
    throw new Error('أدخل مفتاح CurseForge API من صفحة الإعدادات أولاً.');
  }
  const text = await api.apiGet(BASE + path, { 'x-api-key': apiKey });
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('استجابة غير مفهومة من CurseForge');
  }
}

export async function searchMods({ apiKey, query = '', mcVersion, loader = 'fabric', pageSize = 20, index = 0 }) {
  const params = new URLSearchParams({
    gameId: String(GAME_ID),
    classId: String(CLASS_MODS),
    searchFilter: query.trim(),
    sortField: '2', // الشعبية
    sortOrder: 'desc',
    pageSize: String(pageSize),
    index: String(index),
  });
  if (mcVersion) params.set('gameVersion', mcVersion);
  if (LOADER_TYPE[loader]) params.set('modLoaderType', String(LOADER_TYPE[loader]));

  const data = await get(apiKey, `/mods/search?${params.toString()}`);
  return (data.data || []).map((m) => ({
    id: String(m.id),
    slug: m.slug,
    title: m.name,
    author: m.authors?.[0]?.name || '',
    description: m.summary,
    downloads: m.downloadCount,
    iconUrl: m.logo?.thumbnailUrl || '',
    source: 'curseforge',
  }));
}

async function pickFile(apiKey, modId, { mcVersion, loader }) {
  const params = new URLSearchParams({ gameVersion: mcVersion, pageSize: '30' });
  if (LOADER_TYPE[loader]) params.set('modLoaderType', String(LOADER_TYPE[loader]));
  const data = await get(apiKey, `/mods/${modId}/files?${params.toString()}`);
  const files = (data.data || [])
    .filter((f) => f.isAvailable !== false)
    .sort((a, b) => new Date(b.fileDate) - new Date(a.fileDate));
  if (!files.length) {
    throw new Error(`لا توجد نسخة متوافقة مع ماينكرافت ${mcVersion} ومحرّك ${loader}`);
  }
  const file = files.find((f) => f.releaseType === 1) || files[0];
  if (!file.downloadUrl) {
    throw new Error('صاحب هذا المود لا يسمح بالتنزيل من خارج موقع CurseForge. نزّله يدوياً من صفحته.');
  }
  return file;
}

export async function resolveInstallFiles({ apiKey, modId, mcVersion, loader }, seen = new Set(), depth = 0) {
  if (seen.has(String(modId))) return [];
  seen.add(String(modId));

  const file = await pickFile(apiKey, modId, { mcVersion, loader });
  const files = [{ url: file.downloadUrl, fileName: file.fileName, size: file.fileLength }];

  if (depth < 3) {
    for (const dep of file.dependencies || []) {
      if (dep.relationType === 3) {
        // 3 = اعتماد إجباري
        const sub = await resolveInstallFiles(
          { apiKey, modId: dep.modId, mcVersion, loader },
          seen,
          depth + 1
        );
        files.push(...sub);
      }
    }
  }

  const unique = new Map();
  for (const f of files) unique.set(f.fileName, f);
  return [...unique.values()];
}

export async function installMod({ apiKey, modId, mcVersion, loader, instance }) {
  const files = await resolveInstallFiles({ apiKey, modId, mcVersion, loader });
  for (const f of files) {
    await api.downloadMod(instance, f.url, f.fileName);
  }
  return files.map((f) => f.fileName);
}
