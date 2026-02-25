import jsQR from "jsqr";
import { QRAnalyzer } from "./core/analyzer";
import { QRShapes, shapes } from "./renderer/icons";
import { neighborShapes, Neighbors } from "./renderer/dots";
import { cornerDots } from "./renderer/cornerDot";
import { cornerSquares } from "./renderer/cornerSquare";
import {
  Options,
  QrPartOptions,
  QrImage,
  QrImagePosition,
  Gradient,
  QRScanState,
  QrDecoration,
  QrDecorationBuiltinShape,
} from "./types";
import { detectFrameInset } from "./frame-inset";
import { exportQR, FileExtension, ExportOptions } from "./export";
import { defaultOptions } from "./default";

export { exportQR, QRShapes, FileExtension, ExportOptions };

export * from "./types";

// --- Helpers ---

type ZoneType = "dots" | "cornerSquare" | "cornerDot";

function getModuleZone(x: number, y: number, size: number): ZoneType {
  const inTL = x >= 0 && x < 7 && y >= 0 && y < 7;
  const inTR = x >= size - 7 && x < size && y >= 0 && y < 7;
  const inBL = x >= 0 && x < 7 && y >= size - 7 && y < size;

  if (inTL || inTR || inBL) {
    let localX = x;
    let localY = y;
    if (inTR) localX = x - (size - 7);
    if (inBL) localY = y - (size - 7);

    if (localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4) {
      return "cornerDot";
    }
    return "cornerSquare";
  }
  return "dots";
}

function getEyePositions(matrixSize: number, padding: number) {
  return [
    { id: "tl", x: padding, y: padding },
    { id: "tr", x: matrixSize - 7 + padding, y: padding },
    { id: "bl", x: padding, y: matrixSize - 7 + padding },
  ];
}

function isInnerEyeStart(x: number, y: number, size: number): boolean {
  const positions = [
    { x: 2, y: 2 },
    { x: size - 7 + 2, y: 2 },
    { x: 2, y: size - 7 + 2 },
  ];
  return positions.some((p) => p.x === x && p.y === y);
}

function isOuterEyeStart(x: number, y: number, size: number): boolean {
  const positions = [
    { x: 0, y: 0 },
    { x: size - 7, y: 0 },
    { x: 0, y: size - 7 },
  ];
  return positions.some((p) => p.x === x && p.y === y);
}

// Gradient generator bound to a specific zone (bx, by, bw, bh)
function generateGradientDef(
  id: string,
  grad: Gradient,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): string {
  const stops = grad.colorStops
    .map((s) => `<stop offset="${s.offset}" stop-color="${s.color}" />`)
    .join("");

  const angle = (grad.rotation || 0) * (Math.PI / 180);

  // Zone center
  const cx = bx + bw / 2;
  const cy = by + bh / 2;

  // Radius (half the diagonal)
  const r = Math.sqrt(bw * bw + bh * bh) / 2;

  const x1 = (cx - r * Math.cos(angle)).toFixed(2);
  const y1 = (cy - r * Math.sin(angle)).toFixed(2);
  const x2 = (cx + r * Math.cos(angle)).toFixed(2);
  const y2 = (cy + r * Math.sin(angle)).toFixed(2);

  return `
      <linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
        ${stops}
      </linearGradient>
    `;
}

function createSymbol(id: string, part: QrPartOptions): string {
  const shape = part.shape;
  if (!shape) return "";

  if (shape.type === "figure") {
    return "";
  }

  if (shape.type === "custom-icon" && shape.customPath) {
    return `
        <symbol id="${id}" viewBox="${shape.customViewBox || "0 0 24 24"}">
          <path d="${shape.customPath}" />
        </symbol>
      `;
  }

  if (shape.type === "icon" && shape.path) {
    const shapeEntry =
      shapes[shape.path as keyof typeof shapes] || shapes["inner-eye-square"];
    const d = shapeEntry.d;
    const viewBox = shape.viewBox || shapeEntry.viewBox || "0 0 24 24";
    return `
        <symbol id="${id}" viewBox="${viewBox}">
          <path d="${d}" />
        </symbol>
      `;
  }

  return "";
}

// --- Auto-layout for images ---

/** Internal image type with resolved flat x/y coordinates (in matrix modules). */
type ResolvedQrImage = Omit<QrImage, "position"> & { x: number; y: number };

// ─── Critical-zone constants ─────────────────────────────────────────────────
// Each finder pattern is 7×7 modules.  The 1-module-wide separator that
// surrounds it on the inner sides is also forbidden (QR spec requires it to be
// white and unobstructed). Together they form an 8×8 critical zone at every
// corner that images must never cover.
const EYE_SIZE = 7; // finder-pattern width/height in modules
const CRITICAL = 8; // finder + separator = hard exclusion boundary

/** Top-left origins of the 3 finder patterns (in matrix coordinates). */
function getEyeZones(matrixSize: number) {
  return [
    { id: "top-left", x: 0, y: 0 },
    { id: "top-right", x: matrixSize - EYE_SIZE, y: 0 },
    { id: "bottom-left", x: 0, y: matrixSize - EYE_SIZE },
  ];
}

/**
 * Returns true if a rectangle overlaps any critical zone
 * (finder pattern + its 1-module separator = CRITICAL × CRITICAL area).
 */
function overlapsEye(
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  matrixSize: number,
): boolean {
  for (const e of getEyeZones(matrixSize)) {
    if (
      rx < e.x + CRITICAL &&
      rx + rw > e.x &&
      ry < e.y + CRITICAL &&
      ry + rh > e.y
    )
      return true;
  }
  return false;
}

/**
 * Pushes a custom-positioned image out of every critical zone it overlaps.
 * A console.warn is emitted for each adjustment so the caller is aware.
 */
function clampImageFromEyes(
  img: ResolvedQrImage,
  imgIndex: number,
  matrixSize: number,
): ResolvedQrImage {
  let { x, y } = img;

  for (const e of getEyeZones(matrixSize)) {
    const overlapX = x < e.x + CRITICAL && x + img.width > e.x;
    const overlapY = y < e.y + CRITICAL && y + img.height > e.y;
    if (!overlapX || !overlapY) continue;

    // Find the axis with the smallest penetration depth and push out
    const opts = [
      { axis: "x" as const, dir: 1, depth: e.x + CRITICAL - x },
      { axis: "x" as const, dir: -1, depth: x + img.width - e.x },
      { axis: "y" as const, dir: 1, depth: e.y + CRITICAL - y },
      { axis: "y" as const, dir: -1, depth: y + img.height - e.y },
    ]
      .filter((o) => o.depth > 0)
      .sort((a, b) => a.depth - b.depth);

    if (!opts.length) continue;
    const fix = opts[0];
    const origX = x;
    const origY = y;

    if (fix.axis === "x") x = fix.dir > 0 ? e.x + CRITICAL : e.x - img.width;
    else y = fix.dir > 0 ? e.y + CRITICAL : e.y - img.height;

    console.warn(
      `[QR] images[${imgIndex}] overlaps the critical "${e.id}" zone ` +
        `(finder pattern + separator). ` +
        `Auto-adjusted: (${origX.toFixed(1)}, ${origY.toFixed(1)}) → (${x.toFixed(1)}, ${y.toFixed(1)}).`,
    );
  }

  return { ...img, x, y };
}

