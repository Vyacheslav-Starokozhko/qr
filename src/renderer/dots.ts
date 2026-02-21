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
  dots: (x, y, n, s = 1) => {
    const r = 0.5 * s;
    const cx = x + 0.5;
    const cy = y + 0.5;
    return `M ${f(cx - r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} A ${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
  },

  // 3. EXTRA-ROUNDED (Maximum rounding. Becomes a circle when no neighbors)
  "extra-rounded": (x, y, n, s = 1) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 0.5 * s; // Radius = half cell size

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

  // 4. ROUNDED (Moderate rounding. Radius smaller than half the cell)
  rounded: (x, y, n, s = 1) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 0.5 * s;
    const rad = 0.25 * s; // Half-radius for a softer squircle look

    let path = `M ${f(cx)} ${f(cy - r)}`;

    // Top-Right
    if (n.t || n.r) {
      path += ` L ${f(cx + r)} ${f(cy - r)} L ${f(cx + r)} ${f(cy)}`;
    } else {
      path += ` L ${f(cx + r - rad)} ${f(cy - r)} A ${f(rad)} ${f(rad)} 0 0 1 ${f(cx + r)} ${f(cy - r + rad)} L ${f(cx + r)} ${f(cy)}`;
    }
    // Bottom-Right
    if (n.b || n.r) {
      path += ` L ${f(cx + r)} ${f(cy + r)} L ${f(cx)} ${f(cy + r)}`;
    } else {
      path += ` L ${f(cx + r)} ${f(cy + r - rad)} A ${f(rad)} ${f(rad)} 0 0 1 ${f(cx + r - rad)} ${f(cy + r)} L ${f(cx)} ${f(cy + r)}`;
    }
    // Bottom-Left
    if (n.b || n.l) {
      path += ` L ${f(cx - r)} ${f(cy + r)} L ${f(cx - r)} ${f(cy)}`;
    } else {
      path += ` L ${f(cx - r + rad)} ${f(cy + r)} A ${f(rad)} ${f(rad)} 0 0 1 ${f(cx - r)} ${f(cy + r - rad)} L ${f(cx - r)} ${f(cy)}`;
    }
    // Top-Left
    if (n.t || n.l) {
      path += ` L ${f(cx - r)} ${f(cy - r)} L ${f(cx)} ${f(cy - r)}`;
    } else {
      path += ` L ${f(cx - r)} ${f(cy - r + rad)} A ${f(rad)} ${f(rad)} 0 0 1 ${f(cx - r + rad)} ${f(cy - r)} L ${f(cx)} ${f(cy - r)}`;
    }

    return path + " Z";
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

  // 6. CLASSY-ROUNDED (TL and BR rounded heavily, TR and BL rounded lightly)
  "classy-rounded": (x, y, n, s = 1) => {
    const cx = x + 0.5;
    const cy = y + 0.5;
    const r = 0.5 * s;
    const radSmall = 0.25 * s; // Light rounding for the "sharp" classy corners

    let path = `M ${f(cx)} ${f(cy - r)}`;

    // Top-Right (Light rounding if free)
    if (n.t || n.r) {
      path += ` L ${f(cx + r)} ${f(cy - r)} L ${f(cx + r)} ${f(cy)}`;
    } else {
      path += ` L ${f(cx + r - radSmall)} ${f(cy - r)} A ${f(radSmall)} ${f(radSmall)} 0 0 1 ${f(cx + r)} ${f(cy - r + radSmall)} L ${f(cx + r)} ${f(cy)}`;
    }

    // Bottom-Right (Heavy rounding if free)
    if (n.b || n.r) {
      path += ` L ${f(cx + r)} ${f(cy + r)} L ${f(cx)} ${f(cy + r)}`;
    } else {
      path += ` A ${f(r)} ${f(r)} 0 0 1 ${f(cx)} ${f(cy + r)}`;
    }

    // Bottom-Left (Light rounding if free)
    if (n.b || n.l) {
      path += ` L ${f(cx - r)} ${f(cy + r)} L ${f(cx - r)} ${f(cy)}`;
    } else {
      path += ` L ${f(cx - r + radSmall)} ${f(cy + r)} A ${f(radSmall)} ${f(radSmall)} 0 0 1 ${f(cx - r)} ${f(cy + r - radSmall)} L ${f(cx - r)} ${f(cy)}`;
    }

    // Top-Left (Heavy rounding if free)
    if (n.t || n.l) {
      path += ` L ${f(cx - r)} ${f(cy - r)} L ${f(cx)} ${f(cy - r)}`;
    } else {
      path += ` A ${f(r)} ${f(r)} 0 0 1 ${f(cx)} ${f(cy - r)}`;
    }

    return path + " Z";
  },
};
