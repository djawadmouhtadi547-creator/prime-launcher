// حرف P مبني من مكعبات، هو شعار اللانشر
const ROWS = ['######.', '##...##', '##...##', '##...##', '######.', '##.....', '##.....', '##.....', '##.....'];

export default function Logo({ size = 18 }) {
  return (
    <svg
      width={size}
      height={(size * 9) / 7}
      viewBox="0 0 7 9"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {ROWS.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === '#' ? (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="1"
              height="1"
              style={{ fill: 'rgb(var(--c-accent))' }}
            />
          ) : null
        )
      )}
    </svg>
  );
}
