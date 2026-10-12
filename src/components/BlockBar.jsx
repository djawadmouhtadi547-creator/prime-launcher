// شريط تقدّم من مكعبات. total = 0 يعني تقدّم غير محدد.
export default function BlockBar({ value = 0, total = 0, blocks = 28 }) {
  const indeterminate = total <= 0;
  const filled = indeterminate ? 0 : Math.round((value / total) * blocks);
  return (
    <div
      className={`inset flex h-5 gap-[3px] p-[3px] ${indeterminate ? 'animate-pulse' : ''}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={indeterminate ? undefined : total}
      aria-valuenow={indeterminate ? undefined : value}
    >
      {Array.from({ length: blocks }, (_, i) => (
        <span
          key={i}
          className={`flex-1 ${
            indeterminate ? (i % 7 === 0 ? 'bg-accent/70' : 'bg-lo/60') : i < filled ? 'bg-accent' : 'bg-lo/60'
          }`}
        />
      ))}
    </div>
  );
}
