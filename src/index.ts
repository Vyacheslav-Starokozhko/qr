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
} from "./types";
import { detectFrameInset } from "./frame-inset";
import { exportQR, FileExtension, ExportOptions } from "./export";
import { defaultOptions } from "./default";

export { exportQR, QRShapes };
// export type {
//   FileExtension,
//   ExportOptions,
//   Options,
//   QrPart,
//   QrShape,
//   ShapeType,
//   FigureShape,
//   QrImage,
//   QrImagePosition,
//   Gradient,
//   QRShapesType,
//   DotFigure,
//   CornerSquareFigure,
//   CornerDotFigure,
//   QrFrame,
// };

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
      const wMatch = context.match(/\bwidth="([\d.]+)"/);
      const hMatch = context.match(/\bheight="([\d.]+)"/);
      const w = wMatch ? parseFloat(wMatch[1]) : 1000;
      const h = hMatch ? parseFloat(hMatch[1]) : 1000;
      canvas = await svgToCanvas(context, w, h);
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
  canvas: HTMLCanvasElement;
}

async function svgToCanvas(
  svg: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
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
          const origin = getEyeOrigin(x, y, matrixSize);
          if (!origin) continue;
          const eyeKey = `sq-${origin.ex}-${origin.ey}`;
          if (!drawnEyes.has(eyeKey)) {
            drawnEyes.add(eyeKey);
            const drawer = cornerSquares[shapePath] ?? cornerSquares["square"];
            pathsD.cornerSquare += drawer(
              origin.ex + effectiveMargin,
              origin.ey + effectiveMargin,
              7,
            );
          }
        } else {
          // cornerDot — always draw as one 3×3 block per eye
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
        continue;
      }

      // --- Icon / custom-icon rendering (<use> + <symbol>) ---
      let drawSize = 1;

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

  // The inner QR SVG content (background + dots + eyes + logos)
  const qrContent = `
    <defs>${defsString}${clipPathDef}</defs>
    <g ${clipAttr}>
      <rect width="${fullSize}" height="${fullSize}" fill="${getBackgroundFill()}" ${rxAttr}/>
      ${config.backgroundOptions?.image ? `<image href="${config.backgroundOptions.image}" width="${fullSize}" height="${fullSize}" preserveAspectRatio="none" />` : ""}
      ${generateDotsLayer()}
      ${generateEyeLayer("cornerSquare", "grad-sq", config.cornersSquareOptions)}
      ${generateEyeLayer("cornerDot", "grad-dot", config.cornersDotOptions)}
      ${imagesSvg}
    </g>`;

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

    return finalizeResult(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frame.width} ${frame.height}" width="${svgW}" height="${svgH}">
      <!-- Frame image (behind everything) -->
      <image href="${frame.source}" x="0" y="0" width="${frame.width}" height="${frame.height}" preserveAspectRatio="xMidYMid slice" />
      <!-- QR code scaled into the inset area -->
      <g transform="translate(${inset.x}, ${inset.y}) scale(${scaleX.toFixed(6)}, ${scaleY.toFixed(6)})">
        ${qrContent}
      </g>
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
