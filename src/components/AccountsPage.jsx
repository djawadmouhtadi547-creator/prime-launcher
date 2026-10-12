import { useEffect, useState } from 'react';
import { Check, Copy, Plus, Trash2, Upload, Wrench } from 'lucide-react';
import SkinViewer from './SkinViewer.jsx';
import { PageHeader, Field, Notice } from './ui.jsx';
import { api } from '../lib/api.js';
import { uid } from '../lib/store.js';
import {
  installSkinSupport,
  normalizeServer,
  readSkinFile,
  skinUrl,
  skinUrlTemplate,
  uploadSkin,
} from '../services/skins.js';

const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

export default function AccountsPage({ accounts, setAccounts, settings, patch, active }) {
  const [name, setName] = useState('');
  const [uuidPreview, setUuidPreview] = useState('');
  const [formError, setFormError] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const server = normalizeServer(settings.skinServer);

  useEffect(() => {
    if (!NAME_RE.test(name)) {
      setUuidPreview('');
      return undefined;
    }
    let dead = false;
    api
      .offlineUuid(name)
      .then((u) => !dead && setUuidPreview(u))
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [name]);

  useEffect(() => {
    if (!file) {
      setFilePreview('');
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setFilePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const viewerSkin = filePreview || (server && active ? skinUrl(server, active.name) : '');

  const addAccount = async (e) => {
    e.preventDefault();
    setFormError('');
    const n = name.trim();
    if (!NAME_RE.test(n)) {
      setFormError('الاسم من 3 إلى 16 حرفاً: إنجليزي أو أرقام أو _');
      return;
    }
    if (accounts.some((a) => a.name.toLowerCase() === n.toLowerCase())) {
      setFormError('هذا الحساب موجود بالفعل.');
      return;
    }
    try {
      const uuid = await api.offlineUuid(n);
      const acc = { id: uid(), name: n, uuid, type: 'offline' };
      setAccounts((list) => [...list, acc]);
      patch({ activeAccount: acc.id });
      setName('');
    } catch (err) {
      setFormError(err.message);
    }
  };

  const removeAccount = (id) => {
    setAccounts((list) => list.filter((a) => a.id !== id));
    if (settings.activeAccount === id) patch({ activeAccount: null });
  };

  const pickFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    setStatus(null);
    if (!f) return;
    try {
      await readSkinFile(f);
      setFile(f);
    } catch (err) {
      setFile(null);
      setStatus({ kind: 'error', text: err.message });
    }
  };

  const doUpload = async () => {
    if (!file || !active) return;
    setBusy(true);
    setStatus(null);
    try {
      await uploadSkin(server, active.name, file);
      setStatus({ kind: 'ok', text: 'تم رفع السكن. سيظهر داخل اللعبة عند الدخول التالي.' });
      setFile(null);
    } catch (err) {
      setStatus({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const setupInGame = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const names = await installSkinSupport({
        server,
        mcVersion: settings.version,
        loader: settings.loader,
      });
      setStatus({
        kind: 'ok',
        text: `تم تثبيت CustomSkinLoader وضبطه على سيرفرك (${names.length} ملف).`,
      });
    } catch (err) {
      setStatus({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(skinUrlTemplate(server));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* الحافظة غير متاحة */
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="الحسابات">
        الدخول أوفلاين: اسم اللاعب فقط. يُولَّد المعرّف (UUID) من الاسم بنفس طريقة ماينكرافت.
      </PageHeader>

      <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-6">
        <section className="space-y-6">
          <form onSubmit={addAccount} className="bevel space-y-3 p-5">
            <Field label="اسم اللاعب">
              <div className="flex gap-2">
                <input
                  className="field"
                  dir="ltr"
                  placeholder="Steve"
                  maxLength={16}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <button type="submit" className="btn btn-accent shrink-0">
                  <Plus size={16} />
                  إضافة
                </button>
              </div>
            </Field>
            {uuidPreview && (
              <p dir="ltr" className="selectable text-xs text-mute">
                UUID: {uuidPreview}
              </p>
            )}
            <Notice>{formError}</Notice>
          </form>

          <ul className="space-y-2">
            {accounts.length === 0 && (
              <li className="inset p-4 text-mute">لا توجد حسابات. أضف اسماً للبدء.</li>
            )}
            {accounts.map((a) => {
              const isActive = active?.id === a.id;
              return (
                <li
                  key={a.id}
                  className={`${isActive ? 'bevel !border-accent' : 'inset'} flex items-center gap-3 p-3`}
                >
                  <div className="min-w-0 flex-1">
                    <p dir="ltr" className="text-right font-medium">
                      {a.name}
                    </p>
                    <p dir="ltr" className="selectable truncate text-right text-xs text-mute">
                      {a.uuid}
                    </p>
                  </div>
                  {isActive ? (
                    <span className="flex items-center gap-1 text-sm text-accent-hi">
                      <Check size={15} />
                      المفعّل
                    </span>
                  ) : (
                    <button type="button" className="btn" onClick={() => patch({ activeAccount: a.id })}>
                      تفعيل
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-mute hover:text-[#e3a79f]"
                    onClick={() => removeAccount(a.id)}
                    aria-label={`حذف ${a.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="bevel h-fit space-y-4 p-5">
          <div className="inset flex justify-center py-2">
            <SkinViewer skin={viewerSkin} width={240} height={300} />
          </div>

          {!server ? (
            <Notice>أضف عنوان سيرفر السكنات من صفحة الإعدادات لتفعيل الرفع والعرض.</Notice>
          ) : (
            <div className="space-y-2 text-xs text-mute">
              <p>رابط السكنات الذي يقرأه مود CustomSkinLoader:</p>
              <button
                type="button"
                onClick={copyTemplate}
                className="inset selectable flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left"
                dir="ltr"
              >
                <span className="truncate">{skinUrlTemplate(server)}</span>
                <span className="flex shrink-0 items-center gap-1 text-ink">
                  <Copy size={12} />
                  {copied ? 'copied' : 'copy'}
                </span>
              </button>
            </div>
          )}

          <div className="grid gap-2">
            <label className="btn cursor-pointer">
              <Upload size={15} />
              اختيار ملف سكن (PNG)
              <input type="file" accept="image/png" className="sr-only" onChange={pickFile} />
            </label>
            <button
              type="button"
              className="btn btn-accent"
              disabled={!file || !active || !server || busy}
              onClick={doUpload}
            >
              رفع السكن إلى السيرفر
            </button>
            <button
              type="button"
              className="btn"
              disabled={!server || busy || settings.loader === 'vanilla'}
              onClick={setupInGame}
              title="يثبّت CustomSkinLoader ويضبطه على سيرفرك"
            >
              <Wrench size={15} />
              تجهيز السكنات في اللعبة
            </button>
            {settings.loader === 'vanilla' && (
              <p className="text-xs text-mute">التجهيز يحتاج محرّك Fabric.</p>
            )}
          </div>
          <Notice kind={status?.kind}>{status?.text}</Notice>
        </aside>
      </div>
    </div>
  );
}
