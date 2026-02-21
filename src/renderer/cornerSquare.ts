// src/renderer/cornerSquare.ts

const f = (n: number) => Number(n.toFixed(3));

// Helper: if radius is 0, draw a straight line (L), otherwise an arc (A)
const arc = (r: number, x: number, y: number, sweep: 1 | 0) =>
  r <= 0.001
    ? `L ${f(x)} ${f(y)}`
    : `A ${f(r)} ${f(r)} 0 0 ${sweep} ${f(x)} ${f(y)}`;

export type CornerSquareDrawer = (x: number, y: number, s: number) => string;

// Universal frame (donut) generator
const donut = (
  x: number,
  y: number,
  s: number,
  t: number,
  rOut: number[],
  rIn: number[],
) => {
  const [otl, otr, obr, obl] = rOut; // Outer radii (TopLeft, TopRight, BottomRight, BottomLeft)
  const [itl, itr, ibr, ibl] = rIn; // Inner radii

  const ix = x + t,
    iy = y + t,
    isize = s - 2 * t;

  // Outer contour (clockwise, sweep = 1)
  const outer = `M ${f(x + otl)} ${f(y)}
    H ${f(x + s - otr)} ${arc(otr, x + s, y + otr, 1)}
    V ${f(y + s - obr)} ${arc(obr, x + s - obr, y + s, 1)}
    H ${f(x + obl)} ${arc(obl, x, y + s - obl, 1)}
    V ${f(y + otl)} ${arc(otl, x + otl, y, 1)} Z`;

  // Inner hole contour (counter-clockwise, sweep = 0)
  const inner = `M ${f(ix + itl)} ${f(iy)}
    ${arc(itl, ix, iy + itl, 0)}
    V ${f(iy + isize - ibl)} ${arc(ibl, ix + ibl, iy + isize, 0)}
    H ${f(ix + isize - ibr)} ${arc(ibr, ix + isize, iy + isize - ibr, 0)}
    V ${f(iy + itr)} ${arc(itr, ix + isize - itr, iy, 0)}
    H ${f(ix + itl)} Z`;

  return outer + " " + inner;
};

// All styles for Outer Eye (size 7×7)
export const cornerSquares: Record<string, CornerSquareDrawer> = {
  square: (x, y, s) => {
    return donut(x, y, s, s / 7, [0, 0, 0, 0], [0, 0, 0, 0]);
  },

  dot: (x, y, s) => {
    const t = s / 7;
    const rO = s / 2; // Maximum outer radius (3.5 modules)
    const rI = (s - 2 * t) / 2; // Maximum inner radius (2.5 modules)
    return donut(x, y, s, t, [rO, rO, rO, rO], [rI, rI, rI, rI]);
  },

  dots: (x, y, s) => cornerSquares["dot"](x, y, s), // Alias for consistency with DotType

  "extra-rounded": (x, y, s) => {
    const t = s / 7;
    return donut(
      x,
      y,
      s,
      t,
      [2.5 * t, 2.5 * t, 2.5 * t, 2.5 * t],
      [1.5 * t, 1.5 * t, 1.5 * t, 1.5 * t],
    );
  },

  rounded: (x, y, s) => {
    const t = s / 7;
    return donut(
      x,
      y,
      s,
      t,
      [1.5 * t, 1.5 * t, 1.5 * t, 1.5 * t],
      [0.5 * t, 0.5 * t, 0.5 * t, 0.5 * t],
    );
  },

  classy: (x, y, s) => {
    const t = s / 7;
    const rO = s / 2; // 3.5t
    const rI = (s - 2 * t) / 2; // 2.5t
    // Sharp corners (TR, BL) = 0. Round corners (TL, BR) = maximum.
    return donut(x, y, s, t, [rO, 0, rO, 0], [rI, 0, rI, 0]);
  },

  "classy-rounded": (x, y, s) => {
    const t = s / 7;
    const rO = s / 2;
    const rI = (s - 2 * t) / 2;
    // Sharp corners get light rounding (1t), round corners get maximum
    return donut(x, y, s, t, [rO, 1 * t, rO, 1 * t], [rI, 0, rI, 0]);
  },
};
