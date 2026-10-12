// شريط تقدّم متوهّج. total = 0 يعني تقدّماً غير محدد.
export default function BlockBar({ value = 0, total = 0 }) {
  const indeterminate = total <= 0;
  const pct = indeterminate ? 0 : Math.min(100, Math.round((value / total) * 100));
  return (
    <div
      className="h-2.5 w-full overflow-hidden rounded-full bg-white/10"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={indeterminate ? undefined : total}
      aria-valuenow={indeterminate ? undefined : value}
    >
      <div
        className="h-full rounded-full bg-accent transition-all duration-300"
        style={{
          width: indeterminate ? '35%' : `${pct}%`,
          boxShadow: '0 0 14px rgb(var(--c-accent) / 0.85)',
          animation: indeterminate ? 'slide 1.2s ease-in-out infinite' : undefined,
        }}
      />
    </div>
  );
}