/**
 * Resolves every QrImage's position into a flat { x, y } coordinate pair.
 *
 * Safe zone layout (mirrors the diagram):
 *
 *   ┌──[CRIT]──┬──[extra-top]──┬──[CRIT]──┐
 *   │  TL eye  │  Safe Zone 2  │  TR eye  │
 *   ├──────────┼───────────────┤          │
 *   │[extra-   │               │[extra-   │
 *   │  left]   │  Safe Zone 1  │  right]  │
 *   │ Zone 2   │    (center)   │  Zone 4  │
 *   │          │               │          │
 *   ├──[CRIT]──┴──[extra-bot]──┴──────────┤
 *   │  BL eye  │  Safe Zone 2  │          │
 *   └──────────┴───────────────┴──────────┘
 *
 * Critical zone = finder pattern (7×7) + 1-module separator = CRITICAL (8)
 * from each occupied corner. Images are never placed inside these areas.
 *
 * Named positions:
 *  "center"        → Safe Zone 1: centred in the full matrix
 *  "top"           → upper quarter of the inner data zone (between top eyes and centre)
 *  "bottom"        → lower quarter of the inner data zone
 *  "left"          → left quarter of the inner data zone
 *  "right"         → right quarter of the inner data zone
 *  "extra-top"     → Safe Zone 2: top border strip, centred between TL and TR eyes;
 *                    image centred within the EYE_SIZE-module eye band vertically
 *  "extra-bottom"  → Safe Zone 2: bottom border strip, aligned with BL eye row;
 *                    image centred within the EYE_SIZE-module eye band vertically
 *  "extra-left"    → Safe Zone 2: left border strip, centred between TL and BL eyes;
 *                    image centred within the EYE_SIZE-module eye band horizontally
 *  "extra-right"   → Safe Zone 4: right border strip, aligned with TR eye column;
 *                    image centred within the EYE_SIZE-module eye band horizontally
 *  "custom"        → explicit x/y (auto-clamped out of critical zones with a warning)
 */
function resolveImagePositions(
  images: QrImage[],
  matrixSize: number,
): ResolvedQrImage[] {
  // Inner data zone — starts after finder + separator on each side
  const dataStart = CRITICAL; // = 8
  const dataEnd = matrixSize - CRITICAL;
  const dataSize = dataEnd - dataStart;
  const cx = matrixSize / 2;
  const cy = matrixSize / 2;

  /** Compute the top-left x/y for a named position type. */
  function namedCenter(
    type: NonNullable<Exclude<QrImagePosition, { type: "custom" }>["type"]>,
    w: number,
    h: number,
  ): { x: number; y: number } {
    switch (type) {
      // ── inner data-zone positions (Safe Zones 1, 3, 4) ──────────────────
      case "top":
        return { x: cx - w / 2, y: dataStart + dataSize * 0.25 - h / 2 };
      case "bottom":
        return { x: cx - w / 2, y: dataStart + dataSize * 0.75 - h / 2 };
      case "left":
        return { x: dataStart + dataSize * 0.25 - w / 2, y: cy - h / 2 };
      case "right":
        return { x: dataStart + dataSize * 0.75 - w / 2, y: cy - h / 2 };

      // ── border-strip positions (Safe Zone 2 / 4) ─────────────────────────
      //
      // Rules for "extra-*":
      //  • Parallel axis  (along the border): centred in the SAFE GAP between
      //    the two relevant critical zones: gap = [CRITICAL, matrixSize-CRITICAL].
      //    Centre = matrixSize/2.
      //  • Perpendicular axis (into the QR): centred within EYE_SIZE modules,
      //    clamped ≥ 0 so the image never sticks out of the QR boundary.
      //
      // extra-top  — top border, Safe Zone 2
      //   gap: x ∈ [CRITICAL, matrixSize-CRITICAL]  (between TL and TR)
      //   band: y ∈ [0, EYE_SIZE-1]
      case "extra-top":
        return {
          x: cx - w / 2,
          y: Math.max(0, (EYE_SIZE - h) / 2),
        };

      // extra-bottom — bottom border, Safe Zone 2
      //   gap: x ∈ [CRITICAL, matrixSize]  (BL eye on left, nothing on right)
      //         → use matrixSize/2 for visual symmetry; clamping handles BL
      //   band: y ∈ [matrixSize-EYE_SIZE, matrixSize-1]
      case "extra-bottom":
        return {
          x: cx - w / 2,
          y: matrixSize - EYE_SIZE + Math.max(0, (EYE_SIZE - h) / 2),
        };

      // extra-left — left border, Safe Zone 2
      //   gap: y ∈ [CRITICAL, matrixSize-CRITICAL]  (between TL and BL)
      //   band: x ∈ [0, EYE_SIZE-1]
      case "extra-left":
        return {
          x: Math.max(0, (EYE_SIZE - w) / 2),
          y: cy - h / 2,
        };

      // extra-right — right border, Safe Zone 4
      //   gap: y ∈ [CRITICAL, matrixSize]  (TR eye on top, nothing below)
      //         → use matrixSize/2 for visual symmetry; clamping handles TR
      //   band: x ∈ [matrixSize-EYE_SIZE, matrixSize-1]
      case "extra-right":
        return {
          x: matrixSize - EYE_SIZE + Math.max(0, (EYE_SIZE - w) / 2),
          y: cy - h / 2,
        };

      case "center":
      default:
        return { x: cx - w / 2, y: cy - h / 2 };
    }
  }

  return images.map((img, globalIdx) => {
    const pos = img.position;
    const {
      source,
      width,
      height,
      excludeDots,
      margin,
      opacity,
      preserveAspectRatio,
    } = img;
    const base = {
      source,
      width,
      height,
      excludeDots,
      margin,
      opacity,
      preserveAspectRatio,
    };

    if (pos?.type === "custom") {
      const resolved: ResolvedQrImage = { ...base, x: pos.x, y: pos.y };
      return overlapsEye(pos.x, pos.y, width, height, matrixSize)
        ? clampImageFromEyes(resolved, globalIdx, matrixSize)
        : resolved;
    }

    // Named auto-position (covers all non-custom variants)
    const type = (pos?.type ?? "center") as NonNullable<
      Exclude<QrImagePosition, { type: "custom" }>["type"]
    >;
    const { x, y } = namedCenter(type, width, height);
    return { ...base, x, y };
  });
}

// --- Figure helpers ---

function getNeighbors(
  x: number,
  y: number,
  matrix: import("./types").QRMatrix,
  size: number,
): Neighbors {
  return {
    t: y > 0 && matrix[y - 1][x]?.isDark,
    r: x < size - 1 && matrix[y][x + 1]?.isDark,
    b: y < size - 1 && matrix[y + 1][x]?.isDark,
    l: x > 0 && matrix[y][x - 1]?.isDark,
  };
}

/** Return the top-left corner of the eye (finder pattern) that contains (x, y). */
function getEyeOrigin(
  x: number,
  y: number,
  size: number,
): { ex: number; ey: number } | null {
  const origins = [
    { ex: 0, ey: 0 },
    { ex: size - 7, ey: 0 },
    { ex: 0, ey: size - 7 },
  ];
  for (const o of origins) {
    if (x >= o.ex && x < o.ex + 7 && y >= o.ey && y < o.ey + 7) return o;
  }
  return null;
}

// --- jsQR ---

/**
 * Scans an SVG string or an existing HTMLCanvasElement for a QR code.
 *
 * - **SVG string**: rendered to an off-screen canvas using the dimensions
 *   embedded in the SVG `width`/`height` attributes (fallback 1000×1000).
 * - **HTMLCanvasElement**: read directly via `getImageData`.
 *
 * The returned {@link QRScanState} always settles (`inProgress: false`).
 * Errors are surfaced through the `error` field rather than thrown.
 *
 * @example
 * const { svg } = await QRCodeGenerate({ data: "https://example.com" });
 * const { result, data, error } = await scanQR(svg);
 */
