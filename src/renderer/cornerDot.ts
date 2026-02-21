// src/renderer/cornerDot.ts

const f = (n: number) => Number(n.toFixed(3));

const arc = (r: number, x: number, y: number, sweep: 1 | 0) =>
  r <= 0.001
    ? `L ${f(x)} ${f(y)}`
    : `A ${f(r)} ${f(r)} 0 0 ${sweep} ${f(x)} ${f(y)}`;

export type CornerDotDrawer = (x: number, y: number, s: number) => string;

// Universal solid block generator
const solid = (x: number, y: number, s: number, radii: number[]) => {
  const [tl, tr, br, bl] = radii;
  return `M ${f(x + tl)} ${f(y)}
    H ${f(x + s - tr)} ${arc(tr, x + s, y + tr, 1)}
    V ${f(y + s - br)} ${arc(br, x + s - br, y + s, 1)}
    H ${f(x + bl)} ${arc(bl, x, y + s - bl, 1)}
    V ${f(y + tl)} ${arc(tl, x + tl, y, 1)} Z`;
};

// All styles for Inner Eye (size 3×3)
export const cornerDots: Record<string, CornerDotDrawer> = {
  square: (x, y, s) => {
    return solid(x, y, s, [0, 0, 0, 0]);
  },

  dot: (x, y, s) => {
    const r = s / 2; // Full circle (1.5 modules)
    return solid(x, y, s, [r, r, r, r]);
  },

  dots: (x, y, s) => cornerDots["dot"](x, y, s), // Alias

  "extra-rounded": (x, y, s) => {
    const t = s / 3; // 1 module
    return solid(x, y, s, [1 * t, 1 * t, 1 * t, 1 * t]);
  },

  rounded: (x, y, s) => {
    const t = s / 3;
    return solid(x, y, s, [0.5 * t, 0.5 * t, 0.5 * t, 0.5 * t]); // Light rounding
  },

  classy: (x, y, s) => {
    const r = s / 2; // 1.5t
    return solid(x, y, s, [r, 0, r, 0]);
  },

  "classy-rounded": (x, y, s) => {
    const r = s / 2;
    const smallR = (s / 3) * 0.5; // 0.5t
    return solid(x, y, s, [r, smallR, r, smallR]);
  },
};
