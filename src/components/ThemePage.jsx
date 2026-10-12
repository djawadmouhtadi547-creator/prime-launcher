import { Check } from 'lucide-react';
import { PageHeader, Toggle } from './ui.jsx';
import { ACCENTS, BACKGROUNDS } from '../lib/theme.js';

function Swatch({ color, name, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`${selected ? 'bevel !border-accent' : 'inset hover:brightness-125'} flex w-24 flex-col items-center gap-2 p-2`}
    >
      <span
        className="relative flex h-10 w-full items-center justify-center border-2 border-lo"
        style={{ background: color }}
      >
        {selected && <Check size={18} className="text-white mix-blend-difference" />}
      </span>
      <span className="text-xs">{name}</span>
    </button>
  );
}

export default function ThemePage({ settings, patch }) {
  const customAccent = settings.accentId === 'custom';
  const customBg = settings.bgId === 'custom';

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="المظهر">يتغيّر المظهر فوراً ويُحفظ على جهازك.</PageHeader>

      <section className="bevel space-y-4 p-5">
        <h3 className="font-display text-xl font-medium">لون الهوية</h3>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <Swatch
              key={a.id}
              color={a.color}
              name={a.name}
              selected={settings.accentId === a.id}
              onClick={() => patch({ accentId: a.id, accent: a.color })}
            />
          ))}
          <label
            className={`${customAccent ? 'bevel !border-accent' : 'inset hover:brightness-125'} flex w-24 cursor-pointer flex-col items-center gap-2 p-2`}
          >
            <span className="h-10 w-full border-2 border-lo" style={{ background: settings.accent }} />
            <span className="text-xs">لون مخصص</span>
            <input
              type="color"
              className="sr-only"
              value={settings.accent}
              onChange={(e) => patch({ accentId: 'custom', accent: e.target.value })}
            />
          </label>
        </div>
      </section>

      <section className="bevel space-y-4 p-5">
        <h3 className="font-display text-xl font-medium">الخلفية</h3>
        <div className="flex flex-wrap gap-3">
          {BACKGROUNDS.map((b) => (
            <Swatch
              key={b.id}
              color={b.color}
              name={b.name}
              selected={settings.bgId === b.id}
              onClick={() => patch({ bgId: b.id, bg: b.color })}
            />
          ))}
          <label
            className={`${customBg ? 'bevel !border-accent' : 'inset hover:brightness-125'} flex w-24 cursor-pointer flex-col items-center gap-2 p-2`}
          >
            <span className="h-10 w-full border-2 border-lo" style={{ background: settings.bg }} />
            <span className="text-xs">لون مخصص</span>
            <input
              type="color"
              className="sr-only"
              value={settings.bg}
              onChange={(e) => patch({ bgId: 'custom', bg: e.target.value })}
            />
          </label>
        </div>
        <Toggle checked={settings.pattern} onChange={(v) => patch({ pattern: v })}>
          نقش المربعات الخفيف في الخلفية
        </Toggle>
      </section>

      <button
        type="button"
        className="btn"
        onClick={() =>
          patch({
            accentId: 'moss',
            accent: '#7d9a5b',
            bgId: 'deepslate',
            bg: '#1b1d21',
            pattern: true,
          })
        }
      >
        استعادة المظهر الافتراضي
      </button>
    </div>
  );
}
