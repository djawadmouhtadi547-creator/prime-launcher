// شريط تضاريس مكعّبة في أسفل اللوحة الرئيسية
const HEIGHTS = [
  4, 4, 5, 5, 5, 6, 6, 5, 5, 4, 4, 4, 5, 6, 7, 7, 6, 5, 5, 4, 4, 5, 5, 6, 6, 6, 5, 4, 4, 4, 5, 5, 6, 7, 7, 7,
  6, 5, 4, 4, 4, 5, 6, 6, 5, 5, 4, 4, 5, 5, 6, 6, 5, 4, 4, 4, 5, 5, 5, 4,
];

export default function Terrain() {
  const W = HEIGHTS.length * 4;
  return (
    <svg
      viewBox={`0 0 ${W} 10`}
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-20 w-full"
      aria-hidden="true"
    >
      {HEIGHTS.map((h, i) => (
        <g key={i}>
          <rect x={i * 4} y={10 - h} width="4" height="1" style={{ fill: 'rgb(var(--c-accent))' }} />
          <rect
            x={i * 4}
            y={11 - h}
            width="4"
            height={h - 1}
            style={{ fill: 'rgb(var(--c-accent-lo))' }}
          />
        </g>
      ))}
    </svg>
  );
}
