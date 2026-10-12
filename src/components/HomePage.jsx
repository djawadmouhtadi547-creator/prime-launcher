import { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import Terrain from './Terrain.jsx';
import BlockBar from './BlockBar.jsx';
import { Field, Notice, Segmented, Toggle } from './ui.jsx';

const RAM_PRESETS = [2048, 4096, 6144, 8192];
const gb = (mb) => `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;

export default function HomePage({
  settings,
  patch,
  versions,
  versionsError,
  account,
  phase,
  progress,
  logs,
  lastCommand,
  error,
  onPlay,
}) {
  const [copied, setCopied] = useState(false);
  const busy = phase !== 'idle';

  const list = useMemo(() => {
    const base = versions.filter((v) => settings.showSnapshots || v.type === 'release');
    if (settings.version && !base.some((v) => v.id === settings.version)) {
      return [{ id: settings.version, type: 'release' }, ...base];
    }
    return base;
  }, [versions, settings.showSnapshots, settings.version]);

  const fill = ((settings.ramMb - 1024) / (16384 - 1024)) * 100;
  const label =
    phase === 'preparing'
      ? 'جارٍ التجهيز'
      : phase === 'running'
        ? 'اللعبة تعمل'
        : 'PLAY';
  const progressText = progress.total > 0 ? `${progress.label}  ${progress.current} / ${progress.total}` : progress.label;

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(lastCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* الحافظة غير متاحة */
    }
  };

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_300px] gap-6">
      <div className="space-y-5">
        <section className="bevel relative flex min-h-[360px] flex-col overflow-hidden">
          <div className="flex flex-1 flex-col justify-between gap-8 p-7 pb-24">
            <div>
              <h1 className="font-display text-6xl font-bold leading-tight">
                ماينكرافت{' '}
                <span dir="ltr" className="inline-block">
                  {settings.version || '…'}
                </span>
              </h1>
              <dl className="mt-3 space-y-1 text-mute">
                <div className="flex gap-2">
                  <dt>المحرّك:</dt>
                  <dd className="text-ink">{settings.loader === 'fabric' ? 'Fabric (يدعم المودات)' : 'عادي بدون مودات'}</dd>
                </div>
                <div className="flex gap-2">
                  <dt>اللاعب:</dt>
                  <dd className="text-ink" dir="ltr">
                    {account ? account.name : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="relative z-10 max-w-md space-y-3">
              <button
                type="button"
                onClick={onPlay}
                disabled={busy || (!settings.version && !versionsError)}
                className="btn btn-accent w-64 !py-4 font-display text-4xl font-bold tracking-widest"
              >
                {label}
              </button>
              {phase === 'preparing' && (
                <div className="space-y-1.5">
                  <BlockBar value={progress.current} total={progress.total} />
                  <p className="text-sm text-mute">{progressText}</p>
                </div>
              )}
              <Notice>{error}</Notice>
            </div>
          </div>
          <Terrain />
        </section>

        {(logs.length > 0 || lastCommand) && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-medium">سجل اللعبة</h3>
              {lastCommand && (
                <button type="button" className="btn" onClick={copyCommand}>
                  <Copy size={14} />
                  {copied ? 'تم النسخ' : 'نسخ أمر التشغيل'}
                </button>
              )}
            </div>
            <pre
              dir="ltr"
              className="selectable inset h-44 overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs leading-relaxed text-mute"
            >
              {logs.length ? logs.join('\n') : 'لا توجد مخرجات بعد.'}
            </pre>
          </section>
        )}
      </div>

      <aside className="bevel h-fit space-y-5 p-5">
        <Field label="إصدار ماينكرافت">
          <select
            className="field"
            dir="ltr"
            value={settings.version}
            onChange={(e) => patch({ version: e.target.value })}
            disabled={busy}
          >
            {list.length === 0 && <option value="">جارٍ التحميل…</option>}
            {list.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id}
                {v.type !== 'release' ? `  (${v.type})` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Toggle checked={settings.showSnapshots} onChange={(v) => patch({ showSnapshots: v })}>
          إظهار النسخ التجريبية
        </Toggle>
        {versionsError && <Notice>{`تعذّر جلب قائمة الإصدارات: ${versionsError}`}</Notice>}

        <Field label="المحرّك" hint="المودات تحتاج Fabric. لكل محرّك مجلد لعب مستقل.">
          <Segmented
            value={settings.loader}
            onChange={(v) => !busy && patch({ loader: v })}
            options={[
              { value: 'vanilla', label: 'عادي' },
              { value: 'fabric', label: 'Fabric' },
            ]}
          />
        </Field>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-sm font-medium">الذاكرة (RAM)</span>
            <span dir="ltr" className="font-display text-xl font-bold text-accent-hi">
              {gb(settings.ramMb)}
            </span>
          </div>
          <div dir="ltr">
            <input
              type="range"
              className="ram"
              min={1024}
              max={16384}
              step={512}
              value={settings.ramMb}
              style={{ '--fill': `${fill}%` }}
              onChange={(e) => patch({ ramMb: Number(e.target.value) })}
              aria-label="الذاكرة"
            />
          </div>
          <div dir="ltr" className="mt-2 grid grid-cols-4 gap-2">
            {RAM_PRESETS.map((mb) => (
              <button
                key={mb}
                type="button"
                className={`btn !px-0 ${settings.ramMb === mb ? '!border-accent text-accent-hi' : ''}`}
                onClick={() => patch({ ramMb: mb })}
              >
                {mb / 1024}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-mute">لا تتجاوز نصف ذاكرة جهازك حتى لا يبطؤ النظام.</p>
        </div>
      </aside>
    </div>
  );
}
