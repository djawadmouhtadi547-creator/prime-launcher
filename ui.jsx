import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export function PageHeader({ title, children }) {
  return (
    <header className="mb-6">
      <h2 className="font-display text-3xl font-bold">{title}</h2>
      {children && <p className="mt-1 text-mute">{children}</p>}
    </header>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-mute">{hint}</span>}
    </label>
  );
}

export function Notice({ kind = 'error', children }) {
  if (!children) return null;
  const isError = kind === 'error';
  const Icon = isError ? AlertTriangle : CheckCircle2;
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`inset flex items-start gap-2 px-3 py-2 text-sm ${
        isError ? 'text-[#e3a79f]' : 'text-accent-hi'
      }`}
    >
      <Icon size={16} className="mt-1 shrink-0" />
      <span className="selectable break-words">{children}</span>
    </div>
  );
}

export function Segmented({ value, options, onChange }) {
  return (
    <div className="inset flex gap-1 p-1" role="radiogroup">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            style={active ? { boxShadow: '0 0 16px rgb(var(--c-accent) / 0.5)' } : undefined}
            className={`flex-1 rounded-[10px] px-3 py-2 text-sm transition-colors ${
              active
                ? 'bg-accent font-semibold text-accent-ink'
                : 'text-mute hover:bg-white/5 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, children }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm">
      <input
        type="checkbox"
        className="check"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  );
}