export async function scanQR(
  context: string | HTMLCanvasElement,
): Promise<QRScanState> {
  try {
    let canvas: HTMLCanvasElement;

    if (typeof context === "string") {
      if (typeof document === "undefined") {
        throw new Error(
          "scanQR() requires a browser environment (document is not defined)",
        );
      }
      const wMatch = context.match(/\bwidth="([\d.]+)"/);
      const hMatch = context.match(/\bheight="([\d.]+)"/);
      const w = wMatch ? parseFloat(wMatch[1]) : 1000;
      const h = hMatch ? parseFloat(hMatch[1]) : 1000;
      canvas = (await svgToCanvas(context, w, h)) as HTMLCanvasElement;
    } else {
      canvas = context;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2D context from canvas");

    const { width, height } = canvas;
    const imageData = ctx.getImageData(0, 0, width, height);
    const code = jsQR(imageData.data, width, height);

    if (code) {
      return { inProgress: false, result: true, error: "", data: code.data };
    }
    return {
      inProgress: false,
      result: false,
      error: "No QR code found in the image",
      data: null,
    };
  } catch (err) {
    return {
      inProgress: false,
      result: false,
      error: err instanceof Error ? err.message : String(err),
      data: null,
    };
  }
}

// --- Main Function ---

interface QRGenerateResultBase {
  matrixSize: number;
  eyeZones: QREyeZone[];
  getMaxPos: (
    imageWidth: number,
    imageHeight: number,
  ) => { maxX: number; maxY: number };
}

export interface QRGenerateResult extends QRGenerateResultBase {
  svg: string;
  /** Rendered canvas. `null` in non-browser environments (Node.js). */
  canvas: HTMLCanvasElement | null;
}

async function svgToCanvas(
  svg: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement | null> {
  if (typeof document === "undefined") return null;
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Could not get 2D context from canvas"));
      return;
    }
    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

// ─── Decoration helpers ───────────────────────────────────────────────────────

/** Mulberry32 seeded PRNG — returns values in [0, 1). */
function mulberry32(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function _f(n: number): string {
  return n.toFixed(3);
}

function _starPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  points: number,
): string {
  let d = "";
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    d += (i === 0 ? "M" : "L") + _f(x) + "," + _f(y);
  }
  return d + "Z";
}

/** Render a single built-in geometric decoration shape centered at (cx, cy). */
function _renderBuiltinDecoration(
  shape: QrDecorationBuiltinShape,
  cx: number,
  cy: number,
  size: number,
  color: string,
  opacity: number,
): string {
  const r = size / 2;
  const op = opacity < 1 ? ` opacity="${_f(opacity)}"` : "";
  const fill = `fill="${color}"`;

  switch (shape) {
    case "dot":
      return `<circle cx="${_f(cx)}" cy="${_f(cy)}" r="${_f(r)}" ${fill}${op}/>`;

    case "ring":
      return `<circle cx="${_f(cx)}" cy="${_f(cy)}" r="${_f(r * 0.65)}" fill="none" stroke="${color}" stroke-width="${_f(r * 0.5)}"${op}/>`;

    case "square":
      return `<rect x="${_f(cx - r)}" y="${_f(cy - r)}" width="${_f(size)}" height="${_f(size)}" ${fill}${op}/>`;

    case "diamond": {
      const d = `M${_f(cx)},${_f(cy - r)}L${_f(cx + r)},${_f(cy)}L${_f(cx)},${_f(cy + r)}L${_f(cx - r)},${_f(cy)}Z`;
      return `<path d="${d}" ${fill}${op}/>`;
    }

    case "star":
      return `<path d="${_starPath(cx, cy, r, r * 0.45, 5)}" ${fill}${op}/>`;

    case "star4":
      return `<path d="${_starPath(cx, cy, r, r * 0.35, 4)}" ${fill}${op}/>`;

    case "cross": {
      const t = r * 0.3;
      const d =
        `M${_f(cx - t)},${_f(cy - r)}H${_f(cx + t)}V${_f(cy - t)}` +
        `H${_f(cx + r)}V${_f(cy + t)}H${_f(cx + t)}V${_f(cy + r)}` +
        `H${_f(cx - t)}V${_f(cy + t)}H${_f(cx - r)}V${_f(cy - t)}H${_f(cx - t)}Z`;
      return `<path d="${d}" ${fill}${op}/>`;
    }

    case "triangle": {
      const d = `M${_f(cx)},${_f(cy - r)}L${_f(cx + r * 0.866)},${_f(cy + r * 0.5)}L${_f(cx - r * 0.866)},${_f(cy + r * 0.5)}Z`;
      return `<path d="${d}" ${fill}${op}/>`;
    }

    default:
      return `<circle cx="${_f(cx)}" cy="${_f(cy)}" r="${_f(r)}" ${fill}${op}/>`;
  }
}

/**
 * Generates an SVG `<g>` element containing all decoration layers scattered in
 * the empty margin space around the QR matrix.
 *
 * Decorations are rendered INSIDE the clip group, so they are always confined
 * to the QR background zone (including being hidden in rounded corners).
 *
 * Shape types supported:
 *  - Built-in strings: "dot" | "ring" | "square" | "diamond" | "star" | "star4" | "cross" | "triangle"
 *  - { type: "icon"; path }  — icon from the built-in shapes registry
 *  - { type: "custom-path"; d; viewBox? } — custom SVG path data
 *  - { type: "image"; source } — any image URL or base64 data-URI
 */
function generateDecorationsSvg(
  decorations: QrDecoration[],
  effectiveMargin: number,
  matrixSize: number,
  fullSize: number,
): string {
  if (!decorations || decorations.length === 0) return "";

  const qmStart = effectiveMargin;
  const qmEnd = effectiveMargin + matrixSize;

  let defsStr = "";
  let elemsStr = "";

  for (let layerIdx = 0; layerIdx < decorations.length; layerIdx++) {
    const dec = decorations[layerIdx];
    const shapeDef = dec.shape ?? "dot";
    const color = dec.color ?? "#000000";
    const size = dec.size ?? 0.6;
    const opacity = dec.opacity ?? 1;
    const seed = dec.seed ?? 42;
    const placement = dec.placement ?? "scatter";
    // Offset seed per layer so two layers with the same seed still differ
    const rng = mulberry32(seed ^ (layerIdx * 0x9e3779b9));
    const halfSize = size / 2;

    // ── Placement zones ──────────────────────────────────────────────────────
    const topBand = { x1: 0, y1: 0, x2: fullSize, y2: qmStart };
    const bottomBand = { x1: 0, y1: qmEnd, x2: fullSize, y2: fullSize };
    const leftBand = { x1: 0, y1: qmStart, x2: qmStart, y2: qmEnd };
    const rightBand = { x1: qmEnd, y1: qmStart, x2: fullSize, y2: qmEnd };
    const tlCorner = { x1: 0, y1: 0, x2: qmStart, y2: qmStart };
    const trCorner = { x1: qmEnd, y1: 0, x2: fullSize, y2: qmStart };
    const blCorner = { x1: 0, y1: qmEnd, x2: qmStart, y2: fullSize };
    const brCorner = { x1: qmEnd, y1: qmEnd, x2: fullSize, y2: fullSize };

    type Zone = { x1: number; y1: number; x2: number; y2: number };
    let zones: Zone[];
    switch (placement) {
      case "corners":
        zones = [tlCorner, trCorner, blCorner, brCorner];
        break;
      case "top":
        zones = [topBand];
        break;
      case "bottom":
        zones = [bottomBand];
        break;
      case "left":
        zones = [leftBand];
        break;
      case "right":
        zones = [rightBand];
        break;
      case "edges":
      case "scatter":
      default:
        zones = [topBand, bottomBand, leftBand, rightBand];
    }

    const validZones = zones.filter(
      (z) => z.x2 - z.x1 >= size && z.y2 - z.y1 >= size,
    );
    if (validZones.length === 0) continue;

    // Auto count: ~35 % area density
    const totalArea = validZones.reduce(
      (sum, z) => sum + (z.x2 - z.x1) * (z.y2 - z.y1),
      0,
    );
    const slotArea = size * 1.6 * (size * 1.6);
    const autoCount = Math.max(1, Math.round((totalArea / slotArea) * 0.35));
    const count = dec.count ?? Math.min(autoCount, 80);

    // ── Scatter placement ────────────────────────────────────────────────────
    const placed: { cx: number; cy: number }[] = [];
    const minDist = size * 1.3;
    const zoneAreas = validZones.map((z) => (z.x2 - z.x1) * (z.y2 - z.y1));
    const totalZoneArea = zoneAreas.reduce((a, b) => a + b, 0);
    let attempts = 0;
    const maxAttempts = count * 40;

    while (placed.length < count && attempts < maxAttempts) {
      attempts++;
      let pick = rng() * totalZoneArea;
      let zoneIdx = validZones.length - 1;
      for (let i = 0; i < zoneAreas.length; i++) {
        pick -= zoneAreas[i];
        if (pick <= 0) {
          zoneIdx = i;
          break;
        }
      }
      const zone = validZones[zoneIdx];
      const cx =
        zone.x1 + halfSize + rng() * Math.max(0, zone.x2 - zone.x1 - size);
      const cy =
        zone.y1 + halfSize + rng() * Math.max(0, zone.y2 - zone.y1 - size);

      if (
        placed.some((p) => {
          const dx = p.cx - cx;
          const dy = p.cy - cy;
          return Math.sqrt(dx * dx + dy * dy) < minDist;
        })
      )
        continue;
      placed.push({ cx, cy });
    }

    if (placed.length === 0) continue;

    const opAttr = opacity < 1 ? ` opacity="${_f(opacity)}"` : "";

    // ── Render based on shape type ───────────────────────────────────────────
    if (typeof shapeDef === "string") {
      // Built-in geometric shape
      for (const { cx, cy } of placed) {
        elemsStr += _renderBuiltinDecoration(
          shapeDef as QrDecorationBuiltinShape,
          cx,
          cy,
          size,
          color,
          opacity,
        );
      }
    } else if (shapeDef.type === "image") {
      // Raster / SVG image
      for (const { cx, cy } of placed) {
        elemsStr += `<image href="${shapeDef.source}" x="${_f(cx - halfSize)}" y="${_f(cy - halfSize)}" width="${_f(size)}" height="${_f(size)}" preserveAspectRatio="xMidYMid meet"${opAttr}/>`;
      }
    } else {
      // icon or custom-path — define a reusable <symbol> then <use> it
      const symId = `_dec_sym_${layerIdx}`;
      let symContent = "";
      let viewBox = "0 0 24 24";

      if (shapeDef.type === "icon") {
        const entry =
          shapes[shapeDef.path as keyof typeof shapes] ??
          shapes["inner-eye-square"];
        viewBox = entry.viewBox ?? "0 0 24 24";
        symContent = `<path d="${entry.d}" />`;
      } else {
        // custom-path
        viewBox = shapeDef.viewBox ?? "0 0 24 24";
        symContent = `<path d="${shapeDef.d}" />`;
      }

      defsStr += `<symbol id="${symId}" viewBox="${viewBox}">${symContent}</symbol>`;

      for (const { cx, cy } of placed) {
        elemsStr += `<use href="#${symId}" x="${_f(cx - halfSize)}" y="${_f(cy - halfSize)}" width="${_f(size)}" height="${_f(size)}" fill="${color}"${opAttr}/>`;
      }
    }
  }

  if (!elemsStr) return "";
  const defsBlock = defsStr ? `<defs>${defsStr}</defs>` : "";
  return `<g>${defsBlock}${elemsStr}</g>`;
}

// ─────────────────────────────────────────────────────────────────────────────

export async function QRCodeGenerate(
  options: Options,
): Promise<QRGenerateResult> {
  const config = {
    ...defaultOptions,
    ...options,
  };
  const analyzer = new QRAnalyzer(
    config.data ?? "",
    config.qrOptions?.errorCorrectionLevel || "H",
  );
  const matrix = analyzer.getMatrix();
  const matrixSize = matrix.length;
  const margin = config.margin ?? 4;

  // --- Effective margin: ensure corner modules stay inside the rounded clip ---
  // When borderRadius > 0, analytically compute the minimum margin so that the
  // corner module at (effectiveMargin, effectiveMargin) lies exactly on the clip
  // arc boundary. This avoids any scale transform and fully respects the user's
  // margin when it's already large enough.
  //
  //   Let p  = borderRadius / 100 (0–1)
  //       c  = 1 − 1/√2              (≈ 0.2929, the safe-inset ratio)
  //       k  = p × c
  //   minSafeMargin = k × matrixSize / (2 × (1 − k))
  //
  // Derivation: fullSize = matrixSize + 2m, rx = p × fullSize/2,
  // safeInset = rx × c = m  →  solved for m.
  const clampedBorderRadius =
    config.borderRadius != null
      ? Math.max(0, Math.min(100, config.borderRadius))
      : 0;
  const _c = 1 - 1 / Math.SQRT2; // ≈ 0.2929
  const _k = (clampedBorderRadius / 100) * _c;
  const minSafeMargin =
    _k > 0 && _k < 1 ? (_k * matrixSize) / (2 * (1 - _k)) : 0;
  const effectiveMargin = Math.max(margin, minSafeMargin);

  // Pre-build bounds (returned alongside svg)
  const _eyeZones: QREyeZone[] = getEyeZones(matrixSize).map((e) => ({
    ...e,
    width: 7,
    height: 7,
  }));
  const _getMaxPos = (iw: number, ih: number) => ({
    maxX: Math.max(0, matrixSize - iw),
    maxY: Math.max(0, matrixSize - ih),
  });
  const base: QRGenerateResultBase = {
    matrixSize,
    eyeZones: _eyeZones,
    getMaxPos: _getMaxPos,
  };
  const finalizeResult = async (svg: string): Promise<QRGenerateResult> => {
    const canvas = await svgToCanvas(svg, w, h);
    return { ...base, svg, canvas };
  };

  const fullSize = matrixSize + effectiveMargin * 2;
  const w = config.width ?? 1000;
  const h = config.height ?? 1000;

  const eyes = getEyePositions(matrixSize, effectiveMargin);
  const eyeFrameSize = 7; // Outer frame
  const eyeDotSize = 3; // Inner center (ball)

  // --- 1. SETUP DEFS ---
  let defsString = "";

  // A. Background Gradient (FIXED)
  if (config.backgroundOptions?.gradient) {
    defsString += generateGradientDef(
      "grad-bg",
      config.backgroundOptions.gradient,
      0,
      0,
      fullSize,
      fullSize,
    );
  }

  // B. Global Dots Gradient
  if (config.dotsOptions.gradient) {
    defsString += generateGradientDef(
      "grad-dots",
      config.dotsOptions.gradient,
      0,
      0,
      fullSize,
      fullSize,
    );
  }

  // C. Independent Eye Gradients (FIXED LOGIC)
  eyes.forEach((eye) => {
    // 1. Gradient for the frame (Corner Square) - size 7×7
    if (config.cornersSquareOptions.gradient) {
      defsString += generateGradientDef(
        `grad-sq-${eye.id}`,
        config.cornersSquareOptions.gradient,
        eye.x,
        eye.y,
        eyeFrameSize,
        eyeFrameSize,
      );
    }

    // 2. Gradient for the center (Corner Dot) - size 3×3 (FIXED)
    // The +2 offset keeps the gradient tight around the ball area
    if (config.cornersDotOptions.gradient) {
      defsString += generateGradientDef(
        `grad-dot-${eye.id}`,
        config.cornersDotOptions.gradient,
        eye.x + 2,
        eye.y + 2,
        eyeDotSize,
        eyeDotSize,
      );
    }
  });

  defsString += createSymbol("icon-dots", config.dotsOptions);
  defsString += createSymbol("icon-sq", config.cornersSquareOptions);
  defsString += createSymbol("icon-dot", config.cornersDotOptions);

  // --- 2. DRAW LOOP ---
  // <use> elements for icon/custom-icon shapes
  let uses = { dots: "", cornerSquare: "", cornerDot: "" };
  // Accumulated SVG path data for figure shapes
  let pathsD = { dots: "", cornerSquare: "", cornerDot: "" };

  const skipMatrix = Array(matrixSize)
    .fill(false)
    .map(() => Array(matrixSize).fill(false));
  // Tracks which eyes have already been drawn for figure-type eye zones
  const drawnEyes = new Set<string>();

  // Resolve auto-positions for images without explicit x/y
  const images = resolveImagePositions(config.images || [], matrixSize);

  for (let y = 0; y < matrixSize; y++) {
    for (let x = 0; x < matrixSize; x++) {
      if (skipMatrix[y][x]) continue;
      if (!matrix[y][x].isDark) continue;

      const isBlocked = images.some((img) => {
        if (!img.excludeDots) return false;
        const imgMargin = img.margin ?? 0;
        return (
          x >= img.x - 0.5 - imgMargin &&
          x <= img.x + img.width - 0.5 + imgMargin &&
          y >= img.y - 0.5 - imgMargin &&
          y <= img.y + img.height - 0.5 + imgMargin
        );
      });
      if (isBlocked) continue;

      const zone = getModuleZone(x, y, matrixSize);
      let partConfig: QrPartOptions;
      let symbolId = "";

      if (zone === "dots") {
        partConfig = config.dotsOptions;
        symbolId = "#icon-dots";
      } else if (zone === "cornerSquare") {
        partConfig = config.cornersSquareOptions;
        symbolId = "#icon-sq";
      } else {
        partConfig = config.cornersDotOptions;
        symbolId = "#icon-dot";
      }

      // Default to figure/square when no shape is specified
      const shapeType = partConfig.shape?.type ?? "figure";
      const shapePath = partConfig.shape?.path ?? "square";
      const scale = partConfig.scale ?? 1;

      // --- Figure rendering (math paths) ---
      if (shapeType === "figure") {
        if (zone === "dots") {
          const neighbors = getNeighbors(x, y, matrix, matrixSize);
          const drawer = neighborShapes[shapePath] ?? neighborShapes["square"];
          pathsD.dots += drawer(
            x + effectiveMargin,
            y + effectiveMargin,
            neighbors,
            scale,
          );
        } else if (zone === "cornerSquare") {
          if (partConfig.isSingle === false) {
            // Per-module: every dark pixel gets the same isolated shape (no neighbor blending)
            const drawer =
              neighborShapes[shapePath] ?? neighborShapes["square"];
            pathsD.cornerSquare += drawer(
              x + effectiveMargin,
              y + effectiveMargin,
              { t: false, r: false, b: false, l: false },
              scale,
            );
          } else {
            // Single shape per eye (isSingle: true or undefined)
            const origin = getEyeOrigin(x, y, matrixSize);
            if (!origin) continue;
            const eyeKey = `sq-${origin.ex}-${origin.ey}`;
            if (!drawnEyes.has(eyeKey)) {
              drawnEyes.add(eyeKey);
              const drawer =
                cornerSquares[shapePath] ?? cornerSquares["square"];
              pathsD.cornerSquare += drawer(
                origin.ex + effectiveMargin,
                origin.ey + effectiveMargin,
                7,
              );
            }
          }
        } else {
          // cornerDot
          if (partConfig.isSingle === false) {
            // Per-module: every dark pixel gets the same isolated shape (no neighbor blending)
            const drawer =
              neighborShapes[shapePath] ?? neighborShapes["square"];
            pathsD.cornerDot += drawer(
              x + effectiveMargin,
              y + effectiveMargin,
              { t: false, r: false, b: false, l: false },
              scale,
            );
          } else {
            // Single shape for the 3×3 ball (isSingle: true or undefined)
            const origin = getEyeOrigin(x, y, matrixSize);
            if (!origin) continue;
            const eyeKey = `dot-${origin.ex}-${origin.ey}`;
            if (!drawnEyes.has(eyeKey)) {
              drawnEyes.add(eyeKey);
              const drawer = cornerDots[shapePath] ?? cornerDots["square"];
              pathsD.cornerDot += drawer(
                origin.ex + 2 + effectiveMargin,
                origin.ey + 2 + effectiveMargin,
                3,
              );
            }
          }
        }
        continue;
      }

      // --- Icon / custom-icon rendering (<use> + <symbol>) ---
      let drawSize = 1;

      if (zone === "cornerSquare" && partConfig.isSingle) {
        if (!isOuterEyeStart(x, y, matrixSize)) continue;
        drawSize = 7;
        for (let dy = 0; dy < 7; dy++) {
          for (let dx = 0; dx < 7; dx++) {
            // Leave the inner 3×3 cornerDot area free so it renders separately
            if (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) continue;
            if (y + dy < matrixSize && x + dx < matrixSize)
              skipMatrix[y + dy][x + dx] = true;
          }
        }
      }

      if (zone === "cornerDot" && partConfig.isSingle) {
        if (!isInnerEyeStart(x, y, matrixSize)) continue;
        drawSize = 3;
        for (let dy = 0; dy < 3; dy++) {
          for (let dx = 0; dx < 3; dx++) {
            if (y + dy < matrixSize && x + dx < matrixSize)
              skipMatrix[y + dy][x + dx] = true;
          }
        }
      }

      const baseX = x + effectiveMargin;
      const baseY = y + effectiveMargin;

      const sw = drawSize * scale;
      const sh = drawSize * scale;
      const offX = (drawSize - sw) / 2;
      const offY = (drawSize - sh) / 2;

      uses[zone] +=
        `<use href="${symbolId}" x="${baseX + offX}" y="${baseY + offY}" width="${sw}" height="${sh}" />`;
    }
  }

  // --- 3. FINAL ASSEMBLY ---

  // Dots Layer (Global Gradient) — combines icon <use> elements and figure <path> data
  const generateDotsLayer = () => {
    const hasUses = !!uses.dots;
    const hasPaths = !!pathsD.dots;
    if (!hasUses && !hasPaths) return "";

    const fill = config.dotsOptions.gradient
      ? "url(#grad-dots)"
      : config.dotsOptions.color;

    const maskContent =
      (hasUses ? uses.dots : "") +
      (hasPaths ? `<path d="${pathsD.dots}" />` : "");

    return `
        <mask id="mask-dots">
            <rect width="${fullSize}" height="${fullSize}" fill="black" />
            <g fill="white">${maskContent}</g>
        </mask>
        <rect width="${fullSize}" height="${fullSize}" fill="${fill}" mask="url(#mask-dots)" />
      `;
  };

  // Eyes Layer (Independent Gradients) — combines icon <use> elements and figure <path> data
  const generateEyeLayer = (
    key: "cornerSquare" | "cornerDot",
    gradPrefix: string,
    partConfig: QrPartOptions,
  ) => {
    const hasUses = !!uses[key];
    const hasPaths = !!pathsD[key];
    if (!hasUses && !hasPaths) return "";

    const maskId = `mask-${key}`;
    const maskContent =
      (hasUses ? uses[key] : "") +
      (hasPaths ? `<path d="${pathsD[key]}" />` : "");

    const maskDef = `
        <mask id="${maskId}">
            <rect width="${fullSize}" height="${fullSize}" fill="black" />
            <g fill="white" shape-rendering="crispEdges">${maskContent}</g>
        </mask>
      `;

    let rects = "";
    eyes.forEach((eye) => {
      let fill = partConfig.color;
      if (partConfig.gradient) {
        fill = `url(#${gradPrefix}-${eye.id})`;
      }
      rects += `<rect x="${eye.x}" y="${eye.y}" width="${eyeFrameSize}" height="${eyeFrameSize}" fill="${fill}" mask="url(#${maskId})" />`;
    });
    return `<defs>${maskDef}</defs>${rects}`;
  };

  // Background Fill Logic (Color OR Gradient)
  const getBackgroundFill = () => {
    if (config.backgroundOptions?.gradient) return "url(#grad-bg)";
    return config.backgroundOptions?.color || "white"; // default white
  };

  // Images SVG (x/y are always resolved by resolveImagePositions)
  let imagesSvg = "";
  images.forEach((img) => {
    const imgX = img.x + effectiveMargin;
    const imgY = img.y + effectiveMargin;
    const par = img.preserveAspectRatio ?? "xMidYMid meet";
    const opacityAttr = img.opacity != null ? ` opacity="${img.opacity}"` : "";
    imagesSvg += `<image href="${img.source}" x="${imgX}" y="${imgY}" width="${img.width}" height="${img.height}" preserveAspectRatio="${par}"${opacityAttr} />`;
  });

  // Convert borderRadius from percentage (0–100) to SVG viewBox units.
  // 100% → rx = fullSize/2, which produces a perfect circle on a square QR.
  // effectiveMargin already guarantees corner modules are inside the arc, so
  // no additional scale transform is needed here.
  const borderRadius = (clampedBorderRadius / 100) * (fullSize / 2);
  const rxAttr = borderRadius > 0 ? `rx="${borderRadius.toFixed(3)}"` : "";
  const clipPathDef =
    borderRadius > 0
      ? `<clipPath id="qr-clip"><rect width="${fullSize}" height="${fullSize}" ${rxAttr} /></clipPath>`
      : "";
  const clipAttr = borderRadius > 0 ? `clip-path="url(#qr-clip)"` : "";

  // Decorations: shapes scattered in the empty margin space outside the QR matrix.
  // Rendered outside the clip group so they are visible in rounded-corner areas too.
  const decorationsSvg = generateDecorationsSvg(
    config.decorations ?? [],
    effectiveMargin,
    matrixSize,
    fullSize,
  );

  // The inner QR SVG content (background + decorations + dots + eyes + logos)
  // Decorations are placed inside the clip group so they are always confined
  // to the QR background zone (hidden outside the rounded-corner clip boundary).
  const qrContent = `
    <defs>${defsString}${clipPathDef}</defs>
    <g ${clipAttr}>
      <rect width="${fullSize}" height="${fullSize}" fill="${getBackgroundFill()}" ${rxAttr}/>
      ${config.backgroundOptions?.image ? `<image href="${config.backgroundOptions.image}" width="${fullSize}" height="${fullSize}" preserveAspectRatio="none" />` : ""}
      ${decorationsSvg}
      ${generateDotsLayer()}
      ${generateEyeLayer("cornerSquare", "grad-sq", config.cornersSquareOptions)}
      ${generateEyeLayer("cornerDot", "grad-dot", config.cornersDotOptions)}
      ${imagesSvg}
    </g>`;

  // --- Frame label renderer ---
  /**
   * Renders a QrLabel as SVG text (+ optional background rect + defs) placed
   * inside the outer frame coordinate space (frame pixels, not QR modules).
   *
   * Position semantics:
   *   top    – strip above QR inset, full frame width, bottom margin toward QR
   *   bottom – strip below QR inset, full frame width, top margin toward QR
   *   center – inside QR inset, text centred
   *   custom – label.x / label.y are the text centre point (frame px)
   *   auto   – picks top or bottom strip based on which has more vertical space;
   *            label width = 100 % of that strip's width
   *
   * Text is auto-sized (fontSize derived from zone height) unless label.fontSize
   * is provided.  textLength + lengthAdjust ensure the text fills the label width.
   */
  function renderFrameLabel(
    label: import("./types").QrLabel,
    inset: { x: number; y: number; width: number; height: number },
    frameW: number,
    frameH: number,
  ): string {
    if (!label.text) return "";
    const text = label.text;
    const isRounded = label.style === "rounded";
    const gapMargin = label.margin ?? 8;
    // For rounded arc text, default to "top" so omitting position still works
    const pos = label.position ?? (isRounded ? "top" : "bottom");
    // Pre-escape text so both flat and arc paths can use it
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    // ── Zone: area allocated for the label (frame-px coords) ──────────────────
    // For top / bottom / auto we use the full frame width so the label is
    // horizontally centred across the whole frame (common in real frame designs).
    let zoneX: number;
    let zoneY: number;
    let zoneW: number;
    let zoneH: number;
    // Margins on each vertical side (gap toward the QR edge)
    let mTop: number;
    let mBottom: number;
    // Where the text anchors within the zone:
    //   "qr"     → adjacent to the QR code (bottom of top-strip / top of bottom-strip)
    //   "center" → vertically centred (used for "center" and "custom")
    let vAnchor: "qr" | "center" = "qr";

    switch (pos) {
      case "top":
        zoneX = inset.x;
        zoneY = 0;
        zoneW = inset.width;
        zoneH = inset.y;
        mTop = gapMargin * 0.3;
        mBottom = gapMargin;
        vAnchor = "qr"; // snap to bottom of zone (near QR top edge)
        break;

      case "center":
        zoneX = inset.x;
        zoneY = inset.y;
        zoneW = inset.width;
        zoneH = inset.height;
        mTop = gapMargin;
        mBottom = gapMargin;
        vAnchor = "center";
        break;

      case "auto": {
        const topH = inset.y;
        const bottomH = frameH - (inset.y + inset.height);
        if (topH >= bottomH) {
          zoneX = inset.x;
          zoneY = 0;
          zoneW = inset.width;
          zoneH = topH;
          mTop = gapMargin * 0.3;
          mBottom = gapMargin;
          vAnchor = "qr"; // bottom of top-strip → adjacent to QR
        } else {
          zoneX = inset.x;
          zoneY = inset.y + inset.height;
          zoneW = inset.width;
          zoneH = bottomH;
          mTop = gapMargin;
          mBottom = gapMargin * 0.3;
          vAnchor = "qr"; // top of bottom-strip → adjacent to QR
        }
        break;
      }

      case "custom": {
        const customW = label.width ?? inset.width;
        const cx = label.x ?? inset.x + inset.width / 2;
        const cy = label.y ?? inset.y + inset.height + gapMargin + 20;
        const estimatedH = (label.fontSize ?? 24) * 1.4;
        zoneX = cx - customW / 2;
        zoneY = cy - estimatedH / 2;
        zoneW = customW;
        zoneH = estimatedH;
        mTop = 0;
        mBottom = 0;
        vAnchor = "center";
        break;
      }

      case "bottom":
      default:
        zoneX = inset.x;
        zoneY = inset.y + inset.height;
        zoneW = inset.width;
        zoneH = frameH - (inset.y + inset.height);
        mTop = gapMargin;
        mBottom = gapMargin * 0.3;
        vAnchor = "qr"; // snap to top of zone (near QR bottom edge)
        break;
    }

    // ── Available dimensions inside the zone ──────────────────────────────────
    const availH = zoneH - mTop - mBottom;
    const availW = zoneW - gapMargin * 2;
    if (availH <= 0 || availW <= 0) return "";

    // Label width: explicit value capped to available, or fill available
    const labelW = label.width != null ? Math.min(label.width, availW) : availW;

    // ── Font size ─────────────────────────────────────────────────────────────
    // Three independent upper bounds — take the minimum:
    //  1. frameH × 7 % — keeps the label proportional to the overall frame
    //     regardless of how tall the free zone happens to be
    //  2. availH × 0.5 — never taller than half the zone (padding room)
    //  3. labelW / (chars × 0.6) — estimated natural character width cap,
    //     prevents excessive horizontal compression on long strings
    // Average character width ≈ fontSize × 0.6 for a typical sans-serif.
    const CHAR_RATIO = 0.6;
    const maxFontByFrame = frameH * 0.07;
    const maxFontByHeight = availH * 0.5;
    const maxFontByWidth = labelW / (Math.max(1, text.length) * CHAR_RATIO);
    const fontSize =
      label.fontSize != null
        ? label.fontSize
        : Math.max(
            8,
            Math.min(maxFontByFrame, maxFontByHeight, maxFontByWidth),
          );

    // ── Text anchor point (centre of the text rect) ───────────────────────────
    let textCX: number;
    let textCY: number;

    textCX = zoneX + zoneW / 2;

    if (pos === "custom") {
      textCX = label.x ?? inset.x + inset.width / 2;
      textCY = label.y ?? inset.y + inset.height + gapMargin + fontSize / 2;
    } else if (vAnchor === "center") {
      // Vertically centred inside the zone
      textCY = zoneY + mTop + availH / 2;
    } else {
      // "qr" anchor: snap text to the QR-adjacent edge of the zone
      // top-strip  → text sits at the bottom (near QR top edge): zoneY + zoneH - mBottom - fontSize/2
      // bottom-strip → text sits at the top (near QR bottom edge): zoneY + mTop + fontSize/2
      const nearBottom = pos === "top" || (pos === "auto" && zoneY === 0);
      textCY = nearBottom
        ? zoneY + zoneH - mBottom - fontSize / 2
        : zoneY + mTop + fontSize / 2;
    }

    // ── Rounded: curved text along the QR circle arc ──────────────────────────
    // Arc radius is derived from the QR background circle so the text always
    // wraps around the QR at its boundary — no manual radius tuning needed.
    //
    // "top"    → CCW arc over the top  (ascenders face outward / up)
    // "bottom" → CW  arc under the bottom (letters concave-up)
    // "auto"   → picks top or bottom by available strip height
    // default (no position set) → top arc
    //
    // dominant-baseline="central" centers glyphs vertically ON the arc path
    // so text is perfectly centered inside the arc background band.
    if (isRounded && pos !== "center" && pos !== "custom") {
      // Arc wraps the QR background circle — center = QR inset centre,
      // radius = QR circle radius + gapMargin (just outside the QR background).
      const arcCX = inset.x + inset.width / 2;
      const arcCY = inset.y + inset.height / 2;
      const arcR = Math.min(inset.width, inset.height) / 2 + gapMargin;

      if (arcR <= 0) return "";

      // top / auto → arc over the top; bottom → arc under the bottom
      const isTopArc = pos !== "bottom";

      const ax1 = (arcCX - arcR).toFixed(2);
      const ax2 = (arcCX + arcR).toFixed(2);
      const acy = arcCY.toFixed(2);
      // top  → sweep=0 (CCW) — arc goes over the top of the frame circle
      // bottom → sweep=1 (CW) — arc goes under the bottom of the frame circle
      const sweep = isTopArc ? 0 : 1;
      const arcPath = `M ${ax1},${acy} A ${arcR.toFixed(2)} ${arcR.toFixed(2)} 0 0 ${sweep} ${ax2},${acy}`;

      // Unique path ID per document
      const arcId = `_larc_${Math.round(arcCX)}_${Math.round(arcCY)}_${isTopArc ? "t" : "b"}`;

      // Text fill (colour or gradient)
      const arcNatW = text.length * fontSize * CHAR_RATIO;
      let arcDefsStr = "";
      let arcTextFill: string;
      if (label.fontGradient) {
        const arcTextY = isTopArc
          ? arcCY - arcR - fontSize / 2
          : arcCY + arcR - fontSize / 2;
        arcDefsStr += generateGradientDef(
          "grad-arc-text",
          label.fontGradient,
          arcCX - arcNatW / 2,
          arcTextY,
          arcNatW,
          fontSize,
        );
        arcTextFill = "url(#grad-arc-text)";
      } else {
        arcTextFill = label.fontColor ?? "#000000";
      }

      // Optional background: thick stroked arc band centered on the path
      let arcBgStr = "";
      const bgStrokeW = (fontSize * 1.8).toFixed(2);
      if (label.fontBackgroundGradient) {
        arcDefsStr += generateGradientDef(
          "grad-arc-bg",
          label.fontBackgroundGradient,
          arcCX - arcR,
          arcCY - arcR,
          arcR * 2,
          arcR * 2,
        );
        arcBgStr = `<path d="${arcPath}" fill="none" stroke="url(#grad-arc-bg)" stroke-width="${bgStrokeW}" stroke-linecap="round"/>`;
      } else if (label.fontBackgroundColor) {
        arcBgStr = `<path d="${arcPath}" fill="none" stroke="${label.fontBackgroundColor}" stroke-width="${bgStrokeW}" stroke-linecap="round"/>`;
      }

      const textAttrs: string[] = [
        `font-size="${fontSize.toFixed(2)}"`,
        `font-family="${label.fontFamily ?? "sans-serif"}"`,
        // Centers glyphs vertically ON the arc path (inside the background band)
        `dominant-baseline="central"`,
        `fill="${arcTextFill}"`,
      ];
      if (label.fontWeight != null)
        textAttrs.push(`font-weight="${label.fontWeight}"`);
      if (label.fontStyle) textAttrs.push(`font-style="${label.fontStyle}"`);

      const arcDefsBlock = `<defs>${arcDefsStr}<path id="${arcId}" d="${arcPath}" fill="none"/></defs>`;
      const arcText = `<text ${textAttrs.join(" ")}><textPath href="#${arcId}" startOffset="50%" text-anchor="middle">${escaped}</textPath></text>`;
      return `${arcDefsBlock}${arcBgStr}${arcText}`;
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── textLength — overflow protection only, never stretch ──────────────────
    // Only applied when the estimated natural width exceeds labelW (compress to fit).
    // Short / medium text is centred at its natural width without distortion.
    const estimatedNaturalW = text.length * fontSize * CHAR_RATIO;
    const clampText = estimatedNaturalW > labelW;

    // ── Background rect ───────────────────────────────────────────────────────
    // Width: full zone width for strip positions (top/bottom/auto) so the
    // colour band spans edge-to-edge like a real frame label.
    // Height: always tight around the text (fontSize + vertical padding) —
    // never the full zone height, which could cover the whole frame image.
    const isStrip = pos === "top" || pos === "bottom" || pos === "auto";
    const bgPadY = fontSize * 0.2;
    const bgPadX = fontSize * 0.3;
    const bgX = isStrip ? zoneX : textCX - labelW / 2 - bgPadX;
    const bgY = textCY - fontSize / 2 - bgPadY;
    const bgW = isStrip ? zoneW : labelW + bgPadX * 2;
    const bgH = fontSize + bgPadY * 2;

    let defsStr = "";
    let bgStr = "";

    if (label.fontBackgroundGradient) {
      defsStr += generateGradientDef(
        "grad-label-bg",
        label.fontBackgroundGradient,
        bgX,
        bgY,
        bgW,
        bgH,
      );
      bgStr = `<rect x="${bgX.toFixed(2)}" y="${bgY.toFixed(2)}" width="${bgW.toFixed(2)}" height="${bgH.toFixed(2)}" fill="url(#grad-label-bg)" />`;
    } else if (label.fontBackgroundColor) {
      bgStr = `<rect x="${bgX.toFixed(2)}" y="${bgY.toFixed(2)}" width="${bgW.toFixed(2)}" height="${bgH.toFixed(2)}" fill="${label.fontBackgroundColor}" />`;
    }

    // ── Text fill (solid colour or gradient) ──────────────────────────────────
    const textGradW = clampText ? labelW : estimatedNaturalW;
    let textFill: string;
    if (label.fontGradient) {
      defsStr += generateGradientDef(
        "grad-label-text",
        label.fontGradient,
        textCX - textGradW / 2,
        textCY - fontSize / 2,
        textGradW,
        fontSize,
      );
      textFill = "url(#grad-label-text)";
    } else {
      textFill = label.fontColor ?? "#000000";
    }

    // ── Build <text> element ──────────────────────────────────────────────────
    const textAttrs: string[] = [
      `x="${textCX.toFixed(2)}"`,
      `y="${textCY.toFixed(2)}"`,
      `text-anchor="middle"`,
      `dominant-baseline="central"`,
      `font-size="${fontSize.toFixed(2)}"`,
      `font-family="${label.fontFamily ?? "sans-serif"}"`,
    ];
    if (label.fontWeight != null)
      textAttrs.push(`font-weight="${label.fontWeight}"`);
    if (label.fontStyle) textAttrs.push(`font-style="${label.fontStyle}"`);
    textAttrs.push(`fill="${textFill}"`);
    // Apply textLength only to compress overflowing text (never to expand short text)
    if (clampText) {
      textAttrs.push(`textLength="${labelW.toFixed(2)}"`);
      textAttrs.push(`lengthAdjust="spacingAndGlyphs"`);
    }

    const defsBlock = defsStr ? `<defs>${defsStr}</defs>` : "";
    return `${defsBlock}${bgStr}<text ${textAttrs.join(" ")}>${escaped}</text>`;
  }

  // --- Frame composition ---
  const frame = config.frame;

  if (frame) {
    // Resolve inset (where QR sits inside the frame), in frame pixels
    const userInset = frame.inset;
    const needsAutoPosition =
      !userInset || userInset.x == null || userInset.y == null;

    // Detect the hole in the frame whenever we need auto-positioning
    let detectedZone = needsAutoPosition
      ? await detectFrameInset(frame.source, frame.width, frame.height)
      : null;

    // Fallback detected zone: 80% centered
    if (needsAutoPosition && !detectedZone) {
      const fw = frame.width * 0.8;
      const fh = frame.height * 0.8;
      detectedZone = {
        x: (frame.width - fw) / 2,
        y: (frame.height - fh) / 2,
        width: fw,
        height: fh,
      };
    }

    // Final dimensions — prefer user-specified, else use detected
    const iw = userInset?.width ?? detectedZone!.width;
    const ih = userInset?.height ?? detectedZone!.height;

    // Final position — if x/y given use them; otherwise center within detected zone
    const ix = userInset?.x ?? detectedZone!.x + (detectedZone!.width - iw) / 2;
    const iy =
      userInset?.y ?? detectedZone!.y + (detectedZone!.height - ih) / 2;

    const inset = { x: ix, y: iy, width: iw, height: ih };

    // Output size: use frame dimensions unless overridden
    const svgW = config.width ?? frame.width;
    const svgH = config.height ?? frame.height;

    // Scale factor: map QR fullSize units → inset pixel area
    const scaleX = inset.width / fullSize;
    const scaleY = inset.height / fullSize;

    // Collect all labels: single `label` (backward compat) + `labels` array
    const allLabels = [
      ...(frame.label ? [frame.label] : []),
      ...(frame.labels ?? []),
    ];
    const labelSvg = allLabels
      .map((l) => renderFrameLabel(l, inset, frame.width, frame.height))
      .join("");

    return finalizeResult(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frame.width} ${frame.height}" width="${svgW}" height="${svgH}">
      <!-- Frame image (behind everything) -->
      <image href="${frame.source}" x="0" y="0" width="${frame.width}" height="${frame.height}" preserveAspectRatio="xMidYMid slice" />
      <!-- QR code scaled into the inset area -->
      <g transform="translate(${inset.x}, ${inset.y}) scale(${scaleX.toFixed(6)}, ${scaleY.toFixed(6)})">
        ${qrContent}
      </g>
      ${labelSvg}
    </svg>`);
  }

  // --- No frame: standard output ---
  return finalizeResult(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" width="${w}" height="${h}">
    ${qrContent}
  </svg>`);
}

// --- UI Utilities ---

export interface QREyeZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QRBounds {
  /** Size of the QR matrix in modules (e.g. 31 for a version-3 QR) */
  matrixSize: number;
  /** The 3 eye (finder pattern) zones in module coordinates */
  eyeZones: QREyeZone[];
  /**
   * Returns the maximum allowed top-left position for an image of the given size,
   * so it stays fully inside the QR area.
   *   maxX = matrixSize - imageWidth
   *   maxY = matrixSize - imageHeight
   * Use these as the upper bound for your x/y position inputs.
   */
  getMaxPos: (
    imageWidth: number,
    imageHeight: number,
  ) => { maxX: number; maxY: number };
}

/**
 * Returns bounds information for constraining image position inputs in a UI.
 *
 * @example
 * const { matrixSize, eyeZones, getMaxPos } = getQRBounds('https://example.com');
 * const { maxX, maxY } = getMaxPos(imageWidth, imageHeight);
 * // Use maxX / maxY as slider/input max values
 */
export function getQRBounds(
  data: string,
  errorCorrectionLevel: "L" | "M" | "Q" | "H" = "H",
): QRBounds {
  const analyzer = new QRAnalyzer(data, errorCorrectionLevel);
  const matrixSize = analyzer.getMatrix().length;

  const eyeZones: QREyeZone[] = getEyeZones(matrixSize).map((e) => ({
    ...e,
    width: 7,
    height: 7,
  }));

  return {
    matrixSize,
    eyeZones,
    getMaxPos: (imageWidth: number, imageHeight: number) => ({
      maxX: Math.max(0, matrixSize - imageWidth),
      maxY: Math.max(0, matrixSize - imageHeight),
    }),
  };
}
