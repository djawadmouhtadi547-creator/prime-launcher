import { useState } from 'react';
import { FolderOpen, ScanSearch } from 'lucide-react';
import { PageHeader, Field, Notice, Toggle } from './ui.jsx';
import { api } from '../lib/api.js';
import { instanceId } from '../lib/instance.js';

export default function SettingsPage({ settings, patch }) {
  const [javas, setJavas] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const scan = async () => {
    setScanning(true);
    setError('');
    try {
      setJavas(await api.detectJava());
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const open = (kind) =>
    api.openFolder(kind, instanceId(settings.version, settings.loader)).catch((e) => setError(e.message));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="الإعدادات" />

      <section className="bevel space-y-4 p-5">
        <h3 className="font-display text-xl font-medium">Java</h3>
        <Field
          label="مسار Java"
          hint="اتركه فارغاً ليختار اللانشر النسخة المناسبة للإصدار تلقائياً (Java 8 / 17 / 21)."
        >
          <input
            className="field"
            dir="ltr"
            placeholder="C:\Program Files\Java\jdk-21\bin\java.exe"
            value={settings.javaPath}
            onChange={(e) => patch({ javaPath: e.target.value })}
          />
        </Field>
        <button type="button" className="btn" onClick={scan} disabled={scanning}>
          <ScanSearch size={15} />
          {scanning ? 'جارٍ البحث…' : 'البحث عن Java في جهازك'}
        </button>
        {javas && javas.length === 0 && <Notice>لم يُعثر على Java. ثبّت Java 17 أو 21 ثم أعد البحث.</Notice>}
        {javas && javas.length > 0 && (
          <ul className="space-y-1.5">
            {javas.map((j) => (
              <li key={j.path} className="inset flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1" dir="ltr">
                  <p className="text-sm">Java {j.major} <span className="text-mute">({j.version})</span></p>
                  <p className="truncate text-xs text-mute" title={j.path}>
                    {j.path}
                  </p>
                </div>
                <button type="button" className="btn" onClick={() => patch({ javaPath: j.path })}>
                  استخدام
                </button>
              </li>
            ))}
          </ul>
        )}
        <Field label="معاملات JVM إضافية" hint="مثال: -XX:+UseZGC. تُضاف بعد معاملات اللانشر.">
          <input
            className="field"
            dir="ltr"
            value={settings.jvmArgs}
            onChange={(e) => patch({ jvmArgs: e.target.value })}
          />
        </Field>
        <Toggle checked={settings.fullscreen} onChange={(v) => patch({ fullscreen: v })}>
          تشغيل اللعبة بملء الشاشة
        </Toggle>
      </section>

      <section className="bevel space-y-4 p-5">
        <h3 className="font-display text-xl font-medium">السكنات والمودات</h3>
        <Field
          label="عنوان سيرفر السكنات"
          hint="عنوان موقعك الذي يشغّل مجلد website، مثل https://example.com. يُستخدم للرفع ولمود CustomSkinLoader."
        >
          <input
            className="field"
            dir="ltr"
            placeholder="https://example.com"
            value={settings.skinServer}
            onChange={(e) => patch({ skinServer: e.target.value })}
          />
        </Field>
        <Field
          label="مفتاح CurseForge API"
          hint="مجاني من console.curseforge.com. يُحفظ على جهازك فقط. Modrinth لا يحتاج مفتاحاً."
        >
          <input
            className="field"
            dir="ltr"
            type="password"
            autoComplete="off"
            value={settings.curseforgeKey}
            onChange={(e) => patch({ curseforgeKey: e.target.value.trim() })}
          />
        </Field>
      </section>

      <section className="bevel space-y-3 p-5">
        <h3 className="font-display text-xl font-medium">المجلدات</h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => open('root')}>
            <FolderOpen size={15} />
            مجلد اللانشر
          </button>
          <button type="button" className="btn" onClick={() => open('instance')}>
            <FolderOpen size={15} />
            مجلد اللعبة الحالي
          </button>
        </div>
        <Notice>{error}</Notice>
      </section>
    </div>
  );
}
