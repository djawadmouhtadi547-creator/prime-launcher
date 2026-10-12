import { useCallback, useEffect, useState } from 'react';
import { Download, FolderOpen, Search, Trash2, Puzzle } from 'lucide-react';
import { PageHeader, Notice, Segmented } from './ui.jsx';
import { api } from '../lib/api.js';
import { instanceId } from '../lib/instance.js';
import * as modrinth from '../services/modrinth.js';
import * as curseforge from '../services/curseforge.js';

const nf = new Intl.NumberFormat('en');
const size = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export default function ModsPage({ settings, patch }) {
  const [source, setSource] = useState('modrinth');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [message, setMessage] = useState(null);
  const [installed, setInstalled] = useState([]);

  const instance = instanceId(settings.version, settings.loader);
  const canUseMods = settings.loader !== 'vanilla' && !!settings.version;

  const refresh = useCallback(() => {
    api
      .listMods(instance)
      .then(setInstalled)
      .catch(() => setInstalled([]));
  }, [instance]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const search = useCallback(
    async (e) => {
      e?.preventDefault();
      if (!canUseMods) return;
      setLoading(true);
      setMessage(null);
      try {
        const args = { query, mcVersion: settings.version, loader: settings.loader };
        const list =
          source === 'modrinth'
            ? await modrinth.searchMods(args)
            : await curseforge.searchMods({ ...args, apiKey: settings.curseforgeKey });
        setResults(list);
        if (!list.length) setMessage({ kind: 'error', text: 'لم يُعثر على نتائج لهذا الإصدار.' });
      } catch (err) {
        setResults([]);
        setMessage({ kind: 'error', text: err.message });
      } finally {
        setLoading(false);
      }
    },
    [canUseMods, query, settings.version, settings.loader, settings.curseforgeKey, source]
  );

  // عند تغيير المصدر أو النسخة نعرض الأشهر تلقائياً
  useEffect(() => {
    if (canUseMods) search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, instance]);

  const install = async (mod) => {
    setBusyId(mod.id);
    setMessage(null);
    try {
      const names =
        source === 'modrinth'
          ? await modrinth.installMod({
              projectId: mod.id,
              mcVersion: settings.version,
              loader: settings.loader,
              instance,
            })
          : await curseforge.installMod({
              apiKey: settings.curseforgeKey,
              modId: mod.id,
              mcVersion: settings.version,
              loader: settings.loader,
              instance,
            });
      setMessage({ kind: 'ok', text: `تم تنزيل ${names.length} ملف إلى مجلد المودات: ${names.join('، ')}` });
      refresh();
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    } finally {
      setBusyId('');
    }
  };

  const remove = async (name) => {
    try {
      await api.deleteMod(instance, name);
      refresh();
    } catch (err) {
      setMessage({ kind: 'error', text: err.message });
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="المودات">
        {settings.version
          ? `تُثبَّت في مجلد ماينكرافت ${settings.version} مع ${settings.loader === 'fabric' ? 'Fabric' : 'المحرّك العادي'}.`
          : 'اختر إصداراً من الصفحة الرئيسية أولاً.'}
      </PageHeader>

      {!canUseMods && settings.version && (
        <div className="bevel mb-6 flex items-center justify-between gap-4 p-4">
          <p>المودات تحتاج محرّك Fabric. المحرّك الحالي هو العادي.</p>
          <button type="button" className="btn btn-accent" onClick={() => patch({ loader: 'fabric' })}>
            التبديل إلى Fabric
          </button>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_280px] gap-6">
        <section className="space-y-4">
          <div className="w-64">
            <Segmented
              value={source}
              onChange={setSource}
              options={[
                { value: 'modrinth', label: 'Modrinth' },
                { value: 'curseforge', label: 'CurseForge' },
              ]}
            />
          </div>

          <form onSubmit={search} className="flex gap-2">
            <input
              className="field"
              dir="auto"
              placeholder="ابحث عن مود، مثل Sodium"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={!canUseMods}
            />
            <button type="submit" className="btn btn-accent shrink-0" disabled={!canUseMods || loading}>
              <Search size={16} />
              بحث
            </button>
          </form>

          {source === 'curseforge' && !settings.curseforgeKey && (
            <Notice>CurseForge يحتاج مفتاح API. أضفه من صفحة الإعدادات.</Notice>
          )}
          <Notice kind={message?.kind}>{message?.text}</Notice>

          <ul className="inset divide-y divide-white/5">
            {loading && <li className="p-4 text-mute">جارٍ البحث…</li>}
            {!loading && results.length === 0 && !message && (
              <li className="p-4 text-mute">ابدأ بالبحث لعرض المودات المتوافقة.</li>
            )}
            {!loading &&
              results.map((m) => (
                <li key={m.id} className="flex items-center gap-4 p-3">
                  <div className="inset flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden">
                    {m.iconUrl ? (
                      <img src={m.iconUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <Puzzle size={20} className="text-mute" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span dir="auto" className="truncate font-medium">
                        {m.title}
                      </span>
                      <span dir="ltr" className="shrink-0 text-xs text-mute">
                        {m.author}
                      </span>
                    </div>
                    <p dir="auto" className="line-clamp-2 text-sm text-mute">
                      {m.description}
                    </p>
                    <span dir="ltr" className="text-xs text-mute">
                      {nf.format(m.downloads)} downloads
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn shrink-0"
                    disabled={!!busyId}
                    onClick={() => install(m)}
                  >
                    <Download size={15} />
                    {busyId === m.id ? 'جارٍ التثبيت…' : 'تثبيت'}
                  </button>
                </li>
              ))}
          </ul>
        </section>

        <aside className="bevel h-fit space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-medium">المثبّتة</h3>
            <button
              type="button"
              className="btn !px-2"
              onClick={() => api.openFolder('mods', instance).catch((e) => setMessage({ kind: 'error', text: e.message }))}
              title="فتح مجلد المودات"
              aria-label="فتح مجلد المودات"
            >
              <FolderOpen size={16} />
            </button>
          </div>
          {installed.length === 0 ? (
            <p className="text-sm text-mute">لا توجد مودات في هذا المجلد.</p>
          ) : (
            <ul className="space-y-1.5">
              {installed.map((f) => (
                <li key={f.name} className="inset flex items-center gap-2 px-2 py-1.5">
                  <div className="min-w-0 flex-1">
                    <p dir="ltr" className="truncate text-xs" title={f.name}>
                      {f.name}
                    </p>
                    <p dir="ltr" className="text-[11px] text-mute">
                      {size(f.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-mute hover:text-[#e3a79f]"
                    onClick={() => remove(f.name)}
                    aria-label={`حذف ${f.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
