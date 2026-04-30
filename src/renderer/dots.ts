// src/renderer/dots.ts

// Rounding helper (reduces SVG file size)
const f = (n: number) => Number(n.toFixed(3));

export interface Neighbors {
  t: boolean; // Top
  r: boolean; // Right
  b: boolean; // Bottom
  l: boolean; // Left
}

export type NeighborShapeDrawer = (
  x: number,
  y: number,
  n: Neighbors,
  scale?: number,
) => string;

export const neighborShapes: Record<string, NeighborShapeDrawer> = {
  // 1. SQUARE (Classic square, ignores neighbors)
  square: (x, y, n, s = 1) => {
    const r = 0.5 * s;
    const cx = x + 0.5;
    const cy = y + 0.5;
    return `M ${f(cx - r)} ${f(cy - r)} h ${s} v ${s} h -${s} Z`;
  },

  // 2. DOTS (Isolated circles, ignores neighbors)
  dot: (x, y, n, s = 1) => neighborShapes.dots(x, y, n, s), // Alias
  dots: (x, y, n, s = 1) => {
    const r = 0.5 * s;
    const cx = x + 0.5;
    const cy = y + 0.5;
    return `M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
  },

  // 3. EXTRA-ROUNDED (Maximum rounding. Matches QRDot._drawExtraRounded exactly)
  "extra-rounded": (x, y, n, s = 1) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 0.5 * s;
    const count = +n.l + +n.r + +n.t + +n.b;

    // 2 adjacent neighbors: large arc r=s filling the entire free corner quadrant
    if (count === 2 && !(n.l && n.r) && !(n.t && n.b)) {
      if (n.l && n.t) // free: BR
        return `M ${f(cx + r)} ${f(cy - r)} L ${f(cx - r)} ${f(cy - r)} L ${f(cx - r)} ${f(cy + r)} A ${f(s)} ${f(s)} 0 0 0 ${f(cx + r)} ${f(cy - r)} Z`;
      if (n.t && n.r) // free: BL
        return `M ${f(cx + r)} ${f(cy + r)} L ${f(cx + r)} ${f(cy - r)} L ${f(cx - r)} ${f(cy - r)} A ${f(s)} ${f(s)} 0 0 0 ${f(cx + r)} ${f(cy + r)} Z`;
      if (n.r && n.b) // free: TL
        return `M ${f(cx - r)} ${f(cy + r)} L ${f(cx + r)} ${f(cy + r)} L ${f(cx + r)} ${f(cy - r)} A ${f(s)} ${f(s)} 0 0 0 ${f(cx - r)} ${f(cy + r)} Z`;
      // n.l && n.b: free: TR
      return `M ${f(cx - r)} ${f(cy - r)} L ${f(cx - r)} ${f(cy + r)} L ${f(cx + r)} ${f(cy + r)} A ${f(s)} ${f(s)} 0 0 0 ${f(cx - r)} ${f(cy - r)} Z`;
    }

    // 0 neighbors → circle; 1 neighbor → semicircle; 2 opposite / 3+ → square
    let path = `M ${f(cx)} ${f(cy - r)}`;

    // Top-Right
    if (n.t || n.r)
      path += ` L ${f(cx + r)} ${f(cy - r)} L ${f(cx + r)} ${f(cy)}`;
    else path += ` A ${f(r)} ${f(r)} 0 0 1 ${f(cx + r)} ${f(cy)}`;
    // Bottom-Right
    if (n.b || n.r)
      path += ` L ${f(cx + r)} ${f(cy + r)} L ${f(cx)} ${f(cy + r)}`;
    else path += ` A ${f(r)} ${f(r)} 0 0 1 ${f(cx)} ${f(cy + r)}`;
    // Bottom-Left
    if (n.b || n.l)
      path += ` L ${f(cx - r)} ${f(cy + r)} L ${f(cx - r)} ${f(cy)}`;
    else path += ` A ${f(r)} ${f(r)} 0 0 1 ${f(cx - r)} ${f(cy)}`;
    // Top-Left
    if (n.t || n.l)
      path += ` L ${f(cx - r)} ${f(cy - r)} L ${f(cx)} ${f(cy - r)}`;
    else path += ` A ${f(r)} ${f(r)} 0 0 1 ${f(cx)} ${f(cy - r)}`;

    return path + " Z";
  },

  // 4. ROUNDED (Neighbor-count based. Matches QRDot._drawRounded exactly)
  rounded: (x, y, n, s = 1) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 0.5 * s;
    const count = +n.l + +n.r + +n.t + +n.b;

    if (count === 0) return neighborShapes.dots(x, y, n, s);
    if (count > 2 || (n.l && n.r) || (n.t && n.b)) {
      // Rounded rect with gentle corners instead of hard square
      const cr = r * 0.18;
      return `M ${f(cx - r + cr)} ${f(cy - r)} H ${f(cx + r - cr)} A ${f(cr)} ${f(cr)} 0 0 1 ${f(cx + r)} ${f(cy - r + cr)} V ${f(cy + r - cr)} A ${f(cr)} ${f(cr)} 0 0 1 ${f(cx + r - cr)} ${f(cy + r)} H ${f(cx - r + cr)} A ${f(cr)} ${f(cr)} 0 0 1 ${f(cx - r)} ${f(cy + r - cr)} V ${f(cy - r + cr)} A ${f(cr)} ${f(cr)} 0 0 1 ${f(cx - r + cr)} ${f(cy - r)} Z`;
    }

    if (count === 2) {
      // 3 sharp sides + quarter-circle (r = s/2) at the one free corner
      if (n.l && n.t) // free: BR
        return `M ${f(cx + r)} ${f(cy - r)} L ${f(cx - r)} ${f(cy - r)} L ${f(cx - r)} ${f(cy + r)} L ${f(cx)} ${f(cy + r)} A ${f(r)} ${f(r)} 0 0 1 ${f(cx + r)} ${f(cy)} Z`;
      if (n.t && n.r) // free: BL
        return `M ${f(cx + r)} ${f(cy + r)} L ${f(cx + r)} ${f(cy - r)} L ${f(cx - r)} ${f(cy - r)} L ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 0 0 ${f(cx)} ${f(cy + r)} Z`;
      if (n.r && n.b) // free: TL
        return `M ${f(cx - r)} ${f(cy + r)} L ${f(cx + r)} ${f(cy + r)} L ${f(cx + r)} ${f(cy - r)} L ${f(cx)} ${f(cy - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(cx - r)} ${f(cy)} Z`;
      // n.l && n.b: free: TR
      return `M ${f(cx - r)} ${f(cy - r)} L ${f(cx - r)} ${f(cy + r)} L ${f(cx + r)} ${f(cy + r)} L ${f(cx + r)} ${f(cy)} A ${f(r)} ${f(r)} 0 0 0 ${f(cx)} ${f(cy - r)} Z`;
    }

    // count === 1: flat side facing neighbor + semicircle on the free side
    if (n.t) // bottom semicircle
      return `M ${f(cx + r)} ${f(cy - r)} L ${f(cx - r)} ${f(cy - r)} L ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 0 0 ${f(cx + r)} ${f(cy)} Z`;
    if (n.r) // left semicircle
      return `M ${f(cx + r)} ${f(cy - r)} L ${f(cx + r)} ${f(cy + r)} L ${f(cx)} ${f(cy + r)} A ${f(r)} ${f(r)} 0 0 0 ${f(cx)} ${f(cy - r)} Z`;
    if (n.b) // top semicircle
      return `M ${f(cx - r)} ${f(cy + r)} L ${f(cx + r)} ${f(cy + r)} L ${f(cx + r)} ${f(cy)} A ${f(r)} ${f(r)} 0 0 0 ${f(cx - r)} ${f(cy)} Z`;
    // n.l: right semicircle
    return `M ${f(cx - r)} ${f(cy + r)} L ${f(cx - r)} ${f(cy - r)} L ${f(cx)} ${f(cy - r)} A ${f(r)} ${f(r)} 0 0 1 ${f(cx)} ${f(cy + r)} Z`;
  },

  // 5. CLASSY (Clever mix: TL and BR are rounded, TR and BL are always sharp)
  classy: (x, y, n, s = 1) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 0.5 * s;

    let path = `M ${f(cx)} ${f(cy - r)}`;

    // Top-Right (ALWAYS sharp)
    path += ` L ${f(cx + r)} ${f(cy - r)} L ${f(cx + r)} ${f(cy)}`;

    // Bottom-Right (Rounded if free)
    if (n.b || n.r)
      path += ` L ${f(cx + r)} ${f(cy + r)} L ${f(cx)} ${f(cy + r)}`;
    else path += ` A ${f(r)} ${f(r)} 0 0 1 ${f(cx)} ${f(cy + r)}`;

    // Bottom-Left (ALWAYS sharp)
    path += ` L ${f(cx - r)} ${f(cy + r)} L ${f(cx - r)} ${f(cy)}`;

    // Top-Left (Rounded if free)
    if (n.t || n.l)
      path += ` L ${f(cx - r)} ${f(cy - r)} L ${f(cx)} ${f(cy - r)}`;
    else path += ` A ${f(r)} ${f(r)} 0 0 1 ${f(cx)} ${f(cy - r)}`;

    return path + " Z";
  },

  // 6. CLASSY-ROUNDED (Matches QRDot._drawClassyRounded exactly)
  // Isolated → TL + BR rounded r=s/2 (same as classy)
  // Top-left free (!l && !t) → large arc r=s through TL quadrant, rest sharp
  // Bottom-right free (!r && !b) → large arc r=s through BR quadrant, rest sharp
  // Otherwise → square
  "classy-rounded": (x, y, n, s = 1) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 0.5 * s;
    const neighborsCount = +n.l + +n.r + +n.t + +n.b;

    if (neighborsCount === 0) return neighborShapes.classy(x, y, n, s);

    // TL free: BL → BR → TR → large arc r=s through TL → BL
    if (!n.l && !n.t)
      return `M ${f(cx - r)} ${f(cy + r)} L ${f(cx + r)} ${f(cy + r)} L ${f(cx + r)} ${f(cy - r)} A ${f(s)} ${f(s)} 0 0 0 ${f(cx - r)} ${f(cy + r)} Z`;

    // BR free: TR → TL → BL → large arc r=s through BR → TR
    if (!n.r && !n.b)
      return `M ${f(cx + r)} ${f(cy - r)} L ${f(cx - r)} ${f(cy - r)} L ${f(cx - r)} ${f(cy + r)} A ${f(s)} ${f(s)} 0 0 0 ${f(cx + r)} ${f(cy - r)} Z`;

    return neighborShapes.square(x, y, n, s);
  },
};
