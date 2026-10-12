// خدمة Modrinth: بحث، اختيار نسخة متوافقة، حل الاعتمادات، وتنزيل الـ .jar إلى مجلد mods
// الطلبات تمر عبر Rust (api_get) لأن Modrinth يطلب User-Agent واضحاً.
import { api } from '../lib/api.js';

const BASE = 'https://api.modrinth.com/v2';

async function get(path) {
  const text = await api.apiGet(BASE + path);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('استجابة غير مفهومة من Modrinth');
  }
}

/** بحث عن المودات. يرجع قائمة بصيغة موحدة مع CurseForge. */
export async function searchMods({ query = '', mcVersion, loader = 'fabric', limit = 20, offset = 0 }) {
  const facets = [['project_type:mod']];
  if (loader && loader !== 'vanilla') facets.push([`categories:${loader}`]);
  if (mcVersion) facets.push([`versions:${mcVersion}`]);

  const params = new URLSearchParams({
    query: query.trim(),
    limit: String(limit),
    offset: String(offset),
    index: query.trim() ? 'relevance' : 'downloads',
    facets: JSON.stringify(facets),
  });
  const data = await get(`/search?${params.toString()}`);
  return (data.hits || []).map((h) => ({
    id: h.project_id,
    slug: h.slug,
    title: h.title,
    author: h.author,
    description: h.description,
    downloads: h.downloads,
    iconUrl: h.icon_url || '',
    source: 'modrinth',
  }));
}

/** أحدث نسخة (يفضّل release) متوافقة مع إصدار اللعبة والمحرّك. projectId قد يكون المعرّف أو الـ slug. */
export async function getCompatibleVersion(projectId, { mcVersion, loader }) {
  const params = new URLSearchParams({
    game_versions: JSON.stringify([mcVersion]),
    loaders: JSON.stringify([loader]),
  });
  const versions = await get(`/project/${encodeURIComponent(projectId)}/version?${params.toString()}`);
  if (!versions.length) {
    throw new Error(`لا توجد نسخة من هذا المود متوافقة مع ماينكرافت ${mcVersion} ومحرّك ${loader}`);
  }
  return versions.find((v) => v.version_type === 'release') || versions[0];
}

function pickFile(version) {
  const file = version.files.find((f) => f.primary) || version.files[0];
  if (!file) throw new Error('هذه النسخة لا تحتوي على ملفات');
  return { url: file.url, fileName: file.filename, size: file.size };
}

/**
 * يرجع كل الملفات المطلوب تنزيلها لتشغيل المود (المود نفسه + الاعتمادات الإجبارية مثل Fabric API).
 */
export async function resolveInstallFiles({ projectId, mcVersion, loader }, seen = new Set(), depth = 0) {
  if (seen.has(projectId)) return [];
  seen.add(projectId);

  const version = await getCompatibleVersion(projectId, { mcVersion, loader });
  const files = [pickFile(version)];

  if (depth < 3) {
    for (const dep of version.dependencies || []) {
      if (dep.dependency_type === 'required' && dep.project_id) {
        const sub = await resolveInstallFiles(
          { projectId: dep.project_id, mcVersion, loader },
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

/** تنزيل مود واعتماداته إلى مجلد /mods الخاص بالنسخة. يرجع أسماء الملفات. */
export async function installMod({ projectId, mcVersion, loader, instance }) {
  const files = await resolveInstallFiles({ projectId, mcVersion, loader });
  for (const f of files) {
    await api.downloadMod(instance, f.url, f.fileName);
  }
  return files.map((f) => f.fileName);
}
