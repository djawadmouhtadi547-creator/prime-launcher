import { Box } from 'lucide-react';

// مكعب داخل مربع متوهّج بلون الهوية
export default function Logo({ size = 18 }) {
  const box = size + 12;
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl"
      style={{
        width: box,
        height: box,
        color: 'rgb(var(--c-accent-ink))',
        background: 'linear-gradient(135deg, rgb(var(--c-accent-hi)), rgb(var(--c-accent)))',
        boxShadow: '0 0 18px rgb(var(--c-accent) / 0.55)',
      }}
      aria-hidden="true"
    >
      <Box size={size} strokeWidth={2.4} />
    </span>
  );
}
